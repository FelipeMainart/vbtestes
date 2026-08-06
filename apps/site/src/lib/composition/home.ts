import "server-only";

import { DefaultHomeService } from "@/features/home/application/services/default-home-service";
import type { HomeService } from "@/features/home/application/services/home-service";
import { MockHomeRepository } from "@/features/home/infrastructure/repositories/mock-home-repository";

export function createHomeService(): HomeService {
  return new DefaultHomeService(new MockHomeRepository());
}
