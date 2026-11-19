import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? './out');

function copyDir(src: string, dest: string): number {
  let count = 0;
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      count += copyDir(srcPath, destPath);
    } else {
      cpSync(srcPath, destPath);
      count++;
    }
  }
  return count;
}

mkdirSync(outDir, { recursive: true });

const appSrc = join(here, 'app');
const appDest = join(outDir, 'app');
const appCount = existsSync(appSrc) ? copyDir(appSrc, appDest) : 0;

const shotsSrc = join(here, 'screenshots');
const shotsDest = join(outDir, 'screenshots');
const shotsCount = existsSync(shotsSrc) ? copyDir(shotsSrc, shotsDest) : 0;

const dossierBytes = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});

writeFileSync(join(outDir, 'dossier.json'), dossierBytes);

console.log(`Copied ${appCount} files from app/ to ${appDest}`);
console.log(`Copied ${shotsCount} files from screenshots/ to ${shotsDest}`);
console.log(`Wrote dossier.json (${dossierBytes.length} bytes) to ${outDir}`);