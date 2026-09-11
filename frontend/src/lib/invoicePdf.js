import jsPDF from "jspdf";
import { eur, fmtDate } from "@/lib/format";
import { maskIban } from "@/lib/iban";

// Generates a professional INVEST invoice PDF
export function generateInvoicePdf(inv) {
  const doc = new jsPDF("p", "mm", "a4");
  const W = 210;
  const navy = [11, 26, 48];
  const gold = [212, 175, 55];
  let y = 0;

  // Header band
  doc.setFillColor(...navy);
  doc.rect(0, 0, W, 38, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.text("IN", 14, 22);
  doc.setTextColor(...gold);
  doc.text("VEST", 24, 22);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Fatura / Invoice", 14, 30);

  // Number & dates (right)
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...gold);
  doc.text(inv.number || "—", W - 14, 16, { align: "right" });
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`Emissão: ${fmtDate(inv.issue_date, true)}`, W - 14, 24, { align: "right" });
  doc.text(`Vencimento: ${fmtDate(inv.due_date, true)}`, W - 14, 29, { align: "right" });
  doc.text(`Estado: ${(inv.status || "").toUpperCase()}`, W - 14, 34, { align: "right" });

  y = 48;
  // Sender / Recipient boxes
  const boxW = 88;
  const s = inv.sender || {};
  const r = inv.recipient || {};
  const drawParty = (x, title, p) => {
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, y, boxW, 34, 2, 2, "FD");
    doc.setFontSize(8);
    doc.setTextColor(...gold);
    doc.setFont("helvetica", "bold");
    doc.text(title, x + 5, y + 7);
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const lines = [p.name, p.company, p.nif ? `NIF: ${p.nif}` : "", p.address, [p.postal_code, p.city].filter(Boolean).join(" "), p.email].filter(Boolean);
    lines.slice(0, 5).forEach((l, i) => doc.text(String(l).slice(0, 45), x + 5, y + 14 + i * 4.2));
  };
  drawParty(14, "REMETENTE", s);
  drawParty(14 + boxW + 6, "DESTINATÁRIO", r);

  y += 42;
  // Items table
  doc.setFillColor(...navy);
  doc.rect(14, y, W - 28, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Descrição", 16, y + 5.5);
  doc.text("Qt.", 118, y + 5.5, { align: "right" });
  doc.text("Preço", 140, y + 5.5, { align: "right" });
  doc.text("Desc.", 160, y + 5.5, { align: "right" });
  doc.text("IVA", 176, y + 5.5, { align: "right" });
  doc.text("Total", W - 16, y + 5.5, { align: "right" });
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 41, 59);
  (inv.items || []).forEach((it, i) => {
    if (i % 2 === 0) { doc.setFillColor(248, 250, 252); doc.rect(14, y, W - 28, 7, "F"); }
    const line = it.quantity * it.unit_price;
    const lineTotal = line - line * (it.discount / 100);
    doc.text(String(it.description || "").slice(0, 55), 16, y + 5);
    doc.text(String(it.quantity), 118, y + 5, { align: "right" });
    doc.text(eur(it.unit_price, inv.currency), 140, y + 5, { align: "right" });
    doc.text(`${it.discount}%`, 160, y + 5, { align: "right" });
    doc.text(`${it.vat}%`, 176, y + 5, { align: "right" });
    doc.text(eur(lineTotal, inv.currency), W - 16, y + 5, { align: "right" });
    y += 7;
  });

  // Totals
  y += 4;
  const t = inv.totals || {};
  const tx = W - 70;
  doc.setFontSize(9);
  const totRow = (label, val, bold) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, tx, y);
    doc.text(eur(val, inv.currency), W - 16, y, { align: "right" });
    y += 6;
  };
  totRow("Subtotal", t.subtotal);
  totRow("Desconto", -Math.abs(t.discount || 0));
  totRow("IVA", t.vat);
  doc.setDrawColor(...gold);
  doc.line(tx, y - 3, W - 16, y - 3);
  doc.setFillColor(...navy);
  doc.roundedRect(tx - 4, y - 1, 62, 9, 1, 1, "F");
  doc.setTextColor(...gold);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TOTAL", tx, y + 5);
  doc.text(eur(t.total, inv.currency), W - 16, y + 5, { align: "right" });
  y += 16;

  // Payment box
  doc.setTextColor(30, 41, 59);
  const b = inv.bank || {};
  const intl = inv.international || {};
  doc.setDrawColor(...gold);
  doc.setFillColor(255, 250, 235);
  doc.roundedRect(14, y, W - 28, 30, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...navy);
  doc.text("DADOS DE PAGAMENTO", 18, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const payLines = [];
  if (b.bank_name) payLines.push(`Banco: ${b.bank_name}`);
  if (b.holder) payLines.push(`Titular: ${b.holder}`);
  if (b.iban) payLines.push(`IBAN: ${maskIban(b.iban)}`);
  if (b.swift) payLines.push(`SWIFT/BIC: ${b.swift}`);
  if (b.entity) payLines.push(`Multibanco — Entidade: ${b.entity}  Referência: ${b.reference || "—"}`);
  if (intl.country) payLines.push(`Internacional: ${intl.country} · ${intl.swift || ""}`);
  payLines.slice(0, 4).forEach((l, i) => doc.text(l, 18, y + 13 + i * 4.5));

  // QR code
  if (inv.qr_code) {
    try { doc.addImage(inv.qr_code, "PNG", W - 40, y + 4, 22, 22); } catch (e) {}
    doc.setFontSize(6.5);
    doc.text("Verificar fatura", W - 29, y + 29, { align: "center" });
  }

  y += 36;
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  if (inv.notes) doc.text(`Notas: ${String(inv.notes).slice(0, 90)}`, 14, y);
  if (inv.company_message) doc.text(String(inv.company_message).slice(0, 100), 14, y + 5);
  doc.text(`Link público: ${inv.public_link || ""}`, 14, 288);
  doc.setTextColor(...navy);
  doc.text("INVEST · Documento gerado automaticamente", W - 14, 288, { align: "right" });

  doc.save(`${inv.number || "fatura"}.pdf`);
}
