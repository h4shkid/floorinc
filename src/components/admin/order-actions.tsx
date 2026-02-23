"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Factory,
  Bell,
  Truck,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Manufacturer {
  id: string;
  name: string;
}

interface ActionOrder {
  id: string;
  orderNumber: string;
  status: string;
  manufacturerId: string | null;
}

interface OrderActionsProps {
  order: ActionOrder;
  manufacturers: Manufacturer[];
}

export function OrderActions({ order, manufacturers }: OrderActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedManufacturer, setSelectedManufacturer] = useState("");

  const [shipDialogOpen, setShipDialogOpen] = useState(false);
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");

  async function handleAssign(): Promise<void> {
    if (!selectedManufacturer) {
      toast.error("Please select a manufacturer");
      return;
    }

    setLoading("assign");
    const response = await fetch(`/api/orders/${order.id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manufacturerId: selectedManufacturer }),
    });

    if (!response.ok) {
      const data = await response.json();
      toast.error(data.error ?? "Failed to assign order");
      setLoading(null);
      return;
    }

    toast.success("Order assigned to manufacturer");
    setAssignDialogOpen(false);
    setSelectedManufacturer("");
    setLoading(null);
    router.refresh();
  }

  async function handleNotify(): Promise<void> {
    setLoading("notify");
    const response = await fetch(`/api/orders/${order.id}/notify`, {
      method: "POST",
    });

    if (!response.ok) {
      const data = await response.json();
      toast.error(data.error ?? "Failed to send notification");
      setLoading(null);
      return;
    }

    toast.success("Manufacturer notified successfully");
    setLoading(null);
    router.refresh();
  }

  async function handleShip(): Promise<void> {
    if (!carrier || !trackingNumber) {
      toast.error("Please fill in carrier and tracking number");
      return;
    }

    setLoading("ship");
    const response = await fetch(`/api/orders/${order.id}/ship`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ carrier, trackingNumber }),
    });

    if (!response.ok) {
      const data = await response.json();
      toast.error(data.error ?? "Failed to mark as shipped");
      setLoading(null);
      return;
    }

    toast.success("Order marked as shipped");
    setShipDialogOpen(false);
    setCarrier("");
    setTrackingNumber("");
    setLoading(null);
    router.refresh();
  }

  async function handleEscalate(): Promise<void> {
    setLoading("escalate");
    const response = await fetch(`/api/orders/${order.id}/escalate`, {
      method: "POST",
    });

    if (!response.ok) {
      const data = await response.json();
      toast.error(data.error ?? "Failed to escalate order");
      setLoading(null);
      return;
    }

    toast.success("Order escalated - critical alert created");
    setLoading(null);
    router.refresh();
  }

  const canAssign = order.status === "RECEIVED";
  const canNotify = order.status === "ASSIGNED" && order.manufacturerId;
  const canShip =
    order.status === "ASSIGNED" ||
    order.status === "NOTIFIED";
  const canEscalate =
    order.status !== "DELIVERED" && order.status !== "CANCELLED";

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {canAssign && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAssignDialogOpen(true)}
            disabled={loading !== null}
          >
            <Factory className="mr-1 h-4 w-4" />
            Assign to Manufacturer
          </Button>
        )}

        {canNotify && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleNotify}
            disabled={loading !== null}
          >
            {loading === "notify" ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Bell className="mr-1 h-4 w-4" />
            )}
            Send Notification
          </Button>
        )}

        {canShip && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShipDialogOpen(true)}
            disabled={loading !== null}
          >
            <Truck className="mr-1 h-4 w-4" />
            Mark as Shipped
          </Button>
        )}

        {canEscalate && (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleEscalate}
            disabled={loading !== null}
          >
            {loading === "escalate" ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <AlertTriangle className="mr-1 h-4 w-4" />
            )}
            Escalate
          </Button>
        )}
      </div>

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign to Manufacturer</DialogTitle>
            <DialogDescription>
              Select a manufacturer to fulfill order {order.orderNumber}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="manufacturer-select">Manufacturer</Label>
              <Select
                value={selectedManufacturer}
                onValueChange={setSelectedManufacturer}
              >
                <SelectTrigger id="manufacturer-select">
                  <SelectValue placeholder="Select a manufacturer" />
                </SelectTrigger>
                <SelectContent>
                  {manufacturers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignDialogOpen(false)}
              disabled={loading === "assign"}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={loading === "assign" || !selectedManufacturer}
            >
              {loading === "assign" && (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              )}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ship Dialog */}
      <Dialog open={shipDialogOpen} onOpenChange={setShipDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Shipped</DialogTitle>
            <DialogDescription>
              Enter shipping details for order {order.orderNumber}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="carrier-input">Carrier</Label>
              <Input
                id="carrier-input"
                placeholder="e.g. UPS, FedEx, USPS"
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tracking-input">Tracking Number</Label>
              <Input
                id="tracking-input"
                placeholder="Enter tracking number"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShipDialogOpen(false)}
              disabled={loading === "ship"}
            >
              Cancel
            </Button>
            <Button
              onClick={handleShip}
              disabled={loading === "ship" || !carrier || !trackingNumber}
            >
              {loading === "ship" && (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              )}
              Confirm Shipment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
