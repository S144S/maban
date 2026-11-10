export const recurrenceLabels = { none: "بدون تکرار", daily: "روزانه", weekly: "هفتگی", fortnightly: "هر دو هفته", monthly: "ماهانه" };
export const deliveryLabels = {
  not_available: "ارسال پیامک فعال نیست",
  scheduled: "پیامک در انتظار موعد",
  accepted: "آخرین پیامک به سرویس‌دهنده ارسال شد؛ تحویل به گوشی تأیید نشده",
  unknown: "نتیجهٔ آخرین ارسال مشخص نیست؛ برای جلوگیری از پیامک تکراری دوباره ارسال نمی‌شه",
  skipped: "آخرین نوبت پیامک ارسال نشد",
};
export type Reminder = {
  id: string; title: string; note?: string | null; due_at: string; recurrence: keyof typeof recurrenceLabels;
  amount_toman: number | null; delivery_status: keyof typeof deliveryLabels; next_delivery_at?: string | null;
  plant_family_id?: string | null; plant_id?: string | null;
};
