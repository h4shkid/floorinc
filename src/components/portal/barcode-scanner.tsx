"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, XCircle } from "lucide-react";

interface BarcodeScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (decodedText: string) => void;
}

export function BarcodeScanner({
  open,
  onOpenChange,
  onScan,
}: BarcodeScannerProps) {
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef = useRef<InstanceType<any>>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let scanner: InstanceType<any> = null;

    async function startScanner() {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        scanner = new Html5Qrcode("barcode-reader");
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 150 },
            aspectRatio: 1.0,
          },
          (decodedText: string) => {
            onScan(decodedText);
            onOpenChange(false);
          },
          () => {
            // Ignore scan failures (no code in frame)
          }
        );
        setError(null);
      } catch (err: unknown) {
        console.error("Scanner error:", err);
        const message = String(err);
        if (
          message.includes("NotAllowedError") ||
          message.includes("Permission")
        ) {
          setError(
            "Camera access denied. Please allow camera permission and try again."
          );
        } else if (
          message.includes("NotFoundError") ||
          message.includes("no camera")
        ) {
          setError("No camera found on this device.");
        } else {
          setError("Could not start camera. Try again or enter the number manually.");
        }
      }
    }

    // Small delay to ensure the dialog DOM is rendered
    const timeout = setTimeout(startScanner, 300);

    return () => {
      clearTimeout(timeout);
      if (scanner) {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => {});
      }
      scannerRef.current = null;
    };
  }, [open, onScan, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Scan Barcode
          </DialogTitle>
          <DialogDescription>
            Point camera at a barcode or QR code on the shipping label
          </DialogDescription>
        </DialogHeader>

        <div className="px-4 pb-4">
          {error ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <XCircle className="h-12 w-12 text-red-400" />
              <p className="text-sm text-red-600">{error}</p>
              <Button
                variant="outline"
                onClick={() => {
                  setError(null);
                  // Re-trigger by toggling
                  onOpenChange(false);
                  setTimeout(() => onOpenChange(true), 100);
                }}
              >
                Try Again
              </Button>
            </div>
          ) : (
            <div
              ref={containerRef}
              className="relative overflow-hidden rounded-lg bg-black"
            >
              <div id="barcode-reader" className="w-full" />
              <p className="py-2 text-center text-xs text-slate-500">
                Supports barcodes (Code128, Code39, EAN, UPC) and QR codes
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
