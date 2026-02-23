"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Package,
  Truck,
  AlertTriangle,
  RotateCcw,
  X,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function DemoToolbar() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault();
        setVisible((prev) => !prev);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleAction = useCallback(
    async function handleAction(
      action: string,
      url: string,
      successMessage: string
    ) {
      if (loading) return;
      setLoading(action);

      try {
        const response = await fetch(url, { method: "POST" });
        const data = await response.json();

        if (!response.ok) {
          toast.error(data.error || `Failed to ${action}`);
          return;
        }

        toast.success(successMessage);
        router.refresh();
      } catch {
        toast.error(`Failed to ${action}. Check the console for details.`);
      } finally {
        setLoading(null);
      }
    },
    [loading, router]
  );

  function handleNewOrder() {
    handleAction(
      "new-order",
      "/api/demo/new-order",
      "New order created successfully"
    );
  }

  function handleShipRandom() {
    handleAction(
      "ship-random",
      "/api/demo/ship-random",
      "Random order shipped successfully"
    );
  }

  function handleSimulateDelay() {
    handleAction(
      "simulate-delay",
      "/api/demo/simulate-delay",
      "Delay alert simulated successfully"
    );
  }

  function handleResetData() {
    handleAction(
      "reset-data",
      "/api/demo/reset",
      "Demo data has been reset"
    );
  }

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 rounded-xl border border-white/10 bg-slate-900/90 p-4 shadow-2xl backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between gap-6 pb-1">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Wrench className="h-4 w-4 text-amber-400" />
          Demo Toolbar
        </div>
        <button
          onClick={() => setVisible(false)}
          className="rounded-md p-0.5 text-slate-400 transition-colors hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="text-xs text-slate-400 pb-1">
        Press <kbd className="rounded bg-slate-700 px-1 py-0.5 text-[10px] font-mono text-slate-300">Ctrl+Shift+D</kbd> to toggle
      </p>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handleNewOrder}
          disabled={loading !== null}
          className="border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
        >
          <Package className="h-3.5 w-3.5" />
          {loading === "new-order" ? "Creating..." : "New Order"}
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={handleShipRandom}
          disabled={loading !== null}
          className="border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
        >
          <Truck className="h-3.5 w-3.5" />
          {loading === "ship-random" ? "Shipping..." : "Ship Random"}
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={handleSimulateDelay}
          disabled={loading !== null}
          className="border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          {loading === "simulate-delay" ? "Simulating..." : "Simulate Delay"}
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={handleResetData}
          disabled={loading !== null}
          className="border-red-800/50 bg-red-950/50 text-red-300 hover:bg-red-900/50 hover:text-red-200"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {loading === "reset-data" ? "Resetting..." : "Reset Data"}
        </Button>
      </div>
    </div>
  );
}
