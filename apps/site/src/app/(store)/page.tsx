import { HomePage } from "@/features/home";
import { createHomeService } from "@/lib/composition/home";
import { createProductService } from "@/lib/composition/product";

export default async function StorePage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ checkout?: string }> }>) {
  const query = await searchParams;
  return (
    <HomePage
      homeService={createHomeService()}
      initialNotice={
        query.checkout === "minimum"
          ? "Seu pedido ainda não atingiu o mínimo de 6 peças."
          : undefined
      }
      productService={createProductService()}
    />
  );
}
