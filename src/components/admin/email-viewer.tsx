"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Mail,
  MailCheck,
  MailX,
  AlertTriangle,
  Bell,
  ArrowUpCircle,
  ShoppingCart,
  ArrowLeft,
  ExternalLink,
  User,
  Clock,
} from "lucide-react";
import { EMAIL_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface SerializedEmail {
  id: string;
  type: string;
  subject: string;
  body: string;
  recipient: string;
  sender: string;
  status: string;
  orderId: string | null;
  manufacturerId: string | null;
  createdAt: string;
  order: {
    id: string;
    orderNumber: string;
    customerName: string;
    [key: string]: unknown;
  } | null;
  manufacturer: {
    id: string;
    name: string;
    [key: string]: unknown;
  } | null;
}

interface EmailViewerProps {
  emails: SerializedEmail[];
}

const EMAIL_TYPE_ICONS: Record<string, typeof Mail> = {
  ORDER_CONFIRMATION: ShoppingCart,
  SHIPPING_NOTIFICATION: MailCheck,
  DELAY_ALERT: AlertTriangle,
  REMINDER: Bell,
  ESCALATION: ArrowUpCircle,
};

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getStatusBadgeClasses(status: string): string {
  switch (status) {
    case "SENT":
      return "bg-blue-100 text-blue-800 border-blue-300";
    case "DELIVERED":
      return "bg-green-100 text-green-800 border-green-300";
    case "FAILED":
      return "bg-red-100 text-red-800 border-red-300";
    case "BOUNCED":
      return "bg-orange-100 text-orange-800 border-orange-300";
    default:
      return "bg-gray-100 text-gray-800 border-gray-300";
  }
}

function getStatusIcon(status: string): typeof Mail {
  switch (status) {
    case "DELIVERED":
      return MailCheck;
    case "FAILED":
    case "BOUNCED":
      return MailX;
    default:
      return Mail;
  }
}

export function EmailViewer({ emails }: EmailViewerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  const filteredEmails = emails.filter((email) => {
    if (typeFilter !== "ALL" && email.type !== typeFilter) return false;
    return true;
  });

  const selectedEmail = selectedId
    ? emails.find((e) => e.id === selectedId) ?? null
    : null;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col lg:flex-row" style={{ height: "calc(100vh - 220px)" }}>
        {/* Left panel: Email list */}
        <div
          className={cn(
            "flex flex-col border-r",
            selectedEmail ? "hidden lg:flex lg:w-[400px]" : "w-full lg:w-[400px]"
          )}
        >
          {/* Filter header */}
          <div className="p-3 border-b bg-slate-50/50">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700 shrink-0">Type:</span>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Types</SelectItem>
                  {EMAIL_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground ml-auto shrink-0">
                {filteredEmails.length} emails
              </span>
            </div>
          </div>

          {/* Email list */}
          <ScrollArea className="flex-1">
            {filteredEmails.length === 0 ? (
              <div className="p-8 text-center">
                <Mail className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No emails found</p>
              </div>
            ) : (
              <div>
                {filteredEmails.map((email, index) => {
                  const TypeIcon = EMAIL_TYPE_ICONS[email.type] ?? Mail;
                  const isSelected = selectedId === email.id;

                  return (
                    <div key={email.id}>
                      <button
                        className={cn(
                          "w-full text-left p-3 hover:bg-slate-50 transition-colors",
                          isSelected && "bg-blue-50 border-l-2 border-l-blue-500"
                        )}
                        onClick={() => setSelectedId(email.id)}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "p-1.5 rounded shrink-0 mt-0.5",
                              isSelected ? "bg-blue-100" : "bg-slate-100"
                            )}
                          >
                            <TypeIcon
                              className={cn(
                                "w-3.5 h-3.5",
                                isSelected ? "text-blue-600" : "text-slate-500"
                              )}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium truncate">
                                {email.subject}
                              </p>
                              <span className="text-xs text-muted-foreground shrink-0">
                                {formatTimeAgo(email.createdAt)}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              To: {email.recipient}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <Badge
                                variant="outline"
                                className={cn("text-[10px] px-1.5 py-0", getStatusBadgeClasses(email.status))}
                              >
                                {email.status}
                              </Badge>
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                {email.type.replace(/_/g, " ")}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </button>
                      {index < filteredEmails.length - 1 && <Separator />}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right panel: Email detail */}
        <div
          className={cn(
            "flex-1 flex flex-col",
            !selectedEmail && "hidden lg:flex"
          )}
        >
          {selectedEmail ? (
            <EmailDetail
              email={selectedEmail}
              onBack={() => setSelectedId(null)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <Mail className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                <p className="text-lg font-medium text-slate-400">
                  Select an email to view
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Click on any email in the list to see its full content
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

interface EmailDetailProps {
  email: SerializedEmail;
  onBack: () => void;
}

function EmailDetail({ email, onBack }: EmailDetailProps) {
  const StatusIcon = getStatusIcon(email.status);

  return (
    <div className="flex flex-col h-full">
      {/* Detail header */}
      <div className="p-4 border-b bg-slate-50/50">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden shrink-0"
            onClick={onBack}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-slate-900 leading-tight">
              {email.subject}
            </h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <Badge
                variant="outline"
                className={getStatusBadgeClasses(email.status)}
              >
                <StatusIcon className="w-3 h-3 mr-1" />
                {email.status}
              </Badge>
              <Badge variant="secondary">
                {email.type.replace(/_/g, " ")}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="px-4 py-3 border-b space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <User className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">From:</span>
          <span className="font-medium">{email.sender}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Mail className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">To:</span>
          <span className="font-medium">{email.recipient}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Sent:</span>
          <span>{formatFullDate(email.createdAt)}</span>
        </div>
        {email.order && (
          <div className="flex items-center gap-2 text-sm">
            <ShoppingCart className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Order:</span>
            <Link
              href={`/admin/orders/${email.order.id}`}
              className="text-blue-600 hover:underline flex items-center gap-1"
            >
              {email.order.orderNumber}
              <ExternalLink className="w-3 h-3" />
            </Link>
            <span className="text-muted-foreground">
              ({email.order.customerName})
            </span>
          </div>
        )}
        {email.manufacturer && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground ml-5">Manufacturer:</span>
            <Link
              href={`/admin/manufacturers/${email.manufacturer.id}`}
              className="text-blue-600 hover:underline flex items-center gap-1"
            >
              {email.manufacturer.name}
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        )}
      </div>

      {/* Email body */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          <div className="prose prose-sm max-w-none">
            <div className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed bg-white rounded-lg border p-4">
              {email.body}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
