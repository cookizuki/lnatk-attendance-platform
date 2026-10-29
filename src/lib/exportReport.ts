export interface LocaleSummaryRow { city: string; locale: string; duty34: number; duty12: number; noDuty: number; total: number }
export interface MemberStatusRow { city: string; locale: string; name: string; category: string; hold: string; weeks: string[]; weeksDuty: number; status: string }
export interface ReportExportRow {
  city: string; locale: string; month: string; position: string; coordinator: string;
  tkConcerns: string; general: string; actions: string; other: string; submittedAt: string;
}

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function downloadExcel(monthLabel: string, locales: LocaleSummaryRow[], members: MemberStatusRow[], reports: ReportExportRow[]) {
  const mod: any = await import('exceljs');
  const ExcelJS = mod.default ?? mod;
  const wb = new ExcelJS.Workbook();

  const sheet = (name: string, cols: { header: string; key: string; width: number }[], rows: object[]) => {
    const ws = wb.addWorksheet(name);
    ws.columns = cols;
    ws.addRows(rows);
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  };

  sheet('Locale Summary', [
    { header: 'City', key: 'city', width: 14 }, { header: 'Locale', key: 'locale', width: 22 },
    { header: '3-4 Weeks Duty', key: 'duty34', width: 16 }, { header: '1-2 Weeks Duty', key: 'duty12', width: 16 },
    { header: 'No Duty', key: 'noDuty', width: 10 }, { header: 'Total', key: 'total', width: 10 },
  ], locales);

  sheet('Per Member Status', [
    { header: 'City', key: 'city', width: 14 }, { header: 'Locale', key: 'locale', width: 22 },
    { header: 'Member', key: 'name', width: 30 }, { header: 'Category', key: 'category', width: 18 },
    { header: 'Hold', key: 'hold', width: 8 }, { header: 'Week 1', key: 'w1', width: 9 },
    { header: 'Week 2', key: 'w2', width: 9 }, { header: 'Week 3', key: 'w3', width: 9 },
    { header: 'Week 4', key: 'w4', width: 9 }, { header: 'Week 5', key: 'w5', width: 9 }, { header: 'Weeks Duty', key: 'weeksDuty', width: 12 },
    { header: 'Status', key: 'status', width: 18 },
  ], members.map((m) => ({ ...m, w1: m.weeks[0], w2: m.weeks[1], w3: m.weeks[2], w4: m.weeks[3], w5: m.weeks[4] ?? '' })));

  sheet('Coordinator Reports', [
    { header: 'City', key: 'city', width: 14 }, { header: 'Locale', key: 'locale', width: 20 },
    { header: 'Position', key: 'position', width: 18 }, { header: 'Name', key: 'coordinator', width: 22 },
    { header: "TK's Concerns", key: 'tkConcerns', width: 50 }, { header: 'General Concerns', key: 'general', width: 40 },
    { header: 'Actions Taken', key: 'actions', width: 40 }, { header: 'Other / Suggestions', key: 'other', width: 40 },
    { header: 'Submitted', key: 'submittedAt', width: 20 },
  ], reports);

  const buf = await wb.xlsx.writeBuffer();
  save(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `LNATK-Status-${monthLabel.replace(/\s+/g, '-')}.xlsx`);
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

/** Opens a print-ready page; choose "Save as PDF" in the print dialog. */
export function printPdf(monthLabel: string, locales: LocaleSummaryRow[], members: MemberStatusRow[]) {
  const w = window.open('', '_blank');
  if (!w) return false;
  const lr = locales.map((r) => `<tr><td>${esc(r.city)}</td><td>${esc(r.locale)}</td><td>${r.duty34}</td><td>${r.duty12}</td><td>${r.noDuty}</td><td>${r.total}</td></tr>`).join('');
  const wc = Math.max(4, ...members.map((m) => m.weeks.length));
  const mr = members.map((r) => `<tr><td>${esc(r.locale)}</td><td>${esc(r.name)}</td><td>${esc(r.category)}</td><td>${esc(r.hold)}</td>${Array.from({ length: wc }, (_, i) => `<td>${esc(r.weeks[i] ?? '')}</td>`).join('')}<td>${r.weeksDuty}</td><td>${esc(r.status)}</td></tr>`).join('');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>LNATK Status ${esc(monthLabel)}</title>
<style>body{font:12px Arial,sans-serif;margin:24px}h1{font-size:18px}h2{font-size:14px;margin-top:24px}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:4px 6px;text-align:left}th{background:#eee}
@media print{h2{break-after:avoid}tr{break-inside:avoid}}</style></head><body>
<h1>LNATK Overall Status — ${esc(monthLabel)}</h1>
<h2>Locale Summary</h2><table><tr><th>City</th><th>Locale</th><th>3-4 Weeks</th><th>1-2 Weeks</th><th>No Duty</th><th>Total</th></tr>${lr}</table>
<h2>Per Member Status</h2><table><tr><th>Locale</th><th>Member</th><th>Category</th><th>Hold</th>${Array.from({ length: wc }, (_, i) => `<th>W${i + 1}</th>`).join('')}<th>Weeks Duty</th><th>Status</th></tr>${mr}</table>
<script>window.onload=function(){window.print()}</script></body></html>`);
  w.document.close();
  return true;
}
