"use client";

import { DefaultCartService } from "@/features/cart/application/services/default-cart-service";
import type { CartService } from "@/features/cart/application/services/cart-service";
import { LocalCartRepository } from "@/features/cart/infrastructure/repositories/local-cart-repository";

export const cartService: CartService = new DefaultCartService(
  new LocalCartRepository(),
);
