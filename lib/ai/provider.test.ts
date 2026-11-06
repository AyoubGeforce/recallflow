import assert from "node:assert/strict";
import test from "node:test";
import { GeneratedCardsSchema } from "./provider.ts";

test("le schéma de sortie rejette une carte sans source", () => {
  const result = GeneratedCardsSchema.safeParse({ cards: [{ question: "Q", answer: "R", passage_ids: [], evidence: "" }] });
  assert.equal(result.success, false);
});

test("le schéma accepte une proposition sourcée minimale", () => {
  const result = GeneratedCardsSchema.safeParse({ cards: [{ question: "Quel principe ?", answer: "Le principe de test.", passage_ids: ["00000000-0000-4000-8000-000000000001"], evidence: "principe de test" }] });
  assert.equal(result.success, true);
});
