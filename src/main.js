// Entry point
import { App } from './ui/app.js';
import { preloadCrests } from './render/crestImages.js';

const root = document.getElementById('app');
const app = new App(root);
window.ufm = app; // handy for debugging in the console
preloadCrests().finally(() => app.render());
