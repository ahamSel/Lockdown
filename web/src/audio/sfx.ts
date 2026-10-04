export type SfxName = 'split' | 'bounce' | 'hit' | 'blocked' | 'burn' | 'pickup' | 'expire' | 'death' | 'cleared' | 'spawn' | 'click';

export interface Sfx {
  /** Call from a user gesture: browsers only allow audio after one. */
  unlock(): void;
  play(name: SfxName, variant?: number): void;
  setMuted(muted: boolean): void;
}

const MASTER_VOLUME = 0.6;
/** Minimum seconds between plays, so 700 splitting balls don't become noise. */
const MIN_GAP: Partial<Record<SfxName, number>> = { split: 0.035, bounce: 0.06, blocked: 0.08, burn: 0.03, spawn: 0.1 };

export function createSfx(): Sfx {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let muted = false;
  const lastPlayed = new Map<SfxName, number>();

  function tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0) {
    if (!ctx || !master) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  return {
    unlock() {
      if (!ctx) {
        try {
          const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          ctx = new Ctor();
          master = ctx.createGain();
          master.gain.value = muted ? 0 : MASTER_VOLUME;
          master.connect(ctx.destination);
        } catch {
          ctx = null; // no audio support: play() becomes a no-op
          return;
        }
      }
      // 'suspended' before the first gesture; iOS can also leave it 'interrupted' after a call or app switch.
      if (ctx.state !== 'running') void ctx.resume();
    },

    play(name, variant = 0) {
      if (!ctx || muted) return;
      const now = ctx.currentTime;
      const gap = MIN_GAP[name];
      if (gap !== undefined && now - (lastPlayed.get(name) ?? -Infinity) < gap) return;
      lastPlayed.set(name, now);
      switch (name) {
        case 'split':
          tone('triangle', 520 + Math.random() * 180, 300, 0.09, 0.05);
          break;
        case 'bounce':
          tone('sine', 900, 700, 0.03, 0.012);
          break;
        case 'hit':
          tone('square', 220, 70, 0.22, 0.1);
          tone('sawtooth', 110, 50, 0.25, 0.05);
          break;
        case 'blocked':
          tone('sine', 1200, 900, 0.06, 0.04);
          break;
        case 'burn':
          tone('sawtooth', 380, 90, 0.12, 0.05);
          break;
        case 'pickup': {
          const base = 440 * 2 ** (variant / 12);
          tone('sine', base, base, 0.09, 0.09);
          tone('sine', base * 1.5, base * 1.5, 0.14, 0.08, 0.07);
          break;
        }
        case 'expire':
          tone('sine', 500, 250, 0.12, 0.03);
          break;
        case 'death':
          tone('sawtooth', 420, 50, 0.7, 0.1);
          tone('square', 210, 40, 0.8, 0.04);
          break;
        case 'cleared':
          [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.15, 0.08, i * 0.08));
          break;
        case 'spawn':
          tone('sine', 200, 400, 0.25, 0.04);
          break;
        case 'click':
          tone('triangle', 700, 600, 0.04, 0.05);
          break;
      }
    },

    setMuted(m) {
      muted = m;
      if (master && ctx) master.gain.setTargetAtTime(m ? 0 : MASTER_VOLUME, ctx.currentTime, 0.02);
    },
  };
}
