type Entry = { id: string; amount_toman: string | number; created_at: string; description?: string | null };
export type IncomeEntry = Entry & { source: string };
export type ExpenseEntry = Entry & { category_name: string; title: string };
export type RecentTransaction = Entry & { kind: "income" | "expense"; label: string };

const sources: Record<string, string> = { salary: "حقوق", subsidy: "یارانه", voucher: "کالابرگ", gift: "هدیه" };

/** Each existing endpoint returns its newest 50 rows; merging them covers the global newest three. */
export function recentTransactions(income: IncomeEntry[], expenses: ExpenseEntry[]): RecentTransaction[] {
  return [
    ...income.map(row => ({ ...row, kind: "income" as const, label: sources[row.source] ?? "دخل" })),
    ...expenses.map(row => ({ ...row, kind: "expense" as const, label: row.category_name || row.title || "خرج" })),
  ].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)
    || b.id.localeCompare(a.id) || a.kind.localeCompare(b.kind)).slice(0, 3);
}
