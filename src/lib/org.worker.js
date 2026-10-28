// Parses the CSV and runs the O(n) aggregation off the main thread, then
// hands the typed arrays back as transferables (zero-copy).
import { buildOrgFromCSV, TYPED_FIELDS } from './orgEngine.js'

self.onmessage = async (e) => {
  try {
    const { url, text: given } = e.data
    const text = given ?? (await (await fetch(url)).text())
    const org = buildOrgFromCSV(text)
    const transfer = TYPED_FIELDS.map((f) => org[f].buffer)
    self.postMessage({ ok: true, org }, transfer)
  } catch (err) {
    self.postMessage({ ok: false, error: err?.message || String(err) })
  }
}
