import { prisma } from "@/lib/prisma";
import { EmailViewer } from "@/components/admin/email-viewer";

export const dynamic = "force-dynamic";

export default async function EmailsPage() {
  const emails = await prisma.emailLog.findMany({
    include: {
      order: true,
      manufacturer: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const serializedEmails = emails.map((email) => ({
    ...email,
    createdAt: email.createdAt.toISOString(),
    order: email.order
      ? {
          ...email.order,
          createdAt: email.order.createdAt.toISOString(),
          updatedAt: email.order.updatedAt.toISOString(),
          assignedAt: email.order.assignedAt?.toISOString() ?? null,
          notifiedAt: email.order.notifiedAt?.toISOString() ?? null,
          shippedAt: email.order.shippedAt?.toISOString() ?? null,
          deliveredAt: email.order.deliveredAt?.toISOString() ?? null,
          estimatedShip: email.order.estimatedShip?.toISOString() ?? null,
        }
      : null,
    manufacturer: email.manufacturer
      ? {
          ...email.manufacturer,
          createdAt: email.manufacturer.createdAt.toISOString(),
          updatedAt: email.manufacturer.updatedAt.toISOString(),
        }
      : null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Email Log</h1>
        <p className="text-sm text-muted-foreground mt-1">
          View all email communications sent through the system
        </p>
      </div>

      <EmailViewer emails={serializedEmails} />
    </div>
  );
}
