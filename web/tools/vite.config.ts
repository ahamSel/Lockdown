// Dev-only server for generating store art with the game's own renderer.
// Run: npx vite --config tools/vite.config.ts, then open /tools/shots.html. PNGs land in web/marketing/.
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'marketing');
// Planned runs for the README preview (tools/capture) are saved next to the planner.
const captureDir = join(dirname(fileURLToPath(import.meta.url)), 'capture');

export default defineConfig({
  root: join(dirname(fileURLToPath(import.meta.url)), '..'),
  server: { port: 5199, strictPort: true },
  plugins: [
    {
      name: 'save-shots',
      configureServer(server) {
        server.middlewares.use('/__save', (req, res) => {
          const q = new URL(req.url ?? '', 'http://local').searchParams;
          const name = basename(q.get('name') ?? 'shot.png');
          const dir = q.get('dir') === 'capture' ? captureDir : outDir;
          const chunks: Buffer[] = [];
          req.on('data', (c: Buffer) => chunks.push(c));
          req.on('end', () => {
            mkdirSync(dir, { recursive: true });
            writeFileSync(join(dir, name), Buffer.concat(chunks));
            res.end('saved ' + name);
          });
        });
      },
    },
  ],
});
