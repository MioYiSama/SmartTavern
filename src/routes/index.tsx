import { Button } from "@base-ui/react/button";
import { chat, toServerSentEventsResponse } from "@tanstack/ai";
import { openRouterText } from "@tanstack/ai-openrouter";
import { useChat, fetchServerSentEvents } from "@tanstack/ai-react";
import type { UIMessage } from "@tanstack/ai-react";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import IconBot from "~icons/lucide/bot";

import "katex/dist/katex.min.css";
import IconMessageCircle from "~icons/lucide/message-circle";
import IconSend from "~icons/lucide/send";
import IconSquare from "~icons/lucide/square";

import Markdown from "@/components/Markdown";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/")({
  component: RouteComponent,
  server: {
    handlers: {
      POST: async ({ request }) => {
        const abortController = new AbortController();
        const { messages } = await request.json();

        const stream = chat({
          adapter: openRouterText("deepseek/deepseek-v4-flash"),
          messages,
          systemPrompts: [
            "You are a helpful assistant. When writing mathematical expressions, always use KaTeX-compatible delimiters: `$...$` for inline math and `$$...$$` for display math. Do not use `\\( \\)` or `\\[ \\]`.",
          ],
          modelOptions: {
            reasoning: { effort: "medium" },
          },
          abortController,
        });

        return toServerSentEventsResponse(stream, { abortController });
      },
    },
  },
});

function RouteComponent() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, isLoading, error, stop } = useChat({
    connection: fetchServerSentEvents("/"),
  });

  const handleSubmit = () => {
    if (!input.trim()) return;
    void sendMessage(input.trim());
    setInput("");
  };

  return (
    <div className="mx-auto flex h-dvh max-w-2xl flex-col gap-4 p-4">
      <div className="flex flex-1 flex-col overflow-y-auto">
        {messages.length === 0 && (
          <div className="text-base-content/50 m-auto flex flex-col items-center gap-2">
            <IconMessageCircle className="size-8" />
            <p className="text-sm">{m.chat_empty_state()}</p>
          </div>
        )}
        {messages.map((message: UIMessage, idx) => {
          const isUser = message.role === "user";
          const thinkingParts = message.parts.filter((p) => p.type === "thinking");
          const text = message.parts.map((p) => (p.type === "text" ? p.content : "")).join("");
          const hasText = text.length > 0;
          const isStreaming = isLoading && idx === messages.length - 1 && !isUser;
          const mode = isStreaming ? "streaming" : "static";
          return (
            <div key={message.id} className="flex flex-col gap-1">
              {thinkingParts.map((part, i) => (
                <details
                  key={i}
                  open={!hasText}
                  className="bg-base-200 collapse-arrow rounded-box text-base-content/70 collapse text-sm"
                >
                  <summary className="collapse-title font-medium">
                    {hasText ? m.chat_thinking_done() : m.chat_thinking()}
                  </summary>
                  <div className="collapse-content">
                    <Markdown mode={mode} content={part.content} />
                  </div>
                </details>
              ))}
              {(hasText || thinkingParts.length === 0) && (
                <div className={`chat ${isUser ? "chat-end" : "chat-start"}`}>
                  {!isUser && (
                    <div className="chat-image avatar avatar-placeholder">
                      <div className="bg-neutral text-neutral-content size-8 rounded-full">
                        <IconBot className="size-5" />
                      </div>
                    </div>
                  )}
                  <div className={`chat-bubble ${isUser ? "chat-bubble-secondary" : ""}`}>
                    <Markdown mode={mode} content={text} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div role="alert" className="alert alert-error alert-soft">
          <span>{error.message}</span>
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          rows={1}
          className="textarea max-h-40 flex-1 resize-none"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          disabled={isLoading}
          placeholder={m.chat_input_placeholder()}
        />
        {isLoading ? (
          <Button onClick={stop} className="btn btn-neutral">
            <IconSquare className="size-4" />
            {m.chat_stop()}
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={!input.trim()} className="btn btn-primary">
            <IconSend className="size-4" />
            {m.chat_send()}
          </Button>
        )}
      </div>
    </div>
  );
}
