const sizes = [
  { id: "p", label: "P" },
  { id: "m", label: "M" },
  { id: "g", label: "G" },
  { id: "gg", label: "GG" },
] as const;

const createVariations = (productId: string, colorIds: readonly string[]) =>
  colorIds.flatMap((colorId) =>
    sizes.map((size) => ({
      available: true,
      colorId,
      id: `${productId}-${colorId}-${size.id}`,
      sizeId: size.id,
    })),
  );

// TODO: substituir por imagens oficiais
export const ORDER_BUILDER_PRODUCTS_MOCK = [
  {
    colors: [
      {
        id: "preto",
        imageAlt: "Colete Gola U feminino na cor preta",
        imageUrl:
          "https://images.unsplash.com/photo-1591369822096-ffd140ec948f?auto=format&fit=crop&w=1000&q=85",
        label: "Preto",
        tone: "black",
      },
      {
        id: "off-white",
        imageAlt: "Colete Gola U feminino na cor off white",
        imageUrl:
          "https://images.unsplash.com/photo-1598554747436-c9293d6a588f?auto=format&fit=crop&w=1000&q=85",
        label: "Off White",
        tone: "off-white",
      },
      {
        id: "bege",
        imageAlt: "Colete Gola U feminino em composição bege",
        imageUrl:
          "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=1000&q=85",
        label: "Bege",
        tone: "beige",
      },
      {
        id: "marinho",
        imageAlt: "Colete Gola U feminino em composição marinho",
        imageUrl:
          "https://images.unsplash.com/photo-1566206091558-7f218b696731?auto=format&fit=crop&w=1000&q=85",
        label: "Marinho",
        tone: "navy",
      },
      {
        id: "cinza",
        imageAlt: "Colete Gola U feminino em composição cinza",
        imageUrl:
          "https://images.unsplash.com/photo-1581044777550-4cfa60707c03?auto=format&fit=crop&w=1000&q=85",
        label: "Cinza",
        tone: "gray",
      },
    ],
    defaultImageAlt: "Colete Gola U feminino de alfaiataria",
    defaultImageUrl:
      "https://images.unsplash.com/photo-1591369822096-ffd140ec948f?auto=format&fit=crop&w=1000&q=85",
    description:
      "Recorte contemporâneo com gola arredondada para composições versáteis.",
    id: "ref-001",
    name: "Colete Gola U",
    priceInCents: 5000,
    reference: "REF.001",
    sizes,
    status: "active",
    variations: createVariations("ref-001", [
      "preto",
      "off-white",
      "bege",
      "marinho",
      "cinza",
    ]),
  },
  {
    colors: [
      {
        id: "preto",
        imageAlt: "Colete Gola V feminino na cor preta",
        imageUrl:
          "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1000&q=85",
        label: "Preto",
        tone: "black",
      },
      {
        id: "off-white",
        imageAlt: "Colete Gola V feminino na cor off white",
        imageUrl:
          "https://images.unsplash.com/photo-1550614000-4895a10e1bfd?auto=format&fit=crop&w=1000&q=85",
        label: "Off White",
        tone: "off-white",
      },
      {
        id: "bege",
        imageAlt: "Colete Gola V feminino em composição bege",
        imageUrl:
          "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1000&q=85",
        label: "Bege",
        tone: "beige",
      },
      {
        id: "marinho",
        imageAlt: "Colete Gola V feminino em composição marinho",
        imageUrl:
          "https://images.unsplash.com/photo-1551803091-e20673f15770?auto=format&fit=crop&w=1000&q=85",
        label: "Marinho",
        tone: "navy",
      },
      {
        id: "cinza",
        imageAlt: "Colete Gola V feminino em composição cinza",
        imageUrl:
          "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1000&q=85",
        label: "Cinza",
        tone: "gray",
      },
    ],
    defaultImageAlt: "Colete Gola V feminino de alfaiataria",
    defaultImageUrl:
      "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1000&q=85",
    description:
      "Gola em V e linhas precisas para uma alfaiataria feminina elegante.",
    id: "ref-002",
    name: "Colete Gola V",
    priceInCents: 5000,
    reference: "REF.002",
    sizes,
    status: "active",
    variations: createVariations("ref-002", [
      "preto",
      "off-white",
      "bege",
      "marinho",
      "cinza",
    ]),
  },
] as const;
