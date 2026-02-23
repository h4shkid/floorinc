"use client";

import { format } from "date-fns";
import { Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimelineOrder {
  status: string;
  createdAt: string;
  assignedAt: string | null;
  notifiedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
}

interface OrderTimelineProps {
  order: TimelineOrder;
}

interface TimelineStep {
  label: string;
  status: string;
  timestamp: string | null;
}

const STATUS_ORDER = ["RECEIVED", "ASSIGNED", "NOTIFIED", "SHIPPED", "DELIVERED"];

function getStepState(
  stepIndex: number,
  currentIndex: number,
  orderStatus: string
): "completed" | "current" | "upcoming" {
  if (orderStatus === "CANCELLED" || orderStatus === "DELAYED") {
    if (stepIndex < currentIndex) return "completed";
    if (stepIndex === currentIndex) return "current";
    return "upcoming";
  }

  if (stepIndex < currentIndex) return "completed";
  if (stepIndex === currentIndex) return "current";
  return "upcoming";
}

export function OrderTimeline({ order }: OrderTimelineProps) {
  const steps: TimelineStep[] = [
    { label: "Received", status: "RECEIVED", timestamp: order.createdAt },
    { label: "Assigned", status: "ASSIGNED", timestamp: order.assignedAt },
    { label: "Notified", status: "NOTIFIED", timestamp: order.notifiedAt },
    { label: "Shipped", status: "SHIPPED", timestamp: order.shippedAt },
    { label: "Delivered", status: "DELIVERED", timestamp: order.deliveredAt },
  ];

  const currentStatusIndex = STATUS_ORDER.indexOf(order.status);
  const effectiveIndex = currentStatusIndex === -1 ? 0 : currentStatusIndex;

  const isCancelledOrDelayed =
    order.status === "CANCELLED" || order.status === "DELAYED";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Order Progress
        </h3>
        {isCancelledOrDelayed && (
          <span
            className={cn(
              "text-xs font-bold px-2 py-1 rounded",
              order.status === "CANCELLED"
                ? "bg-gray-100 text-gray-700"
                : "bg-red-100 text-red-700"
            )}
          >
            {order.status}
          </span>
        )}
      </div>

      <div className="relative flex items-start justify-between">
        {/* Connecting line */}
        <div className="absolute top-5 left-5 right-5 h-0.5 bg-gray-200" />
        <div
          className="absolute top-5 left-5 h-0.5 bg-blue-500 transition-all duration-500"
          style={{
            width: `${(effectiveIndex / (steps.length - 1)) * 100}%`,
            maxWidth: "calc(100% - 40px)",
          }}
        />

        {steps.map((step, index) => {
          const state = getStepState(index, effectiveIndex, order.status);

          return (
            <div
              key={step.status}
              className="relative z-10 flex flex-col items-center"
              style={{ width: `${100 / steps.length}%` }}
            >
              {/* Circle */}
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300",
                  state === "completed" && "border-blue-500 bg-blue-500 text-white",
                  state === "current" &&
                    "border-blue-500 bg-white text-blue-500 ring-4 ring-blue-100 animate-pulse",
                  state === "upcoming" &&
                    "border-gray-300 bg-white text-gray-300"
                )}
              >
                {state === "completed" ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <Clock className="h-4 w-4" />
                )}
              </div>

              {/* Label */}
              <span
                className={cn(
                  "mt-2 text-xs font-medium text-center",
                  state === "completed" && "text-blue-600",
                  state === "current" && "text-blue-600 font-bold",
                  state === "upcoming" && "text-gray-400"
                )}
              >
                {step.label}
              </span>

              {/* Timestamp */}
              {step.timestamp ? (
                <span className="mt-0.5 text-[10px] text-muted-foreground text-center">
                  {format(new Date(step.timestamp), "MMM d, h:mm a")}
                </span>
              ) : (
                <span className="mt-0.5 text-[10px] text-gray-300 text-center">
                  Pending
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
