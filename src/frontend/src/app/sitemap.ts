import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return ["", "/cart", "/checkout"].map((path) => ({ url: `${baseUrl}${path}`, lastModified: new Date() }));
}