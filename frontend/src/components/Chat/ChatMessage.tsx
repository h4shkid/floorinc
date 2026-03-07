import type { ChatMessage as ChatMessageType } from "../../hooks/useChat";
import { ToolCallIndicator } from "./ToolCallIndicator";

function formatMarkdown(text: string): string {
  // Bold
  let html = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-slate-200 dark:bg-slate-600 px-1 rounded text-sm">$1</code>');
  // Line breaks
  html = html.replace(/\n/g, "<br />");
  return html;
}

export function ChatMessage({ message }: { message: ChatMessageType }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div className={`max-w-[85%] space-y-1`}>
        {/* Tool call indicators */}
        {!isUser && message.toolCalls?.map((tc, i) => (
          <ToolCallIndicator key={i} status={tc.status} />
        ))}

        {/* Message bubble */}
        {(message.content || message.isStreaming) && (
          <div
            className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
              isUser
                ? "bg-blue-600 text-white"
                : "bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            }`}
          >
            {message.content ? (
              <span dangerouslySetInnerHTML={{ __html: formatMarkdown(message.content) }} />
            ) : message.isStreaming ? (
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
