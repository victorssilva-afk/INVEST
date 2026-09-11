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
  "BPI", "Banco Montepio", "Crédito Agrícola", "Bankinter",
];
export const PT_BANKS_OTHER = [
  "Banco CTT", "ActivoBank", "EuroBic", "Banco BiG", "Banco Invest",
  "Abanca", "Novo Banco dos Açores", "Banco Atlântico Europa", "Revolut", "N26",
];
