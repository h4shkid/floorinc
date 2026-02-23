"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Settings,
  Clock,
  Bell,
  Mail,
  Shield,
  User,
  Save,
  AlertTriangle,
  ShoppingCart,
  Truck,
  ArrowUpCircle,
} from "lucide-react";
import {
  DEFAULT_FULFILLMENT_THRESHOLD_DAYS,
  DELAY_THRESHOLD_DAYS,
} from "@/lib/constants";

const EMAIL_TEMPLATE_DATA = [
  {
    type: "ORDER_CONFIRMATION",
    icon: ShoppingCart,
    subject: "Order Confirmation - {{orderNumber}}",
    body: "Dear {{manufacturerName}},\n\nA new order has been assigned to you.\n\nOrder: {{orderNumber}}\nProduct: {{productName}}\nQuantity: {{quantity}}\nShipping Address: {{shippingAddress}}\n\nPlease confirm receipt and provide an estimated ship date.\n\nBest regards,\nFlooringInc Team",
  },
  {
    type: "SHIPPING_NOTIFICATION",
    icon: Truck,
    subject: "Shipping Update - Order {{orderNumber}}",
    body: "Dear {{customerName}},\n\nGreat news! Your order {{orderNumber}} has been shipped.\n\nCarrier: {{carrier}}\nTracking Number: {{trackingNumber}}\n\nYou can track your shipment using the tracking number above.\n\nThank you for your purchase!\nFlooringInc Team",
  },
  {
    type: "DELAY_ALERT",
    icon: AlertTriangle,
    subject: "Order Delay Notice - {{orderNumber}}",
    body: "Dear {{customerName}},\n\nWe regret to inform you that your order {{orderNumber}} is experiencing a delay.\n\nWe are working to resolve this and will keep you updated on the new estimated delivery date.\n\nWe apologize for any inconvenience.\n\nBest regards,\nFlooringInc Team",
  },
  {
    type: "REMINDER",
    icon: Bell,
    subject: "Fulfillment Reminder - Order {{orderNumber}}",
    body: "Dear {{manufacturerName}},\n\nThis is a friendly reminder that order {{orderNumber}} is pending fulfillment.\n\nOrder Date: {{orderDate}}\nDays Since Assigned: {{daysSinceAssigned}}\n\nPlease update the order status at your earliest convenience.\n\nBest regards,\nFlooringInc Team",
  },
  {
    type: "ESCALATION",
    icon: ArrowUpCircle,
    subject: "URGENT: Escalation - Order {{orderNumber}}",
    body: "Dear {{manufacturerName}},\n\nOrder {{orderNumber}} has been escalated due to exceeding the fulfillment threshold.\n\nThis requires immediate attention. Please respond with an update within 24 hours.\n\nRegards,\nFlooringInc Management",
  },
];

const MOCK_USERS = [
  { id: "1", name: "Admin User", email: "admin@floorinc.com", role: "SUPER_ADMIN" },
  { id: "2", name: "John Manager", email: "john@floorinc.com", role: "ADMIN" },
  { id: "3", name: "Premium Floors Contact", email: "contact@premiumfloors.com", role: "MANUFACTURER" },
  { id: "4", name: "Eco Wood Rep", email: "rep@ecowood.com", role: "MANUFACTURER" },
];

function getRoleBadgeClasses(role: string): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "bg-purple-100 text-purple-800 border-purple-300";
    case "ADMIN":
      return "bg-blue-100 text-blue-800 border-blue-300";
    case "MANUFACTURER":
      return "bg-green-100 text-green-800 border-green-300";
    default:
      return "bg-gray-100 text-gray-800 border-gray-300";
  }
}

export default function SettingsPage() {
  const [fulfillmentThreshold, setFulfillmentThreshold] = useState(
    DEFAULT_FULFILLMENT_THRESHOLD_DAYS.toString()
  );
  const [delayThreshold, setDelayThreshold] = useState(
    DELAY_THRESHOLD_DAYS.toString()
  );
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [alertNotifications, setAlertNotifications] = useState(true);
  const [dailyDigest, setDailyDigest] = useState(false);

  function handleSaveGeneral(): void {
    toast.success("Settings saved successfully");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage system configuration and preferences
        </p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="general" className="gap-1.5">
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">General</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5">
            <Mail className="w-4 h-4" />
            <span className="hidden sm:inline">Email Templates</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5">
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">User Management</span>
          </TabsTrigger>
        </TabsList>

        {/* General tab */}
        <TabsContent value="general" className="space-y-6 mt-6">
          {/* Fulfillment Thresholds */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Fulfillment Thresholds
              </CardTitle>
              <CardDescription>
                Configure when alerts and escalations are triggered based on order age
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fulfillment-threshold">
                    Fulfillment Threshold (days)
                  </Label>
                  <Input
                    id="fulfillment-threshold"
                    type="number"
                    min="1"
                    max="30"
                    value={fulfillmentThreshold}
                    onChange={(e) => setFulfillmentThreshold(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Orders exceeding this threshold trigger escalation alerts
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="delay-threshold">
                    Delay Alert Threshold (days)
                  </Label>
                  <Input
                    id="delay-threshold"
                    type="number"
                    min="1"
                    max="30"
                    value={delayThreshold}
                    onChange={(e) => setDelayThreshold(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Orders without updates for this many days trigger delay alerts
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notification Settings
              </CardTitle>
              <CardDescription>
                Control which notifications are enabled
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Email Notifications</p>
                  <p className="text-xs text-muted-foreground">
                    Receive email notifications for new orders and updates
                  </p>
                </div>
                <Switch
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Alert Notifications</p>
                  <p className="text-xs text-muted-foreground">
                    Receive notifications when new alerts are generated
                  </p>
                </div>
                <Switch
                  checked={alertNotifications}
                  onCheckedChange={setAlertNotifications}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Daily Digest</p>
                  <p className="text-xs text-muted-foreground">
                    Receive a daily summary email of all activity
                  </p>
                </div>
                <Switch
                  checked={dailyDigest}
                  onCheckedChange={setDailyDigest}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSaveGeneral} className="gap-1.5">
              <Save className="w-4 h-4" />
              Save Changes
            </Button>
          </div>
        </TabsContent>

        {/* Email Templates tab */}
        <TabsContent value="templates" className="space-y-4 mt-6">
          {EMAIL_TEMPLATE_DATA.map((template) => (
            <Card key={template.type}>
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg shrink-0">
                    <template.icon className="w-5 h-5 text-slate-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-900">
                        {template.type.replace(/_/g, " ")}
                      </h3>
                      <Badge variant="secondary" className="text-xs">
                        {template.type}
                      </Badge>
                    </div>
                    <div className="mt-2 space-y-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Subject</Label>
                        <p className="text-sm font-medium mt-0.5">{template.subject}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Body Preview</Label>
                        <pre className="text-xs text-slate-600 mt-1 p-3 bg-slate-50 rounded-lg border whitespace-pre-wrap font-sans leading-relaxed">
                          {template.body}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* User Management tab */}
        <TabsContent value="users" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="w-5 h-5" />
                User Management
              </CardTitle>
              <CardDescription>
                Manage system users and their roles. Only SUPER_ADMIN users can modify roles.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {MOCK_USERS.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 bg-slate-100 rounded-full shrink-0">
                        <User className="w-4 h-4 text-slate-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{user.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {user.email}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={getRoleBadgeClasses(user.role)}
                    >
                      {user.role.replace("_", " ")}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
