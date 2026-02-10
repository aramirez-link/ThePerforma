import { useEffect } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function BookingConciergeModal({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-black/75 px-4 py-8 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Request availability">
      <div className="mx-auto max-w-2xl rounded-[2rem] border border-white/20 bg-[#0a0a10]/90 p-6 shadow-[0_0_80px_rgba(242,84,45,0.15)] md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-gold/80">VIP Reservation</p>
            <h3 className="mt-3 font-display text-3xl">Request Availability</h3>
            <p className="mt-3 text-sm text-white/70">A concierge response will follow with routing, timeline, and production fit.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-white/30 px-3 py-2 text-xs uppercase tracking-[0.24em] text-white/70">Close</button>
        </div>

        <form className="mt-8 grid gap-4 md:grid-cols-2" action="/" method="post">
          <label className="grid gap-2 text-xs uppercase tracking-[0.22em] text-white/60">
            Venue Type
            <select name="venueType" className="rounded-2xl border border-white/20 bg-black/40 px-4 py-3 text-sm text-white" defaultValue="Club">
              <option>Club</option>
              <option>Festival</option>
              <option>Private Event</option>
            </select>
          </label>

          <label className="grid gap-2 text-xs uppercase tracking-[0.22em] text-white/60">
            Experience Tier
            <select name="experienceTier" className="rounded-2xl border border-white/20 bg-black/40 px-4 py-3 text-sm text-white" defaultValue="Cinematic Set">
              <option>Cinematic Set</option>
              <option>Full Stage Production</option>
              <option>Headliner Package</option>
            </select>
          </label>

          <input className="rounded-2xl border border-white/20 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/40" name="name" placeholder="Name" aria-label="Name" required />
          <input className="rounded-2xl border border-white/20 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/40" name="email" placeholder="Email" aria-label="Email" required />
          <input className="rounded-2xl border border-white/20 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/40" name="city" placeholder="City" aria-label="City" />
          <input className="rounded-2xl border border-white/20 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/40" name="date" placeholder="Event Date" aria-label="Event date" />

          <textarea className="md:col-span-2 rounded-2xl border border-white/20 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/40" name="notes" rows={4} placeholder="Production and audience details" aria-label="Production and audience details" />

          <button type="submit" className="rounded-full bg-ember px-6 py-3 text-xs uppercase tracking-[0.32em] text-ink">Request Availability</button>
        </form>
      </div>
    </div>
  );
}

