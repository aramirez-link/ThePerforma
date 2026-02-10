import { useEffect, useState } from "react";

type Props = {
  launchDate: string;
};

const format = (ms: number) => {
  if (ms <= 0) return "Live";
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
};

export default function DropCountdown({ launchDate }: Props) {
  const [remaining, setRemaining] = useState("...");

  useEffect(() => {
    const target = new Date(launchDate).getTime();
    const tick = () => {
      const now = Date.now();
      setRemaining(format(target - now));
    };
    tick();
    const id = window.setInterval(tick, 60000);
    return () => window.clearInterval(id);
  }, [launchDate]);

  return (
    <span className="text-xs uppercase tracking-[0.3em] text-gold">{remaining}</span>
  );
}
