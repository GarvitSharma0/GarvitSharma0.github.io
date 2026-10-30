/* ============================================================
   Garvit Sharma — portfolio interactions
   No libraries. Everything here is progressive enhancement:
   without JS the page is complete, just still.
   ============================================================ */

(function () {
  "use strict";

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const TAU = Math.PI * 2;
  const FAMILY = "Besley, Georgia, serif";
  const inkColor = () => getComputedStyle(document.documentElement).getPropertyValue("--ink").trim();

  /* ---------- halftone: type read back as dots ----------
     Set text on an offscreen canvas, then read it back one dot per
     (staggered) cell, each dot sized by how much ink its cell holds.
     The figures and the email address are both printed this way. */
  const meter = document.createElement("canvas").getContext("2d");
  function measure(text, font, spacing) {
    meter.font = font;
    if ("letterSpacing" in meter) meter.letterSpacing = spacing || "0px";
    meter.fontKerning = "none";
    return meter.measureText(text);
  }
  function halftone(text, font, w, h, cell, x, y, spacing) {
    const SS = 4; // samples per cell side
    const cols = Math.floor(w / cell), rows = Math.floor(h / cell);
    if (cols < 1 || rows < 1) return [];
    const c = document.createElement("canvas");
    c.width = cols * SS + SS / 2; // room for the half-cell shift on odd rows
    c.height = rows * SS;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.scale(SS / cell, SS / cell);
    g.font = font;
    if ("letterSpacing" in g) g.letterSpacing = spacing || "0px";
    g.fontKerning = "none";
    g.fillText(text, x, y);
    const px = g.getImageData(0, 0, c.width, c.height).data;
    const out = [];
    for (let j = 0; j < rows; j++) {
      const odd = j & 1;
      for (let i = 0; i < cols; i++) {
        let sum = 0;
        for (let yy = 0; yy < SS; yy++) {
          const row = (j * SS + yy) * c.width + i * SS + (odd ? SS / 2 : 0);
          for (let xx = 0; xx < SS; xx++) sum += px[(row + xx) * 4 + 3];
        }
        const cover = sum / (SS * SS * 255);
        if (cover < 0.06) continue;
        const tone = 0.6 + 0.4 * (0.35 * (i / cols) + 0.65 * (j / rows)); // dots swell toward the lower right, like a print
        out.push({
          x: (i + 0.5 + odd * 0.5) * cell,
          y: (j + 0.5) * cell,
          r: 0.47 * cell * Math.sqrt(cover * tone),
        });
      }
    }
    return out;
  }

  /* ---------- intro: the statement rises word by word ---------- */
  (function () {
    const split = document.querySelector("[data-split]");
    if (split) {
      const walk = (node) => {
        Array.from(node.childNodes).forEach((n) => {
          if (n.nodeType === 1) return walk(n);
          if (n.nodeType !== 3) return;
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) return frag.appendChild(document.createTextNode(" "));
            const w = document.createElement("span");
            const inner = document.createElement("span");
            w.className = "w";
            inner.textContent = part;
            w.appendChild(inner);
            frag.appendChild(w);
          });
          n.replaceWith(frag);
        });
      };
      walk(split);
      split.querySelectorAll(".w > span").forEach((s, i) => s.style.setProperty("--i", i));
      // "slow, manual" is set a little crooked, and straightens once it has landed
      split.querySelectorAll(".messy .w").forEach((w, i) => {
        w.style.setProperty("--tilt", ((i % 2 ? 1 : -1) * (1.5 + Math.random())).toFixed(2) + "deg");
        w.style.setProperty("--dy", ((i % 2 ? -1 : 1) * (0.03 + Math.random() * 0.05)).toFixed(3) + "em");
      });
    }

    // wait for the fonts, so words don't rise in one face and land in another
    const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
    Promise.race([fonts, new Promise((r) => setTimeout(r, 700))]).then(() =>
      requestAnimationFrame(() => document.documentElement.classList.add("ready"))
    );
  })();

  /* ---------- reveal on scroll ---------- */
  (function () {
    document
      .querySelectorAll(".work__head, .row, .work__more")
      .forEach((el) => el.setAttribute("data-reveal", ""));
    const els = document.querySelectorAll("[data-reveal], .section");
    if (prefersReduced || !("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries, obs) => {
        let n = 0; // things arriving together are staggered
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          if (e.target.hasAttribute("data-reveal")) e.target.style.setProperty("--r", n++);
          e.target.classList.add("in");
          obs.unobserve(e.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.01 }
    );
    els.forEach((el) => io.observe(el));
  })();

  /* ---------- figures: results printed in dots ----------
     Each headline number is set in Besley, read back as halftone dots
     and drawn on a canvas. The dots start as noise, sort themselves
     into the first figure, then flow left to right into the next. The
     rule under the caption is the timer; hovering pauses it and puts a
     magnifier over the dots, clicking skips ahead. Scroll the figure
     away and it crumbles back into noise; scroll back and it re-sorts. */
  (function () {
    const fig = document.querySelector(".figs");
    if (!fig) return;
    const stage = fig.querySelector(".figs__stage");
    const canvas = stage.querySelector("canvas");
    const ctx = canvas.getContext("2d");
    const caption = fig.querySelector(".figs__caption");
    const noEl = fig.querySelector(".figs__no");
    const textEl = fig.querySelector(".figs__text");
    const items = Array.from(fig.querySelectorAll(".figs__data li")).map((li) => ({
      value: li.dataset.value,
      caption: li.dataset.caption,
    }));
    const darkMQ = window.matchMedia("(prefers-color-scheme: dark)");

    const COLS = 72;
    const MORPH_MS = 1100;
    const SPREAD = 0.32; // how much the left-to-right wave staggers

    let W = 0, H = 0, dpr = 1, s = 0;
    let shapes = [];
    let parts = [];
    let current = 0;
    let P = 1; // progress of the flight under way
    let ink = "#000";
    let mx = 0, my = 0, lens = false;
    let scat = 0, scatT = 0, onScreen = true; // how far the figure has crumbled back into noise
    let raf = 0, last = 0;

    // set a figure in type, centred on the stage, and read it back as dots
    function shapeOf(value) {
      let size = H * 0.8;
      let m = measure(value, "500 " + size + "px " + FAMILY);
      if (m.width > W * 0.94) {
        size *= (W * 0.94) / m.width;
        m = measure(value, "500 " + size + "px " + FAMILY);
      }
      const x = (W - m.width) / 2;
      const y = (H + m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
      return halftone(value, "500 " + size + "px " + FAMILY, W, H, s, x, y);
    }

    function build() {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width) return false;
      W = rect.width;
      H = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      s = W / (COLS + 0.5);
      shapes = items.map((it) => shapeOf(it.value));
      const n = Math.max.apply(null, shapes.map((sh) => sh.length));
      // the pool starts as noise: the raw data before anything is sorted
      parts = Array.from({ length: n }, () => {
        const x = Math.random() * W;
        const y = Math.random() * H;
        const r = s * 0.13;
        return { x, y, r, fx: x, fy: y, fr: r, tx: x, ty: y, tr: r, nx: x, ny: y, sd: 0.5, delay: 0, jx: 0, jy: 0, ox: 0, oy: 0, mag: 1 };
      });
      P = 1;
      return true;
    }

    function swapCaption(text) {
      if (textEl.textContent === text) return;
      textEl.classList.add("out");
      setTimeout(() => {
        textEl.textContent = text;
        textEl.classList.remove("out");
      }, prefersReduced ? 0 : 180);
    }

    // restart the CSS timer on the caption rule
    function startTimer() {
      fig.classList.remove("run");
      void caption.offsetWidth;
      fig.classList.add("run");
    }
    const setPaused = () => fig.classList.toggle("paused", !onScreen || scatT > 0.4);

    // send every dot to figure k: dots pair up in left-to-right order and
    // spare dots fold into a neighbour, so any figure can follow any other
    function go(k, snap) {
      current = k;
      const dest = shapes[k].slice().sort((a, b) => a.x - b.x || a.y - b.y);
      const order = parts.slice().sort((a, b) => a.x - b.x || a.y - b.y);
      let prev = -1;
      order.forEach((p, n) => {
        const idx = Math.floor((n * dest.length) / order.length);
        const d = dest[idx];
        p.fx = p.x;
        p.fy = p.y;
        p.fr = p.r;
        p.tx = d.x;
        p.ty = d.y;
        p.tr = idx === prev ? 0 : d.r;
        prev = idx;
        p.delay = (d.x / W) * SPREAD * 0.85 + Math.random() * SPREAD * 0.15;
        p.jx = (Math.random() - 0.5) * s * 6;
        p.jy = -Math.random() * H * 0.22; // each dot hops on its way
        p.nx = Math.random() * W; // where it goes when the figure crumbles
        p.ny = Math.random() * H;
        p.sd = (d.y / H) * 0.7 + Math.random() * 0.3; // the top crumbles first
      });
      noEl.textContent = "Fig. " + (k + 1);
      swapCaption(items[k].caption);
      fig.classList.remove("run");
      P = snap || prefersReduced ? 1 : 0;
      if (P === 1) {
        draw();
        startTimer();
      } else wake();
    }

    // a soft magnifier: 1.5x at the centre, 1x at the rim
    function lensStep() {
      const R = Math.max(48, W * 0.16);
      const on = lens && P === 1;
      let moving = false;
      for (const p of parts) {
        let tx = 0, ty = 0, tm = 1;
        if (on) {
          const dx = p.x - mx, dy = p.y - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < R) {
            const u = dist / R;
            const push = 0.5 * u * (1 - u) * R;
            tx = dist > 0.001 ? (dx / dist) * push : 0;
            ty = dist > 0.001 ? (dy / dist) * push : 0;
            tm = 1 + (1 - u) * 0.5;
          }
        }
        p.ox += (tx - p.ox) * 0.2;
        p.oy += (ty - p.oy) * 0.2;
        p.mag += (tm - p.mag) * 0.2;
        if (Math.abs(tx - p.ox) > 0.05 || Math.abs(ty - p.oy) > 0.05 || Math.abs(tm - p.mag) > 0.004) {
          moving = true;
        }
      }
      return moving;
    }

    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = ink;
      ctx.beginPath();
      const crumbling = scat > 0.001;
      for (const p of parts) {
        const e = easeIO(clamp((P - p.delay) / (1 - SPREAD), 0, 1));
        const arc = Math.sin(Math.PI * e);
        p.x = p.fx + (p.tx - p.fx) * e + p.jx * arc;
        p.y = p.fy + (p.ty - p.fy) * e + p.jy * arc;
        p.r = p.fr + (p.tr - p.fr) * e;
        let x = p.x + p.ox, y = p.y + p.oy, r = p.r * p.mag;
        if (crumbling) {
          const u = easeIO(clamp((scat - p.sd * 0.6) / 0.4, 0, 1));
          x += (p.nx - p.x) * u;
          y += (p.ny - p.y) * u;
          r += (s * 0.13 - r) * u;
        }
        if (r < 0.15) continue;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, TAU);
      }
      ctx.fill();
    }

    function tick(now) {
      const dt = last ? Math.min(200, now - last) : 16; // slow devices still finish on time
      last = now;
      let busy = false;
      if (P < 1) {
        P = Math.min(1, P + dt / MORPH_MS);
        if (P === 1) startTimer();
        busy = true;
      }
      if (Math.abs(scatT - scat) > 0.002) {
        scat += (scatT - scat) * Math.min(1, dt / 90);
        busy = true;
      } else scat = scatT;
      if (lensStep()) busy = true;
      draw();
      if (busy) raf = requestAnimationFrame(tick);
      else raf = last = 0;
    }
    function wake() {
      if (!raf && W) raf = requestAnimationFrame(tick);
    }

    const next = () => {
      if (shapes.length) go((current + 1) % items.length);
    };
    stage.addEventListener("click", next);
    fig.querySelector(".figs__hint").addEventListener("click", next);
    caption.addEventListener("animationend", next); // the timer rule filled up
    if (finePointer && !prefersReduced) {
      stage.addEventListener("pointermove", (e) => {
        const r = canvas.getBoundingClientRect();
        mx = e.clientX - r.left;
        my = e.clientY - r.top;
        lens = true;
        wake();
      });
      stage.addEventListener("pointerleave", () => {
        lens = false;
        wake();
      });
    }

    // the figures are set in Besley, so wait for it (but not forever)
    const font = document.fonts ? document.fonts.load("500 100px Besley") : Promise.resolve();
    Promise.race([font, new Promise((r) => setTimeout(r, 1500))]).then(() => {
      ink = inkColor();
      if (!build()) return;
      draw();
      new ResizeObserver(() => {
        if (Math.abs(canvas.getBoundingClientRect().width - W) < 1) return;
        build();
        go(current, true);
      }).observe(canvas);
      darkMQ.addEventListener("change", () => {
        ink = inkColor();
        draw();
      });
      // don't run the timer while the figure is off screen
      new IntersectionObserver((entries) =>
        entries.forEach((e) => {
          onScreen = e.isIntersecting;
          setPaused();
        })
      ).observe(fig);
      if (prefersReduced) return go(0, true);
      // as the figure scrolls out through the top, it crumbles back into noise
      window.addEventListener(
        "scroll",
        () => {
          const r = canvas.getBoundingClientRect();
          scatT = clamp(-r.top / (r.height * 0.8), 0, 1);
          setPaused();
          wake();
        },
        { passive: true }
      );
      // once on screen, the noise holds for a beat, then sorts itself into figure 1
      const io = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting)) return;
          io.disconnect();
          setTimeout(() => go(0), 350);
        },
        { threshold: 0.3 }
      );
      io.observe(fig);
    });
  })();

  /* ---------- work: open a row, sort the table ---------- */
  (function () {
    const list = document.querySelector(".work__list");
    if (!list) return;
    const rows = Array.from(list.children);

    rows.forEach((row) => {
      const btn = row.querySelector(".row__sum");
      const detail = row.querySelector(".row__detail");
      detail.inert = true;
      btn.addEventListener("click", () => {
        const open = !row.classList.contains("open");
        row.classList.toggle("open", open);
        btn.setAttribute("aria-expanded", String(open));
        detail.inert = !open;
      });
    });

    const heads = Array.from(document.querySelectorAll(".work__head [data-sort]"));
    let key = "no";
    let dir = 1;
    heads[0].dataset.dir = "asc";
    const value = (row, k) =>
      k === "no" || k === "year" ? Number(row.dataset[k]) : row.dataset[k].toLowerCase();

    heads.forEach((h) =>
      h.addEventListener("click", () => {
        const k = h.dataset.sort;
        if (k === key) dir = -dir;
        else {
          key = k;
          dir = k === "year" ? -1 : 1; // newest first
        }
        heads.forEach((x) => {
          x.setAttribute("aria-pressed", String(x === h));
          delete x.dataset.dir;
        });
        h.dataset.dir = dir > 0 ? "asc" : "desc";
        const sorted = rows.slice().sort((a, b) => {
          const x = value(a, key), y = value(b, key);
          return (x < y ? -1 : x > y ? 1 : 0) * dir || a.dataset.no - b.dataset.no;
        });
        flip(sorted);
      })
    );

    // FLIP: note where every row was, reorder, then slide each from old to new
    function flip(sorted) {
      const before = new Map(rows.map((r) => [r, r.getBoundingClientRect().top]));
      sorted.forEach((r) => list.appendChild(r));
      if (prefersReduced) return;
      sorted.forEach((r, n) => {
        const dy = before.get(r) - r.getBoundingClientRect().top;
        if (Math.abs(dy) < 1) return;
        r.animate([{ transform: "translateY(" + dy + "px)" }, { transform: "none" }], {
          duration: 760,
          delay: n * 22,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          fill: "backwards",
        });
      });
    }
  })();

  /* ---------- email: copy, with a letter roll ---------- */
  (function () {
    const btn = document.querySelector(".contact__email");
    if (!btn) return;
    const email = btn.dataset.email;
    const roll = btn.querySelector(".roll");
    const live = document.querySelector("[data-copy-status]");
    const letters = (text, cls) => {
      const line = document.createElement("span");
      line.className = cls;
      Array.from(text).forEach((c, i) => {
        const span = document.createElement("span");
        span.textContent = c === " " ? " " : c;
        span.style.setProperty("--i", i);
        line.appendChild(span);
      });
      return line;
    };
    roll.append(letters(email, "roll__a"), letters("Copied to clipboard", "roll__b"));

    // older or locked-down browsers: copy through a hidden textarea
    const legacyCopy = () => {
      const ta = document.createElement("textarea");
      ta.value = email;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      if (!ok) throw new Error("copy failed");
    };

    let timer = 0;
    btn.addEventListener("click", () => {
      const copy = navigator.clipboard ? navigator.clipboard.writeText(email) : Promise.reject();
      copy.catch(legacyCopy).then(
        () => {
          btn.classList.add("copied");
          live.textContent = "Email address copied";
          clearTimeout(timer);
          timer = setTimeout(() => {
            btn.classList.remove("copied");
            live.textContent = "";
          }, 1900);
        },
        () => (window.location.href = "mailto:" + email) // couldn't copy: open the mail app
      );
    });
  })();

  /* ---------- email: printed in dots first ----------
     When the address scrolls into view it assembles from noise the way
     the figures did, then the real type fades in underneath so it can
     be copied. */
  (function () {
    const btn = document.querySelector(".contact__email");
    const roll = btn && btn.querySelector(".roll");
    if (!roll || prefersReduced || !("IntersectionObserver" in window)) return;
    btn.classList.add("dots");
    const done = () => btn.classList.remove("dots");

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        const font = document.fonts ? document.fonts.load("400 100px Besley") : Promise.resolve();
        Promise.race([font, new Promise((r) => setTimeout(r, 1000))]).then(run);
      },
      { threshold: 0.6 }
    );
    io.observe(btn);

    function run() {
      const line = roll.querySelector(".roll__a");
      const cs = getComputedStyle(line);
      const box = roll.getBoundingClientRect();
      const lineBox = line.getBoundingClientRect();
      const W = box.width, H = box.height;
      if (!W || !H) return done();
      const size = parseFloat(cs.fontSize);
      const cell = Math.max(2.5, size / 13);
      const font = cs.fontStyle + " " + cs.fontWeight + " " + size + "px " + cs.fontFamily;
      const spacing = cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing;
      // put the baseline where CSS put it: centred in the line box
      const m = measure(line.textContent, font, spacing);
      const asc = m.fontBoundingBoxAscent || size * 0.95;
      const desc = m.fontBoundingBoxDescent || size * 0.25;
      const y = lineBox.top - box.top + (lineBox.height - asc - desc) / 2 + asc;
      const dots = halftone(line.textContent, font, W, H, cell, lineBox.left - box.left, y, spacing);
      if (!dots.length) return done();

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      roll.appendChild(canvas);
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = inkColor();

      const SPREAD = 0.45;
      const MS = 1300;
      const parts = dots.map((d) => ({
        fx: Math.random() * W,
        fy: Math.random() * H,
        fr: cell * 0.12,
        tx: d.x,
        ty: d.y,
        tr: d.r,
        delay: (d.x / W) * SPREAD * 0.85 + Math.random() * SPREAD * 0.15,
        jx: (Math.random() - 0.5) * cell * 4,
        jy: -(0.1 + Math.random() * 0.3) * H,
      }));
      let t0 = 0;
      const frame = (now) => {
        if (!t0) t0 = now;
        const P = Math.min(1, (now - t0) / MS);
        ctx.clearRect(0, 0, W, H);
        ctx.beginPath();
        for (const p of parts) {
          const e = easeIO(clamp((P - p.delay) / (1 - SPREAD), 0, 1));
          const arc = Math.sin(Math.PI * e);
          const r = p.fr + (p.tr - p.fr) * e;
          const x = p.fx + (p.tx - p.fx) * e + p.jx * arc;
          const y = p.fy + (p.ty - p.fy) * e + p.jy * arc;
          ctx.moveTo(x + r, y);
          ctx.arc(x, y, r, 0, TAU);
        }
        ctx.fill();
        if (P < 1) return requestAnimationFrame(frame);
        // set: let the type through and take the dots away
        setTimeout(() => {
          done();
          canvas.style.opacity = 0;
          setTimeout(() => canvas.remove(), 600);
        }, 220);
      };
      requestAnimationFrame(frame);
    }
  })();

  /* ---------- Noida clock ---------- */
  (function () {
    const el = document.querySelector("[data-clock]");
    if (!el) return;
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const tick = () => {
      el.textContent = fmt.format(new Date());
    };
    tick();
    setInterval(tick, 1000);
  })();
})();
