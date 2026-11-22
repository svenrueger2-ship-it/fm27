// Builds a single self-contained dist/index.html (JS + CSS inlined) – runs offline and on any static web server.
import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const watch = process.argv.includes('--serve');
const opts = { entryPoints: ['src/main.js'], bundle: true, format: 'iife', minify: !watch, target: ['es2020'], write: false, legalComments: 'none' };

function html(js) {
  const css = readFileSync('src/styles.css', 'utf8');
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#07060f">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,600;0,800;0,900;1,900&family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<title>FUSSBALL MANAGER 2027 © BAKUSA</title>
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
