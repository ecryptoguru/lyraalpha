export interface SupportMessage {
  id: string;
  senderId: string;
  senderRole: "USER" | "AGENT";
  content: string;
  createdAt: string;
  readAt?: string;
}

export interface SupportConversation {
  id: string;
  status: string;
  subject: string;
  userContext: Record<string, unknown>;
  messages: SupportMessage[];
}

function getCurrentPage() {
  return typeof window !== "undefined" ? window.location.pathname : undefined;
}

export async function fetchSupportConversation(): Promise<SupportConversation | null> {
  const response = await fetch("/api/support/conversations");
  if (!response.ok) {
    return null;
  }
  const data = (await response.json()) as { conversation?: SupportConversation };
  return data.conversation ?? null;
}

export async function createSupportConversation(): Promise<SupportConversation | null> {
  const response = await fetch("/api/support/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subject: "General Inquiry", userContext: { currentPage: getCurrentPage() } }),
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as SupportConversation;
}

export async function saveSupportMessage(conversationId: string, content: string): Promise<Response> {
  return fetch("/api/support/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId, content, senderRole: "USER" }),
  });
}

export async function streamSupportReply(
  conversationId: string,
  content: string,
  onChunk: (value: string) => void,
  signal?: AbortSignal,
): Promise<string | null> {
  const response = await fetch("/api/support/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId, content }),
    signal,
  });

  if (!response.ok || !response.body) {
    return null;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    accumulated += decoder.decode(value, { stream: true });
    onChunk(accumulated);
  }

  return accumulated.trim() || null;
}
