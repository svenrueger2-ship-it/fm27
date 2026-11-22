// Usage: node tools/setRepo.mjs deinname/fussball-manager-2027  → trägt das GitHub-Repo für Auto-Updates ein
import fs from 'node:fs';
const [owner, repo] = (process.argv[2] || '').split('/');
if (!owner || !repo) { console.error('Bitte so aufrufen: node tools/setRepo.mjs BENUTZER/REPO'); process.exit(1); }
const p = new URL('../desktop/package.json', import.meta.url);
const pkg = JSON.parse(fs.readFileSync(p, 'utf8'));
pkg.build.publish = [{ provider: 'github', owner, repo, releaseType: 'release' }];
fs.writeFileSync(p, JSON.stringify(pkg, null, 2));
console.log('Auto-Update-Quelle gesetzt auf github.com/' + owner + '/' + repo);
