export interface StepPlan {
  steps: number;
  acc: number;
  /** How far between the last two sim states to draw, for interpolation. */
  alpha: number;
}

/** Splits a frame's delta into fixed steps. A stalled frame is capped so the sim never spirals. */
export function planSteps(acc: number, frameDt: number, step: number, maxFrame: number): StepPlan {
  let a = acc + Math.min(Math.max(frameDt, 0), maxFrame);
  const steps = Math.floor(a / step + 1e-9);
  a = Math.max(0, a - steps * step);
  return { steps, acc: a, alpha: Math.min(1, a / step) };
}
