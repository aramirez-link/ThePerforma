import { useEffect, useState } from "react";

type Props = {
  children: React.ReactNode;
};

export default function PerformanceMode({ children }: Props) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [enabled]);

  return (
    <div className={enabled ? "fixed inset-0 z-40 bg-black" : ""}>
      <div className={enabled ? "h-full overflow-auto px-3 pb-16 pt-[calc(env(safe-area-inset-top)+0.75rem)] md:p-6" : ""}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.3em] text-white/60">
            Performance Mode
          </p>
          <button
            type="button"
            onClick={() => setEnabled((prev) => !prev)}
            className="rounded-full border border-white/30 px-4 py-2 text-xs uppercase tracking-[0.3em] min-h-11"
          >
            {enabled ? "Exit" : "Enter"}
          </button>
        </div>
        <div className={enabled ? "mt-6 grid gap-6" : "mt-8 grid gap-6"}>
          {children}
        </div>
      </div>
    </div>
  );
}
