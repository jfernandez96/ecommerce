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

  const fullUrl = value.startsWith("/") ? `${origin}${value}` : `${origin}/${value}`;

  if (typeof window === "undefined") return fullUrl;

  try {
    const parsed = new URL(fullUrl);
    const isLocalHost = /^(localhost|127\.0\.0\.1)$/i.test(parsed.hostname);
    const browserHost = window.location.hostname;

    if (isLocalHost && browserHost && !/^(localhost|127\.0\.0\.1)$/i.test(browserHost)) {
      parsed.hostname = browserHost;
      return parsed.toString();
    }
  } catch {
    return fullUrl;
  }

  return fullUrl;
}
