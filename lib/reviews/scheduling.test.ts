import assert from "node:assert/strict";
import test from "node:test";
import { calculateNextReview, type ReviewState } from "./scheduling.ts";

const now = new Date("2026-01-01T00:00:00.000Z");
const fresh: ReviewState = { dueAt: now, intervalDays: 0, easeFactor: 2.5, repetitions: 0, lapses: 0 };

test("une nouvelle carte facile reçoit une échéance déterministe", () => {
  const plan = calculateNextReview(now, "easy", fresh);
  assert.equal(plan.intervalDays, 4);
  assert.equal(plan.dueAt.toISOString(), "2026-01-05T00:00:00.000Z");
  assert.equal(plan.repetitions, 1);
});

test("une carte à revoir revient rapidement et incrémente les échecs", () => {
  const plan = calculateNextReview(now, "again", { ...fresh, repetitions: 3, intervalDays: 12, lapses: 1 });
  assert.equal(plan.intervalDays, 0);
  assert.equal(plan.lapses, 2);
  assert.equal(plan.dueAt.toISOString(), "2026-01-01T00:10:00.000Z");
});

test("les limites d’intervalle et de difficulté sont respectées", () => {
  const plan = calculateNextReview(now, "hard", { ...fresh, repetitions: 20, intervalDays: 3650, easeFactor: 1.3 });
  assert.equal(plan.intervalDays, 3650);
  assert.equal(plan.easeFactor, 1.3);
});
