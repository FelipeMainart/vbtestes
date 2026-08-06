import type { HomeContent } from "../../domain/entities/home-content";

export interface HomeService {
  getContent(): Promise<HomeContent>;
}
