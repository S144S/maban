// Keep exact whole-toman digits; display fractional valuations to at most 3 places.
export function wealthMoney(value: string | null): string {
  if (value === null) return "—";
  const [whole, fraction = ""] = value.split(".");
  const decimals = fraction.slice(0, 3).replace(/0+$/, "");
  if (BigInt(whole) === 0n && /[1-9]/.test(fraction) && !decimals) return whole.startsWith("-") ? "منفی؛ کمتر از ۰٫۰۰۱" : "کمتر از ۰٫۰۰۱";
  return (whole.startsWith("-") && BigInt(whole) === 0n ? "−" : "") + BigInt(whole).toLocaleString("fa-IR") + (decimals ? "٫" + decimals.replace(/\d/g, n => "۰۱۲۳۴۵۶۷۸۹"[Number(n)]) : "");
}
