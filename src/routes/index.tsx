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
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
        {messages.length === 0 && (
          <div className="m-auto flex flex-col items-center gap-2 text-gray-400">
            <IconMessageCircle className="size-8" />
            <p className="text-sm">{m.chat_empty_state()}</p>
          </div>
        )}
        {messages.map((message: UIMessage) => (
          <div
            key={message.id}
            className={
              message.role === "user"
                ? "flex items-end justify-end gap-2"
                : "flex items-end justify-start gap-2"
            }
          >
            {message.role !== "user" && (
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                <IconBot className="size-5" />
              </div>
            )}
            <div
              className={
                message.role === "user"
                  ? "max-w-[85%] rounded-2xl rounded-br-sm bg-blue-600 px-4 py-2 text-white"
                  : "max-w-[85%] rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-2 text-gray-900"
              }
            >
              {message.parts.map((part, i) =>
                part.type === "text" ? (
                  <span key={i} className="whitespace-pre-wrap">
                    {part.content}
                  </span>
                ) : null,
              )}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error.message}</div>
      )}

      <div className="flex items-center gap-2">
        <Input
          className="h-11 flex-1 rounded-xl border border-gray-200 px-4 text-gray-900 outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/30 disabled:opacity-60"
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
          <Button
            onClick={stop}
            className="flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-gray-900 px-5 font-medium text-white hover:bg-gray-700"
          >
            <IconSquare className="size-4" />
            {m.chat_stop()}
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={!input.trim()}
            className="flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-5 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <IconSend className="size-4" />
            {m.chat_send()}
          </Button>
        )}
      </div>
    </div>
  );
}
