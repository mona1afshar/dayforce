# Giga Corp org chart

Vue 3 + Tailwind + Vite. Loads the 40,000-person CSV, shows the reporting
hierarchy as an expandable org chart, and adds a cost analysis view.

```bash
npm install
npm run dev     # app
npm test        # checks the aggregates against a naive per-node walk
```

## How the numbers are computed

All work happens once, in a Web Worker, in linear time (`src/lib/orgEngine.js`):

1. **Index.** `Employee Id -> row index` map, then every column goes into a
   plain array or a typed array (`Float64Array` salaries, `Int32Array` links).
2. **Children as CSR.** Count reports per manager, prefix-sum into
   `childStart`, fill `childList`. No per-node JS arrays or objects.
3. **Iterative pre-order DFS.** Produces `order[]`, `tin`/`tout` and `depth`.
   No recursion, so any depth is safe. A node's whole sub-org is the
   contiguous slice `order[tin[v]+1 .. tout[v])`.
4. **One bottom-up pass.** Walking `order[]` backwards visits every child
   before its parent, so each node pushes its totals to its parent exactly once:

   ```
   desc[p]    += 1 + desc[c]
   nonLeaf[p] += isManager(c) + nonLeaf[c]
   mgmt[p]    += (isManager(c) ? salary[c] : 0) + mgmt[c]
   ic[p]      += (isManager(c) ? 0 : salary[c]) + ic[c]
   ```

That is O(n) for the whole company instead of re-walking a subtree for every
node (O(n × depth) or worse). After it runs, every value on every path is an
O(1) lookup, so expanding any branch costs nothing extra. On the 40k file,
parsing and building the tree with all aggregates take roughly 100 ms each in
Node (`npm test` prints the timings), all off the main thread in the app.

The parser also guards against bad data: unknown managers become top-level
nodes, reporting loops are cut, duplicate IDs are skipped, and the UI says so.

### Definitions

| Field | Meaning |
| --- | --- |
| Descendants | Everyone below the person, at any depth |
| Non-leaf descendants | Descendants who have at least one report |
| Management cost | Sum of salaries of non-leaf descendants |
| IC cost | Sum of salaries of leaf descendants |
| Total cost | Management cost + IC cost (the person's own salary is excluded) |
| Management cost ratio | Management cost ÷ IC cost |

The brief describes the ratio as "between individual contributors and
managers". I read it as a cost ratio (management dollars per IC dollar) since
it sits with the cost fields. The analysis view also shows the headcount side
(managers vs ICs, span of control).

## Org chart

- Only expanded branches are laid out (d3-hierarchy tidy tree), so layout cost
  tracks what is on screen, not the 40k total.
- Only cards inside the viewport are mounted (viewport culling), and when you
  zoom far out cards switch to a lightweight name-only version.
- The card you expand stays still while the layout shifts, then the view pans
  just enough to show the new row.
- Each manager card shows direct reports, total descendants, managers below,
  management / IC / total cost, the ratio, and a split bar of management vs IC.
- Search by name, title, email or ID opens the path to that person.
- The details panel shows the full profile, the chain of managers, direct
  reports and actions ("Show in chart", "Analyze cost", "Open whole team").
- Drag to pan, scroll to pan, Ctrl/⌘ + scroll or pinch to zoom.
- Load any CSV with the same columns from the header.

## Cost analysis (bonus)

Pick any manager (default: the CEO). Everything is scoped to their org, using
the `order[]` slice, so analyzing a 20-person team scans 20 rows.

- **Headline numbers:** people, total / management / IC cost, management cost
  ratio in plain words, average span of control, single-report managers.
- **Where the money goes:** stacked bars by direct report's org (drill down by
  clicking), department, location, legal entity, project or performance
  rating. Sort by total cost, management share or headcount.
- **Cost by layer:** how spend is distributed down the reporting layers.
- **Span of control:** managers by number of direct reports. Single-report
  managers are flagged as likely layers to remove.
- **Managers table:** every manager in scope, sortable by people, direct
  reports, costs and ratio. Ratios 1.5× above the org's are marked "High".

## Files

```
src/lib/csv.js          RFC 4180 CSV parser (no dependency)
src/lib/orgEngine.js    tree build + single-pass aggregation
src/lib/org.worker.js   runs the engine off the main thread
src/lib/analytics.js    sub-org breakdowns from the pre-order slice
src/lib/layout.js       d3-hierarchy layout of the visible tree
src/components/         OrgChart, PersonCard, PersonPanel, CostAnalysis, charts
scripts/verify.mjs      correctness check against a brute-force walk
```
