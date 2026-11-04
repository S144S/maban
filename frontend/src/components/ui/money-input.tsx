import { type ComponentProps, type ChangeEvent } from "react";
import { formatMoneyInput } from "@/lib/money-input";

type MoneyInputProps = Omit<ComponentProps<"input">, "type" | "value" | "defaultValue"> & {
  defaultValue?: string | number;
};

export function MoneyInput({ defaultValue = "", onChange, onKeyDown, onCompositionEnd, ...props }: MoneyInputProps) {
  function format(input: HTMLInputElement) {
    const result = formatMoneyInput(input.value, input.selectionStart ?? input.value.length);
    if (input.value !== result.value) {
      input.value = result.value;
      input.setSelectionRange(result.caret, result.caret);
    }
  }
  function change(event: ChangeEvent<HTMLInputElement>) {
    if (!(event.nativeEvent as InputEvent).isComposing) format(event.currentTarget);
    onChange?.(event);
  }
  return <input {...props} type="text" inputMode="numeric" dir="ltr"
    defaultValue={formatMoneyInput(String(defaultValue)).value} onChange={change}
    onCompositionEnd={event => { format(event.currentTarget); onCompositionEnd?.(event); }}
    onKeyDown={event => {
      onKeyDown?.(event);
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const input = event.currentTarget, start = input.selectionStart;
      if (start === null || start !== input.selectionEnd) return;
      if (event.key === "Backspace" && input.value[start - 1] === "٬") input.setSelectionRange(start - 1, start - 1);
      if (event.key === "Delete" && input.value[start] === "٬") input.setSelectionRange(start + 1, start + 1);
    }} />;
}
