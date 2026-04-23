import { api } from "../../api/client";
import type { AggregatedDictionariesDto } from "../../api/types";

export function fetchDictionaries() {
  return api.get<AggregatedDictionariesDto>("/dictionaries");
}
