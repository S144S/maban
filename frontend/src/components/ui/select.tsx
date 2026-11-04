import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import "./select.css";

type Option = { value: string; label: string; disabled?: boolean };
type SelectProps = {
  id: string;
  name?: string;
  options: Option[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
};

/** Shared RTL selection control with native form serialization and keyboard navigation. */
export function Select({ id, name, options, value, defaultValue, onValueChange, disabled, required }: SelectProps) {
  return <SelectPrimitive.Root dir="rtl" name={name} value={value} defaultValue={defaultValue ?? options[0]?.value} onValueChange={onValueChange} disabled={disabled} required={required}>
    <SelectPrimitive.Trigger id={id} className="maban-select-trigger">
      <SelectPrimitive.Value placeholder="انتخاب کنین" />
      <SelectPrimitive.Icon asChild><ChevronDown size={18} aria-hidden="true" /></SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
    <SelectPrimitive.Portal><SelectPrimitive.Content className="maban-select-content" position="popper" sideOffset={6} collisionPadding={12} dir="rtl">
      <SelectPrimitive.ScrollUpButton className="maban-select-scroll"><ChevronUp size={18} aria-hidden="true" /></SelectPrimitive.ScrollUpButton>
      <SelectPrimitive.Viewport className="maban-select-viewport">
        {options.map(option => <SelectPrimitive.Item key={option.value} value={option.value} disabled={option.disabled} className="maban-select-item">
          <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
          <SelectPrimitive.ItemIndicator className="maban-select-check"><Check size={18} aria-hidden="true" /></SelectPrimitive.ItemIndicator>
        </SelectPrimitive.Item>)}
      </SelectPrimitive.Viewport>
      <SelectPrimitive.ScrollDownButton className="maban-select-scroll"><ChevronDown size={18} aria-hidden="true" /></SelectPrimitive.ScrollDownButton>
    </SelectPrimitive.Content></SelectPrimitive.Portal>
  </SelectPrimitive.Root>;
}
