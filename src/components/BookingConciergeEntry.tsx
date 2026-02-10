import { useState } from "react";
import BookingConciergeModal from "./BookingConciergeModal";

export default function BookingConciergeEntry() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-full bg-ember px-6 py-3 text-xs uppercase tracking-[0.34em] text-ink">
        Request Availability
      </button>
      <BookingConciergeModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
