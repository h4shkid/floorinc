const styles = {
  BACKORDER: "bg-purple-500 text-white",
  RED: "bg-red-500 text-white",
  YELLOW: "bg-amber-400 text-amber-900",
  GREEN: "bg-green-500 text-white",
} as const;

const labels = {
  BACKORDER: "B/O",
  RED: "RED",
  YELLOW: "YLW",
  GREEN: "OK",
} as const;

export function UrgencyBadge({ urgency }: { urgency: "BACKORDER" | "RED" | "YELLOW" | "GREEN" }) {
  return (
    <span
      className={`inline-flex items-center justify-center w-11 py-0.5 rounded text-[10px] font-bold tracking-wide ${styles[urgency]}`}
      title={urgency === "BACKORDER" ? "Backorder — negative on hand" : urgency}
    >
      {labels[urgency]}
    </span>
  );
}
