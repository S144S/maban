import { ArrowLeft } from "lucide-react";
import { Button } from "./ui/button";
import "./management-back.css";

export function ManagementBack({ onBack }: { onBack: () => void }) {
  return <Button variant="outline" size="icon" className="management-back" onClick={onBack}
    aria-label="بازگشت به مدیریت" title="بازگشت به مدیریت"><ArrowLeft aria-hidden="true" /></Button>;
}
