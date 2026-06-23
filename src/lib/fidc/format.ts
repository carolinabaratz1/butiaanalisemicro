export const BRL = (v: number | null | undefined, opts: { compact?: boolean } = {}) => {
  if (v == null || Number.isNaN(v)) return "—";
  if (opts.compact) {
    const abs = Math.abs(v);
    if (abs >= 1e9) return `R$ ${(v / 1e9).toFixed(2).replace(".", ",")} bi`;
    if (abs >= 1e6) return `R$ ${(v / 1e6).toFixed(2).replace(".", ",")} mi`;
    if (abs >= 1e3) return `R$ ${(v / 1e3).toFixed(1).replace(".", ",")} mil`;
  }
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
};

export const PCT = (v: number | null | undefined, digits = 2) => {
  if (v == null || Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(digits).replace(".", ",")}%`;
};

export const NUM = (v: number | null | undefined, digits = 2) => {
  if (v == null || Number.isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

export const formatCNPJ = (c: string) =>
  c.replace(/\D/g, "").replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, "$1.$2.$3/$4-$5");

export const monthLabel = (iso: string) => {
  const [y, m] = iso.split("-");
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${months[+m - 1]}/${y.slice(2)}`;
};

export const dateBR = (iso: string) => {
  const [y, m, d] = iso.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
};
