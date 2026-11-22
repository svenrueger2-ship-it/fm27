// Builds a single self-contained dist/index.html (JS + CSS inlined) – runs offline and on any static web server.
import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const watch = process.argv.includes('--serve');
const opts = { entryPoints: ['src/main.js'], bundle: true, format: 'iife', minify: !watch, target: ['es2020'], write: false, legalComments: 'none' };

function html(js, cssFile = 'src/styles.css', title = 'FUSSBALL MANAGER 2027 © BAKUSA') {
  const css = readFileSync(cssFile, 'utf8');
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#07060f">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,600;0,800;0,900;1,900&family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<title>${title}</title>
<style>${css}</style>
</head>
<body>
<div id="app"></div>
<script>${js.replace(/<\/script/gi, '<\\/script')}</script>
</body>
</html>`;
}

const result = await esbuild.build(opts);
mkdirSync('dist', { recursive: true });
writeFileSync('dist/index.html', html(result.outputFiles[0].text));
console.log('dist/index.html', (readFileSync('dist/index.html').length / 1024).toFixed(0) + ' KB');
// v2.6: the desktop launcher
const lr = await esbuild.build({ ...opts, entryPoints: ['src/launcher/main.js'] });
writeFileSync('dist/launcher.html', html(lr.outputFiles[0].text, 'src/launcher/launcher.css', 'FUSSBALL MANAGER 2027 – Launcher').replace('<div id="app"></div>', ''));
console.log('dist/launcher.html', (readFileSync('dist/launcher.html').length / 1024).toFixed(0) + ' KB');

// v2.7: content version + manifest for live updates (uploaded to the GitHub release "live")
import { createHash } from 'node:crypto';
const { PATCHNOTES } = await import('./src/data/patchnotes.js');
const shellApi = Number((readFileSync('desktop/main.cjs', 'utf8').match(/const SHELL_API = (\d+)/) || [0, 1])[1]);
const files = {};
for (const f of ['index.html', 'launcher.html']) { const b = readFileSync('dist/' + f); files[f] = { size: b.length, sha256: createHash('sha256').update(b).digest('hex') }; }
writeFileSync('dist/version.json', JSON.stringify({ version: PATCHNOTES[0].version }));
writeFileSync('dist/manifest.json', JSON.stringify({ version: PATCHNOTES[0].version, title: PATCHNOTES[0].title, date: PATCHNOTES[0].date, shellApi, files }, null, 2));
console.log('dist/manifest.json', PATCHNOTES[0].version, 'shellApi', shellApi);
