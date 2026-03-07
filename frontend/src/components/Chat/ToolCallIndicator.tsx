export function ToolCallIndicator({ status }: { status: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 py-1 px-2">
      <span className="inline-flex gap-0.5">
        <span className="w-1 h-1 bg-blue-400 rounded-full animate-pulse" />
        <span className="w-1 h-1 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: "200ms" }} />
        <span className="w-1 h-1 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: "400ms" }} />
      </span>
      <span>{status}</span>
    </div>
  );
}
