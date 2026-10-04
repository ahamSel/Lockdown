export interface BestTracker {
  readonly value: number;
  /** Call when a run starts: "new best" is judged against the best from before this run. */
  startRun(): void;
  /** Saves `score` if it beats the best. Safe to call mid-run (on pause, tab hide). */
  record(score: number): void;
  isNewBest(score: number): boolean;
}

export function createBestTracker(initial: number, save: (value: number) => void): BestTracker {
  let best = initial;
  let beforeRun = initial;
  return {
    get value() {
      return best;
    },
    startRun() {
      beforeRun = best;
    },
    record(score) {
      if (score <= best) return;
      best = score;
      save(best);
    },
    isNewBest(score) {
      return score > beforeRun;
    },
  };
}
