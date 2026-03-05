import { useState, useEffect, useCallback } from "react";

export interface TourStep {
  target: string;
  title: string;
  content: string;
  placement?: "top" | "bottom" | "left" | "right";
}

interface Props {
  steps: TourStep[];
  run: boolean;
  onFinish: () => void;
}

export function SpotlightTour({ steps, run, onFinish }: Props) {
  const [current, setCurrent] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const updateRect = useCallback(() => {
    if (!run || !steps[current]) return;
    const el = document.querySelector(steps[current].target);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Small delay after scroll to get accurate position
      setTimeout(() => {
        setRect(el.getBoundingClientRect());
      }, 100);
    }
  }, [run, current, steps]);

  useEffect(() => {
    if (!run) {
      setCurrent(0);
      setRect(null);
      return;
    }
    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [run, updateRect]);

  useEffect(() => {
    if (!run) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onFinish();
      if (e.key === "ArrowRight" || e.key === "Enter") {
        if (current < steps.length - 1) setCurrent(current + 1);
        else onFinish();
      }
      if (e.key === "ArrowLeft" && current > 0) setCurrent(current - 1);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [run, current, steps.length, onFinish]);

  if (!run || !rect) return null;

  const step = steps[current];
  const pad = 8;
  const spotLeft = rect.left - pad;
  const spotTop = rect.top - pad;
  const spotW = rect.width + pad * 2;
  const spotH = rect.height + pad * 2;

  // Calculate tooltip position
  const placement = step.placement || "bottom";
  let tooltipStyle: React.CSSProperties = {};
  const tooltipW = 360;

  if (placement === "bottom") {
    tooltipStyle = {
      top: spotTop + spotH + 12,
      left: Math.max(8, Math.min(spotLeft + spotW / 2 - tooltipW / 2, window.innerWidth - tooltipW - 8)),
    };
  } else if (placement === "top") {
    tooltipStyle = {
      bottom: window.innerHeight - spotTop + 12,
      left: Math.max(8, Math.min(spotLeft + spotW / 2 - tooltipW / 2, window.innerWidth - tooltipW - 8)),
    };
  } else if (placement === "right") {
    tooltipStyle = {
      top: spotTop + spotH / 2 - 60,
      left: spotLeft + spotW + 12,
    };
  } else {
    tooltipStyle = {
      top: spotTop + spotH / 2 - 60,
      right: window.innerWidth - spotLeft + 12,
    };
  }

  return (
    <div className="fixed inset-0 z-[9999]" onClick={onFinish}>
      {/* Overlay with spotlight cutout using box-shadow */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: spotLeft,
          top: spotTop,
          width: spotW,
          height: spotH,
          borderRadius: 8,
          boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.55)",
          zIndex: 9999,
        }}
      />

      {/* Spotlight border glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: spotLeft - 2,
          top: spotTop - 2,
          width: spotW + 4,
          height: spotH + 4,
          borderRadius: 10,
          border: "2px solid rgba(59, 130, 246, 0.6)",
          zIndex: 10000,
        }}
      />

      {/* Tooltip */}
      <div
        className="absolute bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-5"
        style={{ ...tooltipStyle, width: tooltipW, zIndex: 10001 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-xs text-slate-400 dark:text-slate-500 mb-1 font-medium">
          {current + 1} / {steps.length}
        </div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">
          {step.title}
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
          {step.content}
        </p>

        {/* Progress bar */}
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1 mb-4">
          <div
            className="bg-blue-500 h-1 rounded-full transition-all duration-300"
            style={{ width: `${((current + 1) / steps.length) * 100}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={onFinish}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            Skip tour
          </button>
          <div className="flex gap-2">
            {current > 0 && (
              <button
                onClick={() => setCurrent(current - 1)}
                className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Back
              </button>
            )}
            <button
              onClick={() => {
                if (current < steps.length - 1) setCurrent(current + 1);
                else onFinish();
              }}
              className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              {current < steps.length - 1 ? "Next" : "Finish"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
