// The standalone offline explorer.
//
// One HTML file that opens from a USB stick on a clinic PC with no internet. That capability
// exists today in EyeExplorer.html and must not be lost; this is the same engine, wrapped in the
// smallest UI that makes it useful.

import { EyeScene, DEFAULT_IRIS, IRIS_PRESETS, GENERIC_MODEL_BOUNDARY, paintFundus, DEFAULT_FUNDUS } from "../src/engine";

const app = document.getElementById("app")!;
app.innerHTML = `
  <header>
    <h1>Afterlight — eye explorer</h1>
    <p class="boundary">${GENERIC_MODEL_BOUNDARY}</p>
  </header>
  <main>
    <canvas id="eye" aria-label="${GENERIC_MODEL_BOUNDARY}" role="img" tabindex="0"></canvas>
    <aside>
      <h2>Appearance</h2>
      <div id="presets" class="row"></div>
      <label>Pigment <input id="melanin" type="range" min="0" max="1" step="0.01" value="0.55"></label>
      <label>Light in the room <input id="light" type="range" min="0" max="1" step="0.01" value="0.5"></label>
      <h2>Inside the eye</h2>
      <canvas id="fundus" width="360" height="360" aria-label="Generic illustration of the inside of an eye"></canvas>
      <p class="note">Drag the eye, or use the arrow keys, to turn it. Works with no internet connection.</p>
    </aside>
  </main>
`;

const canvas = document.getElementById("eye") as HTMLCanvasElement;
const iris = { ...DEFAULT_IRIS };
let scene = new EyeScene(canvas, { iris });

function resize() {
  const rect = canvas.getBoundingClientRect();
  scene.resize(rect.width, rect.height);
}
window.addEventListener("resize", resize);
resize();
scene.start();

let dragging = false;
let last = { x: 0, y: 0 };
canvas.addEventListener("pointerdown", (e) => {
  dragging = true;
  last = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  scene.rotate((e.clientX - last.x) * 0.006, (e.clientY - last.y) * 0.006);
  last = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener("pointerup", () => (dragging = false));
canvas.addEventListener("keydown", (e) => {
  const step = 0.12;
  if (e.key === "ArrowLeft") scene.rotate(-step, 0);
  else if (e.key === "ArrowRight") scene.rotate(step, 0);
  else if (e.key === "ArrowUp") scene.rotate(0, -step);
  else if (e.key === "ArrowDown") scene.rotate(0, step);
});

function rebuild() {
  scene.dispose();
  scene = new EyeScene(canvas, { iris });
  resize();
  scene.start();
}

const presets = document.getElementById("presets")!;
for (const preset of IRIS_PRESETS) {
  const button = document.createElement("button");
  button.textContent = preset.label;
  button.onclick = () => {
    Object.assign(iris, preset.params);
    (document.getElementById("melanin") as HTMLInputElement).value = String(iris.melanin);
    rebuild();
  };
  presets.appendChild(button);
}

document.getElementById("melanin")!.addEventListener("change", (e) => {
  iris.melanin = Number((e.target as HTMLInputElement).value);
  rebuild();
});

document.getElementById("light")!.addEventListener("input", (e) => {
  scene.setLight(Number((e.target as HTMLInputElement).value));
});

const fundus = document.getElementById("fundus") as HTMLCanvasElement;
const fundusCtx = fundus.getContext("2d");
if (fundusCtx) paintFundus(fundusCtx, 360, DEFAULT_FUNDUS);
