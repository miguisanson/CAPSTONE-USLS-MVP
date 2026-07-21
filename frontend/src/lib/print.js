function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function printDataTable({ title, subtitle = "", columns, rows }) {
  const popup = window.open("", "_blank", "width=1100,height=800");
  if (!popup) throw new Error("Allow pop-ups to open the printable list.");
  popup.opener = null;
  const head = columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("");
  const body = rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    @page{size:auto;margin:14mm}body{font:12px Arial,sans-serif;color:#172033;margin:0}h1{font-size:20px;margin:0 0 4px;color:#176b55}p{color:#526071;margin:0 0 18px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #cbd5e1;padding:7px;text-align:left;vertical-align:top}th{background:#f1f5f9;font-size:10px;text-transform:uppercase;letter-spacing:.04em}.meta{margin-top:14px;font-size:10px}@media print{button{display:none}}
  </style></head><body><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table><p class="meta">Printed ${escapeHtml(new Date().toLocaleString())}</p><script>window.addEventListener('load',()=>window.print());<\/script></body></html>`);
  popup.document.close();
}
