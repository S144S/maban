import { useState } from "react";
import { normalizeDigits } from "./authValidation";

/** One native input preserves autofill, paste, and normal keyboard editing. */
export function OtpInput({ invalid, onChange }: { invalid: boolean; onChange: () => void }) {
  const [value, setValue] = useState("");
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  return (
    <div className="auth-otp" dir="ltr" data-invalid={invalid}>
      <input
        id="otp" name="otp" aria-label="کد تأیید ۵ رقمی"
        inputMode="numeric" autoComplete="one-time-code" required maxLength={5}
        value={value} aria-invalid={invalid}
        aria-describedby={invalid ? "otp-error otp-hint" : "otp-hint"}
        onChange={event => {
          const input = event.currentTarget;
          const nextValue = normalizeDigits(input.value).replace(/\D/g, "").slice(0, 5);
          setValue(nextValue);
          onChange();
          if (nextValue.length === 5 && nextValue !== value) {
            // FormData must read the normalized code before React commits state.
            input.value = nextValue;
            input.form?.requestSubmit();
          }
        }}
        onSelect={event => setSelection({ start: event.currentTarget.selectionStart ?? 0, end: event.currentTarget.selectionEnd ?? 0 })}
        onClick={event => {
          const input = event.currentTarget;
          const bounds = input.getBoundingClientRect();
          const position = Math.min(value.length, Math.max(0, Math.floor((event.clientX - bounds.left) / (bounds.width / 5))));
          input.setSelectionRange(position, position);
        }}
      />
      <div className="auth-otp-slots" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index} className="auth-otp-slot" data-active={index === Math.min(selection.start, 4) || (index >= selection.start && index < selection.end)}>
            {value[index] || <span className="auth-otp-placeholder">−</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
