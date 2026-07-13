const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5036/api/v1";

function getApiOrigin() {
  try {
    return new URL(apiBaseUrl).origin;
  } catch {
    return "";
  }
}

export function resolveMediaUrl(url?: string | null) {
  if (!url) return "";
  const value = url.trim();
  if (!value) return "";

  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  if (value.startsWith("//")) return `https:${value}`;

  const origin = getApiOrigin();
  if (!origin) return value;

  if (value.startsWith("/")) return `${origin}${value}`;
  return `${origin}/${value}`;
}
