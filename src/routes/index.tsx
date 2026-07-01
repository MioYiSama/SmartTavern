import { Button } from "@base-ui/react/button";
import { Input } from "@base-ui/react/input";
import { chat, toServerSentEventsResponse } from "@tanstack/ai";
import { openRouterText } from "@tanstack/ai-openrouter";
import { useChat, fetchServerSentEvents } from "@tanstack/ai-react";
import type { UIMessage } from "@tanstack/ai-react";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import IconBot from "~icons/lucide/bot";
import IconMessageCircle from "~icons/lucide/message-circle";
import IconSend from "~icons/lucide/send";
import IconSquare from "~icons/lucide/square";

import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/")({
  component: RouteComponent,
  server: {
    handlers: {
      POST: async ({ request }) => {
        console.log(process.env["OPENROUTER_API_KEY"]);

        const abortController = new AbortController();
        const { messages } = await request.json();

        const stream = chat({
          adapter: openRouterText("deepseek/deepseek-v4-flash"),
          messages,
          systemPrompts: ["You are a helpful assistant."],
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
    sendMessage(input.trim());
    setInput("");
  };

  return (
    <div className="mx-auto flex h-dvh max-w-2xl flex-col gap-4 p-4">
      <div className="flex flex-1 flex-col overflow-y-auto">
        {messages.length === 0 && (
          <div className="m-auto flex flex-col items-center gap-2 text-base-content/50">
            <IconMessageCircle className="size-8" />
            <p className="text-sm">{m.chat_empty_state()}</p>
          </div>
        )}
        {messages.map((message: UIMessage) => (
          <div
            key={message.id}
            className={`chat ${message.role === "user" ? "chat-end" : "chat-start"}`}
          >
            {message.role !== "user" && (
              <div className="chat-image avatar avatar-placeholder">
                <div className="size-8 rounded-full bg-neutral text-neutral-content">
                  <IconBot className="size-5" />
                </div>
              </div>
            )}
            <div
              className={`chat-bubble whitespace-pre-wrap ${
                message.role === "user" ? "chat-bubble-primary" : ""
              }`}
            >
              {message.parts.map((part, i) =>
                part.type === "text" ? <span key={i}>{part.content}</span> : null,
              )}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div role="alert" className="alert alert-error alert-soft">
          <span>{error.message}</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Input
          className="input flex-1"
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
