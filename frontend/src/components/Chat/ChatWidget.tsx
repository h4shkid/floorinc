import { useState } from "react";
import { X, MessageCircle, Sparkles } from "lucide-react";

export function ChatWidget() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && (
        <div className="fixed bottom-20 right-6 w-[360px] rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 z-40 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-blue-600 to-indigo-600">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <h3 className="text-sm font-semibold text-white">Floory</h3>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Coming Soon Body */}
          <div className="px-6 py-10 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 flex items-center justify-center mb-4">
              <Sparkles className="h-8 w-8 text-blue-500 dark:text-blue-400" />
            </div>
            <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Coming Soon</h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-[260px]">
              Floory, your AI assistant, is almost ready. It will help you with inventory questions, forecasts, and more.
            </p>
            <div className="mt-6 px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-950/30 text-xs font-medium text-blue-600 dark:text-blue-400">
              Stay tuned!
            </div>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center"
        title="Floory — AI Assistant"
      >
        {open ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageCircle className="h-6 w-6" />
        )}
      </button>
    </>
  );
}
