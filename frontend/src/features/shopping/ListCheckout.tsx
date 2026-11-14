import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, ApiError, errorMessage } from "@/lib/http";
import { PurchaseForm, type PurchaseCost } from "./PurchaseForm";

type State = { token: string; has_expense: boolean };

export function ListCheckout({ familyId, listId, listName, onClose, onComplete }: {
  familyId: string; listId: string; listName: string; onClose: () => void; onComplete: () => void;
}) {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);
  const [revision, setRevision] = useState(0);
  const pending = useRef(false);
  const request = useRef({ payload: "", id: "" });
  useEffect(() => {
    const controller = new AbortController();
    setState(null); setError(""); setStale(false);
    void api<{ checkout: State }>(`/families/${familyId}/shopping?list_id=${listId}&status=all`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setState(result.checkout); })
      .catch(err => { if (!controller.signal.aborted) setError(errorMessage(err)); });
    return () => controller.abort();
  }, [familyId, listId, revision]);

  async function complete(cost: PurchaseCost) {
    if (!state || pending.current || stale) return;
    const body = { token: state.token, ...cost };
    const payload = JSON.stringify(body);
    if (request.current.payload !== payload) request.current = { payload, id: crypto.randomUUID() };
    pending.current = true; setBusy(true); setError("");
    try {
      await api(`/families/${familyId}/shopping/lists/${listId}/complete`, {
        method: "POST", body: { ...body, request_id: request.current.id },
      });
      onComplete();
    } catch (err) {
      setError(errorMessage(err));
      setStale(err instanceof ApiError && (err.status === 409 || err.status === 404));
    } finally { pending.current = false; setBusy(false); }
  }

  return <Dialog open onOpenChange={open => { if (!open && !pending.current) onClose(); }}>
    <DialogContent dir="rtl" aria-describedby={undefined} className="shopping-sheet" showCloseButton={!busy}
      onEscapeKeyDown={event => { if (pending.current) event.preventDefault(); }}
      onInteractOutside={event => { if (pending.current) event.preventDefault(); }}>
      <DialogHeader><DialogTitle>هزینهٔ کل لیست چقدر شد؟</DialogTitle></DialogHeader>
      {state ? <PurchaseForm key={revision} familyId={familyId} itemName={listName} hasExpense={state.has_expense}
        disabled={busy || stale} busy={busy} onCancel={onClose} onSave={complete} /> : !error && <p role="status">در حال دریافت لیست خرید…</p>}
      {error && <div className="shopping-error" role="alert"><p>{error}</p>
        {(!state || stale) && <Button variant="outline" onClick={() => setRevision(value => value + 1)}>دریافت دوبارهٔ لیست</Button>}
      </div>}
    </DialogContent>
  </Dialog>;
}
