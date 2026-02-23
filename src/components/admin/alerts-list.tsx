"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Clock,
  AlertTriangle,
  ShieldAlert,
  Package,
  TrendingDown,
  ExternalLink,
  CheckCircle2,
  ArrowUpCircle,
  Mail,
} from "lucide-react";
import { SEVERITY_COLORS, ALERT_SEVERITIES } from "@/lib/constants";
import type { AlertWithRelations } from "@/types";

interface AlertsListProps {
  alerts: AlertWithRelations[];
}

const ALERT_TYPE_ICONS: Record<string, typeof AlertTriangle> = {
  DELAY: Clock,
  OVERDUE: AlertTriangle,
  QUALITY: ShieldAlert,
  STOCK: Package,
  ESCALATION: TrendingDown,
};

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(date).toLocaleDateString();
}

function getSeverityBadgeClasses(severity: string): string {
  switch (severity) {
    case "CRITICAL":
      return "bg-red-100 text-red-800 border-red-300";
    case "HIGH":
      return "bg-orange-100 text-orange-800 border-orange-300";
    case "MEDIUM":
      return "bg-yellow-100 text-yellow-800 border-yellow-300";
    case "LOW":
      return "bg-blue-100 text-blue-800 border-blue-300";
    default:
      return "bg-gray-100 text-gray-800 border-gray-300";
  }
}

export function AlertsList({ alerts }: AlertsListProps) {
  const router = useRouter();
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [showResolved, setShowResolved] = useState(false);
  const [resolvingIds, setResolvingIds] = useState<Set<string>>(new Set());

  const filteredAlerts = alerts.filter((alert) => {
    if (severityFilter !== "ALL" && alert.severity !== severityFilter) {
      return false;
    }
    if (!showResolved && alert.resolved) {
      return false;
    }
    return true;
  });

  async function handleResolve(alertId: string): Promise<void> {
    setResolvingIds((prev) => new Set(prev).add(alertId));

    const response = await fetch(`/api/alerts/${alertId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved: true }),
    });

    if (response.ok) {
      toast.success("Alert resolved successfully");
      router.refresh();
    } else {
      toast.error("Failed to resolve alert");
    }

    setResolvingIds((prev) => {
      const next = new Set(prev);
      next.delete(alertId);
      return next;
    });
  }

  function handleSendReminder(alert: AlertWithRelations): void {
    toast.info(`Reminder sent for alert: ${alert.title}`);
  }

  function handleEscalate(alert: AlertWithRelations): void {
    toast.info(`Alert escalated: ${alert.title}`);
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700">Severity:</span>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  {ALERT_SEVERITIES.map((severity) => (
                    <SelectItem key={severity} value={severity}>
                      {severity.charAt(0) + severity.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700">Show Resolved:</span>
              <Switch checked={showResolved} onCheckedChange={setShowResolved} />
            </div>
            <div className="sm:ml-auto text-sm text-muted-foreground">
              {filteredAlerts.length} alert{filteredAlerts.length !== 1 ? "s" : ""}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alert cards */}
      {filteredAlerts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <p className="text-lg font-medium text-slate-700">No alerts found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {showResolved
                ? "No alerts match your filters."
                : "All clear! Try showing resolved alerts."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => {
            const TypeIcon = ALERT_TYPE_ICONS[alert.type] ?? AlertTriangle;
            const isResolving = resolvingIds.has(alert.id);

            return (
              <Card
                key={alert.id}
                className={alert.resolved ? "opacity-60" : undefined}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                    {/* Icon and content */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`p-2 rounded-lg shrink-0 ${SEVERITY_COLORS[alert.severity]?.split(" ")[0] ?? "bg-gray-100"}`}>
                        <TypeIcon className={`w-4 h-4 ${SEVERITY_COLORS[alert.severity]?.split(" ")[1] ?? "text-gray-600"}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant="outline"
                            className={getSeverityBadgeClasses(alert.severity)}
                          >
                            {alert.severity}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {alert.type.replace("_", " ")}
                          </Badge>
                          {alert.resolved && (
                            <Badge className="bg-green-100 text-green-800 border-green-300">
                              Resolved
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground ml-auto shrink-0">
                            {formatTimeAgo(alert.createdAt)}
                          </span>
                        </div>
                        <h3 className="font-semibold text-slate-900 mt-1">{alert.title}</h3>
                        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                          {alert.message}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          {alert.order && (
                            <Link
                              href={`/admin/orders/${alert.order.id}`}
                              className="flex items-center gap-1 text-blue-600 hover:underline"
                            >
                              <Package className="w-3 h-3" />
                              {alert.order.orderNumber}
                            </Link>
                          )}
                          {alert.manufacturer && (
                            <span className="flex items-center gap-1">
                              <span className="font-medium">{alert.manufacturer.name}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    {!alert.resolved && (
                      <div className="flex items-center gap-2 shrink-0">
                        {alert.order && (
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/admin/orders/${alert.order.id}`}>
                              <ExternalLink className="w-3.5 h-3.5 mr-1" />
                              View Order
                            </Link>
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSendReminder(alert)}
                        >
                          <Mail className="w-3.5 h-3.5 mr-1" />
                          Remind
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          disabled={isResolving}
                          onClick={() => handleResolve(alert.id)}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          {isResolving ? "Resolving..." : "Resolve"}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleEscalate(alert)}
                        >
                          <ArrowUpCircle className="w-3.5 h-3.5 mr-1" />
                          Escalate
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
