import { HOME_MOCK_DATA } from "@/mocks/home/home-data";

import type { HomeRepository } from "../../domain/repositories/home-repository";
import { homeContentSchema } from "../schemas/home-content.schema";

export class MockHomeRepository implements HomeRepository {
  async getContent() {
    return homeContentSchema.parse(HOME_MOCK_DATA);
  }
}
