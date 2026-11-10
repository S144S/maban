import { ArrowLeft } from "lucide-react";
import { Button } from "./ui/button";
import "./management-back.css";

export function ManagementBack({ onBack, label = "بازگشت به مدیریت" }: { onBack: () => void; label?: string }) {
  return <Button variant="outline" size="icon" className="management-back" onClick={onBack}
    aria-label={label} title={label}><ArrowLeft aria-hidden="true" /></Button>;
}
