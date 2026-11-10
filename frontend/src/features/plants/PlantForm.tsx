import { useEffect, useRef, useState, type FormEvent } from "react";
import { ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { Member } from "../families/api";
import type { Plant } from "./model";

export type PlantFields = { name: string; species: string; location: string; note: string; assignee_id: string | null };
const commonSpecies = ["پتوس", "سانسوریا", "زاموفیلیا", "فیکوس", "بنجامین", "مونسترا (برگ انجیری)", "فیلودندرون", "اسپاتی فیلوم", "آگلونما", "دیفن باخیا", "دراسنا", "یوکا", "شفلرا", "شامادورا", "اریکا", "گندمی", "برگ عبایی", "قاشقی", "حسن یوسف", "بگونیا", "بنفشه آفریقایی", "شمعدانی", "ارکیده", "آنتوریوم", "کالانکوئه", "کاکتوس", "ساکولنت", "آلوئه‌ورا", "یشم", "سرخس"];

export function PlantForm({ plant, members, busy, error, onSubmit }: { plant: Plant | null; members: Member[]; busy: boolean; error: string; onSubmit: (fields: PlantFields, photo: File | null) => void }) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [species, setSpecies] = useState(plant?.species && !commonSpecies.includes(plant.species) ? "other" : plant?.species || "unknown");
  const photoInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!photo) { setPreview(""); return; }
    const url = URL.createObjectURL(photo); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? "").trim();
    onSubmit({ name: value("name"), species: species === "unknown" ? "" : species === "other" ? value("custom_species") : species, location: value("location"), note: value("note"), assignee_id: !plant || value("assignee_id") === "none" ? null : value("assignee_id") }, photo);
  }
  return <form onSubmit={submit}><fieldset className="dash-form plants-form" disabled={busy}>
    <label htmlFor="plant-name">اسم گلدون<input id="plant-name" name="name" defaultValue={plant?.name} maxLength={80} required placeholder="مثلاً پتوس کوچولو" /></label>
    {!plant && <div className="plant-photo-editor">
      <Button type="button" variant="outline" aria-describedby="new-plant-photo-hint" onClick={() => photoInput.current?.click()}><ImagePlus aria-hidden="true" />{photo ? "تغییر عکس انتخاب‌شده" : "افزودن عکس (اختیاری)"}</Button>
      <input ref={photoInput} type="file" hidden aria-label="فایل عکس گلدون" accept="image/jpeg,image/png,image/webp" onChange={event => {
        const file = event.target.files?.[0];
        if (!file) return;
        setPhotoError("");
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || !file.size || file.size > 5 * 1024 * 1024) {
          setPhotoError("یه عکس JPEG، PNG یا WebP تا ۵ مگابایت انتخاب کنین."); event.target.value = ""; return;
        }
        setPhoto(file);
      }} />
      <p id="new-plant-photo-hint" className="dash-muted">JPEG، PNG یا WebP، تا ۵ مگابایت و ۲۰ مگاپیکسل. عکس همراه گلدون ذخیره می‌شه و فقط اعضای خانواده می‌بیننش.</p>
      {preview && <img className="plant-photo" src={preview} alt="پیش‌نمایش عکس گلدون" width={640} height={480} onError={() => { setPhoto(null); setPhotoError("عکس باز نشد؛ یه عکس دیگه انتخاب کنین."); if (photoInput.current) photoInput.current.value = ""; }} />}
      {photo && <><p>عکس انتخاب‌شده: <bdi>{photo.name}</bdi></p><Button type="button" variant="ghost" onClick={() => { setPhoto(null); setPhotoError(""); if (photoInput.current) photoInput.current.value = ""; }}>حذف عکس انتخاب‌شده</Button></>}
      {photoError && <p className="dash-error" role="alert">{photoError}</p>}
    </div>}
    <label htmlFor="plant-species">نوع گیاه (اختیاری)<Select id="plant-species" value={species} onValueChange={setSpecies} disabled={busy} options={[{ value: "unknown", label: "هنوز نمی‌دونم" }, ...commonSpecies.map(value => ({ value, label: value })), { value: "other", label: "نوع دیگه" }]} /></label>
    {species === "other" && <label htmlFor="plant-custom-species">نام نوع گیاه<input id="plant-custom-species" name="custom_species" defaultValue={plant?.species} maxLength={120} required /></label>}
    <label htmlFor="plant-location">محل قرارگیری<input id="plant-location" name="location" defaultValue={plant?.location} maxLength={120} required placeholder="مثلاً کنار پنجرهٔ پذیرایی" /></label>
    {plant && <label htmlFor="plant-assignee">مسئول رسیدگی<Select id="plant-assignee" name="assignee_id" defaultValue={plant?.assignee_id ?? "none"} disabled={busy} options={[{ value: "none", label: "همه با هم؛ بدون مسئول مشخص" }, ...members.map(m => ({ value: m.user_id, label: m.name }))]} /></label>}
    {!plant && <p className="dash-muted">رسیدگی با همهٔ اعضای خانواده‌ست.</p>}
    <label htmlFor="plant-note">یادداشت (اختیاری)<textarea id="plant-note" name="note" defaultValue={plant?.note} maxLength={2000} rows={3} /></label>
    {error && <p role="alert" className="dash-error">{error}</p>}
    <Button type="submit">{busy ? "در حال ذخیره…" : "ذخیرهٔ گلدون"}</Button>
  </fieldset></form>;
}
