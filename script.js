/* ============================================================
   Garvit Sharma — portfolio interactions
   Progressive enhancement: core UX works without any library.
   GSAP / Lenis are optional niceties, guarded behind feature checks.
   ============================================================ */

(function () {
  "use strict";

  const prefersReduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;

  /* ---------- mobile menu ---------- */
  const burger = document.getElementById("nav-burger");
  const mobileMenu = document.getElementById("mobile-menu");
  const scrim = document.getElementById("menu-scrim");
  function setMenu(open) {
    mobileMenu.classList.toggle("open", open);
    burger.classList.toggle("open", open);
    if (scrim) scrim.classList.toggle("open", open);
    document.body.classList.toggle("menu-open", open);
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    mobileMenu.setAttribute("aria-hidden", String(!open));
    mobileMenu.inert = !open;
    if (open) {
      const first = mobileMenu.querySelector("a");
      if (first) first.focus();
    }
  }
  function closeMenu() {
    setMenu(false);
  }
  if (burger && mobileMenu) {
    burger.addEventListener("click", function () {
      setMenu(!mobileMenu.classList.contains("open"));
    });
    mobileMenu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", closeMenu);
    });
    if (scrim) scrim.addEventListener("click", closeMenu);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && mobileMenu.classList.contains("open")) {
        closeMenu();
        burger.focus();
      }
    });
  }

  /* ---------- nav scrolled state ---------- */
  const nav = document.getElementById("nav");
  function onScroll() {
    const y = window.scrollY || window.pageYOffset;
    if (nav) nav.classList.toggle("scrolled", y > 40);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- scroll-spy (active nav link) ---------- */
  const sections = Array.prototype.slice.call(
    document.querySelectorAll("main section[id]")
  );
  const navLinks = Array.prototype.slice.call(
    document.querySelectorAll(".nav__links a")
  );
  const spineNodes = Array.prototype.slice.call(
    document.querySelectorAll(".spine__node")
  );
  if ("IntersectionObserver" in window && sections.length) {
    const spy = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            const id = e.target.getAttribute("id");
            navLinks.forEach(function (l) {
              l.classList.toggle(
                "active",
                l.getAttribute("href") === "#" + id
              );
            });
            spineNodes.forEach(function (n) {
              n.classList.toggle("active", n.getAttribute("data-target") === id);
            });
          }
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    sections.forEach(function (s) {
      spy.observe(s);
    });
  }

  /* ---------- section progress rail (draws with scroll) ---------- */
  (function () {
    const spineEl = document.getElementById("spine");
    if (!spineEl) return;
    const progressPath = spineEl.querySelector(".spine__progress");
    const head = spineEl.querySelector(".spine__head");
    const totalLen =
      progressPath && progressPath.getTotalLength
        ? progressPath.getTotalLength()
        : 0;

    function positionNodes() {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      if (h <= 0 || !totalLen) return;
      spineNodes.forEach(function (node) {
        const sec = document.getElementById(node.getAttribute("data-target"));
        if (!sec) return;
        const frac = Math.min(0.98, Math.max(0.04, sec.offsetTop / h));
        // place the dot exactly on the wave at this section's progress point
        const pt = progressPath.getPointAtLength(frac * totalLen);
        node.style.left = pt.x + "px";
        node.style.top = (pt.y * window.innerHeight) / 1000 + "px";
      });
    }

    function update() {
      const y = window.scrollY || window.pageYOffset;
      const h = document.documentElement.scrollHeight - window.innerHeight;
      const p = h > 0 ? Math.min(1, Math.max(0, y / h)) : 0;
      if (progressPath) progressPath.style.strokeDashoffset = String(1 - p);
      spineNodes.forEach(function (node) {
        const sec = document.getElementById(node.getAttribute("data-target"));
        const frac =
          sec && h > 0 ? Math.min(0.98, Math.max(0.04, sec.offsetTop / h)) : 1;
        node.classList.toggle("passed", p >= frac - 0.002);
      });
      if (head && totalLen && !prefersReduced) {
        const pt = progressPath.getPointAtLength(p * totalLen);
        head.style.left = pt.x + "px";
        head.style.top = (pt.y * window.innerHeight) / 1000 + "px";
        head.style.opacity = p > 0.004 && p < 0.996 ? "1" : "0";
      }
    }

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", function () {
      positionNodes();
      update();
    });
    window.addEventListener("load", function () {
      positionNodes();
      update();
    });
    positionNodes();
    update();
  })();

  /* ---------- reveal on scroll (dependency-free) ---------- */
  const reveals = Array.prototype.slice.call(
    document.querySelectorAll(".reveal")
  );
  if (prefersReduced || !("IntersectionObserver" in window)) {
    reveals.forEach(function (el) {
      el.classList.add("is-visible");
    });
  } else {
    const revObserver = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    reveals.forEach(function (el) {
      revObserver.observe(el);
    });
    // safety net: anything still hidden after load gets shown
    window.addEventListener("load", function () {
      setTimeout(function () {
        reveals.forEach(function (el) {
          const r = el.getBoundingClientRect();
          if (r.top < window.innerHeight) el.classList.add("is-visible");
        });
      }, 600);
    });
  }

  /* ---------- hero role rotator (typing effect) ---------- */
  const rotator = document.getElementById("role-rotator");
  if (rotator) {
    const roles = [
      "Data Analytics & Science",
      "AI Automation Engineer",
      "Data Engineering",
    ];
    if (prefersReduced) {
      rotator.innerHTML = '<span class="hero__role">Data &amp; AI Engineer</span>';
    } else {
      let i = 0;
      let char = 0;
      let deleting = false;
      const type = function () {
        const word = roles[i];
        char += deleting ? -1 : 1;
        rotator.innerHTML =
          '<span class="hero__role">' + word.substring(0, char) + "</span>";
        let delay = deleting ? 45 : 90;
        if (!deleting && char === word.length) {
          delay = 1600;
          deleting = true;
        } else if (deleting && char === 0) {
          deleting = false;
          i = (i + 1) % roles.length;
          delay = 350;
        }
        setTimeout(type, delay);
      };
      type();
    }
  }

  /* ---------- animated counters ---------- */
  const counters = Array.prototype.slice.call(
    document.querySelectorAll(".stat__num")
  );
  function animateCount(el) {
    const target = parseFloat(el.getAttribute("data-count"));
    const decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);
    const suffix = el.getAttribute("data-suffix") || "";
    if (prefersReduced) {
      el.textContent = target.toFixed(decimals) + suffix;
      return;
    }
    const dur = 1500;
    const start = performance.now();
    function frame(now) {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (target * eased).toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(frame);
      else el.textContent = target.toFixed(decimals) + suffix;
    }
    requestAnimationFrame(frame);
  }
  if (counters.length && "IntersectionObserver" in window) {
    const cObs = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            animateCount(e.target);
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.6 }
    );
    counters.forEach(function (c) {
      cObs.observe(c);
    });
  } else {
    counters.forEach(animateCount);
  }

  /* ---------- magnetic buttons (desktop, fine pointer) ---------- */
  if (finePointer && !prefersReduced) {
    document.querySelectorAll(".btn--primary, .social").forEach(function (el) {
      el.addEventListener("mousemove", function (e) {
        const r = el.getBoundingClientRect();
        const mx = e.clientX - (r.left + r.width / 2);
        const my = e.clientY - (r.top + r.height / 2);
        el.style.transform =
          "translate(" + mx * 0.18 + "px," + my * 0.18 + "px)";
      });
      el.addEventListener("mouseleave", function () {
        el.style.transform = "";
      });
    });
  }

  /* ---------- 3D tilt on cards (desktop, fine pointer) ---------- */
  if (finePointer && !prefersReduced) {
    const tiltCards = document.querySelectorAll(
      ".project, .skill-card, .contact__card"
    );
    tiltCards.forEach(function (card) {
      card.addEventListener("mousemove", function (e) {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transition = "transform 0.3s ease-out";
        card.style.transform =
          "perspective(900px) rotateX(" +
          (-py * 4).toFixed(2) +
          "deg) rotateY(" +
          (px * 4).toFixed(2) +
          "deg) translateY(-4px)";
      });
      card.addEventListener("mouseleave", function () {
        card.style.transition = "";
        card.style.transform = "";
      });
    });
  }

  /* ---------- animated 3D particle-wave backdrop ---------- */
  (function () {
    const canvas = document.getElementById("bg-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const coarse = !finePointer;
    const COLS = coarse ? 54 : 80; // lateral
    const ROWS = coarse ? 30 : 46; // depth
    const SEPX = 24;
    const zNear = 160;
    const zFar = 1300;
    const focal = 400;
    const camH = 140; // camera height above the wave plane
    const amp = 42; // wave amplitude
    let W, H, dpr, raf, t = 0, running = true;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function render() {
      ctx.clearRect(0, 0, W, H);
      const cx = W / 2;
      const horizon = H * 0.5;
      for (let r = 0; r < ROWS; r++) {
        const z = zNear + (zFar - zNear) * Math.pow(r / (ROWS - 1), 1.7);
        const scale = focal / z;
        const depth = 1 - r / ROWS; // 1 near, 0 far
        for (let c = 0; c < COLS; c++) {
          const x = (c - (COLS - 1) / 2) * SEPX;
          const sx = cx + (focal * x) / z;
          if (sx < -30 || sx > W + 30) continue;
          const sCol = Math.sin(c * 0.22 + t);
          const sRow = Math.sin(r * 0.3 + t * 0.8);
          const w = (sCol + sRow) * amp;
          const sy = horizon + (focal * (camH - w)) / z;
          if (sy < -30 || sy > H + 30) continue;
          const peak = (sCol + sRow + 2) / 4; // 0..1 (wave crest)
          const size = Math.max(0.5, scale * 0.9 * (0.7 + peak * 1.6));
          const alpha = Math.min(
            0.92,
            (0.22 + peak * 0.55) * (0.4 + depth * 0.85)
          );
          ctx.beginPath();
          ctx.arc(sx, sy, size, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(96, 165, 250, " + alpha.toFixed(3) + ")";
          ctx.fill();
        }
      }
    }

    function loop() {
      if (!running) return;
      t += 0.009;
      render();
      raf = requestAnimationFrame(loop);
    }

    resize();
    window.addEventListener("resize", function () {
      resize();
      if (prefersReduced) render(); // resize() clears the bitmap; repaint the static frame
    });
    if (prefersReduced) {
      render(); // single static frame, no motion
    } else {
      loop();
      document.addEventListener("visibilitychange", function () {
        running = !document.hidden;
        if (running) {
          cancelAnimationFrame(raf);
          loop();
        } else {
          cancelAnimationFrame(raf);
        }
      });
    }
  })();

  /* ---------- project case-study modals ---------- */
  (function () {
    const modal = document.getElementById("case-modal");
    if (!modal) return;
    const CASES = {
      swasth: {
        img: "assets/case-swasth.png",
        alt: "Training & validation loss and accuracy curves for the Swin Transformer",
        problem:
          "Crop disease drives major yield loss, yet accurate detection models are usually too heavy for the low-end hardware farmers actually have — and inaccessible to non-English speakers.",
        approach:
          "Trained a Swin Transformer on 100k+ leaf images across 38 disease classes, optimized for edge devices, and wrapped it in a multilingual (150+ languages) React UI with a Django AI chatbot that explains causes, cures and prevention.",
        architecture:
          "Leaf photo → Swin Transformer (PyTorch) → class + confidence → Django REST API → multilingual React UI + AI guidance chatbot.",
        results:
          "98.94% validation accuracy and ~98% on the held-out test set — light enough for low-power devices and usable by farmers in their own language.",
      },
      insurance: {
        img: "assets/case-insurance.png",
        alt: "Loss ratio by policy tenure bar chart",
        problem:
          "Evaluate an insurance portfolio's profitability and risk: which policies actually make money, and how badly does claim frequency erode the book?",
        approach:
          "Generated policy + claims datasets, then used SQL and Python (Pandas) to compute premium revenue, monthly claim-cost trends, loss ratios by tenure, and projected liabilities under varying claim-frequency assumptions.",
        architecture:
          "SQLite (SQL queries) → Pandas analysis → Matplotlib / Seaborn visualizations.",
        results:
          "3-year policies are the most profitable (lowest loss ratio, 1.31); the overall portfolio loss ratio exceeds 1 (claims > premium); and higher claim frequency sharply worsens profitability.",
      },
      sentiment: {
        img: "assets/case-sentiment.png",
        alt: "Accuracy comparison across six classification models",
        problem:
          "Classify sentiment from thousands of consumer-product reviews and identify the best-performing model.",
        approach:
          "Built an end-to-end PySpark MLlib pipeline — tokenization, stopword removal, spaCy lemmatization, TF-IDF — then trained and cross-validated six classifiers and compared them across accuracy, precision, recall, F1 and AUC.",
        architecture:
          "Spark SQL ingest → text preprocessing → TF-IDF features → 6 MLlib models (CrossValidator) → metric comparison.",
        results:
          "The best models (Logistic Regression, Gradient Boosting) reached ~98% accuracy and ~0.99 ROC-AUC across the six-way comparison.",
      },
      adhoc: {
        img: "assets/case-adhoc.png",
        alt: "Sales-channel contribution donut chart from the insights deck",
        problem:
          "Management lacked quick, detailed insight to make data-driven calls across a 2M+ row sales database.",
        approach:
          "Answered 10 executive business requests in SQL (with views and stored procedures), then turned the outputs into a stakeholder presentation.",
        architecture:
          "SQL queries (10 requests) → result sets → Power BI / Excel visualizations → executive deck.",
        results:
          "Surfaced that the Retailer channel drives ~73% of gross sales, flagged the Nov-2020 peak and Mar-2020 COVID trough, and ranked top products, customers and segments — with 50% faster queries.",
      },
      sales: {
        img: "assets/case-sales.png",
        alt: "Awesome Chocolates Power BI sales dashboard",
        problem:
          "A 10.8% month-over-month sales decline with no clear view of where margin and performance were leaking.",
        approach:
          "Built a multi-functional Power BI dashboard over Excel/CSV sources covering sales, profit, shipments and rep/region performance, tuned with DAX Studio.",
        architecture:
          "Excel / CSV → Power Query → data model → DAX measures → interactive Power BI dashboard.",
        results:
          "Modeled $34M in sales and $21M profit (60.3% of target), exposed the decline's drivers and the top/under-performing reps and regions, and guided pricing and shipment-consistency actions. (Live dashboard linked.)",
      },
      pnl: {
        img: "assets/case-pnl.png",
        alt: "P&L statement by fiscal year for AtliQ Hardware",
        problem:
          "Finance needed granular, reliable P&L plus market and customer performance reporting across fiscal years.",
        approach:
          "Built an automated finance & sales report with Power Query ETL, a Power Pivot data model and DAX measures — P&L by fiscal year and by market.",
        architecture:
          "Raw data → Power Query (ETL, date table, fiscal months/quarters) → Power Pivot model → DAX measures → P&L & performance reports.",
        results:
          "Delivered P&L by fiscal year with gross-margin tracking and market/customer-vs-target views; automated cleaning saved ~4 hrs per cycle and improved report accuracy ~30%.",
      },
    };
    const REPO_TO_CASE = {
      "Swasth-Kethi": "swasth",
      "Insurance-Portfolio": "insurance",
      "Sentiment-Analysis": "sentiment",
      ad_hoc: "adhoc",
      "sales-analytics": "sales",
      "P-and-L": "pnl",
    };

    const tagEl = modal.querySelector(".modal__tag");
    const titleEl = modal.querySelector(".modal__title");
    const bodyEl = modal.querySelector(".modal__body");
    const linksEl = modal.querySelector(".modal__links");
    const closeBtn = modal.querySelector(".modal__close");
    let lastFocus = null;

    function sect(h, p) {
      return '<div class="case__sec"><h4>' + h + "</h4><p>" + p + "</p></div>";
    }

    function open(card) {
      const key = card.getAttribute("data-case");
      const data = CASES[key];
      if (!data) return;
      lastFocus = document.activeElement;
      titleEl.textContent = card.querySelector(".project__title").textContent;
      tagEl.textContent = card.querySelector(".project__tag").textContent;
      bodyEl.innerHTML =
        '<div class="case__media"><img src="' +
        data.img +
        '" alt="' +
        data.alt +
        '" loading="lazy"></div><div class="case__grid">' +
        sect("Problem", data.problem) +
        sect("Approach", data.approach) +
        sect("Architecture", data.architecture) +
        sect("Results", data.results) +
        "</div>";
      linksEl.innerHTML = "";
      card.querySelectorAll(".project__links a").forEach(function (a) {
        linksEl.appendChild(a.cloneNode(true));
      });
      modal.classList.add("open");
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("menu-open");
      closeBtn.focus();
    }
    function close() {
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("menu-open");
      if (lastFocus) lastFocus.focus();
    }

    modal.querySelectorAll("[data-close]").forEach(function (el) {
      el.addEventListener("click", close);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modal.classList.contains("open")) close();
    });
    modal.addEventListener("keydown", function (e) {
      if (e.key !== "Tab" || !modal.classList.contains("open")) return;
      const f = modal.querySelectorAll('a[href], button:not([disabled])');
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    // map each card to its case via its GitHub repo link, then add a trigger
    document.querySelectorAll(".project").forEach(function (card) {
      const links = card.querySelector(".project__links");
      const repo = card.querySelector('a[href*="github.com/GarvitSharma0"]');
      if (!links || !repo) return;
      for (const k in REPO_TO_CASE) {
        if (repo.href.indexOf(k) !== -1) {
          card.setAttribute("data-case", REPO_TO_CASE[k]);
          break;
        }
      }
      if (!card.getAttribute("data-case")) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "project__link project__link--accent project__expand";
      btn.innerHTML =
        'Case study <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" d="M5 12h13M13 6l6 6-6 6"/></svg>';
      btn.addEventListener("click", function () {
        open(card);
      });
      links.insertBefore(btn, links.firstChild);
    });
  })();

  /* ---------- Lenis smooth scroll (optional) ---------- */
  function initLenis() {
    if (prefersReduced || typeof window.Lenis === "undefined") return;
    const lenis = new window.Lenis({
      duration: 1.1,
      easing: function (t) {
        return Math.min(1, 1.001 - Math.pow(2, -10 * t));
      },
      smoothWheel: true,
    });
    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    // anchor links route through Lenis
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener("click", function (e) {
        const id = a.getAttribute("href");
        if (id.length > 1) {
          const target = document.querySelector(id);
          if (target) {
            e.preventDefault();
            lenis.scrollTo(target, { offset: -70 });
          }
        }
      });
    });

  }

  // Lenis loads with `defer`; run on window load to be safe.
  window.addEventListener("load", initLenis);
})();
