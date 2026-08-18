import { z } from "zod";

const digits = (value: string) => value.replace(/\D/g, "");

export const customerSchema = z.object({
  cpf: z
    .string()
    .trim()
    .refine((value) => value.length === 0 || digits(value).length === 11, {
      message: "Informe 11 dígitos ou deixe o CPF em branco.",
    })
    .optional(),
  email: z.email("Informe um e-mail válido."),
  firstName: z.string().trim().min(2, "Informe seu nome."),
  lastName: z.string().trim().min(2, "Informe seu sobrenome."),
  phone: z
    .string()
    .trim()
    .refine(
      (value) => digits(value).length >= 10,
      "Informe um telefone válido.",
    ),
});

export const addressSchema = z.object({
  city: z.string().trim().min(2, "Informe a cidade."),
  complement: z.string().trim().optional(),
  neighborhood: z.string().trim().min(2, "Informe o bairro."),
  number: z.string().trim().min(1, "Informe o número ou S/N."),
  postalCode: z
    .string()
    .trim()
    .refine((value) => digits(value).length === 8, "Informe um CEP válido."),
  state: z.string().trim().length(2, "Use a sigla do estado."),
  street: z.string().trim().min(2, "Informe a rua."),
});

export const cartLineInputSchema = z.object({
  colorId: z.string().min(1),
  colorLabel: z.string().min(1),
  imageAlt: z.string().min(1),
  imageUrl: z.url(),
  name: z.string().min(1),
  priceInCents: z.number().int().positive(),
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  reference: z.string().min(1),
  sizeId: z.string().min(1),
  sizeLabel: z.string().min(1),
  variationId: z.string().min(1),
});

export const checkoutReviewSchema = z.object({
  address: addressSchema,
  customer: customerSchema,
  lines: z.array(cartLineInputSchema).min(1),
  paymentId: z.enum(["pix", "card", "boleto"]),
  shippingId: z.enum(["pac", "sedex", "premium"]),
});

export type CustomerFormData = z.infer<typeof customerSchema>;
export type AddressFormData = z.infer<typeof addressSchema>;
