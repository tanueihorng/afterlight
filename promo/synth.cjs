// 120 BPM, F major, 22 s. Everything is synthesised; no samples.
const fs = require('fs');
const SR = 44100, DUR = 22, N = SR * DUR, BEAT = .5, b = n => n * BEAT;
const L = new Float32Array(N), R = new Float32Array(N), VL = new Float32Array(N), VR = new Float32Array(N); // dry, reverb send
let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647 * 2 - 1;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function put(i, v, pan = 0, send = 0) { if (i < 0 || i >= N) return; const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4); L[i] += v * gl; R[i] += v * gr; VL[i] += v * send * gl; VR[i] += v * send * gr; }
function biquad(type, f, q) { // RBJ
  let a0, a1, a2, b0, b1, b2; const w = 2 * Math.PI * f / SR, c = Math.cos(w), al = Math.sin(w) / (2 * q);
  if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; } else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; } else { b0 = al; b1 = 0; b2 = -al; }
  a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const fn = x => { const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
  fn.set = (f2, q2 = q) => { const w = 2 * Math.PI * Math.min(f2, SR * .45) / SR, c = Math.cos(w), al = Math.sin(w) / (2 * q2); a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; } else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; } else { b0 = al; b1 = 0; b2 = -al; } };
  return fn;
}
// ── sidechain envelope from kicks
const kicks = []; for (let k = 4; k < 34; k++) kicks.push(b(k));
kicks.push(b(40));
const duck = new Float32Array(N).fill(1);
for (const t of kicks) { const s = Math.floor(t * SR); for (let n = 0; n < SR * .45; n++) if (s + n < N) duck[s + n] = Math.min(duck[s + n], 1 - .72 * Math.exp(-n / SR * 9)); }
// ── drums
function kick(t, g = 1) { const s = Math.floor(t * SR); let ph = 0; for (let n = 0; n < SR * .5; n++) { const x = n / SR, f = 44 + 130 * Math.exp(-x * 32); ph += 2 * Math.PI * f / SR; const v = Math.sin(ph) * Math.exp(-x * 6.5) * 1.0 + rnd() * .25 * Math.exp(-x * 400); put(s + n, Math.tanh(v * 1.6) * g * .8); } }
function clap(t, g = 1) { const s = Math.floor(t * SR), bp = biquad('bp', 1400, 1.1); for (let n = 0; n < SR * .3; n++) { const x = n / SR; let e = Math.exp(-x * 16); for (const o of [0, .011, .022]) if (x >= o && x < o + .01) e = Math.max(e, 1 - (x - o) / .01); put(s + n, bp(rnd()) * e * g * 1.6, 0, .25); } }
function hat(t, g = 1, open = false, pan = .25) { const s = Math.floor(t * SR), hp = biquad('hp', 7500, .7); for (let n = 0; n < SR * (open ? .25 : .06); n++) { const x = n / SR; put(s + n, hp(rnd()) * Math.exp(-x * (open ? 14 : 70)) * g * .35, pan, .08); } }
function impact(t, g = 1) { const s = Math.floor(t * SR), lp = biquad('lp', 900, .7); let ph = 0; for (let n = 0; n < SR * 2.2; n++) { const x = n / SR, f = 32 + 60 * Math.exp(-x * 10); ph += 2 * Math.PI * f / SR; const v = Math.sin(ph) * Math.exp(-x * 2.2) * .9 + lp(rnd()) * Math.exp(-x * 5) * .7; put(s + n, Math.tanh(v * 1.4) * g, 0, .35); } }
function whoosh(t, d = .45, g = .5, up = true) { const s = Math.floor(t * SR), bp = biquad('bp', 500, 1.4); for (let n = 0; n < SR * d; n++) { const x = n / SR / d; bp.set(up ? 300 + 5000 * x * x : 5000 - 4700 * x, 1.4); put(s + n, bp(rnd()) * Math.sin(Math.PI * x) ** 2 * g, Math.sin(x * 3) * .6, .3); } }
function riser(t0, t1, g = .6) { const s = Math.floor(t0 * SR), n1 = Math.floor((t1 - t0) * SR), bp = biquad('bp', 300, 2); let ph = 0; for (let n = 0; n < n1; n++) { const x = n / n1; bp.set(200 + 9000 * x * x * x, 2.5); ph += 2 * Math.PI * (180 + 900 * x * x) / SR; put(s + n, (bp(rnd()) * .9 + Math.sin(ph) * .12) * x * x * g, 0, .4); } }
function reverseSwell(t1, d, notes, g = .25) { const s = Math.floor((t1 - d) * SR), n1 = Math.floor(d * SR); for (const m of notes) { const f = mtof(m); let ph = 0; for (let n = 0; n < n1; n++) { const x = n / n1; ph += 2 * Math.PI * f / SR; put(s + n, (Math.sin(ph) + .3 * Math.sin(2 * ph)) * x ** 3 * g / notes.length, 0, .6); } } }
function bell(t, m, g = .25, pan = 0) { const s = Math.floor(t * SR), f = mtof(m); for (let n = 0; n < SR * 1.6; n++) { const x = n / SR; const v = Math.sin(2 * Math.PI * f * x) * Math.exp(-x * 3) + .5 * Math.sin(2 * Math.PI * f * 2.76 * x) * Math.exp(-x * 6) + .25 * Math.sin(2 * Math.PI * f * 5.4 * x) * Math.exp(-x * 10); put(s + n, v * g * Math.min(1, x * 400), pan, .55); } }
// ── tonal
const chords = { F: [53, 57, 60, 64], Dm: [50, 53, 57, 60], Bb: [46, 50, 53, 57], C: [48, 52, 55, 60], Am: [45, 48, 52, 55], Csus: [48, 53, 55, 60], F9: [53, 57, 60, 64, 67] };
const bars = ['Fdrone', 'F', 'Dm', 'Bb', 'C', 'F', 'Am', 'Bb', 'C', 'Dm', 'F9']; // bar = 2 s
const roots = { F: 41, Dm: 38, Bb: 34, C: 36, Am: 33, F9: 41 };
function saw(ph) { return 2 * (ph - Math.floor(ph + .5)); }
function padChord(t0, d, notes, g, bright = 1600) {
  const s = Math.floor(t0 * SR), n1 = Math.floor(d * SR);
  for (const [vi, m] of notes.entries()) for (const det of [-.09, 0, .09]) {
    const f = mtof(m + 12) * Math.pow(2, det / 12); const lp = biquad('lp', bright, .8); let ph = rnd();
    const pan = det * 6 + (vi - 1.5) * .12;
    for (let n = 0; n < n1 + SR * .8; n++) { const x = n / SR; ph += f / SR; const env = Math.min(1, x / .25) * (n > n1 ? Math.exp(-(n - n1) / SR * 5) : 1); lp.set(bright * (1 + .3 * Math.sin(x * 2 + vi))); put(s + n, lp(saw(ph)) * env * g * .05 * (duck[s + n] ?? 1), pan, .5); }
  }
}
function bass(t, m, d, g = 1) { const s = Math.floor(t * SR), f = mtof(m), lp = biquad('lp', 380, 1.2); let ph = 0; for (let n = 0; n < SR * d; n++) { const x = n / SR; ph += f / SR; const env = Math.min(1, x / .005) * Math.exp(-x * 3) * (x > d - .02 ? (d - x) / .02 : 1); lp.set(220 + 900 * Math.exp(-x * 18)); put(s + n, (lp(saw(ph)) * .8 + Math.sin(2 * Math.PI * ph) * .6) * env * g * .5 * (duck[s + n] ?? 1)); } }
function pluck(t, m, g = .2, pan = 0) { const s = Math.floor(t * SR), f = mtof(m), lp = biquad('lp', 3000, 1); let ph = 0; for (let n = 0; n < SR * .45; n++) { const x = n / SR; ph += f / SR; lp.set(600 + 5000 * Math.exp(-x * 20)); const sq = ph % 1 < .5 ? 1 : -1; put(s + n, lp(sq * .6 + saw(ph) * .4) * Math.exp(-x * 9) * g * (duck[s + n] ?? 1), pan, .4); } }

// ───── arrangement ─────
// bar 0 — hook
impact(0, 1); bell(0.02, 89, .22, .3); bell(0.5, 84, .12, -.3);
padChord(0, 1.5, [41, 53, 60], .6, 700);
riser(.4, b(3), .5); whoosh(1.0, .5, .7, false);
impact(b(3), .9); bell(b(3) + .02, 93, .18, .4); bell(b(3) + .15, 96, .1, -.4);
hat(b(3.5), .6); hat(b(3.75), .8);
// bars 1–8 — groove
for (let bar = 1; bar <= 8; bar++) {
  const name = bars[bar], t0 = bar * 2, ch = chords[name];
  padChord(t0, 2, ch, bar >= 7 ? 1 : .8, bar >= 7 ? 2600 : 1500);
  for (let e = 0; e < 8; e++) {
    const t = t0 + e * .25; const oct = e % 2 ? 12 : 0;
    bass(t, roots[name] + oct, .22, e % 2 ? .7 : 1);
  }
  for (let q = 0; q < 4; q++) { const t = t0 + q * .5; kick(t, 1); if (q % 2) clap(t, bar >= 7 ? 1.1 : .9); }
  // hats: offbeats from bar 2, 16ths in bars 7–8
  for (let s16 = 0; s16 < 16; s16++) {
    const t = t0 + s16 * .125;
    if (bar >= 7) hat(t, s16 % 4 === 2 ? 1 : .45, s16 % 8 === 6, s16 % 2 ? .3 : -.2);
    else if (bar >= 2 && s16 % 4 === 2) hat(t, .9, bar >= 5 && s16 % 8 === 6);
  }
  // arp from bar 3
  if (bar >= 3) { const pat = [0, 1, 2, 3, 2, 1, 3, 2]; for (let s16 = 0; s16 < 16; s16++) { const m = ch[pat[s16 % 8] % ch.length] + 24 + (s16 >= 8 && bar >= 5 ? 12 : 0) - 12; pluck(t0 + s16 * .125, m, bar >= 7 ? .16 : .11, s16 % 2 ? .45 : -.45); } }
}
// accents
impact(b(10), .35); whoosh(b(11), .5, .5, true);                        // "doesn't." / fall
bell(b(12), 84, .2); bell(b(13), 88, .12, -.4); bell(b(13) + .06, 91, .1, .4); // the dot, the split
for (let k = 0; k < 6; k++) bell(b(14.4) + k * .21, [72, 76, 79, 84, 88, 91][k], .06, (k % 2 ? .5 : -.5)); // days fill in
whoosh(b(16), .5, .45); for (let h = 0; h < 5; h++) bell(b(18) + h * .5 + .3, 84 + [0, 2, 4, 7, 9][h], .07, .2); // Lumi hops
whoosh(b(19.4), .3, .6, true); impact(b(20), .45);                                          // dive into the day
for (let k = 1; k < 4; k++) whoosh(b(20 + 2 * k) - .25, .5, .55, k % 2 === 1);              // camera moves
riser(b(26), b(28), .55); whoosh(b(27.4), .3, .7, true);
impact(b(28), 1);                                                                          // drop
whoosh(b(30), .3, .6, false); whoosh(b(32), .35, .6, true); whoosh(b(33.5), .3, .5, false);
// bar 9 — breakdown: pad + soft plucks, no drums
padChord(18 - 1, 1, chords.Dm, .7, 900);
padChord(b(34), 3, chords.Dm, .9, 1100);
padChord(b(38), 1, chords.Bb, .9, 1300);
[62, 65, 69, 72, 69, 65].forEach((m, i) => pluck(b(34) + i * .5, m + 12, .1, i % 2 ? .4 : -.4));
bell(b(36), 77, .13); bell(b(38), 81, .12); bell(b(38.5), 84, .1);
riser(b(38), b(40), .45); reverseSwell(b(40), 1.2, [65, 69, 72, 76], .5);
// bar 10 — end
impact(b(40), 1.1); kick(b(40), 1);
padChord(b(40), 1.4, chords.F9, 1.2, 2200);
bass(b(40), 29, 1.4, 1.2);
[77, 81, 84, 88, 91].forEach((m, i) => bell(b(41) + i * .09, m, .1, (i - 2) * .25));
bell(b(43), 96, .08, .3);

// ── reverb (Schroeder-ish, stereo)
function reverb(inp, combs, aps) {
  const out = new Float32Array(N);
  for (const [d, fb] of combs) { const buf = new Float32Array(d); let i = 0, lp = 0; for (let n = 0; n < N; n++) { const y = buf[i]; lp = y * .7 + lp * .3; buf[i] = inp[n] + lp * fb; i = (i + 1) % d; out[n] += y / combs.length; } }
  for (const d of aps) { const buf = new Float32Array(d); let i = 0; for (let n = 0; n < N; n++) { const bv = buf[i], x = out[n]; const y = -x * .5 + bv; buf[i] = x + bv * .5; out[n] = y; i = (i + 1) % d; } }
  return out;
}
const rvL = reverb(VL, [[1557, .86], [1617, .86], [1491, .86], [1422, .86], [1277, .86]], [225, 556, 441]);
const rvR = reverb(VR, [[1580, .86], [1640, .86], [1514, .86], [1445, .86], [1300, .86]], [248, 579, 464]);
// ── master: sum, gentle glue, fade, normalise
let peak = 0; const out = Buffer.alloc(N * 4);
const mix = new Float32Array(N * 2);
for (let n = 0; n < N; n++) {
  const fade = Math.min(1, (DUR - n / SR) / .5);
  const l = Math.tanh((L[n] + rvL[n] * 1.2) * .9) * fade, r = Math.tanh((R[n] + rvR[n] * 1.2) * .9) * fade;
  mix[2 * n] = l; mix[2 * n + 1] = r; peak = Math.max(peak, Math.abs(l), Math.abs(r));
}
const g = .93 / peak;
for (let n = 0; n < N * 2; n++) out.writeInt16LE(Math.round(clampS(mix[n] * g) * 32767), n * 2);
function clampS(x) { return Math.max(-1, Math.min(1, x)); }
const h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36 + out.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(out.length, 40);
fs.writeFileSync('music.wav', Buffer.concat([h, out])); console.log('peak', peak.toFixed(2));
