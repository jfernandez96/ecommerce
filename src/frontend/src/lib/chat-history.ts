export type StoredMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

const STORAGE_KEY = "nova_market_chat_v1";
const MAX_STORED = 40;

export function loadChatHistory(): StoredMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredMessage[]) : [];
  } catch {
    return [];
  }
}

export function saveChatHistory(messages: StoredMessage[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_STORED)));
  } catch {
    // ignore quota errors
  }
}

export function clearChatHistory(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
