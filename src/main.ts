import './style.css';
import { TigaGame } from './game/Game';
import { Hud } from './ui/hud';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Application root was not found');

app.innerHTML = `
  <main class="game-shell">
    <div class="scene" data-scene aria-hidden="true"></div>
    <div data-hud-root></div>
  </main>`;

const scene = app.querySelector<HTMLElement>('[data-scene]');
const hudRoot = app.querySelector<HTMLElement>('[data-hud-root]');
if (!scene || !hudRoot) throw new Error('Game mount points were not found');

const hud = new Hud(hudRoot);
new TigaGame(scene, hud);
