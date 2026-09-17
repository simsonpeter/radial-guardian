import { AudioEngine } from "./audio.js";
import { Input } from "./input.js";
import { UI } from "./ui.js";
import { Game } from "./game.js";

const canvas = document.getElementById("game");
const audio = new AudioEngine();
const ui = new UI(audio);
const input = new Input(canvas, () => {
  const rect = canvas.getBoundingClientRect();
  return { cx: rect.width * 0.5, cy: rect.height * 0.5 };
});
input.attach();

const game = new Game(canvas, { audio, ui, input });
game.init();
window.RadialDefense = game;

window.addEventListener("blur", () => {
  if (game.state === "playing") game.pause();
});
