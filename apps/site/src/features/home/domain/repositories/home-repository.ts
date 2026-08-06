import type { HomeContent } from "../entities/home-content";

export interface HomeRepository {
  getContent(): Promise<HomeContent>;
}
