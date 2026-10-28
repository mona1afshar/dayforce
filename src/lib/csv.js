// Minimal RFC 4180 CSV parser: quoted fields, escaped quotes ("") and
// newlines inside quotes. Single pass over the string, no regex, no deps.
// Returns { header: string[], rows: string[][] }.
export function parseCSV(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1) // strip BOM

  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  let i = 0
  const n = text.length

  while (i < n) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      // Copy a run of plain characters in one slice instead of char by char.
      const next = text.indexOf('"', i)
      const end = next === -1 ? n : next
      field += text.slice(i, end)
      i = end
      continue
    }

    if (c === '"') {
      inQuotes = true
      i++
    } else if (c === ',') {
      row.push(field)
      field = ''
      i++
    } else if (c === '\n' || c === '\r') {
      row.push(field)
      field = ''
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
      i += c === '\r' && text[i + 1] === '\n' ? 2 : 1
    } else {
      // Fast path: slice until the next delimiter.
      let j = i + 1
      while (j < n) {
        const d = text.charCodeAt(j)
        if (d === 44 || d === 10 || d === 13 || d === 34) break // , \n \r "
        j++
      }
      field += text.slice(i, j)
      i = j
    }
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }

  const header = (rows.shift() || []).map((h) => h.trim())
  return { header, rows }
}
