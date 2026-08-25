/** Minimal läsare för det gamla binära Excelformatet (.xls, BIFF8 – Excel
 *  97–2003), som flera banker fortfarande exporterar kontoutdrag i. Utan
 *  beroenden, i samma anda som xlsx-läsaren: filen är en Compound File
 *  (CFB-container) med en "Workbook"-ström av BIFF-poster, och bara de
 *  posttyper ett kontoutdrag behöver stöds. Läser första kalkylbladet. */

import type { Cell } from './xlsx'
import { BUILTIN_DATE_FMT, isDateCode, serialToISO } from './xlsx'

const invalid = () => new Error('Filen är inte en giltig Excelfil (.xls)')

/* ---------- CFB-containern ---------- */

const FREE = 0xffffffff
const ENDOFCHAIN = 0xfffffffe

/** Följer en sektorkedja genom FAT:en och slår ihop sektorernas innehåll. */
function readChain(
  bytes: Uint8Array,
  fat: Uint32Array,
  start: number,
  sectorSize: number,
  offsetOf: (sector: number) => number,
): Uint8Array {
  const parts: Uint8Array[] = []
  let sector = start
  let guard = 0
  while (sector !== ENDOFCHAIN && sector !== FREE && guard++ < 1 << 20) {
    const off = offsetOf(sector)
    parts.push(bytes.subarray(off, off + sectorSize))
    sector = fat[sector] ?? ENDOFCHAIN
  }
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let pos = 0
  for (const p of parts) {
    out.set(p, pos)
    pos += p.length
  }
  return out
}

/** Letar upp arbetsboksströmmen ("Workbook"/"Book") i containern. */
function workbookStream(buf: ArrayBuffer): Uint8Array {
  const bytes = new Uint8Array(buf)
  const view = new DataView(buf)
  const sectorSize = 1 << view.getUint16(30, true)
  const miniSize = 1 << view.getUint16(32, true)
  const dirStart = view.getUint32(48, true)
  const miniCutoff = view.getUint32(56, true)
  const miniFatStart = view.getUint32(60, true)
  const difatStart = view.getUint32(68, true)
  const sectorOffset = (sector: number) => 512 + sector * sectorSize

  // FAT:en pekas ut av DIFAT: 109 poster i headern, resten i kedjade sektorer.
  const fatSectors: number[] = []
  for (let i = 0; i < 109; i++) {
    const s = view.getUint32(76 + i * 4, true)
    if (s !== FREE && s !== ENDOFCHAIN) fatSectors.push(s)
  }
  let difat = difatStart
  let guard = 0
  while (difat !== ENDOFCHAIN && difat !== FREE && guard++ < 4096) {
    const off = sectorOffset(difat)
    for (let i = 0; i < sectorSize / 4 - 1; i++) {
      const s = view.getUint32(off + i * 4, true)
      if (s !== FREE && s !== ENDOFCHAIN) fatSectors.push(s)
    }
    difat = view.getUint32(off + sectorSize - 4, true)
  }
  const fat = new Uint32Array((fatSectors.length * sectorSize) / 4)
  fatSectors.forEach((s, i) => {
    const off = sectorOffset(s)
    for (let j = 0; j < sectorSize / 4; j++) fat[i * (sectorSize / 4) + j] = view.getUint32(off + j * 4, true)
  })

  const dir = readChain(bytes, fat, dirStart, sectorSize, sectorOffset)
  const dirView = new DataView(dir.buffer, dir.byteOffset, dir.byteLength)
  let rootStart = -1
  let found: { start: number; size: number } | null = null
  for (let e = 0; e + 128 <= dir.length; e += 128) {
    const nameLen = dirView.getUint16(e + 64, true)
    if (nameLen === 0 || nameLen > 64) continue
    let name = ''
    for (let i = 0; i < nameLen - 2; i += 2) name += String.fromCharCode(dirView.getUint16(e + i, true))
    const type = dir[e + 66]
    if (type === 5) rootStart = dirView.getUint32(e + 116, true)
    const lower = name.toLowerCase()
    if (type === 2 && (lower === 'workbook' || lower === 'book') && !found)
      found = { start: dirView.getUint32(e + 116, true), size: dirView.getUint32(e + 120, true) }
  }
  if (!found) throw invalid()

  if (found.size >= miniCutoff) {
    return readChain(bytes, fat, found.start, sectorSize, sectorOffset).subarray(0, found.size)
  }
  // Små strömmar ligger i ministrömmen: rotpostens kedja är behållaren och
  // minifat:en (64-bytesektorer) pekar inom den.
  if (rootStart < 0) throw invalid()
  const miniContainer = readChain(bytes, fat, rootStart, sectorSize, sectorOffset)
  const miniFatBytes = readChain(bytes, fat, miniFatStart, sectorSize, sectorOffset)
  const miniFat = new Uint32Array(miniFatBytes.length / 4)
  const mfView = new DataView(miniFatBytes.buffer, miniFatBytes.byteOffset, miniFatBytes.byteLength)
  for (let i = 0; i < miniFat.length; i++) miniFat[i] = mfView.getUint32(i * 4, true)
  return readChain(miniContainer, miniFat, found.start, miniSize, (s) => s * miniSize).subarray(0, found.size)
}

/* ---------- BIFF-poster ---------- */

interface BiffRecord {
  opcode: number
  data: Uint8Array
}

function* records(stream: Uint8Array, from: number): Generator<BiffRecord> {
  const view = new DataView(stream.buffer, stream.byteOffset, stream.byteLength)
  let pos = from
  while (pos + 4 <= stream.length) {
    const opcode = view.getUint16(pos, true)
    const size = view.getUint16(pos + 2, true)
    if (pos + 4 + size > stream.length) return
    yield { opcode, data: stream.subarray(pos + 4, pos + 4 + size) }
    pos += 4 + size
  }
}

/** Läsare över SST-postens data plus dess CONTINUE-poster. Räknare och
 *  formateringsdata läses rakt över segmentgränser, men teckendata som
 *  fortsätter i ett nytt segment föregås av en ny flaggbyte – det är den
 *  detaljen som gör SST till formatets krångligaste del. */
class SegmentReader {
  private si = 0
  private pos = 0
  constructor(private segs: Uint8Array[]) {}

  private get seg(): Uint8Array {
    return this.segs[this.si]
  }

  get atEnd(): boolean {
    return this.si >= this.segs.length || (this.si === this.segs.length - 1 && this.pos >= this.seg.length)
  }

  private hop() {
    while (this.si < this.segs.length && this.pos >= this.seg.length) {
      this.si++
      this.pos = 0
    }
  }

  u8(): number {
    this.hop()
    if (this.si >= this.segs.length) throw invalid()
    return this.seg[this.pos++]
  }

  u16(): number {
    return this.u8() | (this.u8() << 8)
  }

  u32(): number {
    return (this.u16() | (this.u16() << 16)) >>> 0
  }

  skip(n: number) {
    while (n > 0) {
      this.hop()
      if (this.si >= this.segs.length) return
      const take = Math.min(n, this.seg.length - this.pos)
      this.pos += take
      n -= take
    }
  }

  /** XLUnicodeRichExtendedString – strängformatet i SST. */
  string(): string {
    const cch = this.u16()
    let flags = this.u8()
    const richCount = flags & 0x08 ? this.u16() : 0
    const extSize = flags & 0x04 ? this.u32() : 0
    let out = ''
    let remaining = cch
    while (remaining > 0) {
      this.hop()
      if (this.si >= this.segs.length) throw invalid()
      // Teckendata som börjar i ett nytt segment föregås av en ny flaggbyte.
      // (Ett segments början kan bara nås här via en CONTINUE-gräns: i första
      // segmentet står alltid cch/flaggor före tecknen.)
      if (this.pos === 0 && this.si > 0) flags = this.u8()
      const wide = flags & 0x01
      const avail = this.seg.length - this.pos
      const take = Math.min(remaining, wide ? avail >> 1 : avail)
      if (take === 0) {
        // Tecknet ryms inte i segmentet – fortsätt i nästa.
        this.pos = this.seg.length
        continue
      }
      for (let i = 0; i < take; i++)
        out += String.fromCharCode(wide ? this.u8() | (this.u8() << 8) : this.seg[this.pos++])
      remaining -= take
    }
    this.skip(richCount * 4 + extSize)
    return out
  }
}

/** RK-tal: 30 bitar + flaggor för heltal och /100. */
function rkValue(rk: number): number {
  let v: number
  if (rk & 0x02) {
    v = rk >> 2
  } else {
    const dv = new DataView(new ArrayBuffer(8))
    dv.setUint32(4, rk & 0xfffffffc, true)
    v = dv.getFloat64(0, true)
  }
  return rk & 0x01 ? v / 100 : v
}

/* ---------- Arbetsboken ---------- */

/** Läser första kalkylbladet i en .xls-fil till samma cellmatris som
 *  xlsx-läsaren, med datumformaterade tal normaliserade till 'YYYY-MM-DD'. */
export function parseXls(buf: ArrayBuffer): Cell[][] {
  const stream = workbookStream(buf)
  const view = new DataView(stream.buffer, stream.byteOffset, stream.byteLength)

  // Globals-substream: format, XF-stilar, delade strängar, bladkatalog.
  const formats = new Map<number, string>()
  const xfFormats: number[] = []
  let sst: string[] = []
  let sheetStart = -1
  let epoch1904 = false
  let sstSegs: Uint8Array[] | null = null
  let sstCount = 0
  for (const rec of records(stream, 0)) {
    if (sstSegs && rec.opcode !== 0x003c) {
      sst = readSst(sstSegs, sstCount)
      sstSegs = null
    }
    if (rec.opcode === 0x0809) {
      // BOF: bara BIFF8 har unicode-strängar; äldre versioner avvisas begripligt.
      const version = rec.data.length >= 2 ? rec.data[0] | (rec.data[1] << 8) : 0
      if (version !== 0x0600)
        throw new Error('Filen är i ett för gammalt Excelformat – öppna den i Excel och spara som .xlsx')
    } else if (rec.opcode === 0x0022) {
      epoch1904 = (rec.data[0] & 1) === 1
    } else if (rec.opcode === 0x041e) {
      // FORMAT: id + formatkod som XLUnicodeString.
      const id = rec.data[0] | (rec.data[1] << 8)
      formats.set(id, new SegmentReader([rec.data.subarray(2)]).string())
    } else if (rec.opcode === 0x00e0) {
      xfFormats.push(rec.data[2] | (rec.data[3] << 8))
    } else if (rec.opcode === 0x00fc) {
      sstCount = rec.data[4] | (rec.data[5] << 8) | (rec.data[6] << 16) | (rec.data[7] << 24)
      sstSegs = [rec.data.subarray(8)]
    } else if (rec.opcode === 0x003c) {
      sstSegs?.push(rec.data)
    } else if (rec.opcode === 0x0085) {
      const offset = rec.data[0] | (rec.data[1] << 8) | (rec.data[2] << 16) | (rec.data[3] << 24)
      if (sheetStart < 0) sheetStart = offset
    } else if (rec.opcode === 0x000a) {
      break
    }
  }
  if (sheetStart < 0 || sheetStart >= stream.length) throw invalid()

  const dateXf = new Set<number>()
  xfFormats.forEach((id, i) => {
    const code = formats.get(id)
    if (BUILTIN_DATE_FMT.has(id) || (code !== undefined && isDateCode(code))) dateXf.add(i)
  })

  // Bladets substream: cellposterna.
  const rows: Cell[][] = []
  const put = (r: number, c: number, xf: number, num: number | null, str?: string) => {
    const row = (rows[r] ??= [])
    if (str !== undefined) row[c] = str
    else if (num !== null) row[c] = dateXf.has(xf) && num > 0 ? serialToISO(num, epoch1904) : num
  }
  let pendingString: { r: number; c: number } | null = null
  for (const rec of records(stream, sheetStart)) {
    const d = rec.data
    const base = d.byteOffset - stream.byteOffset
    if (rec.opcode === 0x000a) break
    if (rec.opcode === 0x00fd && d.length >= 10) {
      // LABELSST: delad sträng.
      const isst = view.getUint32(base + 6, true)
      put(view.getUint16(base, true), view.getUint16(base + 2, true), 0, null, sst[isst] ?? '')
    } else if (rec.opcode === 0x0203 && d.length >= 14) {
      // NUMBER: IEEE-double.
      put(
        view.getUint16(base, true),
        view.getUint16(base + 2, true),
        view.getUint16(base + 4, true),
        view.getFloat64(base + 6, true),
      )
    } else if (rec.opcode === 0x027e && d.length >= 10) {
      // RK: komprimerat tal.
      put(
        view.getUint16(base, true),
        view.getUint16(base + 2, true),
        view.getUint16(base + 4, true),
        rkValue(view.getUint32(base + 6, true)),
      )
    } else if (rec.opcode === 0x00bd && d.length >= 12) {
      // MULRK: flera RK-tal på samma rad.
      const r = view.getUint16(base, true)
      const colFirst = view.getUint16(base + 2, true)
      const n = (d.length - 6) / 6
      for (let i = 0; i < n; i++) {
        const xf = view.getUint16(base + 4 + i * 6, true)
        put(r, colFirst + i, xf, rkValue(view.getUint32(base + 6 + i * 6, true)))
      }
    } else if (rec.opcode === 0x0006 && d.length >= 14) {
      // FORMULA: cachat resultat; strängresultat kommer i en STRING-post efter.
      const r = view.getUint16(base, true)
      const c = view.getUint16(base + 2, true)
      const xf = view.getUint16(base + 4, true)
      if (d[12] === 0xff && d[13] === 0xff) {
        if (d[6] === 0) pendingString = { r, c }
      } else put(r, c, xf, view.getFloat64(base + 6, true))
    } else if (rec.opcode === 0x0207 && pendingString) {
      put(pendingString.r, pendingString.c, 0, null, new SegmentReader([d]).string())
      pendingString = null
    }
  }
  // Gör matrisen tät: fyll hål med null så att raderna kan itereras enkelt.
  const result: Cell[][] = []
  for (const row of rows) {
    if (!row) {
      result.push([])
      continue
    }
    const dense: Cell[] = []
    for (let i = 0; i < row.length; i++) dense.push(row[i] ?? null)
    result.push(dense)
  }
  return result
}

function readSst(segs: Uint8Array[], count: number): string[] {
  const reader = new SegmentReader(segs)
  const out: string[] = []
  try {
    for (let i = 0; i < count && !reader.atEnd; i++) out.push(reader.string())
  } catch {
    // En trasig svans fäller inte strängarna som redan lästs.
  }
  return out
}
