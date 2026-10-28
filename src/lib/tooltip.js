import { reactive } from 'vue'

/** One shared tooltip for every chart: { show, x, y, title, rows: [[label, value, swatchClass?]] } */
export const tip = reactive({ show: false, x: 0, y: 0, title: '', rows: [] })

export function showTip(e, title, rows) {
  const r = e.currentTarget.getBoundingClientRect()
  tip.x = r.left + r.width / 2
  tip.y = r.top
  tip.title = title
  tip.rows = rows
  tip.show = true
}

export function moveTip(e) {
  if (e.clientX) {
    tip.x = e.clientX
    tip.y = e.clientY - 8
  }
}

export const hideTip = () => (tip.show = false)
