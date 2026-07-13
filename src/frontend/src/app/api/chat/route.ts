import { type NextRequest, NextResponse } from "next/server";
import { removeStopwords, spa } from "stopword";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

export type OpenAIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  salePrice?: number;
  stock: number;
  sizesCsv?: string;
};

export type ChatRequestPayload = {
  messages: OpenAIMessage[];
  storeName?: string;
  catalog: {
    products: CatalogProduct[];
    categoryNames: string[];
    activePromotions: number;
  };
};

export type AIActionType = "go_to_checkout" | "go_to_collections" | "go_to_promotions" | "go_to_faq";

export type AIResponse = {
  message: string;
  showProductIds: string[] | null;
  askVariant: { productId: string; productName: string } | null;
  action: AIActionType | null;
  isAIPowered: boolean;
};

const DOMAIN_STOP_WORDS = new Set([
  "ver", "quiero", "busco", "buscar", "mostrar", "muestrame", "ensename", "necesito", "tienes",
  "producto", "productos", "articulo", "articulos", "item", "items",
]);

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function tokenize(value: string): string[] {
  const rawTokens = normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1);

  return removeStopwords(rawTokens, spa)
    .filter((token) => token.length > 1 && !DOMAIN_STOP_WORDS.has(token));
}

function searchCatalog(
  query: string,
  catalog: ChatRequestPayload["catalog"],
  maxPrice: number = Number.POSITIVE_INFINITY,
  includeOutOfStock: boolean = false
) {
  const normalizedQuery = normalizeText(query);
  const tokens = tokenize(query);

  const scoredProducts = catalog.products
    .filter((product) => (includeOutOfStock || product.stock > 0) && (product.salePrice ?? product.price) <= maxPrice)
    .map((product) => {
      const name = normalizeText(product.name);
      const brand = normalizeText(product.brand);
      const category = normalizeText(product.category);
      const haystack = `${name} ${brand} ${category} ${normalizeText(product.sizesCsv ?? "")}`;

      let score = 0;
      for (const token of tokens) {
        if (name.includes(token)) {
          score += 4;
        } else if (brand.includes(token)) {
          score += 3;
        } else if (category.includes(token)) {
          score += 2;
        } else if (haystack.includes(token)) {
          score += 1;
        }
      }

      if (normalizedQuery.length > 3 && name.includes(normalizedQuery)) {
        score += 8;
      }

      return { product, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((item) => item.product);

  const scoredCategories = catalog.categoryNames
    .map((categoryName) => {
      const normalizedCategory = normalizeText(categoryName);
      let score = 0;

      for (const token of tokens) {
        if (normalizedCategory.includes(token)) {
          score += 3;
        }
      }

      if (normalizedQuery.length > 3 && normalizedCategory.includes(normalizedQuery)) {
        score += 5;
      }

      return { categoryName, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((item) => item.categoryName);

  const suggestedProducts = catalog.products
    .filter((product) => product.stock > 0)
    .sort((a, b) => (b.salePrice ?? b.price) - (a.salePrice ?? a.price))
    .slice(0, 3);

  return { products: scoredProducts, categories: scoredCategories, suggestedProducts };
}

function hasDiscount(product: CatalogProduct): boolean {
  return typeof product.salePrice === "number" && product.salePrice < product.price;
}

function isGenericHelpMessage(message: string): boolean {
  const text = normalizeText(message);
  return /puedo ayudarte con productos, promociones, carrito, checkout, envios, pagos y devoluciones/.test(text);
}

function buildCatalogAwareResponse(userText: string, catalog: ChatRequestPayload["catalog"]): AIResponse {
  const q = normalizeText(userText);
  const priceMatch = q.match(/(?:menos\s*de|hasta|por\s*menos\s*de|max)\s*(\d+)/);
  const maxPrice = priceMatch ? Number(priceMatch[1]) : Number.POSITIVE_INFINITY;

  const { products, categories, suggestedProducts } = searchCatalog(userText, catalog, maxPrice);

  if (products.length > 0) {
    const priceNote = Number.isFinite(maxPrice) ? ` por menos de S/${maxPrice}` : "";
    return {
      message: `Revisé todo el catálogo y encontré ${products.length} opción(es) relacionadas${priceNote}. ¿Quieres que abramos una para comprarla?`,
      showProductIds: products.map((product) => product.id),
      askVariant: null,
      action: null,
      isAIPowered: false,
    };
  }

  if (categories.length > 0) {
    return {
      message: `No encontré ese nombre exacto, pero sí categorías relacionadas: ${categories.join(", ")}. ¿Te muestro opciones en una de esas secciones?`,
      showProductIds: null,
      askVariant: null,
      action: "go_to_collections",
      isAIPowered: false,
    };
  }

  if (suggestedProducts.length > 0) {
    const sectionPreview = catalog.categoryNames.slice(0, 5).join(", ");
    return {
      message: `No encontré coincidencia exacta para eso, pero revisé la base y puedo mostrarte alternativas. Secciones disponibles: ${sectionPreview}.`,
      showProductIds: suggestedProducts.map((product) => product.id),
      askVariant: null,
      action: "go_to_collections",
      isAIPowered: false,
    };
  }

  return {
    message: "Ahora mismo no tengo productos activos en catálogo para sugerirte. Inténtalo en unos minutos.",
    showProductIds: null,
    askVariant: null,
    action: null,
    isAIPowered: false,
  };
}

function enrichAIResponseWithCatalog(
  userText: string,
  response: Omit<AIResponse, "isAIPowered">,
  catalog: ChatRequestPayload["catalog"]
): Omit<AIResponse, "isAIPowered"> {
  if (!isGenericHelpMessage(response.message)) {
    return response;
  }

  const enriched = buildCatalogAwareResponse(userText, catalog);
  return {
    message: enriched.message,
    showProductIds: enriched.showProductIds,
    askVariant: response.askVariant,
    action: response.action ?? enriched.action,
  };
}

// ─── System prompt builder ───────────────────────────────────────────────────

function buildSystemPrompt(catalog: ChatRequestPayload["catalog"], storeName?: string): string {
  const resolvedStoreName = storeName?.trim() || "tu tienda";
  const productsText = catalog.products
    .slice(0, 100)
    .map((p) => {
      const priceLabel = p.salePrice ? `S/${p.salePrice} (antes S/${p.price})` : `S/${p.price}`;
      return `ID:${p.id}|"${p.name}"|${p.brand}|${p.category}|${priceLabel}|Stock:${p.stock}|Tallas:${p.sizesCsv ?? "unico"}`;
    })
    .join("\n");

  return `Eres Nova, la asistente virtual de ${resolvedStoreName}, tienda de moda premium online en Peru.
Habla SIEMPRE en español, de forma amigable, concisa y profesional.
Tu ÚNICO objetivo: ayudar al cliente a encontrar productos y acompañarlo hasta completar su compra.

=== CATALOGO (${catalog.products.length} productos) ===
${productsText}

=== SECCIONES: ${catalog.categoryNames.join(", ")} ===
=== PROMOCIONES ACTIVAS: ${catalog.activePromotions} ===

=== REGLAS ===
1. Devuelve SIEMPRE JSON válido, sin texto fuera del JSON.
2. "showProductIds": máximo 5 IDs del catálogo con stock > 0 que coincidan con la búsqueda.
3. "askVariant": cuando el usuario quiera comprar un producto específico, devuelve el ID más relevante del catálogo para iniciar el selector de talla/color.
4. "action": "go_to_checkout" si quiere pagar/ver carrito; "go_to_promotions" para ofertas; "go_to_collections" para ver todo; "go_to_faq" para dudas sobre pedidos, envíos, pagos, cambios, devoluciones o seguridad.
5. Si mencionan presupuesto máximo, filtra por precio <= ese monto.
6. Si no encuentras coincidencias, pide más detalles o sugiere categorías.
7. Al final de cada respuesta, propón una acción concreta para seguir ayudando.

=== ESQUEMA JSON OBLIGATORIO ===
{
  "message": "texto de respuesta en español",
  "showProductIds": ["id1","id2"] | null,
  "askVariant": { "productId": "id", "productName": "nombre" } | null,
  "action": "go_to_checkout" | "go_to_collections" | "go_to_promotions" | "go_to_faq" | null
}`;
}

// ─── Rule-based fallback (no API key) ────────────────────────────────────────

function fallbackResponse(userText: string, catalog: ChatRequestPayload["catalog"]): AIResponse {
  const q = normalizeText(userText);
  const words = q.split(/\W+/).filter((w) => w.length > 2);

  const asksStock = /(stock|disponib|queda|quedan|hay\s+stock|tienen\s+stock|sin\s+stock)/.test(q);
  const asksPromotion = /(promocion|promociones|oferta|ofertas|descuento|rebaja|sale)/.test(q);

  if (asksStock) {
    const { products: stockCandidates } = searchCatalog(userText, catalog, Number.POSITIVE_INFINITY, true);
    const target = stockCandidates[0];

    if (target) {
      if (target.stock > 0) {
        const promoText = hasDiscount(target) ? ` y ahora está en promoción a S/${target.salePrice} (antes S/${target.price})` : "";
        return {
          message: `${target.name} sí tiene stock disponible (${target.stock} unidad(es))${promoText}. ¿Quieres que te lo muestre para comprarlo?`,
          showProductIds: [target.id],
          askVariant: null,
          action: null,
          isAIPowered: false,
        };
      }

      const alternatives = catalog.products
        .filter((product) => product.id !== target.id && product.category === target.category && product.stock > 0)
        .slice(0, 3);

      return {
        message: alternatives.length > 0
          ? `${target.name} está sin stock por ahora. Te muestro ${alternatives.length} alternativa(s) disponibles en ${target.category}.`
          : `${target.name} está sin stock por ahora. Si quieres, te muestro opciones disponibles en otras categorías.`,
        showProductIds: alternatives.length > 0 ? alternatives.map((product) => product.id) : null,
        askVariant: null,
        action: alternatives.length > 0 ? null : "go_to_collections",
        isAIPowered: false,
      };
    }

    return {
      message: "Puedo validar stock en tiempo real. Dime el nombre del producto y te confirmo si está disponible.",
      showProductIds: null,
      askVariant: null,
      action: null,
      isAIPowered: false,
    };
  }

  if (asksPromotion && /(tiene|hay|esta|con)/.test(q)) {
    const { products: promoCandidates } = searchCatalog(userText, catalog, Number.POSITIVE_INFINITY, true);
    const target = promoCandidates[0];

    if (target) {
      if (hasDiscount(target)) {
        return {
          message: `Sí, ${target.name} está en promoción: S/${target.salePrice} (antes S/${target.price}).`,
          showProductIds: [target.id],
          askVariant: null,
          action: null,
          isAIPowered: false,
        };
      }

      return {
        message: `${target.name} no tiene promoción activa en este momento. Si quieres, te muestro productos con descuento disponibles hoy.`,
        showProductIds: null,
        askVariant: null,
        action: "go_to_promotions",
        isAIPowered: false,
      };
    }
  }

  const buyIntent = /quiero\s*comprar|comprar|llevar|agregar|añadir|anadir/.test(q);

  if (buyIntent) {
    const purchasable = catalog.products
      .filter((p) => p.stock > 0)
      .map((p) => ({
        product: p,
        score: words.reduce((total, word) => {
          const haystack = `${p.name} ${p.brand} ${p.category}`
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
          return haystack.includes(word) ? total + 1 : total;
        }, 0),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    const target = purchasable[0]?.product;
    if (target) {
      return {
        message: `Perfecto, vamos a comprar ${target.name}. Te mostraré sus opciones disponibles para continuar.`,
        showProductIds: [target.id],
        askVariant: { productId: target.id, productName: target.name },
        action: null,
        isAIPowered: false,
      };
    }
  }

  if (/ver\s*(?:mi\s*)?carrito|carrito|voy\s*a\s*pagar|quiero\s*pagar|checkout|comprar\s*ahora|ir\s*a\s*pagar|finalizar\s*(?:la\s*)?compra|terminar\s*(?:la\s*)?compra/.test(q)) {
    return { message: "¡Claro! Te llevo a tu carrito para completar la compra.", showProductIds: null, askVariant: null, action: "go_to_checkout", isAIPowered: false };
  }
  if (/como\s*(?:hago|realizo)\s*(?:un\s*)?pedido|como\s*comprar|como\s*funciona/.test(q)) {
    return { message: "Para comprar, elige tus productos, agrégalos al carrito, revisa el carrito y luego completa tus datos en checkout para confirmar el pedido.", showProductIds: null, askVariant: null, action: "go_to_faq", isAIPowered: false };
  }
  if (/envio|entrega|cuanto\s*tarda|tiempo\s*de\s*entrega/.test(q)) {
    return { message: "Realizamos envíos a nivel nacional y normalmente el tiempo de entrega varía entre 1 y 4 días hábiles según la ciudad destino.", showProductIds: null, askVariant: null, action: "go_to_faq", isAIPowered: false };
  }
  if (/metodos?\s*de\s*pago|aceptan\s*pago|tarjeta|yape|transferencia/.test(q)) {
    return { message: "Aceptamos tarjeta, transferencias y billeteras digitales según la configuración activa de la tienda.", showProductIds: null, askVariant: null, action: "go_to_faq", isAIPowered: false };
  }
  if (/cambio|devolucion|devolver|garantia/.test(q)) {
    return { message: "Puedes solicitar cambios o devoluciones según las políticas vigentes del producto. Te muestro la sección de ayuda con ese detalle.", showProductIds: null, askVariant: null, action: "go_to_faq", isAIPowered: false };
  }
  if (/seguridad|datos\s*personales|mis\s*datos|es\s*seguro/.test(q)) {
    return { message: "Aplicamos medidas de seguridad para proteger la información de nuestros clientes y procesar la compra de forma segura.", showProductIds: null, askVariant: null, action: "go_to_faq", isAIPowered: false };
  }
  if (/promo|oferta|descuento|sale|rebaja/.test(q)) {
    const msg = catalog.activePromotions > 0
      ? `¡Tenemos ${catalog.activePromotions} promoción(es) activa(s)! Te las muestro.`
      : "Por ahora no hay promociones activas, ¡pero tenemos excelentes precios todos los días!";
    return { message: msg, showProductIds: null, askVariant: null, action: "go_to_promotions", isAIPowered: false };
  }
  if (/ver\s*todo|catalogo|coleccion|secciones|menu|que\s*tienen/.test(q)) {
    return { message: `Tenemos estas secciones: ${catalog.categoryNames.join(", ")}. ¿Por cuál empezamos?`, showProductIds: null, askVariant: null, action: "go_to_collections", isAIPowered: false };
  }

  const priceMatch = q.match(/(?:menos\s*de|hasta|por\s*menos\s*de|max)\s*(\d+)/);
  const maxPrice = priceMatch ? Number(priceMatch[1]) : Number.POSITIVE_INFINITY;
  const { products: matched } = searchCatalog(userText, catalog, maxPrice);

  if (matched.length > 0) {
    const priceNote = Number.isFinite(maxPrice) ? ` por menos de S/${maxPrice}` : "";
    return {
      message: `Encontré ${matched.length} opción(es)${priceNote} que podrían interesarte:`,
      showProductIds: matched.map((p) => p.id),
      askVariant: null,
      action: null,
      isAIPowered: false,
    };
  }

  return buildCatalogAwareResponse(userText, catalog);
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatRequestPayload;
    const { messages, catalog, storeName } = body;
    const lastUser = [...messages].reverse().find((m) => m.role === "user");

    if (!OPENAI_API_KEY) {
      return NextResponse.json(fallbackResponse(lastUser?.content ?? "", catalog));
    }

    const systemPrompt = buildSystemPrompt(catalog, storeName);
    const aiMessages: OpenAIMessage[] = [
      { role: "system", content: systemPrompt },
      ...messages.slice(-12),
    ];

    const openaiRes = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: aiMessages,
        response_format: { type: "json_object" },
        max_tokens: 500,
        temperature: 0.75,
      }),
      signal: AbortSignal.timeout(18_000),
    });

    if (!openaiRes.ok) {
      throw new Error(`OpenAI ${openaiRes.status}`);
    }

    const aiData = (await openaiRes.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = aiData.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as Omit<AIResponse, "isAIPowered">;
    const enriched = enrichAIResponseWithCatalog(lastUser?.content ?? "", parsed, catalog);

    return NextResponse.json({ ...enriched, isAIPowered: true } satisfies AIResponse);
  } catch (error) {
    console.error("[POST /api/chat]", error);
    return NextResponse.json({
      message: "Tuve un pequeño inconveniente. Intenta de nuevo.",
      showProductIds: null,
      askVariant: null,
      action: null,
      isAIPowered: false,
    } satisfies AIResponse);
  }
}
