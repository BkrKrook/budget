/** Gissar kategori för importerade kontoutdragsrader utifrån transaktions-
 *  texten. Reglerna pekar på standardkategoriernas id:n i data/defaults.ts –
 *  håll dem i synk: en regel vars kategori tagits bort faller tyst vidare
 *  till nästa träff och sist till Övrigt. Gissningen är ett förslag som
 *  användaren granskar, så den behöver vara god men inte perfekt. */

import type { Category, TxType } from '../types'

const KEYWORD_RULES: readonly (readonly [RegExp, string])[] = [
  // Butiksnamn dyker ofta upp utan åäö i kortterminaltexter (HEMKOP, NARLIVS).
  [/\b(ica|coop|willys|hemk[öo]p|lidl|city ?gross|netto|mathem|matsmart|matöppet|n[äa]rlivs|livsmedel)/i, 'cat-mat'],
  [
    /\b(sl\b|sj\b|circle[ _]?k|okq8|preem|ingo|st1|shell|parkering|easypark|aimo|apcoa|västtrafik|skånetrafiken|östgötatrafiken|flixbus|taxi|uber(?! ?eats)|bolt\b)/i,
    'cat-transport',
  ],
  [
    /netflix|spotify|hbo|disney|viaplay|youtube|storytel|telia|tele2|telenor|comviq|hallon|halebop|vimla|bahnhof|bredband|apple\.com|itunes|google (one|play)|amazon prime|patreon/i,
    'cat-abonnemang',
  ],
  [
    /mc ?donald|\bmcd|burger king|max burgers|espresso house|starbucks|waynes|sushi|pizz|restaurang|café|cafe\b|konditori|kebab|foodora|uber ?eats|wolt/i,
    'cat-restaurang',
  ],
  [
    /apotek|tandläk|folktandvård|vårdcentral|läkar|optik|synsam|specsavers|gym|sats\b|nordic ?wellness|friskis|actic/i,
    'cat-halsa',
  ],
  [
    /\bh ?& ?m\b|zalando|lindex|kappahl|åhléns|stadium|intersport|xxl|gina tricot|monki|weekday|boozt|shein|cubus/i,
    'cat-klader',
  ],
  [
    /hyra|hyres|bostad|brf|hsb|riksbyggen|heimstaden|vattenfall|e\.?on\b|ellevio|fortum|tibber|göta energi|hemförsäkring|folksam|trygg.?hansa|länsförsäkringar|\blf\b/i,
    'cat-boende',
  ],
  [/systembolaget|filmstaden|ticketmaster|eventim|konsert|teater|\bbio\b/i, 'cat-noje'],
  [/\blön\b|salary|payroll/i, 'cat-lon'],
  [/försäkringskassan|csn|skatteverket|a-kassa|pensionsmyndigheten/i, 'cat-bidrag'],
]

export function guessCategoryId(text: string, type: TxType, categories: Category[]): string {
  // Kortterminaltexter använder ofta understreck som avgränsare
  // ('30/6_22457_Circle_K') – normalisera så att ordgränserna stämmer.
  const t = text.replace(/_/g, ' ')
  const has = (id: string) => categories.some((c) => c.id === id && c.type === type)
  for (const [rx, id] of KEYWORD_RULES) if (rx.test(t) && has(id)) return id
  // Egna kategorinamn som nämns i texten (t.ex. en kategori "Husdjur" och
  // texten "Husdjur AB") träffar också.
  const lower = t.toLowerCase()
  const byName = categories.find(
    (c) => c.type === type && c.name.length >= 3 && lower.includes(c.name.toLowerCase()),
  )
  if (byName) return byName.id
  const fallback = type === 'income' ? 'cat-ovrig-inkomst' : 'cat-ovrigt'
  if (has(fallback)) return fallback
  return categories.find((c) => c.type === type)?.id ?? ''
}
