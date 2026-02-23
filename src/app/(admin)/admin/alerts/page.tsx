import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, ShieldAlert, AlertOctagon, CheckCircle2 } from "lucide-react";
import { AlertsList } from "@/components/admin/alerts-list";
import type { AlertWithRelations } from "@/types";

export const dynamic = "force-dynamic";

const SEVERITY_PRIORITY: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

export default async function AlertsPage() {
  const alerts = await prisma.alert.findMany({
    include: {
      order: {
        include: { product: true },
      },
      manufacturer: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const totalAlerts = alerts.length;
  const criticalCount = alerts.filter((a) => a.severity === "CRITICAL" && !a.resolved).length;
  const highCount = alerts.filter((a) => a.severity === "HIGH" && !a.resolved).length;
  const resolvedCount = alerts.filter((a) => a.resolved).length;

  const sortedAlerts = [...alerts].sort((a, b) => {
    const severityDiff =
      (SEVERITY_PRIORITY[a.severity] ?? 99) - (SEVERITY_PRIORITY[b.severity] ?? 99);
    if (severityDiff !== 0) return severityDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const stats = [
    {
      label: "Total Alerts",
      value: totalAlerts,
      icon: AlertTriangle,
      color: "text-slate-600",
      bg: "bg-slate-100",
    },
    {
      label: "Critical",
      value: criticalCount,
      icon: AlertOctagon,
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      label: "High Priority",
      value: highCount,
      icon: ShieldAlert,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
    {
      label: "Resolved",
      value: resolvedCount,
      icon: CheckCircle2,
      color: "text-green-600",
      bg: "bg-green-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Alerts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitor and manage fulfillment alerts across all orders
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alert list with filters */}
      <AlertsList alerts={sortedAlerts as AlertWithRelations[]} />
    </div>
  );
}
