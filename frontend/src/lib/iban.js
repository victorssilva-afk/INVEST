// Portuguese IBAN utilities
export function maskIban(value) {
  const raw = (value || "").replace(/\s+/g, "").toUpperCase();
  return raw.replace(/(.{4})/g, "$1 ").trim();
}

export function cleanIban(value) {
  return (value || "").replace(/\s+/g, "").toUpperCase();
}

// Validate Portuguese IBAN (PT50 + 21 digits = 25 chars) via ISO 7064 mod-97
export function validateIban(value) {
  const iban = cleanIban(value);
  if (!/^PT\d{23}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (c) => c.charCodeAt(0) - 55);
  let remainder = 0;
  for (let i = 0; i < numeric.length; i++) {
    remainder = (remainder * 10 + Number(numeric[i])) % 97;
  }
  return remainder === 1;
}

export const PT_BANKS_MAIN = [
  "Caixa Geral de Depósitos", "Millennium BCP", "Novo Banco", "Banco Santander Totta",
  "Banco BPI", "Banco Montepio", "Crédito Agrícola", "Bankinter", "Banco CTT",
  "ActivoBank", "EuroBic", "Banco Best", "Abanca",
];
export const PT_BANKS_OTHER = [
  "Banco Investimento Global (BiG)", "Banco Primus", "Bison Bank", "CaixaBI",
  "Deutsche Bank Portugal", "Haitong Bank", "Itaú BBA Europe", "Novo Banco dos Açores",
  "Openbank", "BBVA Portugal", "BNP Paribas Portugal", "Citibank Europe",
  "Barclays Bank", "Bank of China", "ICBC (Industrial and Commercial Bank of China)",
  "N26 Bank", "bunq", "Younited Credit", "Banco do Brasil AG (Sucursal em Portugal)",
];
