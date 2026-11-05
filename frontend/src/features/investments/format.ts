// Preserve decimal precision for large holdings and tiny crypto quantities.
export function formatInvestmentValue(value: string) {
  const [whole, fraction = ""] = value.split(".");
  const tail = fraction.replace(/0+$/, "").replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
  return BigInt(whole).toLocaleString("fa-IR") + (tail ? "٫" + tail : "");
}
