import jsPDF from "jspdf";
import { eur, fmtDate } from "@/lib/format";
import { maskIban } from "@/lib/iban";
import { INVOICE_LOGO } from "@/lib/invoiceLogo";

// Emitente (instituição) — identidade fixa da empresa
const ISSUER = {
  brand: "Financeiro & Jurídico",
  address: "Rua Henrique Mesquita, nº 257 NA",
  postal: "3220-232 Miranda do Corvo · Portugal",
  if_code: "7847",
  email: "victor.silva@wexford-advisory.email",
  inst_type: "Instituições de moeda eletrónica com sede na UE — Livre prestação de serviços em PT",
  swift: "BGALPTPLXXX",
};

// Fatura portuguesa profissional — preto e branco
export function generateInvoicePdf(inv) {
  const doc = new jsPDF("p", "mm", "a4");
  const W = 210;
  const black = [17, 17, 17], ink = [24, 24, 24], gray = [90, 90, 100], soft = [140, 145, 155];
  const boxbd = [30, 30, 30], lightbd = [205, 208, 214], white = [255, 255, 255];
  const r = inv.recipient || {}, b = inv.bank || {}, intl = inv.international || {}, t = inv.totals || {}, cur = inv.currency || "EUR";
  const swift = b.swift || intl.swift || ISSUER.swift;

  // logo (SERVIÇOS Financeiro & Jurídico)
  try { doc.addImage(INVOICE_LOGO, "PNG", 14, 7, 24, 26); } catch (e) {}

  // brand + issuer identity
  const bx = 43;
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(...black);
  doc.text(ISSUER.brand, bx, 15);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.2); doc.setTextColor(...gray);
  let hy = 19.5;
  const hline = (txt, bold) => { doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setTextColor(...(bold ? ink : gray)); doc.text(txt, bx, hy); hy += 3.3; };
  hline(ISSUER.address);
  hline(ISSUER.postal);
  hline(`Código de IF: ${ISSUER.if_code}  ·  E-mail: ${ISSUER.email}`);
  hline(`SWIFT/BIC: ${swift}`, true);
  doc.setFont("helvetica", "italic"); doc.setFontSize(6.6); doc.setTextColor(...soft);
  doc.splitTextToSize(`Tipo de instituição: ${ISSUER.inst_type}`, 120).forEach((l) => { doc.text(l, bx, hy); hy += 3; });
  doc.setFont("helvetica", "normal");

  // right block: FATURA + number + date
  doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(...black);
  doc.text("F A T U R A", W - 14, 13, { align: "right" });
  doc.setFontSize(17); doc.setTextColor(...black); doc.text(inv.number || "—", W - 14, 20.5, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...gray);
  doc.text(`Data de emissão: ${fmtDate(inv.issue_date)}`, W - 14, 25.5, { align: "right" });
  doc.setTextColor(...soft); doc.text("Original · Documento não certificado", W - 14, 30, { align: "right" });

  // divider (preto)
  let y = Math.max(hy + 2, 44);
  doc.setDrawColor(...black); doc.setLineWidth(0.5); doc.line(14, y, W - 14, y); doc.setLineWidth(0.3);

  // info boxes
  y += 4; const cw = (W - 28 - 9) / 4;
  const info = [["DATA DE EMISSÃO", fmtDate(inv.issue_date)], ["VENCIMENTO", fmtDate(inv.due_date)], ["PRAZO DE PAGAMENTO", inv.due_label || "—"], ["MOEDA", cur]];
  info.forEach((c, i) => { const x = 14 + i * (cw + 3); doc.setFillColor(...white); doc.setDrawColor(...lightbd); doc.roundedRect(x, y, cw, 15, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "bold"); doc.setFontSize(5.8); doc.setTextColor(...soft); doc.text(c[0], x + 4, y + 5.5);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(...black); doc.text(String(c[1]), x + 4, y + 11); });

  // REMETENTE / PAGAMENTO A
  y += 21; const half = (W - 28 - 6) / 2;
  doc.setDrawColor(...boxbd); doc.setFillColor(...white); doc.roundedRect(14, y, half, 30, 1.5, 1.5, "S"); doc.roundedRect(14 + half + 6, y, half, 30, 1.5, 1.5, "S");
  doc.setFont("helvetica", "bold"); doc.setFontSize(6.5); doc.setTextColor(...black); doc.text("REMETENTE", 19, y + 7); doc.text("PAGAMENTO A", 19 + half + 6, y + 7);
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...black); doc.text("NOME DO REMETENTE", 19, y + 14);
  const px = 19 + half + 6;
  doc.setFontSize(11); doc.setTextColor(...black); doc.text(String(r.name || b.holder || "—").slice(0, 34), px, y + 13.5);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...gray);
  doc.text(String(b.bank_name || "Banco do Cliente").slice(0, 40), px, y + 18);
  doc.setTextColor(...gray); doc.text("IBAN:", px, y + 22.5);
  doc.setFont("helvetica", "bold"); doc.setTextColor(...black); doc.text((b.iban ? maskIban(b.iban) : "—").slice(0, 34), px + 11, y + 22.5);
  doc.setFont("helvetica", "normal"); doc.setTextColor(...gray); doc.text(`SWIFT: ${swift}`, px, y + 27);
  if (b.entity) { doc.text(`Multibanco: Ent. ${b.entity} · Ref. ${b.reference || "—"}`, px, y + 27); }

  // Banda IBAN em destaque — grande, a negrito, ao centro (preto e branco)
  const ibY = y + 34;
  const ibDisp = b.iban ? maskIban(b.iban) : "—";
  doc.setFillColor(...white); doc.setDrawColor(...boxbd); doc.setLineWidth(0.6); doc.roundedRect(14, ibY, W - 28, 16, 2, 2, "FD"); doc.setLineWidth(0.3);
  doc.setFont("helvetica", "bold"); doc.setFontSize(6.5); doc.setTextColor(...black); doc.text("IBAN PARA PAGAMENTO", W / 2, ibY + 5, { align: "center" });
  doc.setFont("helvetica", "bold"); doc.setFontSize(16.5); doc.setTextColor(...black); doc.text(ibDisp, W / 2, ibY + 12.5, { align: "center" });

  // items table
  y = ibY + 22;
  doc.setFillColor(...black); doc.rect(14, y, W - 28, 8.5, "F"); doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(7.2);
  doc.text("DESCRIÇÃO", 18, y + 5.6);
  doc.text("QTD", 112, y + 5.6, { align: "right" });
  doc.text("PREÇO UN.", 138, y + 5.6, { align: "right" });
  doc.text("DESC.", 156, y + 5.6, { align: "right" });
  doc.text("IVA", 170, y + 5.6, { align: "right" });
  doc.text("TOTAL", W - 16, y + 5.6, { align: "right" });
  y += 8.5; doc.setFont("helvetica", "normal"); doc.setTextColor(...ink); doc.setFontSize(9);
  const vatGroups = {};
  (inv.items || []).forEach((it) => {
    const gross = it.quantity * it.unit_price;
    const net = gross - gross * (it.discount / 100);
    const key = String(it.vat || 0);
    vatGroups[key] = vatGroups[key] || { base: 0, iva: 0 };
    vatGroups[key].base += net; vatGroups[key].iva += net * (Number(it.vat || 0) / 100);
    doc.text(String(it.description || ISSUER.brand).slice(0, 54), 18, y + 6);
    doc.text(String(it.quantity), 112, y + 6, { align: "right" });
    doc.text(eur(it.unit_price, cur), 138, y + 6, { align: "right" });
    doc.text(`${it.discount || 0}%`, 156, y + 6, { align: "right" });
    doc.text(`${it.vat || 0}%`, 170, y + 6, { align: "right" });
    doc.setFont("helvetica", "bold"); doc.text(eur(net, cur), W - 16, y + 6, { align: "right" }); doc.setFont("helvetica", "normal");
    doc.setDrawColor(...lightbd); doc.line(14, y + 9, W - 14, y + 9); y += 9;
  });

  // Band: RESUMO IVA (left) + Totais (right)
  y += 7;
  doc.setFont("helvetica", "bold"); doc.setFontSize(6.5); doc.setTextColor(...black); doc.text("RESUMO DE IVA", 14, y);
  doc.setDrawColor(...lightbd); doc.roundedRect(14, y + 2, 92, 8 + Object.keys(vatGroups).length * 6, 1.5, 1.5, "S");
  doc.setFont("helvetica", "bold"); doc.setFontSize(6.8); doc.setTextColor(...soft);
  doc.text("TAXA", 19, y + 7); doc.text("INCIDÊNCIA", 70, y + 7, { align: "right" }); doc.text("IVA", 102, y + 7, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setTextColor(...ink); doc.setFontSize(8);
  let vy = y + 12;
  Object.entries(vatGroups).forEach(([rate, g]) => { doc.text(`${rate}%`, 19, vy); doc.text(eur(g.base, cur), 70, vy, { align: "right" }); doc.text(eur(g.iva, cur), 102, vy, { align: "right" }); vy += 6; });

  // totais
  const tx = 122, tvx = W - 16; let ty = y + 4; doc.setFontSize(9.5);
  const trow = (label, val, sign) => { doc.setFont("helvetica", "normal"); doc.setTextColor(...gray); doc.text(label, tx, ty); doc.setFont("helvetica", "bold"); doc.setTextColor(...ink); doc.text(`${sign || ""}${eur(val, cur)}`, tvx, ty, { align: "right" }); doc.setFont("helvetica", "normal"); ty += 7.5; };
  trow("Subtotal", t.subtotal);
  trow("Desconto", Math.abs(t.discount || 0), "- ");
  trow("IVA", t.vat);
  ty += 1; doc.setFillColor(...black); doc.roundedRect(tx - 4, ty - 1, tvx - tx + 8, 12, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(12.5); doc.setTextColor(255, 255, 255); doc.text("TOTAL A PAGAR", tx, ty + 6.5);
  doc.text(eur(t.total, cur), tvx, ty + 6.5, { align: "right" });

  // Band: instruções de pagamento (full width)
  y = Math.max(vy, ty + 14) + 6;
  const insH = 40;
  doc.setDrawColor(...boxbd); doc.setFillColor(...white); doc.roundedRect(14, y, W - 28, insH, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(...black); doc.text("INSTRUÇÕES DE PAGAMENTO", 19, y + 6);
  if (inv.qr_code) { try { doc.addImage(inv.qr_code, "PNG", W - 44, y + 6, 28, 28); } catch (e) {} }
  const ix = 19; const pay = [["Banco", b.bank_name || "—"], ["Titular", r.name || b.holder || "—"], ["IBAN", b.iban ? maskIban(b.iban) : "—"], ["SWIFT/BIC", swift]];
  if (b.entity) pay.push(["Multibanco", `Ent. ${b.entity} · Ref. ${b.reference || "—"}`]);
  pay.forEach((p, i) => { const yy = y + 12 + i * 5.4; doc.setFont("helvetica", "normal"); doc.setFontSize(7.6); doc.setTextColor(...soft); doc.text(p[0], ix, yy); doc.setFont("helvetica", p[0] === "IBAN" ? "bold" : "normal"); doc.setTextColor(...(p[0] === "IBAN" ? black : ink)); doc.text(String(p[1]).slice(0, 44), ix + 24, yy); });
  doc.setFont("helvetica", "normal"); doc.setFontSize(6.4); doc.setTextColor(...soft); doc.text("Digitalize o QR para consultar o estado online.", W - 16, y + 37, { align: "right" });

  // nota (barra preta)
  y += insH + 6;
  doc.setDrawColor(...black); doc.setLineWidth(1.1); doc.line(15, y - 3, 15, y + 5); doc.setLineWidth(0.3);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...ink);
  doc.text(`O pagamento deverá ser efetuado no prazo de ${inv.due_label || "—"} a contar da data de emissão.`, 19, y);
  if (inv.company_message) { doc.setTextColor(...gray); doc.setFontSize(7.5); doc.text(doc.splitTextToSize(String(inv.company_message), W - 34), 19, y + 4.5); }

  // footer
  doc.setDrawColor(...lightbd); doc.line(14, 279, W - 14, 279);
  doc.setFontSize(6.8); doc.setTextColor(...soft);
  doc.text(`© ${new Date().getFullYear()} ${ISSUER.brand} · Código de IF ${ISSUER.if_code}`, 14, 283.5);
  doc.text("Processado por INVEST", W - 14, 283.5, { align: "right" });
  doc.setFontSize(6.1);
  const legal = `${ISSUER.brand} — ${ISSUER.inst_type}. Documento emitido eletronicamente; não dispensa a consulta do estado online através do código QR. IVA incluído quando aplicável.`;
  doc.text(doc.splitTextToSize(legal, W - 28), 14, 287.5);

  doc.save(`${inv.number || "fatura"}.pdf`);
}
