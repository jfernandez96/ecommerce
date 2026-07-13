"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Loader2, MessageCircle, Send, ShoppingCart, Sparkles, Trash2, X } from "lucide-react";
import type { ProductDetail, ProductSummary } from "@/lib/api";
import { getCategories, getProductBySlug, getProducts, getPromotions } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/media-url";
import { useCartStore } from "@/store/cart-store";
import { useStore } from "@/lib/hooks/store-context";
import type { AIResponse, CatalogProduct, OpenAIMessage } from "@/app/api/chat/route";
import { clearChatHistory, loadChatHistory, saveChatHistory } from "@/lib/chat-history";
import type { StoredMessage } from "@/lib/chat-history";

// ─── Types ────────────────────────────────────────────────────────────────────

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  products?: ProductSummary[];
  action?: AIResponse["action"];
  link?: { href: string; label: string };
  isAI?: boolean;
  timestamp: number;
};

type RouteIntent = {
  message: string;
  href: string;
  label: string;
};

type PurchaseFlow =
  | { phase: "idle" }
  | { phase: "loading"; productId: string; productName: string }
  | { phase: "selecting"; product: ProductDetail; selectedColor: string | null; selectedSize: string | null; quantity: number };

// ─── Constants ────────────────────────────────────────────────────────────────

const QUICK_CHIPS = ["Ver promociones", "Quiero un polo", "Ver todo el catálogo", "Zapatillas disponibles"];

const ACTION_LABEL: Record<NonNullable<AIResponse["action"]>, string> = {
  go_to_checkout: "Ir a pagar",
  go_to_collections: "Ver catálogo",
  go_to_promotions: "Ver promociones",
  go_to_faq: "Abrir ayuda",
};

const toSlug = (value: string) => normalizeText(value).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const singularize = (value: string) => value.replace(/es$/i, "").replace(/s$/i, "");

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getCommerceIntent(value: string): "cart" | "checkout" | null {
  const text = normalizeText(value);
  if (/(voy\s*a\s*pagar|quiero\s*pagar|ir\s*a\s*pagar|finalizar\s*(?:la\s*)?compra|terminar\s*(?:la\s*)?compra|continuar\s*(?:con\s*)?(?:la\s*)?compra|procesar\s*(?:mi\s*)?pedido|tramitar\s*(?:mi\s*)?pedido|checkout|pagar\s*ahora|comprar\s*ahora)/.test(text)) {
    return "checkout";
  }

  if (/(ver\s*(?:mi\s*)?carrito|abrir\s*(?:mi\s*)?carrito|mostrar\s*(?:mi\s*)?carrito|ensename\s*(?:mi\s*)?carrito|ver\s*(?:mi\s*)?bolsa|revisar\s*(?:mi\s*)?pedido|ver\s*(?:mis\s*)?productos|carrito)/.test(text)) {
    return "cart";
  }

  return null;
}

function isAddToCartIntent(value: string) {
  const text = normalizeText(value);
  return (
    /(agrega(?:lo|la)?|anade(?:lo|la)?|anadir(?:lo|la)?|pon(?:lo|la)?|mete(?:lo|la)?|lleva(?:lo|la)?).*(carrito|bolsa)/.test(text) ||
    /(?:agregalo|agregala|anadelo|anadela|anadirlo|anadirla|compralo|comprarla|llevalo|llevala)/.test(text)
  );
}

function findProductInText(value: string, products: ProductSummary[]) {
  const text = normalizeText(value);
  return [...products]
    .sort((left, right) => right.name.length - left.name.length)
    .find((product) => matchesCatalogTerm(text, product.name));
}

function parseQuantityValue(value: string) {
  const text = normalizeText(value);
  const digitMatch = text.match(/(?:cantidad\s*)?(\d{1,2})/);
  if (digitMatch) return Number(digitMatch[1]);

  const quantityWords: Array<[string, number]> = [
    ["una", 1], ["uno", 1], ["un ", 1],
    ["dos", 2], ["tres", 3], ["cuatro", 4], ["cinco", 5],
    ["seis", 6], ["siete", 7], ["ocho", 8], ["nueve", 9], ["diez", 10],
  ];

  const found = quantityWords.find(([word]) => text.includes(word));
  return found?.[1] ?? null;
}

function findMatchingOption(value: string, options: string[]) {
  const text = normalizeText(value);
  return options.find((option) => {
    const normalizedOption = normalizeText(option);
    return text.includes(normalizedOption) || normalizedOption.includes(text);
  }) ?? null;
}

function resolveSpokenSize(value: string, availableSizes: string[]) {
  const text = normalizeText(value);
  const aliasMap: Record<string, string[]> = {
    xs: ["xs", "extra small", "extra chico"],
    s: ["s", "small", "pequena", "pequeña", "chica"],
    m: ["m", "medium", "mediana"],
    l: ["l", "large", "grande"],
    xl: ["xl", "extra large", "extra grande"],
    xxl: ["xxl", "doble xl", "doble extra grande"],
  };

  for (const size of availableSizes) {
    const normalizedSize = normalizeText(size);
    const aliases = aliasMap[normalizedSize] ?? [normalizedSize];
    if (aliases.some((alias) => text.includes(alias))) {
      return size;
    }
  }

  return findMatchingOption(value, availableSizes);
}

function buildSelectionReply(params: {
  productName: string;
  selectedColor: string | null;
  selectedSize: string | null;
  quantity: number;
  needsColor: boolean;
  needsSize: boolean;
}) {
  const { productName, selectedColor, selectedSize, quantity, needsColor, needsSize } = params;
  const parts = [`Estoy configurando ${productName}.`];

  if (selectedColor) parts.push(`Color: ${selectedColor}.`);
  if (selectedSize) parts.push(`Talla: ${selectedSize}.`);
  parts.push(`Cantidad: ${quantity}.`);

  if (needsColor || needsSize) {
    const missing: string[] = [];
    if (needsColor) missing.push("color");
    if (needsSize) missing.push("talla");
    parts.push(`Aún necesito ${missing.join(" y ")} para agregarlo al carrito.`);
  } else {
    parts.push("Si quieres, ahora dime 'agrégalo al carrito'.");
  }

  return parts.join(" ");
}

function matchesCatalogTerm(text: string, candidate: string) {
  const normalizedCandidate = normalizeText(candidate);
  const singularCandidate = singularize(normalizedCandidate);
  return text.includes(normalizedCandidate) || text.includes(singularCandidate);
}

function resolveFaqHref(text: string) {
  if (/cambio|devolucion|devolver/.test(text)) return "/preguntas-frecuentes#cambios";
  if (/terminos|condiciones/.test(text)) return "/preguntas-frecuentes#terminos";
  return "/preguntas-frecuentes";
}

function pickPreferredAssistantVoice(voices: SpeechSynthesisVoice[]) {
  const spanishVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith("es"));
  if (spanishVoices.length === 0) return null;

  const femaleHints = [
    "female", "woman", "mujer", "maria", "sofia", "paulina", "helena", "isabella", "laura", "sabina", "monica", "elvira",
  ];

  const localePriority = ["es-pe", "es-mx", "es-es", "es-us"];

  const scoreVoice = (voice: SpeechSynthesisVoice) => {
    const name = voice.name.toLowerCase();
    const lang = voice.lang.toLowerCase();
    let score = 0;

    const localeIndex = localePriority.findIndex((locale) => lang.startsWith(locale));
    if (localeIndex >= 0) {
      score += 12 - localeIndex * 2;
    }

    if (femaleHints.some((hint) => name.includes(hint))) {
      score += 20;
    }

    if (name.includes("google")) score += 3;
    if (name.includes("microsoft")) score += 2;
    if (voice.default) score += 1;

    return score;
  };

  return [...spanishVoices].sort((left, right) => scoreVoice(right) - scoreVoice(left))[0] ?? spanishVoices[0];
}

function resolveRouteIntent(value: string, categories: Awaited<ReturnType<typeof getCategories>>, products: ProductSummary[]): RouteIntent | null {
  const text = normalizeText(value);

  if (/(preguntas|faq|ayuda|envio|entrega|cambio|devolucion|terminos|seguridad|metodos?\s*de\s*pago|pago\s*aceptan)/.test(text)) {
    return {
      message: "Te llevo a la sección de ayuda para que revises la información de la plataforma sobre pedidos, envíos, pagos y devoluciones.",
      href: resolveFaqHref(text),
      label: "Abrir ayuda",
    };
  }

  if (/(promo|oferta|descuento|sale|rebaja)/.test(text)) {
    return {
      message: "Te llevo a promociones para que revises las ofertas activas.",
      href: "/promociones",
      label: "Abrir promociones",
    };
  }

  if (/(catalogo|coleccion|ver\s*todo|mostrar\s*todo|tienen\s*todo)/.test(text)) {
    return {
      message: "Te llevo al catálogo completo para que explores todos los productos.",
      href: "/collections",
      label: "Abrir catálogo",
    };
  }

  const matchedProduct = products.find((product) => matchesCatalogTerm(text, product.name));
  if (matchedProduct && /(ver|abrir|detalle|producto|buscar|busco|quiero|muestrame|mostrar|ensename|necesito|tienen|hay)/.test(text)) {
    return {
      message: `Te llevo al detalle de ${matchedProduct.name} para que revises la información y puedas comprarlo.`,
      href: `/products/${matchedProduct.slug}`,
      label: "Ver producto",
    };
  }

  const rootCategories = categories.filter((category) => !category.parentId && category.isActive);
  const childCategories = categories.filter((category) => !!category.parentId && category.isActive);
  const rootsById = new Map(rootCategories.map((category) => [category.id, category]));

  const matchedChild = [...childCategories]
    .sort((left, right) => right.name.length - left.name.length)
    .find((category) => matchesCatalogTerm(text, category.name));

  if (matchedChild) {
    const root = matchedChild.parentId ? rootsById.get(matchedChild.parentId) : undefined;
    if (root) {
      return {
        message: `Te llevo a ${matchedChild.name} dentro de ${root.name} para que veas opciones relacionadas.`,
        href: `/seccion/${root.slug}?categoria=${matchedChild.slug}`,
        label: `Ver ${matchedChild.name}`,
      };
    }

    return {
      message: `Te llevo a la categoría ${matchedChild.name} para que revises los productos disponibles.`,
      href: `/categoria/${matchedChild.slug}`,
      label: `Ver ${matchedChild.name}`,
    };
  }

  const matchedRoot = [...rootCategories]
    .sort((left, right) => right.name.length - left.name.length)
    .find((category) => matchesCatalogTerm(text, category.name));

  if (matchedRoot) {
    return {
      message: `Te llevo a la sección ${matchedRoot.name} para que explores los productos disponibles.`,
      href: `/seccion/${matchedRoot.slug}`,
      label: `Abrir ${matchedRoot.name}`,
    };
  }

  const categoryFromProducts = Array.from(new Set(products.map((product) => product.category).filter(Boolean))).find((category) => matchesCatalogTerm(text, category));
  if (categoryFromProducts) {
    return {
      message: `Te llevo al catálogo filtrado por ${categoryFromProducts} para que revises los resultados.`,
      href: `/collections?categoria=${toSlug(categoryFromProducts)}`,
      label: `Ver ${categoryFromProducts}`,
    };
  }

  const priceMatch = text.match(/(?:menos\s*de|hasta|por\s*menos\s*de|max(?:imo)?)\s*(\d+)/);
  if (priceMatch && /(buscar|busco|quiero|mostrar|muestrame|ensename|ver|tienen|hay)/.test(text)) {
    return {
      message: `Te llevo al catálogo con productos de hasta S/${priceMatch[1]} para que compares opciones.`,
      href: `/collections?max=${priceMatch[1]}`,
      label: "Ver resultados",
    };
  }

  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VirtualShopAssistant() {
  const { storeName } = useStore();
  const pathname = usePathname();
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);
  const openDrawer = useCartStore((s) => s.openDrawer);
  const cartItemsCount = useCartStore((s) => s.items.length);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const lastSpokenMessageIdRef = useRef<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const sendMessageRef = useRef<(text?: string) => Promise<void> | void>(() => undefined);
  const autoListenTimeoutRef = useRef<number | null>(null);
  const handleAddToCartRef = useRef<() => void>(() => undefined);
  const lastContextProductIdRef = useRef<string | null>(null);
  const lastVoiceUtteranceRef = useRef<{ text: string; at: number } | null>(null);
  const muteSpeechMessageIdRef = useRef<string | null>(null);
  const activatedAtRef = useRef<number>(0);

  // Build dynamic welcome messages with store name
  const WELCOME_TEXT = `¡Hola! Soy Nova, tu asistente de ${storeName}. Puedo ayudarte a encontrar productos, ver promociones y acompañarte hasta completar tu compra. ¿Qué estás buscando hoy?`;
  const ASSISTANT_GREETING_TEXT = `Hola, bienvenido a ${storeName}. Soy Nova y ya estoy lista para ayudarte con productos, categorías, carrito y compra. Solo háblame.`;

  const [isOpen, setIsOpen] = useState(false);
  const [hasWelcomed, setHasWelcomed] = useState(false);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [handsFreeEnabled, setHandsFreeEnabled] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [flow, setFlow] = useState<PurchaseFlow>({ phase: "idle" });

  // ─── Data ──────────────────────────────────────────────────────────────────

  const { data: products = [] } = useQuery({
    queryKey: ["asst-products"],
    queryFn: () => getProducts(200),
    staleTime: 5 * 60_000,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["asst-categories"],
    queryFn: getCategories,
    staleTime: 10 * 60_000,
  });

  const { data: promotions = [] } = useQuery({
    queryKey: ["asst-promotions"],
    queryFn: getPromotions,
    staleTime: 5 * 60_000,
  });

  // ─── Catalog snapshot for API ──────────────────────────────────────────────

  const catalogSnapshot = useMemo(() => {
    const now = Date.now();
    const activePromotions = promotions.filter((p) => {
      if (!p.isActive) return false;
      const s = new Date(p.startsAt).getTime();
      const e = new Date(p.endsAt).getTime();
      return s <= now && e >= now;
    }).length;

    const catalogProducts: CatalogProduct[] = products.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      brand: p.brand,
      category: p.category,
      price: p.regularPrice,
      salePrice: p.salePrice,
      stock: p.stock,
      sizesCsv: p.sizesCsv,
    }));

    const categoryNames = categories
      .filter((c) => !c.parentId)
      .map((c) => c.name);

    return { products: catalogProducts, categoryNames, activePromotions };
  }, [products, categories, promotions]);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  // ─── localStorage persistence ──────────────────────────────────────────────

  useEffect(() => {
    const stored = loadChatHistory();
    if (stored.length > 0) {
      setMessages(
        stored.map((m) => ({
          id: crypto.randomUUID(),
          role: m.role,
          text: m.content,
          timestamp: m.timestamp,
        }))
      );
      setHasWelcomed(true);
    }
    initializedRef.current = true;
  }, []);

  useEffect(() => {
    if (!initializedRef.current || messages.length === 0) return;
    const toStore: StoredMessage[] = messages.map((m) => ({
      role: m.role,
      content: m.text,
      timestamp: m.timestamp,
    }));
    saveChatHistory(toStore);
  }, [messages]);

  // ─── Auto scroll ──────────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, flow]);

  const stopListening = useCallback(() => {
    if (autoListenTimeoutRef.current !== null) {
      window.clearTimeout(autoListenTimeoutRef.current);
      autoListenTimeoutRef.current = null;
    }
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (!speechSupported || typeof window === "undefined" || isListening || isSpeaking || isTyping) return;

    const RecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!RecognitionCtor) return;

    const recognition = new RecognitionCtor();
    recognitionRef.current = recognition;
    recognition.lang = "es-PE";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();

      setIsListening(false);
      if (transcript) {
        setInput(transcript);
        void sendMessageRef.current(transcript);
      }
    };
    recognition.onerror = (event) => {
      setIsListening(false);

      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setHandsFreeEnabled(false);
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: "No tengo permiso para usar el micrófono. Actívalo en tu navegador para continuar con el asistente por voz.",
            timestamp: Date.now(),
          },
        ]);
      }
    };
    recognition.onend = () => {
      setIsListening(false);
    };

    setIsListening(true);
    recognition.start();
  }, [isListening, isSpeaking, isTyping, speechSupported]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSpeechSupported(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
  }, []);

  useEffect(() => {
    if (!handsFreeEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const latestMessage = messages[messages.length - 1];
    if (!latestMessage || latestMessage.role !== "assistant" || latestMessage.id === lastSpokenMessageIdRef.current) return;

    if (latestMessage.id === muteSpeechMessageIdRef.current) {
      lastSpokenMessageIdRef.current = latestMessage.id;
      muteSpeechMessageIdRef.current = null;
      return;
    }

    lastSpokenMessageIdRef.current = latestMessage.id;
    stopListening();
    setIsSpeaking(true);
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(latestMessage.text);
    utterance.lang = "es-PE";
    utterance.rate = 0.95;
    utterance.pitch = 1.08;
    const availableVoices = window.speechSynthesis.getVoices();
    const preferredVoice = pickPreferredAssistantVoice(availableVoices);
    if (preferredVoice) utterance.voice = preferredVoice;
    utterance.onend = () => {
      setIsSpeaking(false);
      if (handsFreeEnabled && speechSupported) {
        autoListenTimeoutRef.current = window.setTimeout(() => {
          startListening();
        }, 320);
      }
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
    };
    window.speechSynthesis.speak(utterance);
  }, [handsFreeEnabled, messages, speechSupported, startListening, stopListening]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (autoListenTimeoutRef.current !== null) {
        window.clearTimeout(autoListenTimeoutRef.current);
      }
      recognitionRef.current?.stop();
    };
  }, []);

  // ─── Open / welcome ────────────────────────────────────────────────────────

  const openAssistant = useCallback(() => {
    setIsOpen(true);
    if (!hasWelcomed) {
      setMessages([{ id: crypto.randomUUID(), role: "assistant", text: WELCOME_TEXT, timestamp: Date.now() }]);
      setHasWelcomed(true);
    }
  }, [hasWelcomed]);

  const closeChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  const deactivateAssistant = useCallback(() => {
    setHandsFreeEnabled(false);
    stopListening();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, [stopListening]);

  const resetChat = useCallback(() => {
    clearChatHistory();
    setMessages([]);
    setHasWelcomed(false);
    setFlow({ phase: "idle" });
    initializedRef.current = true;
    setTimeout(() => {
      setMessages([{ id: crypto.randomUUID(), role: "assistant", text: WELCOME_TEXT, timestamp: Date.now() }]);
      setHasWelcomed(true);
    }, 50);
  }, []);

  const activateHandsFreeAssistant = useCallback(() => {
    activatedAtRef.current = Date.now();
    setHandsFreeEnabled(true);
    setMessages((prev) => {
      if (handsFreeEnabled) return prev;
      const alreadyGreeted = prev.some((msg) => msg.role === "assistant" && msg.text === ASSISTANT_GREETING_TEXT);
      if (alreadyGreeted) return prev;
      const greetingId = crypto.randomUUID();
      muteSpeechMessageIdRef.current = greetingId;
      return [
        ...prev,
        {
          id: greetingId,
          role: "assistant",
          text: ASSISTANT_GREETING_TEXT,
          timestamp: Date.now(),
        },
      ];
    });
    setHasWelcomed(true);
  }, [handsFreeEnabled]);

  useEffect(() => {
    if (!handsFreeEnabled || !speechSupported || isListening || isSpeaking || isTyping) return;

    const delay = Date.now() - activatedAtRef.current < 1800 ? 120 : 650;

    autoListenTimeoutRef.current = window.setTimeout(() => {
      startListening();
    }, delay);

    return () => {
      if (autoListenTimeoutRef.current !== null) {
        window.clearTimeout(autoListenTimeoutRef.current);
        autoListenTimeoutRef.current = null;
      }
    };
  }, [handsFreeEnabled, speechSupported, isListening, isSpeaking, isTyping, startListening]);

  useEffect(() => {
    const onActivateAssistant = () => {
      activateHandsFreeAssistant();
    };

    window.addEventListener("nova:activate-assistant", onActivateAssistant);
    return () => {
      window.removeEventListener("nova:activate-assistant", onActivateAssistant);
    };
  }, [activateHandsFreeAssistant]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("nova:assistant-status", {
      detail: {
        active: handsFreeEnabled,
        listening: isListening,
        speaking: isSpeaking,
      },
    }));
  }, [handsFreeEnabled, isListening, isSpeaking]);

  const startPurchaseFlow = useCallback(
    async (product: ProductSummary) => {
      lastContextProductIdRef.current = product.id;
      setFlow({ phase: "loading", productId: product.id, productName: product.name });

      try {
        const detail = await getProductBySlug(product.slug);
        if (!detail) {
          setFlow({ phase: "idle" });
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              text: `No pude cargar las opciones de ${product.name} en este momento. Intenta otra vez.`,
              timestamp: Date.now(),
            },
          ]);
          return;
        }

        const hasVariantStock = detail.variants.length > 0 && detail.variants.some((variant) => variant.stock > 0);
        const hasStock = hasVariantStock || detail.stock > 0;
        if (!hasStock) {
          setFlow({ phase: "idle" });
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              text: `${product.name} está sin stock por ahora. Si quieres, te muestro alternativas disponibles de la misma categoría.`,
              timestamp: Date.now(),
            },
          ]);
          return;
        }

        setFlow({ phase: "selecting", product: detail, selectedColor: null, selectedSize: null, quantity: 1 });
      } catch {
        setFlow({ phase: "idle" });
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: `Tuve un problema al abrir la compra de ${product.name}. Intenta otra vez.`,
            timestamp: Date.now(),
          },
        ]);
      }
    },
    []
  );

  const openVisibleCart = useCallback(() => {
    setIsOpen(false);
    window.setTimeout(() => {
      openDrawer();
    }, 120);
  }, [openDrawer]);

  const continueToCheckout = useCallback(() => {
    router.push("/checkout");
  }, [router]);

  const navigateWithAssistant = useCallback(
    (href: string) => {
      router.push(href);
    },
    [router]
  );

  const handleCommerceIntent = useCallback(
    (intent: "cart" | "checkout", snapshot: ChatMessage[]) => {
      if (intent === "cart") {
        openVisibleCart();
        setMessages([
          ...snapshot,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: cartItemsCount > 0
              ? "Abrí tu carrito para que revises tus productos. Desde ahí también puedes continuar con el pago."
              : "Abrí tu carrito. Ahora mismo está vacío, pero puedo ayudarte a encontrar un producto para comprar.",
            action: cartItemsCount > 0 ? "go_to_checkout" : undefined,
            timestamp: Date.now(),
          },
        ]);
        return;
      }

      if (cartItemsCount > 0) {
        continueToCheckout();
        setMessages([
          ...snapshot,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: "Te llevo directo al checkout para completar tu compra. Si necesitas cambiar algo, también puedes volver al carrito.",
            action: "go_to_checkout",
            timestamp: Date.now(),
          },
        ]);
        return;
      }

      openVisibleCart();
      setMessages([
        ...snapshot,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: "Todavía no tienes productos en el carrito. Te abrí el carrito y si quieres te ayudo a elegir algo antes de pagar.",
          timestamp: Date.now(),
        },
      ]);
    },
    [cartItemsCount, continueToCheckout, openVisibleCart]
  );

  const handleRouteIntent = useCallback(
    (intent: RouteIntent, snapshot: ChatMessage[]) => {
      navigateWithAssistant(intent.href);
      setMessages([
        ...snapshot,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: intent.message,
          link: { href: intent.href, label: intent.label },
          timestamp: Date.now(),
        },
      ]);
    },
    [navigateWithAssistant]
  );

  // ─── Send message ──────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text?: string) => {
      const content = (text ?? input).trim();
      if (!content || isTyping) return;

      const normalizedContent = normalizeText(content);
      const now = Date.now();
      if (text && lastVoiceUtteranceRef.current && lastVoiceUtteranceRef.current.text === normalizedContent && now - lastVoiceUtteranceRef.current.at < 2200) {
        return;
      }
      if (text) {
        lastVoiceUtteranceRef.current = { text: normalizedContent, at: now };
      }

      setInput("");
      const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", text: content, timestamp: Date.now() };
      const snapshot = [...messages, userMsg];
      setMessages(snapshot);

      if (flow.phase === "selecting") {
        const availableColors = Array.from(new Set(flow.product.variants.filter((variant) => variant.stock > 0).map((variant) => variant.color))).filter(Boolean);
        const sizeCandidates = flow.product.variants
          .filter((variant) => variant.stock > 0 && (!flow.selectedColor || variant.color === flow.selectedColor))
          .map((variant) => variant.size);
        const availableSizes = Array.from(new Set(sizeCandidates)).filter(Boolean);

        const spokenColor = findMatchingOption(content, availableColors);
        const spokenSize = resolveSpokenSize(content, availableSizes);
        const spokenQuantity = parseQuantityValue(content);
        const hasSelectionIntent = Boolean(spokenColor || spokenSize || spokenQuantity !== null || /talla|color|cantidad|unidad|unidades/.test(normalizedContent));

        if (hasSelectionIntent) {
          let nextColor = flow.selectedColor;
          let nextSize = flow.selectedSize;
          let nextQuantity = flow.quantity;

          if (spokenColor) {
            nextColor = spokenColor;
            nextSize = spokenColor !== flow.selectedColor ? null : nextSize;
          }

          const sizeOptionsForColor = Array.from(
            new Set(
              flow.product.variants
                .filter((variant) => variant.stock > 0 && (!nextColor || variant.color === nextColor))
                .map((variant) => variant.size)
            )
          ).filter(Boolean);

          const normalizedSize = spokenSize ? resolveSpokenSize(spokenSize, sizeOptionsForColor) : null;
          if (normalizedSize) {
            nextSize = normalizedSize;
          }

          if (spokenQuantity !== null) {
            nextQuantity = Math.max(spokenQuantity, 1);
          }

          const selectedVariant = flow.product.variants.find(
            (variant) =>
              variant.stock > 0 &&
              (!nextColor || variant.color === nextColor) &&
              (!nextSize || variant.size === nextSize)
          );
          const availableStock = selectedVariant?.stock
            ?? flow.product.variants.find((variant) => variant.stock > 0 && (!nextColor || variant.color === nextColor))?.stock
            ?? flow.product.stock;

          if (nextQuantity > availableStock && availableStock > 0) {
            nextQuantity = availableStock;
          }

          setFlow((current) => current.phase === "selecting"
            ? { ...current, selectedColor: nextColor, selectedSize: nextSize, quantity: nextQuantity }
            : current);

          const invalidColor = /color/.test(normalizedContent) && !spokenColor && availableColors.length > 0;
          const invalidSize = /talla|size|mediana|grande|chica|small|medium|large|xl|xs/.test(normalizedContent) && !normalizedSize && sizeOptionsForColor.length > 0;

          let reply = buildSelectionReply({
            productName: flow.product.name,
            selectedColor: nextColor,
            selectedSize: nextSize,
            quantity: nextQuantity,
            needsColor: availableColors.length > 0 && !nextColor,
            needsSize: sizeOptionsForColor.length > 0 && !nextSize,
          });

          if (availableStock <= 0) {
            reply = `No tengo stock disponible para esa combinación de ${flow.product.name}. Prueba con otro color o talla.`;
          } else if (spokenQuantity !== null && spokenQuantity > availableStock) {
            reply = `Solo quedan ${availableStock} unidad(es) para esa combinación. Ajusté la cantidad y sigo con ${flow.product.name}.`;
          } else if (invalidColor) {
            reply = `Ese color no está disponible para ${flow.product.name}. Colores disponibles: ${availableColors.join(", ")}.`;
          } else if (invalidSize) {
            reply = `Esa talla no está disponible para ${flow.product.name}. Tallas disponibles: ${sizeOptionsForColor.join(", ")}.`;
          }

          setMessages([
            ...snapshot,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              text: reply,
              timestamp: Date.now(),
            },
          ]);
          return;
        }
      }

      if (isAddToCartIntent(content)) {
        if (flow.phase === "selecting") {
          handleAddToCartRef.current();
          return;
        }

        const explicitProduct = findProductInText(content, products);
        const contextualProduct = explicitProduct ?? (lastContextProductIdRef.current ? productMap.get(lastContextProductIdRef.current) : undefined);

        if (contextualProduct) {
          void startPurchaseFlow(contextualProduct);
          setMessages([
            ...snapshot,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              text: `Perfecto, abrí ${contextualProduct.name} para agregarlo. Elige talla, color y cantidad, y lo llevo a tu carrito.`,
              timestamp: Date.now(),
            },
          ]);
          return;
        }

        setMessages([
          ...snapshot,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: "Listo, te ayudo a agregarlo al carrito. Dime el nombre del producto o pídeme que te muestre opciones para elegir uno.",
            timestamp: Date.now(),
          },
        ]);
        return;
      }

      const assistantMode = handsFreeEnabled;
      if (assistantMode) {
        const commerceIntent = getCommerceIntent(content);
        if (commerceIntent) {
          handleCommerceIntent(commerceIntent, snapshot);
          return;
        }

        const routeIntent = resolveRouteIntent(content, categories, products);
        if (routeIntent) {
          handleRouteIntent(routeIntent, snapshot);
          return;
        }
      }

      setIsTyping(true);

      try {
        const aiMessages: OpenAIMessage[] = snapshot
          .slice(-10)
          .map((m) => ({ role: m.role, content: m.text }));

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: aiMessages, catalog: catalogSnapshot, storeName }),
        });

        if (!res.ok) throw new Error("API error");
        const aiResp = (await res.json()) as AIResponse;

        const matchedProducts = (aiResp.showProductIds ?? [])
          .map((id) => productMap.get(id))
          .filter((p): p is ProductSummary => !!p);

        if (matchedProducts.length > 0) {
          lastContextProductIdRef.current = matchedProducts[0].id;
        }

        const aiMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          text: aiResp.message,
          products: matchedProducts.length > 0 ? matchedProducts : undefined,
          action: assistantMode ? (aiResp.action ?? undefined) : undefined,
          isAI: aiResp.isAIPowered,
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, aiMsg]);

        if (aiResp.askVariant) {
          const { productId, productName } = aiResp.askVariant;
          lastContextProductIdRef.current = productId;
          setFlow({ phase: "loading", productId, productName });
          const summary = productMap.get(productId);
          if (summary) {
            getProductBySlug(summary.slug)
              .then((detail) => {
                if (detail) setFlow({ phase: "selecting", product: detail, selectedColor: null, selectedSize: null, quantity: 1 });
                else setFlow({ phase: "idle" });
              })
              .catch(() => setFlow({ phase: "idle" }));
          } else {
            setFlow({ phase: "idle" });
          }
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", text: "Lo siento, tuve un problema. Intenta de nuevo.", timestamp: Date.now() },
        ]);
      } finally {
        setIsTyping(false);
      }
    },
    [input, isTyping, messages, flow.phase, products, productMap, startPurchaseFlow, catalogSnapshot, handleCommerceIntent, handleRouteIntent, categories, handsFreeEnabled]
  );

  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  const toggleListening = useCallback(() => {
    if (!speechSupported || typeof window === "undefined") return;

    if (isListening) {
      setHandsFreeEnabled(false);
      stopListening();
      return;
    }

    setHandsFreeEnabled(true);
    startListening();
  }, [isListening, speechSupported, startListening, stopListening]);

  // ─── Add to cart from variant selector ────────────────────────────────────

  const handleAddToCart = useCallback(() => {
    if (flow.phase !== "selecting") return;
    const { product, selectedColor, selectedSize } = flow;

    const variant =
      product.variants.find((v) => v.color === selectedColor && v.size === selectedSize && v.stock > 0) ??
      product.variants.find((v) => v.stock > 0) ??
      null;
    const quantity = Math.max(flow.quantity, 1);
    const availableStock = variant?.stock ?? product.stock;

    if (availableStock <= 0) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: `${product.name} no tiene stock disponible en este momento. ¿Quieres que te muestre otras opciones?`,
          timestamp: Date.now(),
        },
      ]);
      return;
    }

    if (quantity > availableStock) {
      setFlow((current) => (current.phase === "selecting" ? { ...current, quantity: availableStock } : current));
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: `Solo quedan ${availableStock} unidad(es) disponibles de ${product.name}. Ajusté la cantidad al stock actual.`,
          timestamp: Date.now(),
        },
      ]);
      return;
    }

    const unitPrice = (product.salePrice ?? product.regularPrice) + (variant?.priceAdjustment ?? 0);

    addItem({
      id: product.id,
      name: product.name,
      slug: product.slug,
      brand: product.brand,
      category: product.category,
      regularPrice: product.regularPrice,
      salePrice: product.salePrice,
      stock: availableStock,
      imageUrl: product.images[0]?.url ?? "",
      rating: 4.5,
      isOnSale: !!product.salePrice,
      unitPrice,
      quantity,
      selectedSize: selectedSize ?? undefined,
      selectedColor: selectedColor ?? undefined,
      selectedVariantId: variant?.id,
      maxAvailableStock: availableStock,
      compareAtPrice: product.salePrice ? product.regularPrice : undefined,
    });

    lastContextProductIdRef.current = product.id;

    setFlow({ phase: "idle" });
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        text: `¡Listo! Agregué ${quantity} unidad(es) de "${product.name}"${selectedSize ? ` talla ${selectedSize}` : ""}${selectedColor ? `, color ${selectedColor}` : ""} a tu carrito. ¿Seguimos buscando o quieres pagar ahora?`,
        action: "go_to_checkout",
        timestamp: Date.now(),
      },
    ]);
  }, [flow, addItem]);

  useEffect(() => {
    handleAddToCartRef.current = handleAddToCart;
  }, [handleAddToCart]);

  // ─── Action button handler ─────────────────────────────────────────────────

  const handleAction = useCallback(
    (action: NonNullable<AIResponse["action"]>) => {
      if (action === "go_to_checkout") {
        if (cartItemsCount > 0) {
          continueToCheckout();
        } else {
          openVisibleCart();
        }
      } else if (action === "go_to_promotions") {
        router.push("/promociones");
      } else if (action === "go_to_faq") {
        router.push("/preguntas-frecuentes");
      } else {
        router.push("/collections");
      }
    },
    [cartItemsCount, continueToCheckout, openVisibleCart, router]
  );

  // ─── Variant options ───────────────────────────────────────────────────────

  const availableColors =
    flow.phase === "selecting"
      ? Array.from(new Set(flow.product.variants.filter((v) => v.stock > 0).map((v) => v.color))).filter(Boolean)
      : [];

  const availableSizes =
    flow.phase === "selecting"
      ? Array.from(
          new Set(
            flow.product.variants
              .filter((v) => v.stock > 0 && (!flow.selectedColor || v.color === flow.selectedColor))
              .map((v) => v.size)
          )
        ).filter(Boolean)
      : [];

  const selectedVariantStock =
    flow.phase === "selecting"
      ? flow.product.variants.find(
          (variant) =>
            variant.stock > 0 &&
            (!flow.selectedColor || variant.color === flow.selectedColor) &&
            (!flow.selectedSize || variant.size === flow.selectedSize)
        )?.stock ?? flow.product.stock
      : 0;

  const maxSelectableQuantity = Math.max(selectedVariantStock, 0);

  const isAddDisabled =
    flow.phase !== "selecting" ||
    selectedVariantStock <= 0 ||
    (availableColors.length > 0 && !flow.selectedColor) ||
    (availableSizes.length > 0 && !flow.selectedSize);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.section
            key="nova-panel"
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.96 }}
            transition={{ duration: 0.22 }}
            className="fixed bottom-24 right-4 z-[90] flex w-[min(94vw,400px)] flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-[0_24px_60px_rgba(15,23,42,0.20)] dark:bg-slate-900"
            style={{ maxHeight: "min(82vh, 640px)" }}
          >
            {/* Header */}
            <header className="flex shrink-0 items-center justify-between border-b border-border bg-gradient-to-r from-[#E8F4FF] to-[#F4FBFF] px-4 py-3 dark:from-slate-800 dark:to-slate-800/60">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#0F5DB3] to-[#1D9BF0] text-white shadow">
                  <Sparkles size={16} />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#0F3D70] dark:text-blue-200">Nova · Asistente</p>
                  <p className="text-[11px] text-foreground/50">{storeName} · En línea</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    type="button"
                    title="Limpiar conversación"
                    onClick={resetChat}
                    className="rounded-xl p-2 text-foreground/40 transition hover:bg-black/5 hover:text-red-500"
                    aria-label="Limpiar historial"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeChat}
                  className="rounded-xl p-2 text-foreground/40 transition hover:bg-black/5"
                  aria-label="Cerrar"
                >
                  <X size={17} />
                </button>
              </div>
            </header>

            {/* Messages */}
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.map((msg) => (
                <article key={msg.id} className={`flex flex-col gap-2 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                  <div
                    className={`max-w-[88%] rounded-2xl px-3 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-gradient-to-br from-[#0F5DB3] to-[#1D9BF0] text-white"
                        : "bg-[#F3F8FE] text-[#1A2D40] dark:bg-slate-800/80 dark:text-slate-100"
                    }`}
                  >
                    {msg.isAI && msg.role === "assistant" && (
                      <span className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#1D9BF0]/70">
                        <Sparkles size={9} /> IA
                      </span>
                    )}
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>

                  {/* Product cards */}
                  {msg.products && msg.products.length > 0 && (
                    <div className="w-full space-y-1.5">
                      {msg.products.map((product) => (
                        <div
                          key={product.id}
                          className="flex items-center gap-2.5 rounded-2xl border border-[#D8E8FC] bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                        >
                          {product.imageUrl && (
                            <img src={resolveMediaUrl(product.imageUrl)} alt={product.name} className="h-11 w-11 shrink-0 rounded-xl object-cover" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-[#0E447A] dark:text-slate-100">{product.name}</p>
                            <p className="text-[11px] text-foreground/55">
                              {product.brand}
                              {product.salePrice ? (
                                <>
                                  {" · "}
                                  <span className="font-bold text-[#0F5DB3]">S/ {Number(product.salePrice).toFixed(2)}</span>{" "}
                                  <span className="line-through opacity-50">S/ {Number(product.regularPrice).toFixed(2)}</span>
                                </>
                              ) : (
                                <> · S/ {Number(product.regularPrice).toFixed(2)}</>
                              )}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col gap-1">
                            <Link
                              href={`/products/${product.slug}`}
                              className="rounded-lg bg-[#EEF5FF] px-2 py-1 text-[10px] font-bold text-[#0F5DB3] transition hover:bg-[#DCE9FB]"
                            >
                              Ver
                            </Link>
                            <button
                              type="button"
                              onClick={() => void startPurchaseFlow(product)}
                              className="rounded-lg bg-[#0F5DB3] px-2 py-1 text-[10px] font-bold text-white transition hover:bg-[#0B4B91]"
                            >
                              Comprar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Action chip */}
                  {msg.action && (
                    <button
                      type="button"
                      onClick={() => handleAction(msg.action!)}
                      className="flex items-center gap-2 rounded-full border border-[#BFD9F7] bg-white px-4 py-2 text-xs font-bold text-[#0F5DB3] transition hover:bg-[#F0F7FF] dark:border-slate-700 dark:bg-slate-900 dark:text-blue-300"
                    >
                      <ShoppingCart size={13} />
                      {ACTION_LABEL[msg.action]}
                    </button>
                  )}

                  {msg.link && (
                    <Link
                      href={msg.link.href}
                      onClick={() => void 0}
                      className="inline-flex items-center gap-2 rounded-full border border-[#BFD9F7] bg-white px-4 py-2 text-xs font-bold text-[#0F5DB3] transition hover:bg-[#F0F7FF] dark:border-slate-700 dark:bg-slate-900 dark:text-blue-300"
                    >
                      <Sparkles size={13} />
                      {msg.link.label}
                    </Link>
                  )}
                </article>
              ))}

              {/* Typing indicator */}
              {isTyping && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 rounded-2xl bg-[#F3F8FE] px-4 py-3 dark:bg-slate-800/80">
                    <Loader2 size={13} className="animate-spin text-[#1D9BF0]" />
                    <span className="text-xs text-foreground/50">Nova está escribiendo…</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Variant selector */}
            <AnimatePresence>
              {(flow.phase === "loading" || flow.phase === "selecting") && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  className="shrink-0 border-t border-border bg-[#F8FBFF] p-3 dark:bg-slate-800/50"
                >
                  {flow.phase === "loading" && (
                    <div className="flex items-center gap-2 text-xs text-foreground/50">
                      <Loader2 size={13} className="animate-spin" />
                      Cargando opciones de {flow.productName}…
                    </div>
                  )}

                  {flow.phase === "selecting" && (
                    <div className="space-y-2.5">
                      <p className="text-xs font-bold text-[#0F3D70] dark:text-blue-200">
                        {flow.product.name}
                        {flow.product.salePrice && (
                          <span className="ml-2 text-[#0F5DB3]">S/ {flow.product.salePrice}</span>
                        )}
                      </p>

                      {availableColors.length > 0 && (
                        <div>
                          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-foreground/45">Color</p>
                          <div className="flex flex-wrap gap-1.5">
                            {availableColors.map((color) => (
                              <button
                                key={color}
                                type="button"
                                onClick={() =>
                                  setFlow((f) => f.phase === "selecting" ? { ...f, selectedColor: color, selectedSize: null } : f)
                                }
                                className={`rounded-xl px-2.5 py-1 text-xs font-semibold transition ${
                                  flow.selectedColor === color
                                    ? "bg-[#0F5DB3] text-white"
                                    : "border border-border bg-white hover:border-[#0F5DB3] hover:text-[#0F5DB3] dark:bg-slate-900"
                                }`}
                              >
                                {color}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {availableSizes.length > 0 && (
                        <div>
                          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-foreground/45">Talla</p>
                          <div className="flex flex-wrap gap-1.5">
                            {availableSizes.map((size) => (
                              <button
                                key={size}
                                type="button"
                                onClick={() =>
                                  setFlow((f) => f.phase === "selecting" ? { ...f, selectedSize: size } : f)
                                }
                                className={`rounded-xl px-2.5 py-1 text-xs font-semibold transition ${
                                  flow.selectedSize === size
                                    ? "bg-[#0F5DB3] text-white"
                                    : "border border-border bg-white hover:border-[#0F5DB3] hover:text-[#0F5DB3] dark:bg-slate-900"
                                }`}
                              >
                                {size}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <div className="mb-1.5 flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-wider text-foreground/45">
                          <span>Cantidad</span>
                          <span className="text-[10px] normal-case tracking-normal">Stock disponible: {selectedVariantStock}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setFlow((current) =>
                                current.phase === "selecting"
                                  ? { ...current, quantity: Math.max(current.quantity - 1, 1) }
                                  : current
                              )
                            }
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-white text-sm font-bold transition hover:border-[#0F5DB3] hover:text-[#0F5DB3] dark:bg-slate-900"
                            aria-label="Reducir cantidad"
                          >
                            -
                          </button>
                          <div className="flex h-9 min-w-12 items-center justify-center rounded-xl border border-[#D8E8FC] bg-white px-3 text-sm font-bold text-[#0F3D70] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                            {flow.quantity}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setFlow((current) =>
                                current.phase === "selecting"
                                  ? { ...current, quantity: Math.min(current.quantity + 1, maxSelectableQuantity) }
                                  : current
                              )
                            }
                            disabled={flow.quantity >= maxSelectableQuantity}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-white text-sm font-bold transition hover:border-[#0F5DB3] hover:text-[#0F5DB3] disabled:opacity-40 dark:bg-slate-900"
                            aria-label="Aumentar cantidad"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={handleAddToCart}
                          disabled={isAddDisabled}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#0F5DB3] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#0B4B91] disabled:opacity-40"
                        >
                          <ShoppingCart size={13} />
                          Agregar al carrito
                        </button>
                        <button
                          type="button"
                          onClick={() => setFlow({ phase: "idle" })}
                          className="rounded-xl border border-border px-3 py-2 text-xs font-semibold transition hover:bg-muted"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Quick chips */}
            {messages.length <= 1 && (
              <div className="shrink-0 border-t border-border/40 px-3 py-2">
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => void sendMessage(chip)}
                      disabled={isTyping}
                      className="rounded-full border border-[#BFD9F7] bg-[#EEF5FF] px-3 py-1 text-[11px] font-semibold text-[#0F5DB3] transition hover:bg-[#DCE9FB] disabled:opacity-50"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input bar */}
            <footer className="shrink-0 border-t border-border p-3">
              <div className="flex items-center gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                  placeholder="¿Qué estás buscando?"
                  disabled={isTyping}
                  className="h-10 flex-1 rounded-2xl border border-border bg-background px-3.5 text-sm focus:border-[#1D9BF0] focus:outline-none disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={!input.trim() || isTyping}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0F5DB3] text-white transition hover:bg-[#0B4B91] disabled:opacity-40"
                  aria-label="Enviar mensaje"
                >
                  <Send size={15} />
                </button>
              </div>
            </footer>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Floating button */}
      <motion.button
        type="button"
        onClick={() => (isOpen ? closeChat() : openAssistant())}
        animate={{ scale: isOpen ? 1 : [1, 1.05, 1] }}
        transition={{ duration: 2.5, repeat: isOpen ? 0 : Infinity, repeatDelay: 3 }}
        className="fixed bottom-6 right-4 z-[90] inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#0F5DB3] to-[#1D9BF0] px-4 py-3 text-sm font-bold text-white shadow-[0_18px_40px_rgba(15,93,179,0.40)] transition hover:-translate-y-0.5"
        aria-label="Abrir asistente virtual"
      >
        {isOpen ? <X size={17} /> : <MessageCircle size={17} />}
        <span>{isOpen ? "Cerrar chat" : "Chat Nova"}</span>
        {!isOpen && <Sparkles size={13} className="opacity-80" />}
      </motion.button>
    </>
  );
}
