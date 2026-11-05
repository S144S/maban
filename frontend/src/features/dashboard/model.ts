export type Category = "home" | "groceries" | "leisure";
export type Transaction = { id: string; title: string; amount: number; kind: "income" | "expense"; category: Category; date: string };
export const categories: { id: Category; title: string; limit: number }[] = [
  { id: "home", title: "خانه و زندگی", limit: 12000000 },
  { id: "groceries", title: "خرید روزمره", limit: 7000000 },
  { id: "leisure", title: "تفریح و خوش‌گذرانی", limit: 6000000 },
];
export const initialTransactions: Transaction[] = [
  { id: "1", title: "خریدهای خانه", amount: 4500000, kind: "expense", category: "groceries", date: "۲۶ مهر" },
  { id: "2", title: "تفریح خانوادگی", amount: 3000000, kind: "expense", category: "leisure", date: "۲۴ مهر" },
  { id: "3", title: "اجارهٔ خانه", amount: 9000000, kind: "expense", category: "home", date: "۵ مهر" },
  { id: "4", title: "درآمد ماهانه", amount: 35000000, kind: "income", category: "home", date: "۱ مهر" },
];
export const formatMoney = (value: number) => new Intl.NumberFormat("fa-IR").format(value);
export function parseAmount(value: string) {
  const normalized = value.replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))).replace(/[,٬\s]/g, "");
  const amount = Number(normalized);
  return /^\d+$/.test(normalized) && Number.isSafeInteger(amount) && amount > 0 && amount <= 1000000000000 ? amount : null;
}
export function summarize(transactions: Transaction[]) {
  const income = transactions.filter(t => t.kind === "income").reduce((sum, t) => sum + t.amount, 0);
  const expense = transactions.filter(t => t.kind === "expense").reduce((sum, t) => sum + t.amount, 0);
  return { income, expense, balance: income - expense };
}
