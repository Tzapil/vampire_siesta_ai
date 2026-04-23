import { api } from "../../api/client";
import type { HomeScreenDto } from "../../api/types";

export function fetchHomeScreen() {
  return api.get<HomeScreenDto>("/home");
}
