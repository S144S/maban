import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/http";
import type { Plant } from "./model";

export function PlantImage({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? <div className="plant-photo-error"><p>عکس دریافت نشد.</p><Button variant="ghost" onClick={() => setFailed(false)}>دریافت دوبارهٔ عکس</Button></div>
    : <img className="plant-photo" src={src} alt={`عکس ${name}`} width={640} height={480} loading="lazy" onError={() => setFailed(true)} />;
}

export function PlantPhoto({ plant, familyId, onSaved, activity }: { plant: Plant; familyId: string; onSaved: (message: string) => void; activity: { current: boolean } }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const pending = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    activity.current = !!file || confirm || busy;
    return () => { activity.current = false; };
  }, [file, confirm, busy, activity]);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function save(remove = false) {
    if (pending.current || (!remove && !file)) return;
    pending.current = true; setBusy(true); setError("");
    controller.current = new AbortController();
    try {
      await api(`/families/${familyId}/plants/${plant.id}/photo`, {
        method: remove ? "DELETE" : "PUT", body: remove ? undefined : file, signal: controller.current.signal,
      });
      onSaved(remove ? "عکس گلدون حذف شد." : "عکس گلدون ذخیره شد.");
    } catch (err) {
      if (!controller.current.signal.aborted) setError(errorMessage(err));
    } finally { pending.current = false; setBusy(false); }
  }
  function submit(event: FormEvent) { event.preventDefault(); void save(); }
  return <section className="plant-photo-editor" aria-labelledby="plant-photo-title">
    <h2 id="plant-photo-title">عکس گلدون</h2>
    {plant.photo_url && <PlantImage key={plant.photo_url} src={plant.photo_url} name={plant.name} />}
    <form onSubmit={submit}><fieldset className="dash-form plants-form" disabled={busy}>
      <Button type="button" variant="outline" aria-describedby="plant-photo-hint" onClick={() => input.current?.click()}>{plant.photo_url ? "انتخاب عکس تازه" : "افزودن عکس (اختیاری)"}</Button>
        <input ref={input} id="plant-photo-file" type="file" hidden aria-label="فایل عکس گلدون" accept="image/jpeg,image/png,image/webp" onChange={event => {
          const selected = event.target.files?.[0]; setError(""); setConfirm(false); setFile(null);
          if (!selected) return;
          if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type) || selected.size > 5 * 1024 * 1024 || !selected.size) {
            setError("یه عکس JPEG، PNG یا WebP تا ۵ مگابایت انتخاب کنین."); event.target.value = ""; return;
          }
          setFile(selected);
        }} />
      {file && <p>عکس انتخاب‌شده: <bdi>{file.name}</bdi></p>}
      <p id="plant-photo-hint" className="dash-muted">JPEG، PNG یا WebP، تا ۵ مگابایت و ۲۰ مگاپیکسل. عکس فقط برای اعضای خانواده نمایش داده می‌شه. اطلاعات جانبی عکس موقع ذخیره پاک می‌شه.</p>
      {preview && <><img className="plant-photo" src={preview} alt="پیش‌نمایش عکس انتخاب‌شده" width={640} height={480} onError={() => { setError("پیش‌نمایش عکس باز نشد؛ یه عکس دیگه انتخاب کنین."); setFile(null); if (input.current) input.current.value = ""; }} /><div className="plant-actions"><Button type="submit">{busy ? "در حال ذخیره…" : "ذخیرهٔ عکس"}</Button><Button type="button" variant="outline" onClick={() => { setFile(null); if (input.current) input.current.value = ""; }}>انصراف از انتخاب</Button></div></>}
      {error && <p className="dash-error" role="alert">{error}</p>}
      {busy && <p role="status">در حال ذخیرهٔ تغییرات عکس…</p>}
      {plant.photo_url && !confirm && <Button type="button" variant="ghost" className="plant-delete" onClick={() => setConfirm(true)}>حذف عکس</Button>}
      {confirm && <div className="plant-photo-confirm"><p>عکس فعلی برای همهٔ اعضای خانواده حذف می‌شه. اطلاعات و تاریخچهٔ گلدون حفظ می‌شن.</p><div className="plant-actions"><Button type="button" className="plant-confirm-delete" onClick={() => void save(true)}>حذف عکس فعلی</Button><Button type="button" variant="outline" onClick={() => setConfirm(false)}>انصراف</Button></div></div>}
    </fieldset></form>
  </section>;
}
