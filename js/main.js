import { AudioEngine } from "./audio.js";
import { AdService } from "./ads.js";
import { Input } from "./input.js";
import { UI } from "./ui.js";
import { Game } from "./game.js";
import { runSplash } from "./splash.js";

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

const canvas = document.getElementById("game");
const audio = new AudioEngine();
const ads = new AdService();
ads.init({ muted: audio.muted });
const ui = new UI(audio);
const input = new Input(canvas, () => {
  const rect = canvas.getBoundingClientRect();
  return { cx: rect.width * 0.5, cy: rect.height * 0.5 };
});
input.attach();

const game = new Game(canvas, { audio, ui, input, ads });
window.RadialDefense = game;

await runSplash();
game.init();
ui.onMuteChange = (muted) => ads.setSound(!muted);

window.addEventListener("blur", () => {
  if (game.state === "playing") game.pause();
});
