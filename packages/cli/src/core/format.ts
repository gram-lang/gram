const systemLocale =
  typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().locale : 'en'

export function fmtNumber(n: number, maxDecimals = 2): string {
  return new Intl.NumberFormat(systemLocale, {
    maximumFractionDigits: maxDecimals,
  }).format(n)
}
