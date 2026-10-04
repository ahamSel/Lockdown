import './ui/styles.css';
import { soundForEvent } from './audio/events';
import { createSfx } from './audio/sfx';
import { createBestTracker } from './best';
import { CONFIG } from './game/config';
import { createWorld, drainEvents, resizeWorld, step } from './game/sim';
import type { SimEvent, Vec, World } from './game/types';
import { createKeyboard } from './input/keyboard';
import { createJoystick } from './input/touch';
import { planSteps } from './loop';
import { createFx } from './render/fx';
import { createRenderer } from './render/renderer';
import { readBool, readNumber, writeBool, writeNumber } from './storage';
import { createUI, type ScreenName, type UIAction } from './ui/screens';

const ZERO: Vec = { x: 0, y: 0 };
const GAME_OVER_DELAY = 1.2;

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ui = createUI(document.getElementById('ui')!);
const renderer = createRenderer(canvas);
const fx = createFx(matchMedia('(prefers-reduced-motion: reduce)').matches);
const keyboard = createKeyboard(window);
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
  last = performance.now();
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
  for (const e of events) {
    const sound = soundForEvent(e, world);
    if (sound) sfx.play(sound[0], sound[1]);
    if (world.demo) continue;
    if (e.type === 'hit') ui.pulseHp();
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
  const frameDt = Math.min((now - last) / 1000, CONFIG.maxFrame);
  last = now;
  const running = screen !== 'paused';
  if (running) {
    const input = currentInput();
    const plan = planSteps(acc, frameDt, CONFIG.step, CONFIG.maxFrame);
    for (let i = 0; i < plan.steps; i++) step(world, input, CONFIG.step);
    acc = plan.acc;
    alpha = plan.alpha;
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
  if (e.repeat) return;
  const onButton = (e.target as Element | null)?.closest?.('button');
  switch (e.code) {
    case 'Escape':
    case 'KeyP':
      if (screen === 'playing') pause();
      else if (screen === 'paused') resume();
      else if (screen === 'howto') setScreen('title');
      break;
    case 'KeyR':
      if (screen === 'playing' || screen === 'paused' || screen === 'gameover') startGame();
      break;
    case 'Enter':
    case 'Space':
      if (onButton) return; // the button's own click handles it
      e.preventDefault();
      if (screen === 'title' || screen === 'gameover') startGame();
      else if (screen === 'paused') resume();
      break;
    case 'KeyM':
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
