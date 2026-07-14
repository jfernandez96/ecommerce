import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ path: string[] }> };

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length"
]);

function getUpstreamBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5036/api/v1";
}

function buildUpstreamUrl(path: string[], request: NextRequest) {
  const upstreamBase = getUpstreamBaseUrl().replace(/\/+$/, "");
  const joinedPath = path.join("/");
  const base = `${upstreamBase}/${joinedPath}`;
  const query = request.nextUrl.search;
  return `${base}${query}`;
}

function copyRequestHeaders(request: NextRequest) {
  const headers = new Headers();

  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  const cookie = request.headers.get("cookie");
  if (cookie) {
    headers.set("cookie", cookie);
  }

  return headers;
}

function copyResponseHeaders(upstream: Response) {
  const headers = new Headers();

  upstream.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase()) && key.toLowerCase() !== "set-cookie") {
      headers.append(key, value);
    }
  });

  const getSetCookie = (upstream.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const setCookies = typeof getSetCookie === "function" ? getSetCookie.call(upstream.headers) : [];

  for (const cookie of setCookies) {
    headers.append("set-cookie", cookie);
  }

  return headers;
}

async function proxy(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const upstreamUrl = buildUpstreamUrl(path, request);
  const method = request.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";

  try {
    const response = await fetch(upstreamUrl, {
      method,
      headers: copyRequestHeaders(request),
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: "manual"
    });

    return new Response(response.body, {
      status: response.status,
      headers: copyResponseHeaders(response)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown upstream error";
    return NextResponse.json(
      {
        title: "Upstream API unavailable",
        detail: `No se pudo conectar con la API de backend desde el BFF (${method} ${upstreamUrl}). ${message}`
      },
      { status: 502 }
    );
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function OPTIONS(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}
