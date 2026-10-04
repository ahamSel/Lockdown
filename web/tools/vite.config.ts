// Dev-only server for generating store art with the game's own renderer.
// Run: npx vite --config tools/vite.config.ts, then open /tools/shots.html. PNGs land in web/marketing/.
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'marketing');

export default defineConfig({
  root: join(dirname(fileURLToPath(import.meta.url)), '..'),
  server: { port: 5199, strictPort: true },
  plugins: [
    {
      name: 'save-shots',
      configureServer(server) {
        server.middlewares.use('/__save', (req, res) => {
          const name = basename(new URL(req.url ?? '', 'http://local').searchParams.get('name') ?? 'shot.png');
          const chunks: Buffer[] = [];
          req.on('data', (c: Buffer) => chunks.push(c));
          req.on('end', () => {
            mkdirSync(outDir, { recursive: true });
            writeFileSync(join(outDir, name), Buffer.concat(chunks));
            res.end('saved ' + name);
          });
        });
      },
    },
  ],
});
