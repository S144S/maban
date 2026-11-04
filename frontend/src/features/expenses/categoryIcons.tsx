import { Tag, House, ShoppingBasket, Utensils, Car, Bus, HeartPulse, GraduationCap, Shirt, Gamepad2, Gift, Plane, Receipt, Wrench, Baby, PawPrint } from "lucide-react";

export const categoryIcons = [
  { value: "tag", label: "عمومی", Icon: Tag },
  { value: "house", label: "خانه", Icon: House },
  { value: "shopping-basket", label: "خرید", Icon: ShoppingBasket },
  { value: "utensils", label: "غذا", Icon: Utensils },
  { value: "car", label: "خودرو", Icon: Car },
  { value: "bus", label: "رفت‌وآمد", Icon: Bus },
  { value: "heart-pulse", label: "سلامت", Icon: HeartPulse },
  { value: "graduation-cap", label: "آموزش", Icon: GraduationCap },
  { value: "shirt", label: "پوشاک", Icon: Shirt },
  { value: "gamepad-2", label: "تفریح", Icon: Gamepad2 },
  { value: "gift", label: "هدیه", Icon: Gift },
  { value: "plane", label: "سفر", Icon: Plane },
  { value: "receipt", label: "قبض", Icon: Receipt },
  { value: "wrench", label: "تعمیرات", Icon: Wrench },
  { value: "baby", label: "کودک", Icon: Baby },
  { value: "paw-print", label: "حیوانات", Icon: PawPrint },
] as const;

export function CategoryIcon({ name }: { name?: string }) {
  const Icon = categoryIcons.find(item => item.value === name)?.Icon ?? Tag;
  return <Icon size={20} aria-hidden="true" />;
}
