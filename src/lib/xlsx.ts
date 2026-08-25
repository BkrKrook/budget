/** Minimal .xlsx-läsare utan beroenden, för kontoutdragsimporten. Läser första
 *  kalkylbladet till en matris. Zip-posterna packas upp med webbläsarens
 *  inbyggda DecompressionStream och XML:en tolkas med tåliga reguljära uttryck
 *  – Excel-XML är maskingenererad och regelbunden, så en full XML-parser behövs
 *  inte. Datumformaterade celler normaliseras till 'YYYY-MM-DD'. */

import type { Cell } from './excel'
import { BUILTIN_DATE_FMT, isDateCode, serialToISO } from './excel'

const td = new TextDecoder()

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** Packar upp zip-arkivets XML-filer via centralkatalogen i slutet av filen. */
async function unzip(buf: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const view = new DataView(buf)
  const bytes = new Uint8Array(buf)
  // End of central directory: sök signaturen bakifrån (zip-kommentaren kan
  // skjuta den upp till 64 kB från slutet).
  let eocd = -1
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 22 - 65535); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('Filen är inte en giltig Excelfil (.xlsx)')
  const count = view.getUint16(eocd + 10, true)
  let off = view.getUint32(eocd + 16, true)
  const files = new Map<string, Uint8Array>()
  for (let i = 0; i < count; i++) {
    if (view.getUint32(off, true) !== 0x02014b50) break
    const method = view.getUint16(off + 10, true)
    // Storlekarna läses ur centralkatalogen: den lokala rubriken kan ange 0
    // och skjuta upp dem till en data descriptor efter innehållet.
    const compressedSize = view.getUint32(off + 20, true)
    const nameLen = view.getUint16(off + 28, true)
    const extraLen = view.getUint16(off + 30, true)
    const commentLen = view.getUint16(off + 32, true)
    const localOff = view.getUint32(off + 42, true)
    const name = td.decode(bytes.subarray(off + 46, off + 46 + nameLen))
    off += 46 + nameLen + extraLen + commentLen
    // Bara XML-delarna behövs – hoppa över ev. bilder m.m.
    if (!/\.(xml|rels)$/.test(name)) continue
    const localNameLen = view.getUint16(localOff + 26, true)
    const localExtraLen = view.getUint16(localOff + 28, true)
    const start = localOff + 30 + localNameLen + localExtraLen
    const data = bytes.subarray(start, start + compressedSize)
    files.set(name, method === 8 ? await inflate(data) : data.slice())
  }
  return files
}

const fileText = (files: Map<string, Uint8Array>, name: string): string | undefined => {
  const f = files.get(name)
  return f ? td.decode(f) : undefined
}

/** Attributvärde ur en tagg eller attributsträng; xlsx citerar alltid med ".
 *  Regexparna cachas per attributnamn – attr anropas per cell i arkloopen. */
const attrRegexps = new Map<string, RegExp>()
function attr(s: string, name: string): string | undefined {
  let rx = attrRegexps.get(name)
  if (!rx) {
    rx = new RegExp(`(?:^|\\s)${name}="([^"]*)"`)
    attrRegexps.set(name, rx)
  }
  return s.match(rx)?.[1]
}

function decodeXml(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (_, e: string) => {
    if (e === 'amp') return '&'
    if (e === 'lt') return '<'
    if (e === 'gt') return '>'
    if (e === 'quot') return '"'
    if (e === 'apos') return "'"
    const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
    return Number.isFinite(code) ? String.fromCodePoint(code) : ''
  })
}

/** En delad sträng kan bestå av flera formaterade <t>-bitar – slå ihop dem. */
function textRuns(xml: string): string {
  let out = ''
  for (const m of xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) out += decodeXml(m[1])
  return out
}

function parseSharedStrings(xml: string): string[] {
  const out: string[] = []
  for (const m of xml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)) out.push(textRuns(m[1]))
  return out
}

/** Vilka cellstilar (index i cellXfs) som visar datum. */
function parseDateStyles(xml: string | undefined): Set<number> {
  const dateStyles = new Set<number>()
  if (!xml) return dateStyles
  const custom = new Map<number, string>()
  for (const m of xml.matchAll(/<numFmt\s[^>]*>/g)) {
    const id = attr(m[0], 'numFmtId')
    const code = attr(m[0], 'formatCode')
    if (id && code) custom.set(Number(id), decodeXml(code))
  }
  const cellXfs = xml.match(/<cellXfs(?:\s[^>]*)?>([\s\S]*?)<\/cellXfs>/)
  if (!cellXfs) return dateStyles
  let index = 0
  for (const m of cellXfs[1].matchAll(/<xf\b[^>]*>/g)) {
    const id = Number(attr(m[0], 'numFmtId') ?? 0)
    const code = custom.get(id)
    if (BUILTIN_DATE_FMT.has(id) || (code !== undefined && isDateCode(code))) dateStyles.add(index)
    index++
  }
  return dateStyles
}

/** Sökväg till första kalkylbladet, via workbookens relationsfil. */
function firstSheetPath(workbookXml: string, relsXml: string | undefined): string {
  const sheetTag = workbookXml.match(/<sheet\s[^>]*>/)?.[0]
  const rid = sheetTag && attr(sheetTag, 'r:id')
  if (relsXml && rid) {
    for (const m of relsXml.matchAll(/<Relationship\s[^>]*>/g)) {
      if (attr(m[0], 'Id') !== rid) continue
      let target = attr(m[0], 'Target')
      if (!target) break
      target = target.replace(/^\//, '')
      return target.startsWith('xl/') ? target : `xl/${target}`
    }
  }
  return 'xl/worksheets/sheet1.xml'
}

/** Kolumnbokstäverna i en cellreferens ('BC12') → 0-baserat kolumnindex. */
function colIndex(ref: string): number {
  let n = 0
  for (let i = 0; i < ref.length; i++) {
    const c = ref.charCodeAt(i)
    if (c < 65 || c > 90) break
    n = n * 26 + (c - 64)
  }
  return Math.max(0, n - 1)
}

/** Läser första kalkylbladet till en matris med rader av celler. */
export async function parseXlsx(buf: ArrayBuffer): Promise<Cell[][]> {
  const files = await unzip(buf)
  const workbookXml = fileText(files, 'xl/workbook.xml')
  if (!workbookXml) throw new Error('Filen är inte en giltig Excelfil (.xlsx)')
  const sheetXml = fileText(files, firstSheetPath(workbookXml, fileText(files, 'xl/_rels/workbook.xml.rels')))
  if (!sheetXml) throw new Error('Inget kalkylblad hittades i filen')
  const shared = parseSharedStrings(fileText(files, 'xl/sharedStrings.xml') ?? '')
  const dateStyles = parseDateStyles(fileText(files, 'xl/styles.xml'))
  const epoch1904 = /date1904="(1|true)"/.test(workbookXml)

  const rows: Cell[][] = []
  for (const rowMatch of sheetXml.matchAll(/<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g)) {
    const row: Cell[] = []
    let nextCol = 0
    for (const m of rowMatch[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = m[1]
      const inner = m[2] ?? ''
      const ref = attr(attrs, 'r')
      const col = ref ? colIndex(ref) : nextCol
      nextCol = col + 1
      const type = attr(attrs, 't') ?? 'n'
      let value: Cell = null
      if (type === 'inlineStr') {
        value = textRuns(inner)
      } else {
        const v = inner.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/)?.[1]
        if (v === undefined || type === 'e') value = null
        else if (type === 's') value = shared[Number(v)] ?? ''
        else if (type === 'str') value = decodeXml(v)
        else if (type === 'b') value = v === '1' ? 'SANT' : 'FALSKT'
        else {
          const num = Number(v)
          const style = attr(attrs, 's')
          if (!Number.isFinite(num)) value = decodeXml(v)
          else if (style !== undefined && dateStyles.has(Number(style)) && num > 0)
            value = serialToISO(num, epoch1904)
          else value = num
        }
      }
      row[col] = value
    }
    for (let i = 0; i < row.length; i++) if (row[i] === undefined) row[i] = null
    rows.push(row)
  }
  return rows
}
