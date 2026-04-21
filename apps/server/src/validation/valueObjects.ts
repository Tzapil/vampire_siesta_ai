import type { LayeredValue } from "./layered";

export class TraitValue {
  readonly base: number;
  readonly freebie: number;
  readonly storyteller: number;

  constructor(value: LayeredValue) {
    this.base = Number(value.base ?? 0);
    this.freebie = Number(value.freebie ?? 0);
    this.storyteller = Number(value.storyteller ?? 0);
  }

  get total() {
    return this.base + this.freebie + this.storyteller;
  }
}

export class ResourceBounds {
  readonly min: number;
  readonly max: number;

  constructor(min: number, max: number) {
    this.min = Number(min);
    this.max = Number(max);
  }

  contains(value: number) {
    return value >= this.min && value <= this.max;
  }
}

export type GenerationRecord = {
  generation: number;
  bloodPoolMax: number;
  bloodPerTurn: number;
};

export class GenerationConstraint {
  readonly generation: number;
  readonly bloodPoolMax: number;
  readonly bloodPerTurn: number;

  constructor(record: GenerationRecord) {
    this.generation = Number(record.generation);
    this.bloodPoolMax = Number(record.bloodPoolMax);
    this.bloodPerTurn = Number(record.bloodPerTurn);
  }
}
