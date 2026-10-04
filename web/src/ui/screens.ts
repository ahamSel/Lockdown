import { CONFIG } from '../game/config';
import { activePowerups, POWERUP_IDS, POWERUPS } from '../game/powerups';
import type { TimedPowerupId, World } from '../game/types';

export type ScreenName = 'title' | 'howto' | 'playing' | 'paused' | 'gameover';
export type UIAction = 'play' | 'howto' | 'back' | 'pause' | 'resume' | 'restart' | 'menu' | 'toggleMute';

export interface UI {
  show(name: ScreenName): void;
  onAction(handler: (action: UIAction) => void): void;
  hud(world: World, best: number): void;
  pulseHp(): void;
  gameOver(score: number, best: number, isNewBest: boolean): void;
  setBest(best: number): void;
  setMuted(muted: boolean): void;
}

interface Pill {
  el: HTMLElement;
  bar: HTMLElement;
  secs: HTMLElement;
  peak: number;
}

const POP: Keyframe[] = [{ transform: 'scale(1.35)' }, { transform: 'scale(1)' }];
const POP_TIMING: KeyframeAnimationOptions = { duration: 220, easing: 'cubic-bezier(.2,1.4,.4,1)' };
const HP_PULSE: Keyframe[] = [
  { transform: 'scale(1.5)', color: '#ff0c00' },
  { transform: 'scale(1)', color: '#ffffff' },
];

export function createUI(root: HTMLElement): UI {
  const bind = (name: string) => {
    const el = root.querySelector<HTMLElement>(`[data-bind="${name}"]`);
    if (!el) throw new Error(`missing [data-bind="${name}"]`);
    return el;
  };
  const screens = Array.from(root.querySelectorAll<HTMLElement>('[data-screen]'));
  const hp = bind('hp');
  const score = bind('score');
  const best = bind('best');
  const balls = bind('balls');
  const pills = bind('pills');
  const titleBest = bind('titleBest');
  const goScore = bind('goScore');
  const goBest = bind('goBest');
  const goNew = bind('goNew');
  const muteBtn = root.querySelector<HTMLElement>('[data-action="toggleMute"]')!;
  fillPowerupList(bind('powerups'));

  let handler: (action: UIAction) => void = () => {};
  root.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest<HTMLButtonElement>('button[data-action]');
    if (!btn) return;
    btn.blur();
    handler(btn.dataset.action as UIAction);
  });

  const shown = { hp: -1, score: -1, best: -1, balls: -1, order: '' };
  const pillEls = new Map<TimedPowerupId, Pill>();

  return {
    show(name) {
      for (const el of screens) el.classList.toggle('is-visible', el.dataset.screen!.split(' ').includes(name));
    },

    onAction(h) {
      handler = h;
    },

    hud(world, bestScore) {
      const p = world.player;
      if (p.hp !== shown.hp) {
        hp.textContent = String(p.hp);
        shown.hp = p.hp;
      }
      if (world.score !== shown.score) {
        score.textContent = String(world.score);
        if (shown.score > 0 && world.score > shown.score) score.animate(POP, POP_TIMING);
        shown.score = world.score;
      }
      if (bestScore !== shown.best) {
        best.textContent = `Best ${bestScore}`;
        shown.best = bestScore;
      }
      const n = world.balls.length;
      if (n !== shown.balls) {
        balls.textContent = `${n} ball${n === 1 ? '' : 's'}`;
        shown.balls = n;
      }

      const active = activePowerups(p);
      for (const [id, pill] of pillEls) {
        if (!active.some((a) => a.id === id)) {
          pill.el.remove();
          pillEls.delete(id);
        }
      }
      for (const a of active) {
        let pill = pillEls.get(a.id);
        if (!pill) {
          pill = makePill(a.id);
          pillEls.set(a.id, pill);
        }
        pill.peak = Math.max(pill.peak, a.remaining);
        pill.bar.style.transform = `scaleX(${a.remaining / pill.peak})`;
        const secs = String(Math.ceil(a.remaining));
        if (pill.secs.textContent !== secs) pill.secs.textContent = secs;
      }
      const order = active.map((a) => a.id).join();
      if (order !== shown.order) {
        for (const a of active) pills.appendChild(pillEls.get(a.id)!.el);
        shown.order = order;
      }
    },

    pulseHp() {
      hp.animate(HP_PULSE, { duration: 350, easing: 'cubic-bezier(.2,1.4,.4,1)' });
    },

    gameOver(finalScore, bestScore, isNewBest) {
      goScore.textContent = String(finalScore);
      goBest.textContent = `Best ${bestScore}`;
      goNew.classList.toggle('is-on', isNewBest);
    },

    setBest(bestScore) {
      titleBest.textContent = bestScore > 0 ? `Best ${bestScore}` : '';
    },

    setMuted(muted) {
      muteBtn.classList.toggle('is-muted', muted);
      muteBtn.setAttribute('aria-pressed', String(muted));
    },
  };
}

function makePill(id: TimedPowerupId): Pill {
  const def = POWERUPS[id];
  const el = document.createElement('div');
  el.className = 'pill';
  el.style.setProperty('--c', def.color);
  const dot = document.createElement('i');
  dot.className = 'dot';
  const label = document.createElement('span');
  label.textContent = def.label;
  const secs = document.createElement('b');
  secs.className = 'secs';
  const bar = document.createElement('span');
  bar.className = 'bar';
  const fill = document.createElement('span');
  bar.append(fill);
  el.append(dot, label, secs, bar);
  return { el, bar: fill, secs, peak: 0 };
}

function fillPowerupList(list: HTMLElement) {
  for (const id of POWERUP_IDS) {
    const def = POWERUPS[id];
    const li = document.createElement('li');
    const dot = document.createElement('i');
    dot.className = 'diamond';
    dot.style.setProperty('--c', def.color);
    const name = document.createElement('strong');
    name.textContent = def.label;
    const desc = document.createElement('span');
    desc.textContent = def.timed ? `${def.description} · ${CONFIG.powerup.duration} s` : def.description;
    li.append(dot, name, desc);
    list.append(li);
  }
}
