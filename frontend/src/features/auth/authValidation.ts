export function normalizeDigits(value: string) {
  return value.replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

export function validPhone(value: string) {
  return /^09\d{9}$/.test(value);
}

// Development UI simulation only. A production server must own OTP verification.
export function verifyDevelopmentOtp(code: string, enabled: boolean, issuedAt: number, now: number, attempts: number) {
  if (!enabled) return "تأیید آزمایشی در این محیط فعال نیست.";
  if (!issuedAt || now - issuedAt >= 120000 || now < issuedAt) return "کد منقضی شده؛ دوباره کد بگیرین.";
  if (attempts >= 5) return "تعداد تلاش‌ها بیش از حد مجازه؛ دوباره کد بگیرین.";
  if (normalizeDigits(code.trim()) !== "12345") return "کد تأیید درست نیست؛ دوباره بررسی کنین.";
  return null;
}
