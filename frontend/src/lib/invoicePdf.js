import jsPDF from "jspdf";
import { eur, fmtDate } from "@/lib/format";
import { maskIban } from "@/lib/iban";

const BRAND = "Atlas Financeiro & Jurídico";

// Preto & branco. Layout profissional inspirado no modelo Atlas.
export function generateInvoicePdf(inv) {
  const doc = new jsPDF("p", "mm", "a4");
  const W = 210;
  const dark = [17, 24, 39];
  const gray = [110, 116, 128];
  const border = [209, 213, 219];
  const light = [244, 245, 247];
  const s = inv.sender || {};
  const r = inv.recipient || {};
  const b = inv.bank || {};
  const intl = inv.international || {};
  const t = inv.totals || {};
  const cur = inv.currency || "EUR";

  // top rule
  doc.setFillColor(...dark);
  doc.rect(0, 0, W, 1.5, "F");

  // ---- Header ----
  // emblem
  doc.setDrawColor(...dark);
  doc.setLineWidth(0.5);
  doc.roundedRect(14, 12, 12, 12, 1, 1, "S");
  doc.setFont("times", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...dark);
  doc.text("A", 20, 20.5, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(BRAND, 30, 17);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...dark);
  doc.text(`Remetente: ${s.name || "—"}`, 30, 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...gray);
  const sLines = [s.address, [s.postal_code, s.city].filter(Boolean).join(" "), s.country,
    [s.nif ? `NIF: ${s.nif}` : "", s.email].filter(Boolean).join(" · ")].filter(Boolean);
  sLines.slice(0, 4).forEach((l, i) => doc.text(String(l).slice(0, 60), 30, 26 + i * 3.6));

  // right: FATURA + number
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...gray);
  doc.text("F A T U R A", W - 14, 15, { align: "right" });
  doc.setFontSize(17);
  doc.setTextColor(...dark);
  doc.text(inv.number || "—", W - 14, 23, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...gray);
  doc.text("Documento não certificado", W - 14, 28, { align: "right" });

  doc.setDrawColor(...border);
  doc.setLineWidth(0.3);
  doc.line(14, 44, W - 14, 44);

  // ---- info row (4 cols) ----
  let y = 50;
  const cols = [
    ["DATA DE EMISSÃO", fmtDate(inv.issue_date)],
    ["VENCIMENTO", fmtDate(inv.due_date)],
    ["PRAZO DE PAGAMENTO", inv.due_label || "—"],
    ["MOEDA", cur],
  ];
  const cw = (W - 28) / 4;
  cols.forEach((c, i) => {
    const x = 14 + i * cw;
    doc.setFontSize(6.5);
    doc.setTextColor(...gray);
    doc.setFont("helvetica", "bold");
    doc.text(c[0], x, y);
    doc.setFontSize(9.5);
    doc.setTextColor(...dark);
    doc.text(String(c[1]), x, y + 5);
  });
  doc.line(14, y + 9, W - 14, y + 9);

  // ---- FATURAR A / PAGAMENTO A ----
  y += 16;
  const boxW = (W - 28 - 6) / 2;
  const drawBox = (x, title, lines) => {
    doc.setDrawColor(...border);
    doc.roundedRect(x, y, boxW, 30, 1.5, 1.5, "S");
    doc.setFontSize(6.5);
    doc.setTextColor(...gray);
    doc.setFont("helvetica", "bold");
    doc.text(title, x + 4, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...dark);
    lines.filter(Boolean).slice(0, 5).forEach((l, i) => doc.text(String(l).slice(0, 52), x + 4, y + 12 + i * 4));
  };
  drawBox(14, "FATURAR A", [{ b: r.name || "—" }].map((o) => o.b));
  const payLines = [r.name || b.holder || "—", b.bank_name, b.iban ? `IBAN: ${maskIban(b.iban)}` : "",
    b.swift || intl.swift ? `SWIFT: ${b.swift || intl.swift}` : "",
    b.entity ? `Multibanco: ${b.entity} / ${b.reference || "—"}` : ""];
  drawBox(14 + boxW + 6, "PAGAMENTO A", payLines);

  // ---- items table ----
  y += 38;
  doc.setFillColor(...dark);
  doc.rect(14, y, W - 28, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("DESCRIÇÃO", 17, y + 5.3);
  doc.text("QTD", 120, y + 5.3, { align: "right" });
  doc.text("PREÇO", 145, y + 5.3, { align: "right" });
  doc.text("IVA", 165, y + 5.3, { align: "right" });
  doc.text("TOTAL", W - 17, y + 5.3, { align: "right" });
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...dark);
  doc.setFontSize(8.5);
  (inv.items || []).forEach((it) => {
    const line = it.quantity * it.unit_price;
    const lineTotal = line - line * (it.discount / 100);
    doc.text(String(it.description || BRAND).slice(0, 58), 17, y + 5.5);
    doc.text(String(it.quantity), 120, y + 5.5, { align: "right" });
    doc.text(eur(it.unit_price, cur), 145, y + 5.5, { align: "right" });
    doc.text(`${it.vat}%`, 165, y + 5.5, { align: "right" });
    doc.text(eur(lineTotal, cur), W - 17, y + 5.5, { align: "right" });
    doc.setDrawColor(...border);
    doc.line(14, y + 8, W - 14, y + 8);
    y += 8;
  });

  // ---- payment instructions (left) + totals (right) ----
  y += 8;
  const insY = y;
  // instructions box
  doc.setDrawColor(...border);
  doc.roundedRect(14, insY, 96, 46, 1.5, 1.5, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...dark);
  doc.text("INSTRUÇÕES DE PAGAMENTO", 18, insY + 6);
  if (inv.qr_code) { try { doc.addImage(inv.qr_code, "PNG", 18, insY + 9, 26, 26); } catch (e) {} }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...gray);
  const pl = [["Banco", b.bank_name || "—"], ["Titular", r.name || b.holder || "—"],
    ["IBAN", b.iban ? maskIban(b.iban) : "—"], ["SWIFT", b.swift || intl.swift || "—"]];
  pl.forEach((p, i) => {
    doc.setTextColor(...gray); doc.text(p[0], 48, insY + 12 + i * 5.5);
    doc.setTextColor(...dark); doc.text(String(p[1]).slice(0, 26), 62, insY + 12 + i * 5.5);
  });

  // totals right
  const tx = 118, tvx = W - 17;
  let ty = insY + 4;
  doc.setFontSize(9);
  const row = (label, val) => {
    doc.setTextColor(...gray); doc.setFont("helvetica", "normal");
    doc.text(label, tx, ty); doc.setTextColor(...dark);
    doc.text(eur(val, cur), tvx, ty, { align: "right" }); ty += 7;
  };
  row("Subtotal", t.subtotal);
  row("Desconto", -Math.abs(t.discount || 0));
  row("IVA", t.vat);
  doc.setFillColor(...dark);
  doc.rect(tx - 3, ty - 2, (tvx - tx) + 6, 10, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Total", tx, ty + 4.5);
  doc.text(eur(t.total, cur), tvx, ty + 4.5, { align: "right" });

  // vencimento note
  y = insY + 52;
  doc.setDrawColor(...dark);
  doc.setLineWidth(0.8);
  doc.line(14, y, 14, y + 9);
  doc.setLineWidth(0.3);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...dark);
  doc.text(`O pagamento deverá ser efetuado no prazo de ${inv.due_label || "—"} a contar da data de emissão.`, 18, y + 4);
  if (inv.company_message) doc.text(String(inv.company_message).slice(0, 95), 18, y + 8.5);

  // footer
  doc.setDrawColor(...border);
  doc.line(14, 282, W - 14, 282);
  doc.setFontSize(6.5);
  doc.setTextColor(...gray);
  doc.text(`© ${new Date().getFullYear()} ${BRAND} · Documento gerado automaticamente.`, 14, 287);
  doc.text(String(inv.public_link || "").slice(0, 70), 14, 291);

  doc.save(`${inv.number || "fatura"}.pdf`);
}
