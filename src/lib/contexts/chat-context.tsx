"use client";

import {
  createContext,
  useContext,
  ReactNode,
  useEffect,
  useState,
} from "react";
import { useChat as useAIChat } from "@ai-sdk/react";
import { UIMessage, DefaultChatTransport } from "ai";
import { useFileSystem } from "./file-system-context";
import { setHasAnonWork } from "@/lib/anon-work-tracker";

interface ChatContextProps {
  projectId?: string;
  initialMessages?: any[];
}

interface ChatContextType {
  messages: UIMessage[];
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  status: string;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

function normalizeMessages(messages: any[]): UIMessage[] {
  return messages.map((msg) => {
    if (msg.parts) return msg as UIMessage;
    return {
      id: msg.id || Math.random().toString(36).slice(2),
      role: msg.role,
      parts: msg.content ? [{ type: "text" as const, text: msg.content }] : [],
    };
  });
}

export function ChatProvider({
  children,
  projectId,
  initialMessages = [],
}: ChatContextProps & { children: ReactNode }) {
  const { fileSystem, handleToolCall } = useFileSystem();
  const [input, setInput] = useState("");

  const normalizedMessages = normalizeMessages(initialMessages);

  const { messages, sendMessage, status } = useAIChat({
    messages: normalizedMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({
        files: fileSystem.serialize(),
        projectId,
      }),
    }),
    onToolCall: ({ toolCall }) => {
      handleToolCall({ toolName: toolCall.toolName, args: (toolCall as any).input });
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input);
    setInput("");
  };

  // Track anonymous work
  useEffect(() => {
    if (!projectId && messages.length > 0) {
      setHasAnonWork(messages, fileSystem.serialize());
    }
  }, [messages, fileSystem, projectId]);

  return (
    <ChatContext.Provider
      value={{
        messages,
        input,
        handleInputChange,
        handleSubmit,
        status,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
