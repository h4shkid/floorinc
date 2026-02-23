import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Factory,
  Mail,
  Phone,
  User,
  ShoppingCart,
  Package,
  Clock,
  ChevronRight,
} from "lucide-react";

export const dynamic = "force-dynamic";

function getRatingBadgeClasses(rating: string): string {
  switch (rating) {
    case "EXCELLENT":
      return "bg-green-100 text-green-800 border-green-300";
    case "GOOD":
      return "bg-blue-100 text-blue-800 border-blue-300";
    case "FAIR":
      return "bg-yellow-100 text-yellow-800 border-yellow-300";
    case "POOR":
      return "bg-red-100 text-red-800 border-red-300";
    default:
      return "bg-gray-100 text-gray-800 border-gray-300";
  }
}

export default async function ManufacturersPage() {
  const manufacturers = await prisma.manufacturer.findMany({
    include: {
      _count: {
        select: {
          orders: true,
          products: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manufacturers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {manufacturers.length} manufacturer{manufacturers.length !== 1 ? "s" : ""} registered
          </p>
        </div>
      </div>

      {manufacturers.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Factory className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-lg font-medium text-slate-700">No manufacturers found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Manufacturers will appear here once they are added to the system.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {manufacturers.map((manufacturer) => (
            <Link
              key={manufacturer.id}
              href={`/admin/manufacturers/${manufacturer.id}`}
              className="block group"
            >
              <Card className="h-full transition-shadow hover:shadow-md group-hover:border-blue-200">
                <CardContent className="p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 bg-slate-100 rounded-lg shrink-0">
                        <Factory className="w-5 h-5 text-slate-600" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-900 truncate">
                          {manufacturer.name}
                        </h3>
                        {manufacturer.location && (
                          <p className="text-xs text-muted-foreground">{manufacturer.location}</p>
                        )}
                        <Badge
                          variant="outline"
                          className={getRatingBadgeClasses(manufacturer.rating)}
                        >
                          {manufacturer.rating}
                        </Badge>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 group-hover:text-blue-500 transition-colors" />
                  </div>

                  {/* Contact info */}
                  <div className="space-y-1.5 mb-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{manufacturer.contactName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{manufacturer.contactEmail}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      <span>{manufacturer.contactPhone}</span>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="space-y-3 border-t pt-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" />
                        Avg Fulfillment
                      </span>
                      <span className="font-medium">
                        {manufacturer.avgFulfillment.toFixed(1)} days
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">On-Time Rate</span>
                        <span className="font-medium">
                          {manufacturer.onTimeRate.toFixed(0)}%
                        </span>
                      </div>
                      <Progress value={manufacturer.onTimeRate} />
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <ShoppingCart className="w-3.5 h-3.5" />
                        Orders
                      </span>
                      <span className="font-medium">{manufacturer._count.orders}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Package className="w-3.5 h-3.5" />
                        Products
                      </span>
                      <span className="font-medium">{manufacturer._count.products}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
