// numeron. type math, get an answer, then get told a bunch of stuff about it.
// the parser is a shunting-yard thing i wrote myself. no libraries.

"use strict";

// ---- functions + constants the calculator knows ----
const FUNCS = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  log: (x) => Math.log10(x), ln: Math.log,
  sqrt: Math.sqrt, abs: Math.abs, exp: Math.exp,
  floor: Math.floor, ceil: Math.ceil, round: Math.round,
};
const CONSTS = { pi: Math.PI, e: Math.E, tau: Math.PI * 2 };
const OPS = { "+": [2, false], "-": [2, false], "*": [3, false], "/": [3, false], "%": [3, false], "^": [4, true] };

// break the string into tokens (numbers, names, ops, brackets, the ! thing)
function tokenize(src) {
  const t = [];
  let i = 0;
  const digit = (c) => c >= "0" && c <= "9";
  const alpha = (c) => (c >= "a" && c <= "z") || (c >= "A" && c <= "Z");

  while (i < src.length) {
    const c = src[i];
    if (c === " ") { i++; continue; }
    if (digit(c) || (c === "." && digit(src[i + 1]))) {
      let n = "";
      while (i < src.length && (digit(src[i]) || src[i] === ".")) n += src[i++];
      if ((n.match(/\./g) || []).length > 1) throw new Error("that number has too many dots");
      t.push({ t: "num", v: parseFloat(n) });
      continue;
    }
    if (alpha(c)) {
      let w = "";
      while (i < src.length && (alpha(src[i]) || digit(src[i]))) w += src[i++];
      w = w.toLowerCase();
      if (FUNCS[w]) t.push({ t: "func", v: w });
      else if (w in CONSTS) t.push({ t: "num", v: CONSTS[w] });
      else if (w === "x") t.push({ t: "var" });
      else throw new Error("dunno what '" + w + "' means");
      continue;
    }
    if (c === "!") { t.push({ t: "fact" }); i++; continue; }
    if (c === "(") { t.push({ t: "lp" }); i++; continue; }
    if (c === ")") { t.push({ t: "rp" }); i++; continue; }
    if (c in OPS) { t.push({ t: "op", v: c }); i++; continue; }
    throw new Error("weird character: " + c);
  }
  return t;
}

// shunting-yard: turn the infix tokens into reverse-polish so it's easy to run.
// the annoying bit was unary minus, i handle it by sneaking a 0 in front.
function toRPN(tokens) {
  const out = [];
  const stack = [];
  let prev = null;

  for (const tok of tokens) {
    if (tok.t === "num" || tok.t === "var") {
      out.push(tok);
    } else if (tok.t === "func") {
      stack.push(tok);
    } else if (tok.t === "fact") {
      out.push(tok);
    } else if (tok.t === "op") {
      const unary = tok.v === "-" && (prev === null || prev.t === "op" || prev.t === "lp");
      if (unary) {
        out.push({ t: "num", v: 0 });
        stack.push({ t: "op", v: "-" });
      } else {
        const [p, rightAssoc] = OPS[tok.v];
        while (stack.length) {
          const top = stack[stack.length - 1];
          if (top.t === "op") {
            const [tp] = OPS[top.v];
            if (tp > p || (tp === p && !rightAssoc)) { out.push(stack.pop()); continue; }
          }
          break;
        }
        stack.push(tok);
      }
    } else if (tok.t === "lp") {
      stack.push(tok);
    } else if (tok.t === "rp") {
      while (stack.length && stack[stack.length - 1].t !== "lp") out.push(stack.pop());
      if (!stack.length) throw new Error("you've got a ) with no (");
      stack.pop();
      if (stack.length && stack[stack.length - 1].t === "func") out.push(stack.pop());
    }
    prev = tok;
  }
  while (stack.length) {
    const s = stack.pop();
    if (s.t === "lp") throw new Error("you left a ( open");
    out.push(s);
  }
  return out;
}

function factorial(n) {
  if (n < 0 || !Number.isInteger(n)) throw new Error("factorial only likes whole numbers 0 and up");
  if (n > 170) return Infinity; // js runs out of room past here anyway
  let r = 1;
  for (let k = 2; k <= n; k++) r *= k;
  return r;
}

// run the RPN. if xVal is given, any x in there becomes that (used by the graph).
function evalRPN(rpn, xVal) {
  const s = [];
  for (const tok of rpn) {
    if (tok.t === "num") s.push(tok.v);
    else if (tok.t === "var") {
      if (xVal === undefined) throw new Error("x only makes sense in the graph");
      s.push(xVal);
    } else if (tok.t === "fact") {
      s.push(factorial(s.pop()));
    } else if (tok.t === "func") {
      s.push(FUNCS[tok.v](s.pop()));
    } else if (tok.t === "op") {
      const b = s.pop(), a = s.pop();
      if (a === undefined || b === undefined) throw new Error("something's missing in that expression");
      if (tok.v === "+") s.push(a + b);
      else if (tok.v === "-") s.push(a - b);
      else if (tok.v === "*") s.push(a * b);
      else if (tok.v === "/") s.push(a / b);
      else if (tok.v === "%") s.push(a % b);
      else if (tok.v === "^") s.push(Math.pow(a, b));
    }
  }
  if (s.length !== 1) throw new Error("that expression doesn't add up");
  return s[0];
}

function compile(src) {
  const rpn = toRPN(tokenize(src));
  return { rpn, usesX: rpn.some((t) => t.t === "var") };
}

// =====================================================================
// the "tell me about this number" stuff
// =====================================================================
function primeFactors(n) {
  const f = [];
  let d = 2;
  while (d * d <= n) {
    while (n % d === 0) { f.push(d); n /= d; }
    d += d === 2 ? 1 : 2;
  }
  if (n > 1) f.push(n);
  return f;
}
function factorString(n) {
  const counts = {};
  primeFactors(n).forEach((p) => (counts[p] = (counts[p] || 0) + 1));
  return Object.entries(counts).map(([p, c]) => (c > 1 ? `${p}^${c}` : `${p}`)).join(" × ");
}
function toRoman(n) {
  if (n <= 0 || n >= 4000) return null;
  const map = [[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]];
  let r = "";
  for (const [v, s] of map) while (n >= v) { r += s; n -= v; }
  return r;
}
function divisorCount(n) {
  let c = 0;
  for (let d = 1; d * d <= n; d++) if (n % d === 0) c += (d * d === n ? 1 : 2);
  return c;
}
function isPerfect(n) {
  if (n < 2) return false;
  let sum = 1;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) { sum += d; if (d * d !== n) sum += n / d; }
  return sum === n;
}
function isFib(n) {
  const sq = (x) => { const r = Math.round(Math.sqrt(x)); return r * r === x; };
  return sq(5 * n * n + 4) || sq(5 * n * n - 4);
}
function digitSum(n) { return String(n).split("").reduce((a, d) => a + (+d || 0), 0); }
function digitalRoot(n) { while (n >= 10) n = digitSum(n); return n; }
function isPalindrome(n) { const s = String(n); return s === s.split("").reverse().join("") && s.length > 1; }

// small-ish integer to english words. good enough, i capped it.
const ONES = ["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
const TENS = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];
function threeToWords(n) {
  let s = "";
  if (n >= 100) { s += ONES[Math.floor(n / 100)] + " hundred"; n %= 100; if (n) s += " "; }
  if (n >= 20) { s += TENS[Math.floor(n / 10)]; n %= 10; if (n) s += "-" + ONES[n]; }
  else if (n > 0) s += ONES[n];
  return s;
}
function numberToWords(n) {
  if (n === 0) return "zero";
  const neg = n < 0; n = Math.abs(n);
  if (n > 999999999) return null; // don't bother past a billion
  const parts = [];
  const chunks = [["billion",1e9],["million",1e6],["thousand",1e3],["",1]];
  for (const [name, val] of chunks) {
    if (n >= val) {
      const c = Math.floor(n / val); n %= val;
      parts.push(threeToWords(c) + (name ? " " + name : ""));
    }
  }
  return (neg ? "negative " : "") + parts.join(" ");
}

function trimNum(v) {
  if (Number.isInteger(v)) return v.toString();
  return parseFloat(v.toPrecision(12)).toString();
}
function nearestFraction(x, maxDen = 10000) {
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  let bn = 1, bd = 1, be = Infinity;
  for (let d = 1; d <= maxDen; d++) {
    const n = Math.round(x * d), e = Math.abs(x - n / d);
    if (e < be) { be = e; bn = n; bd = d; if (e < 1e-9) break; }
  }
  if (bd === 1 || be > 1e-4) return null;
  return `${sign * bn}/${bd}`;
}

function renderFacts(value) {
  const box = document.getElementById("facts");
  const rows = [];
  const add = (label, val, cls = "") => rows.push(`<div class="fact"><span class="label">${label}</span><span class="val ${cls}">${val}</span></div>`);

  if (!isFinite(value)) {
    box.innerHTML = `<p class="empty">that came out to ${value === Infinity ? "infinity" : value < 0 ? "negative infinity" : "not a number"}, so there's nothing to break down.</p>`;
    return;
  }

  add("it's", trimNum(value), "big");

  const isInt = Number.isInteger(value);
  if (isInt && Math.abs(value) < Number.MAX_SAFE_INTEGER) {
    const n = Math.abs(value);
    const prime = n >= 2 && primeFactors(n).length === 1;
    add("prime?", prime ? `<span class="yeah">yep</span>` : `<span class="nope">nope</span>`);
    if (n >= 2 && !prime) add("factors into", factorString(n));
    if (n >= 1) add("divisors", divisorCount(n));
    add("in binary", value.toString(2));
    add("in hex", value.toString(16).toUpperCase());
    const rom = toRoman(value);
    if (rom) add("roman", rom);
    if (n >= 1) { add("digit sum", digitSum(n)); add("digital root", digitalRoot(n)); }
    const words = numberToWords(value);
    if (words) add("out loud", words);

    const tags = [];
    if (isPerfect(n)) tags.push("perfect");
    if (n > 0 && isFib(n)) tags.push("fibonacci");
    if (n > 1 && Math.sqrt(n) % 1 === 0) tags.push("square");
    if (isPalindrome(n)) tags.push("palindrome");
    tags.push(n % 2 === 0 ? "even" : "odd");
    if (tags.length) rows.push(`<div class="fact"><span class="label">also</span><span class="tags">${tags.map((t) => `<span class="tag">${t}</span>`).join("")}</span></div>`);
  } else if (!isInt) {
    add("rounded", trimNum(Math.round(value * 1e6) / 1e6));
    const frac = nearestFraction(value);
    if (frac) add("basically", frac);
    add("floor / ceil", `${Math.floor(value)} / ${Math.ceil(value)}`);
  }

  box.innerHTML = rows.join("");
}

// =====================================================================
// the graph. plain canvas, drag to pan, wheel to zoom.
// =====================================================================
const G = { canvas: null, ctx: null, cx: 0, cy: 0, scale: 34, rpn: null, src: "" };

function initGraph() {
  G.canvas = document.getElementById("graph");
  G.ctx = G.canvas.getContext("2d");
  G.cx = G.canvas.width / 2;
  G.cy = G.canvas.height / 2;

  let drag = false, lx = 0, ly = 0;
  G.canvas.addEventListener("pointerdown", (e) => { drag = true; lx = e.offsetX; ly = e.offsetY; G.canvas.setPointerCapture(e.pointerId); });
  G.canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const k = G.canvas.width / G.canvas.clientWidth;
    G.cx += (e.offsetX - lx) * k; G.cy += (e.offsetY - ly) * k;
    lx = e.offsetX; ly = e.offsetY;
    drawGraph();
  });
  G.canvas.addEventListener("pointerup", () => (drag = false));
  G.canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    G.scale = Math.max(4, Math.min(400, G.scale * (e.deltaY < 0 ? 1.1 : 0.9)));
    drawGraph();
  }, { passive: false });

  drawGraph();
}

function css(name) { return getComputedStyle(document.body).getPropertyValue(name).trim(); }

function drawGraph() {
  const { ctx, canvas } = G;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const ink = css("--screen-ink") || "#333";
  const accent = css("--accent") || "#c00";

  // faint grid
  ctx.strokeStyle = ink; ctx.globalAlpha = 0.15; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = G.cx % G.scale; x < W; x += G.scale) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = G.cy % G.scale; y < H; y += G.scale) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();

  // axes
  ctx.globalAlpha = 0.5; ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(0, G.cy); ctx.lineTo(W, G.cy);
  ctx.moveTo(G.cx, 0); ctx.lineTo(G.cx, H);
  ctx.stroke();
  ctx.globalAlpha = 1;

  const meta = document.getElementById("graphmeta");
  if (!G.rpn) { meta.textContent = "stick an x in your expression. drag to move it around, scroll to zoom."; return; }

  ctx.strokeStyle = accent; ctx.lineWidth = 2.2;
  ctx.beginPath();
  let pen = false;
  for (let px = 0; px <= W; px++) {
    const xv = (px - G.cx) / G.scale;
    let yv; try { yv = evalRPN(G.rpn, xv); } catch { yv = NaN; }
    if (!isFinite(yv)) { pen = false; continue; }
    const py = G.cy - yv * G.scale;
    if (py < -H || py > 2 * H) { pen = false; continue; }
    if (!pen) { ctx.moveTo(px, py); pen = true; } else ctx.lineTo(px, py);
  }
  ctx.stroke();
  meta.textContent = `y = ${G.src}`;
}

// =====================================================================
// wiring everything up
// =====================================================================
const exprEl = document.getElementById("expr");
const resultEl = document.getElementById("result");
const errEl = document.getElementById("err");
let history = JSON.parse(localStorage.getItem("numeron.history") || "[]");

function show(which) {
  document.querySelectorAll(".pin").forEach((p) => p.classList.toggle("on", p.dataset.show === which));
  document.querySelectorAll(".sticky").forEach((s) => s.classList.toggle("show", s.id === "view-" + which));
}

function run() {
  const src = exprEl.value.trim();
  errEl.textContent = "";
  if (!src) { resultEl.textContent = "0"; return; }

  let c;
  try { c = compile(src); } catch (e) { errEl.textContent = e.message; return; }

  if (c.usesX) {
    G.src = src; G.rpn = c.rpn; drawGraph();
    show("graph");
    resultEl.textContent = "y = f(x)";
    return;
  }

  let v;
  try { v = evalRPN(c.rpn); } catch (e) { errEl.textContent = e.message; return; }
  if (Number.isNaN(v)) { errEl.textContent = "hmm, that's not a number"; resultEl.textContent = "?"; return; }

  resultEl.textContent = trimNum(v);
  renderFacts(v);
  show("facts");
  pushHistory(src, trimNum(v));
}

// live-update the answer while typing, but don't spam the history
exprEl.addEventListener("input", () => {
  const src = exprEl.value.trim();
  errEl.textContent = "";
  if (!src) { resultEl.textContent = "0"; return; }
  try {
    const c = compile(src);
    if (c.usesX) { G.src = src; G.rpn = c.rpn; drawGraph(); resultEl.textContent = "y = f(x)"; return; }
    const v = evalRPN(c.rpn);
    resultEl.textContent = Number.isNaN(v) ? "..." : trimNum(v);
  } catch { resultEl.textContent = "..."; }
});

exprEl.addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });

document.getElementById("pad").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  beep(b);
  if (b.id === "clear") { exprEl.value = ""; resultEl.textContent = "0"; errEl.textContent = ""; exprEl.focus(); return; }
  if (b.id === "equals") { run(); return; }
  exprEl.value += b.dataset.ins;
  exprEl.focus();
  exprEl.dispatchEvent(new Event("input"));
});

// the little tab pins
document.querySelector(".switcher").addEventListener("click", (e) => {
  const p = e.target.closest(".pin");
  if (p) show(p.dataset.show);
});

// history / the tape
function pushHistory(src, res) {
  history.unshift({ src, res });
  history = history.slice(0, 40);
  localStorage.setItem("numeron.history", JSON.stringify(history));
  drawHistory();
}
function drawHistory() {
  const ul = document.getElementById("history");
  if (!history.length) { ul.innerHTML = `<li class="empty">no history yet. go do some math.</li>`; return; }
  ul.innerHTML = history.map((h) => `<li data-src="${encodeURIComponent(h.src)}"><span>${h.src}</span><span class="r">= ${h.res}</span></li>`).join("");
}
document.getElementById("history").addEventListener("click", (e) => {
  const li = e.target.closest("li[data-src]");
  if (!li) return;
  exprEl.value = decodeURIComponent(li.dataset.src);
  exprEl.focus();
  run();
});
document.getElementById("clearHist").addEventListener("click", () => {
  history = []; localStorage.removeItem("numeron.history"); drawHistory();
});

// ---- themes ----
function setTheme(name) {
  document.body.dataset.theme = name;
  localStorage.setItem("numeron.theme", name);
  document.querySelectorAll(".dot").forEach((d) => d.classList.toggle("active", d.dataset.theme === name));
  if (G.ctx) drawGraph();
}
document.querySelectorAll(".dot").forEach((d) => d.addEventListener("click", () => setTheme(d.dataset.theme)));

// ---- keypress beeps (little musical thing you can turn on) ----
let soundOn = false;
let audio = null;
function beep(btn) {
  if (!soundOn) return;
  if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
  // map digits to a pentatonic-ish scale so mashing keys sounds okay
  const ins = btn.dataset.ins || (btn.id === "equals" ? "=" : "C");
  const scale = [261.6, 293.7, 329.6, 392.0, 440.0, 523.3, 587.3, 659.3, 784.0, 880.0];
  let f = 330;
  if (/[0-9]/.test(ins)) f = scale[+ins];
  else if (btn.id === "equals") f = 523.3;
  const o = audio.createOscillator(), g = audio.createGain();
  o.type = "triangle"; o.frequency.value = f;
  g.gain.setValueAtTime(0.18, audio.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.18);
  o.connect(g).connect(audio.destination);
  o.start(); o.stop(audio.currentTime + 0.19);
}
document.getElementById("soundBtn").addEventListener("click", (e) => {
  soundOn = !soundOn;
  e.target.classList.toggle("on", soundOn);
  e.target.textContent = soundOn ? "🔊 sounds on" : "🔇 sounds off";
});

// if you just start typing numbers, jump into the box
document.addEventListener("keydown", (e) => {
  if (document.activeElement !== exprEl && /[0-9+\-*/^().]/.test(e.key)) exprEl.focus();
});

// ---- boot ----
setTheme(localStorage.getItem("numeron.theme") || "paper");
initGraph();
drawHistory();
exprEl.focus();
