import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { Trash2, Minus, MessageCircle, Send } from "lucide-react";
import type { ChatMessage as ChatMessageType } from "../../hooks/useChat";
import { ChatMessage } from "./ChatMessage";

const STARTERS = [
  "What SKUs need reordering?",
  "Show RED urgency items",
  "Top selling products this month",
  "Which vendors have POs arriving this week?",
];

interface Props {
  messages: ChatMessageType[];
  isStreaming: boolean;
  onSend: (text: string) => void;
  onClear: () => void;
  onClose: () => void;
}

export function ChatWindow({ messages, isStreaming, onSend, onClear, onClose }: Props) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit() {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    onSend(text);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="fixed bottom-20 right-6 w-[400px] h-[560px] rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col z-40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Inventory Assistant</h3>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={onClear}
              className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition-colors"
              title="Clear chat"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition-colors"
            title="Minimize"
          >
            <Minus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950 flex items-center justify-center mb-3">
              <MessageCircle className="h-6 w-6 text-blue-500" />
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Ask me anything</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">I can look up inventory, sales, POs, and forecasts</p>
            <div className="space-y-2 w-full">
              {STARTERS.map((q) => (
                <button
                  key={q}
                  onClick={() => onSend(q)}
                  className="w-full text-left px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-slate-200 dark:border-slate-700 px-3 py-2">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about inventory..."
            rows={1}
            disabled={isStreaming}
            className="flex-1 resize-none rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isStreaming}
            className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
