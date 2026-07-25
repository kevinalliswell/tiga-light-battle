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
try {
  new TigaGame(scene, hud);
} catch (error) {
  console.error('无法启动 3D 战斗：', error);
  app.innerHTML = `
    <div class="fatal-error" role="alert">
      <h1>无法启动游戏</h1>
      <p>你的浏览器或设备可能不支持 3D 游戏所需的 WebGL。</p>
      <p>请更新到较新的浏览器，或换用支持 WebGL 的设备后再试。</p>
    </div>`;
}
