import { notFound } from "next/navigation";
import { ProductDetailInteractive } from "@/components/commerce/product-detail-interactive";
import { getProductBySlug } from "@/lib/api";

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const apiProduct = await getProductBySlug(slug);
  if (!apiProduct) notFound();
  return <ProductDetailInteractive product={apiProduct} />;
}