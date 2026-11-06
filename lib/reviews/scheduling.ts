export type ReviewRating = "again" | "hard" | "good" | "easy";

export type ReviewState = {
  dueAt: Date;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  lapses: number;
};

export type ReviewPlan = ReviewState & { rating: ReviewRating; reviewedAt: Date };

/**
 * Détermine la prochaine échéance côté serveur. Les cartes échouées reviennent
 * dans 10 minutes; une nouvelle carte réussie commence à 1/4/7 jours selon
 * l'évaluation. L'intervalle est volontairement borné et déterministe.
 */
export function calculateNextReview(now: Date, rating: ReviewRating, state: ReviewState): ReviewPlan {
  const reviewedAt = new Date(now.getTime());
  const easeFactor = Math.min(3, Math.max(1.3, state.easeFactor + (rating === "easy" ? 0.15 : rating === "hard" ? -0.15 : rating === "again" ? -0.2 : 0)));
  if (rating === "again") {
    return { rating, reviewedAt, dueAt: new Date(now.getTime() + 10 * 60 * 1000), intervalDays: 0, easeFactor, repetitions: 0, lapses: state.lapses + 1 };
  }
  if (state.repetitions === 0) {
    const intervalDays = rating === "easy" ? 4 : 1;
    return { rating, reviewedAt, dueAt: new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000), intervalDays, easeFactor, repetitions: 1, lapses: state.lapses };
  }
  const base = Math.max(1, state.intervalDays);
  const multiplier = rating === "easy" ? easeFactor * 1.3 : rating === "hard" ? 1.2 : easeFactor;
  const intervalDays = Math.min(3650, Math.max(1, Math.round(base * multiplier)));
  return { rating, reviewedAt, dueAt: new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000), intervalDays, easeFactor, repetitions: state.repetitions + 1, lapses: state.lapses };
}
