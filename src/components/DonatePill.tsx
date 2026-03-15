import { getDonationHref, getDonationTitle } from "../lib/donate";

type Props = {
  source: string;
  label?: string;
  className?: string;
};

export default function DonatePill({ source, label = "Donate", className = "" }: Props) {
  return (
    <a
      href={getDonationHref(source)}
      target="_blank"
      rel="noreferrer"
      title={getDonationTitle()}
      aria-label={`${label} via Stripe`}
      className={`inline-flex min-h-9 items-center justify-center rounded-full border border-gold/40 bg-black/55 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.22em] text-gold shadow-[0_0_22px_rgba(242,84,45,0.18)] backdrop-blur-md transition hover:border-gold hover:bg-black/70 hover:shadow-[0_0_28px_rgba(242,84,45,0.28)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold ${className}`}
    >
      {label}
    </a>
  );
}
