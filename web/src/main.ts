import './ui/styles.css';
import { soundForEvent } from './audio/events';
import { createSfx } from './audio/sfx';
import { createBestTracker } from './best';
import { CONFIG } from './game/config';
import { createWorld, drainEvents, resizeWorld, step } from './game/sim';
import type { SimEvent, Vec, World } from './game/types';
import { createKeyboard } from './input/keyboard';
import { shortcutFor } from './input/shortcuts';
import { createJoystick } from './input/touch';
import { planSteps } from './loop';
import { createFx } from './render/fx';
import { createRenderer } from './render/renderer';
import { readBool, readNumber, writeBool, writeNumber } from './storage';
import { createUI, type ScreenName, type UIAction } from './ui/screens';

const ZERO: Vec = { x: 0, y: 0 };
const GAME_OVER_DELAY = 1.2;
/** A hit freezes the world for a moment so it lands with some weight. */
const HIT_STOP = 0.05;

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ui = createUI(document.getElementById('ui')!);
const renderer = createRenderer(canvas);
const fx = createFx(matchMedia('(prefers-reduced-motion: reduce)').matches);
// On How to play the arrow keys scroll the list; everywhere else they must not scroll the itch page.
const keyboard = createKeyboard(window, () => screen !== 'howto');
const joystick = createJoystick(canvas);
const sfx = createSfx();

let screen: ScreenName = 'title';
let world: World = createWorld({ aspect: renderer.aspect(), demo: true });
const best = createBestTracker(readNumber('best', 0), (v) => writeNumber('best', v));
let muted = readBool('muted', false);
let acc = 0;
let alpha = 0;
let last = performance.now();
let gameOverIn = -1;
let hitStop = 0;

if (import.meta.env.DEV) {
  (window as unknown as { gwa: unknown }).gwa = { world: () => world };
}

function setScreen(next: ScreenName) {
  screen = next;
  ui.show(next);
  joystick.setEnabled(next === 'playing');
}

function saveBest() {
  if (!world.demo) best.record(world.score);
}

function startGame() {
  saveBest();
  world = createWorld({ aspect: renderer.aspect() });
  best.startRun();
  acc = 0;
  hitStop = 0;
  gameOverIn = -1;
  fx.reset();
  setScreen('playing');
}

function toMenu() {
  saveBest();
  world = createWorld({ aspect: renderer.aspect(), demo: true });
  gameOverIn = -1;
  fx.reset();
  ui.setBest(best.value);
  setScreen('title');
}

function pause() {
  if (screen !== 'playing') return;
  saveBest();
  setScreen('paused');
}

function resume() {
  if (screen !== 'paused') return;
  setScreen('playing');
}

function showGameOver() {
  saveBest();
  ui.gameOver(world.score, best.value, best.isNewBest(world.score));
  setScreen('gameover');
}

function toggleMute() {
  muted = !muted;
  sfx.setMuted(muted);
  ui.setMuted(muted);
  writeBool('muted', muted);
}

function act(action: UIAction) {
  sfx.unlock();
  sfx.play('click');
  switch (action) {
    case 'play':
    case 'restart':
      startGame();
      break;
    case 'howto':
      setScreen('howto');
      break;
    case 'back':
      setScreen('title');
      break;
    case 'menu':
      toMenu();
      break;
    case 'pause':
      pause();
      break;
    case 'resume':
      resume();
      break;
    case 'toggleMute':
      toggleMute();
      break;
  }
}

function handleEvents(events: SimEvent[]) {
  if (events.length === 0) return;
  fx.handle(events, world);
  renderer.onEvents(events, world);
  for (const e of events) {
    const sound = soundForEvent(e, world);
    if (sound) sfx.play(sound[0], sound[1]);
    if (world.demo) continue;
    if (e.type === 'hit') {
      ui.pulseHp();
      hitStop = HIT_STOP;
    }
    else if (e.type === 'death') gameOverIn = GAME_OVER_DELAY;
  }
}

function currentInput(): Vec {
  if (screen !== 'playing') return ZERO;
  const kb = keyboard.dir();
  return kb.x !== 0 || kb.y !== 0 ? kb : joystick.dir();
}

function frame(now: number) {
  // Schedule first, so one bad frame can't stop the game for good.
  requestAnimationFrame(frame);
  // rAF timestamps can be slightly earlier than a performance.now() read, so never go negative.
  const frameDt = Math.min(Math.max(0, (now - last) / 1000), CONFIG.maxFrame);
  last = now;
  const running = screen !== 'paused';
  if (running) {
    if (hitStop > 0) {
      hitStop -= frameDt; // the world holds still; effects and the player's squash keep animating
    } else {
      const input = currentInput();
      const plan = planSteps(acc, frameDt, CONFIG.step, CONFIG.maxFrame);
      for (let i = 0; i < plan.steps; i++) step(world, input, CONFIG.step);
      acc = plan.acc;
      alpha = plan.alpha;
    }
    handleEvents(drainEvents(world));
    fx.update(frameDt, world);
    if (gameOverIn > 0) {
      gameOverIn -= frameDt;
      if (gameOverIn <= 0) showGameOver();
    }
  }
  if (!world.demo) ui.hud(world, Math.max(best.value, world.score));
  renderer.draw(world, fx, alpha, screen === 'playing' ? joystick.view() : null, running ? frameDt : 0);
}

ui.onAction(act);
window.addEventListener('keydown', (e) => {
  sfx.unlock();
  const onButton = !!(e.target as Element | null)?.closest?.('button');
  const { action, preventDefault } = shortcutFor({ code: e.code, repeat: e.repeat, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, onButton }, screen);
  if (preventDefault) e.preventDefault();
  switch (action) {
    case 'pause':
      pause();
      break;
    case 'resume':
      resume();
      break;
    case 'back':
      setScreen('title');
      break;
    case 'restart':
    case 'start':
      startGame();
      break;
    case 'mute':
      toggleMute();
      break;
  }
});
window.addEventListener('pointerdown', () => sfx.unlock());
window.addEventListener('resize', () => resizeWorld(world, renderer.resize()));
window.addEventListener('blur', pause);
window.addEventListener('pagehide', saveBest);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
});

sfx.setMuted(muted);
ui.setMuted(muted);
ui.setBest(best.value);
setScreen('title');
requestAnimationFrame(frame);
