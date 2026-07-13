import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/lib/providers";
import { AppChrome } from "@/components/layout/app-chrome";

const plusJakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-plus-jakarta" });
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5036/api/v1";
const PUBLIC_FOOTER_ENDPOINT = API_URL.endsWith("/api")
  ? `${API_URL}/v1/settings/public-footer`
  : `${API_URL}/settings/public-footer`;

export async function generateMetadata(): Promise<Metadata> {
  const defaultTitle = "MARKET";
  const description = "Moda, zapatillas, accesorios, perfumes y relojes con experiencia premium.";

  try {
    const response = await fetch(PUBLIC_FOOTER_ENDPOINT, {
      next: { revalidate: 60 },
    });

    if (response.ok) {
      const data = (await response.json()) as { storeName?: string };
      const storeName = data.storeName?.trim() || defaultTitle;

      return {
        title: storeName,
        description,
        openGraph: { title: storeName, description: "Ecommerce premium moderno y rapido.", type: "website" },
        robots: { index: true, follow: true },
      };
    }
  } catch {
    // Fall back to generic metadata if settings endpoint is unavailable.
  }

  return {
    title: defaultTitle,
    description,
    openGraph: { title: defaultTitle, description: "Ecommerce premium moderno y rapido.", type: "website" },
    robots: { index: true, follow: true },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={plusJakarta.variable}>
        <Providers>
          <AppChrome>{children}</AppChrome>
        </Providers>
      </body>
    </html>
  );
}