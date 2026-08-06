import type { HomeRepository } from "../../domain/repositories/home-repository";
import type { HomeService } from "./home-service";

export class DefaultHomeService implements HomeService {
  constructor(private readonly homeRepository: HomeRepository) {}

  getContent() {
    return this.homeRepository.getContent();
  }
}
