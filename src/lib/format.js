export function money(x) {
  if (x == null || !Number.isFinite(x)) return '–'
  const a = Math.abs(x)
  if (a >= 1e9) return `$${(x / 1e9).toFixed(2)}B`
  if (a >= 1e6) return `$${(x / 1e6).toFixed(a >= 1e8 ? 0 : 1)}M`
  if (a >= 1e3) return `$${(x / 1e3).toFixed(a >= 1e5 ? 0 : 1)}K`
  return `$${Math.round(x)}`
}

export const moneyFull = (x) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(x)

export const num = (x) => new Intl.NumberFormat('en-US').format(x)

export const ratio = (x) => (x == null ? '–' : x.toFixed(2))

export const pct = (x) => (Number.isFinite(x) ? `${Math.round(x * 100)}%` : '–')

export function initials(name = '') {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

/** "👏 Exceeds Expectations" -> { icon: "👏", label: "Exceeds Expectations" } */
export function splitEmoji(s = '') {
  const m = s.match(/^(\p{Extended_Pictographic}️?)\s*(.*)$/u)
  return m ? { icon: m[1], label: m[2] } : { icon: '', label: s }
}

export function formatDate(iso) {
  if (!iso) return '–'
  const d = new Date(iso + 'T00:00:00')
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}
