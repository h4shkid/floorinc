import { useState, useEffect, useRef } from "react";
import { fetchManufacturers } from "../../api/client";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function ManufacturerSelect({ value, onChange }: Props) {
  const [manufacturers, setManufacturers] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchManufacturers().then(setManufacturers).catch(() => {});
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = manufacturers.filter((m) =>
    m.toLowerCase().includes(search.toLowerCase())
  );

  function select(m: string) {
    onChange(m);
    setSearch("");
    setOpen(false);
  }

  function clear() {
    onChange("");
    setSearch("");
    setOpen(false);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div
        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus-within:ring-2 focus-within:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-200 flex items-center gap-1 cursor-pointer"
        onClick={() => setOpen(true)}
      >
        {value ? (
          <>
            <span className="truncate flex-1">{value}</span>
            <button
              onClick={(e) => { e.stopPropagation(); clear(); }}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 shrink-0"
            >
              &times;
            </button>
          </>
        ) : (
          <span className="text-slate-400 dark:text-slate-500 flex-1">All Manufacturers</span>
        )}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-64 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg max-h-64 flex flex-col">
          <input
            autoFocus
            type="text"
            placeholder="Search manufacturers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 border-b border-slate-200 dark:border-slate-600 text-sm outline-none bg-transparent dark:text-slate-200 dark:placeholder-slate-400"
          />
          <div className="overflow-y-auto flex-1">
            <button
              onClick={clear}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-400"
            >
              All Manufacturers
            </button>
            {filtered.map((m) => (
              <button
                key={m}
                onClick={() => select(m)}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-600 truncate ${
                  m === value ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium" : "text-slate-700 dark:text-slate-200"
                }`}
              >
                {m}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-sm text-slate-400 dark:text-slate-500">No results</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
