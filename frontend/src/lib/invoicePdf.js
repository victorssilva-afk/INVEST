import jsPDF from "jspdf";
import { eur, fmtDate } from "@/lib/format";
import { maskIban } from "@/lib/iban";

const BRAND = "Atlas Financeiro & Jurídico";

// Reproduz fielmente o modelo INVEST (navy + dourado sobre fundo branco).
export function generateInvoicePdf(inv) {
  const doc = new jsPDF("p", "mm", "a4");
  const W = 210;
  const navy = [11, 26, 48];
  const gold = [212, 175, 55];
  const ink = [30, 41, 59];
  const gray = [107, 116, 128];
  const soft = [148, 163, 184];
  const boxbg = [248, 250, 252];
  const boxbd = [226, 232, 240];
  const cream = [255, 251, 235];
  const creambd = [235, 214, 140];

  const s = inv.sender || {};
  const r = inv.recipient || {};
  const b = inv.bank || {};
  const intl = inv.international || {};
  const t = inv.totals || {};
  const cur = inv.currency || "EUR";

  // 1) top gold bar
  doc.setFillColor(...gold);
  doc.rect(0, 0, W, 2.5, "F");

  // 2) emblem (colunas)
  doc.setDrawColor(...navy);
  doc.setLineWidth(0.5);
  doc.roundedRect(14, 11, 13, 13, 1.5, 1.5, "S");
  doc.setLineWidth(0.4);
  doc.line(16.5, 15.2, 24.5, 15.2);              // arquitrave
  doc.line(17.2, 14.6, 20.5, 13.2);              // telhado esq
  doc.line(20.5, 13.2, 23.8, 14.6);              // telhado dir
  [17.6, 20.5, 23.4].forEach((x) => doc.line(x, 15.6, x, 21));  // colunas
  doc.line(16.5, 21.4, 24.5, 21.4);              // base

  // 3) brand + remetente
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...navy);
  doc.text(BRAND, 31, 16.5);
  doc.setFontSize(8.5);
  doc.text(`Remetente: ${s.name || "—"}`, 31, 21.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.6);
  doc.setTextColor(...gray);
  const sLines = [s.address, [s.postal_code, s.city].filter(Boolean).join(" ") + (s.country ? ` · ${s.country}` : ""),
    [s.nif ? `NIF: ${s.nif}` : "", s.email].filter(Boolean).join(" · ")].filter((l) => l && l.trim());
  sLines.slice(0, 3).forEach((l, i) => doc.text(String(l).slice(0, 62), 31, 26 + i * 3.7));

  // 4) right: FATURA + number
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...gold);
  doc.text("F A T U R A", W - 14, 15, { align: "right" });
  doc.setFontSize(18);
  doc.setTextColor(...navy);
  doc.text(inv.number || "—", W - 14, 23, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...soft);
  doc.text("Documento não certificado", W - 14, 28, { align: "right" });

  // divider
  doc.setDrawColor(...boxbd);
  doc.setLineWidth(0.3);
  doc.line(14, 40, W - 14, 40);

  // 5) info row (4 boxes)
  let y = 46;
  const cw = (W - 28 - 9) / 4;
  const info = [
    ["DATA DE EMISSÃO", fmtDate(inv.issue_date), false],
    ["VENCIMENTO", fmtDate(inv.due_date), false],
    ["PRAZO DE PAGAMENTO", inv.due_label || "—", true],
    ["MOEDA", cur, false],
  ];
  info.forEach((c, i) => {
    const x = 14 + i * (cw + 3);
    doc.setFillColor(...(c[2] ? cream : boxbg));
    doc.setDrawColor(...(c[2] ? creambd : boxbd));
    doc.roundedRect(x, y, cw, 15, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(...soft);
    doc.text(c[0], x + 4, y + 5.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...navy);
    doc.text(String(c[1]), x + 4, y + 11);
  });

  // 6) FATURAR A / PAGAMENTO A
  y += 21;
  const half = (W - 28 - 6) / 2;
  doc.setDrawColor(...boxbd);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(14, y, half, 32, 1.5, 1.5, "S");
  doc.roundedRect(14 + half + 6, y, half, 32, 1.5, 1.5, "S");
  // labels
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...gold);
  doc.text("FATURAR A", 19, y + 7);
  doc.text("PAGAMENTO A", 19 + half + 6, y + 7);
  // faturar a
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...navy);
  doc.text(String(r.name || "—").slice(0, 34), 19, y + 15);
  if (r.nif) { doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...gray); doc.text(`NIF: ${r.nif}`, 19, y + 21); }
  // pagamento a
  const px = 19 + half + 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...ink);
  doc.text(String(r.name || b.holder || "—").slice(0, 34), px, y + 14);
  doc.setFontSize(8);
  doc.setTextColor(...soft);
  if (b.bank_name) doc.text(String(b.bank_name).slice(0, 40), px, y + 19);
  if (b.iban) {
    doc.setTextColor(...gray); doc.text("IBAN:", px, y + 24);
    doc.setFont("helvetica", "bold"); doc.setTextColor(...navy);
    doc.text(maskIban(b.iban).slice(0, 34), px + 11, y + 24);
    doc.setFont("helvetica", "normal");
  }
  if (b.swift || intl.swift) { doc.setTextColor(...gray); doc.text(`SWIFT: ${b.swift || intl.swift}`, px, y + 29); }
  if (b.entity) { doc.setTextColor(...gray); doc.text(`Multibanco: ${b.entity} / ${b.reference || "—"}`, px, y + 29); }

  // 7) items table
  y += 40;
  doc.setFillColor(...navy);
  doc.rect(14, y, W - 28, 8.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("DESCRIÇÃO", 18, y + 5.6);
  doc.text("QTD", 120, y + 5.6, { align: "right" });
  doc.text("PREÇO", 150, y + 5.6, { align: "right" });
  doc.text("IVA", 170, y + 5.6, { align: "right" });
  doc.text("TOTAL", W - 16, y + 5.6, { align: "right" });
  y += 8.5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...ink);
  doc.setFontSize(9);
  (inv.items || []).forEach((it) => {
    const line = it.quantity * it.unit_price;
    const lineTotal = line - line * (it.discount / 100);
    doc.text(String(it.description || BRAND).slice(0, 58), 18, y + 6);
    doc.text(String(it.quantity), 120, y + 6, { align: "right" });
    doc.text(eur(it.unit_price, cur), 150, y + 6, { align: "right" });
    doc.text(`${it.vat}%`, 170, y + 6, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.text(eur(lineTotal, cur), W - 16, y + 6, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setDrawColor(...boxbd);
    doc.line(14, y + 9, W - 14, y + 9);
    y += 9;
  });

  // 8) instructions (left) + totals (right)
  y += 8;
  const insH = 48;
  doc.setDrawColor(...boxbd);
  doc.roundedRect(14, y, 100, insH, 1.5, 1.5, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...gold);
  doc.text("INSTRUÇÕES DE PAGAMENTO", 18, y + 6);
  if (inv.qr_code) { try { doc.addImage(inv.qr_code, "PNG", 18, y + 9, 26, 26); } catch (e) {} }
  const ix = 48;
  const pay = [["Banco", b.bank_name || "—"], ["Titular", r.name || b.holder || "—"],
    ["IBAN", b.iban ? maskIban(b.iban) : "—"], ["SWIFT", b.swift || intl.swift || "—"]];
  pay.forEach((p, i) => {
    const ry = y + 12 + i * 6;
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...soft);
    doc.text(p[0], ix, ry);
    doc.setFont(p[0] === "IBAN" ? "helvetica" : "helvetica", p[0] === "IBAN" ? "bold" : "normal");
    doc.setTextColor(...(p[0] === "IBAN" ? navy : ink));
    doc.text(String(p[1]).slice(0, 30), ix + 13, ry);
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(...soft);
  doc.text("Digitalize o código para consultar o estado", 18, y + 40);
  doc.text("da fatura online.", 18, y + 43);

  // totals right
  const tx = 122, tvx = W - 16;
  let ty = y + 4;
  doc.setFontSize(9.5);
  const trow = (label, val) => {
    doc.setFont("helvetica", "normal"); doc.setTextColor(...gray); doc.text(label, tx, ty);
    doc.setTextColor(...ink); doc.text(eur(val, cur), tvx, ty, { align: "right" }); ty += 8;
  };
  trow("Subtotal", t.subtotal);
  doc.setTextColor(...gray); doc.text("Desconto", tx, ty);
  doc.setTextColor(...ink); doc.text(`- ${eur(Math.abs(t.discount || 0), cur)}`, tvx, ty, { align: "right" }); ty += 8;
  trow("IVA", t.vat);
  ty += 1;
  doc.setFillColor(...navy);
  doc.roundedRect(tx - 4, ty - 1, tvx - tx + 8, 11, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text("Total", tx, ty + 6.2);
  doc.setTextColor(...gold);
  doc.text(eur(t.total, cur), tvx, ty + 6.2, { align: "right" });

  // note with gold left border
  const ny = y + insH + 6;
  doc.setDrawColor(...gold);
  doc.setLineWidth(1);
  doc.line(15, ny, 15, ny + 8);
  doc.setLineWidth(0.3);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...ink);
  doc.text(`O pagamento deverá ser efetuado no prazo de ${inv.due_label || "—"} a`, 19, ny + 3);
  doc.text("contar da data de emissão.", 19, ny + 7);
  if (inv.company_message) { doc.setTextColor(...gray); doc.setFontSize(7.5); doc.text(String(inv.company_message).slice(0, 95), 19, ny + 12); }

  // footer
  doc.setDrawColor(...boxbd);
  doc.line(14, 279, W - 14, 279);
  doc.setFontSize(6.8);
  doc.setTextColor(...soft);
  doc.text(`© ${new Date().getFullYear()} ${BRAND}`, 14, 284);
  doc.setFontSize(6.2);
  const legal = `${BRAND} presta serviços de assessoria financeira. Registada sob o n.º 419 501 250 desde 21/01/2019, está autorizada a exercer a atividade de mediação de seguros no Ramo Vida.`;
  doc.text(doc.splitTextToSize(legal, W - 28), 14, 288);

  doc.save(`${inv.number || "fatura"}.pdf`);
}
