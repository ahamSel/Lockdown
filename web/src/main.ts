// Temporary harness for Task 5: a playable world with no UI. Replaced in Task 8.
import { CONFIG } from './game/config';
import { createWorld, drainEvents, resizeWorld, step } from './game/sim';
import { createKeyboard } from './input/keyboard';
import { createJoystick } from './input/touch';
import { planSteps } from './loop';
import { createFx } from './render/fx';
import { createRenderer } from './render/renderer';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const renderer = createRenderer(canvas);
const fx = createFx(false);
const keyboard = createKeyboard(window);
const joystick = createJoystick(canvas);
joystick.setEnabled(true);

let world = createWorld({ aspect: renderer.aspect() });
let acc = 0;
let alpha = 0;
let last = performance.now();

window.addEventListener('resize', () => resizeWorld(world, renderer.resize()));
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyR') world = createWorld({ aspect: renderer.aspect() });
});

function frame(now: number) {
  const dt = Math.min((now - last) / 1000, CONFIG.maxFrame);
  last = now;
  const kb = keyboard.dir();
  const input = kb.x !== 0 || kb.y !== 0 ? kb : joystick.dir();
  const plan = planSteps(acc, dt, CONFIG.step, CONFIG.maxFrame);
  for (let i = 0; i < plan.steps; i++) step(world, input, CONFIG.step);
  acc = plan.acc;
  alpha = plan.alpha;
  fx.handle(drainEvents(world), world);
  fx.update(dt, world);
  renderer.draw(world, fx, alpha, joystick.view(), dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
