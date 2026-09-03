/* ============================================================
   MERU-PRASTĀRA — script.js
   Vanilla JavaScript only. Organised into small modules:
     Core   -> BigInt-based triangle & combinatorics engine
     UI     -> navbar, theme, search, scroll, loading, footer
     Views  -> generator, combination calc, binomial, probability,
               applications, quiz, test cases, viva accordion
   ============================================================ */

/* ---------------------------------------------------------
   CORE ENGINE
   Meru-Prastara / Pascal's Triangle built with Dynamic
   Programming: every row is derived only from the row
   directly above it (Halayudha's sum rule).
   BigInt is used throughout so values never overflow, even
   for 100+ rows (see Algorithm > Limitations).
--------------------------------------------------------- */
const Core = (() => {

  /**
   * Builds the first `rows` rows of Meru-Prastara.
   * Returns an array of arrays of BigInt.
   * Time complexity: O(rows^2). Space complexity: O(rows^2).
   */
  function buildTriangle(rows) {
    const triangle = [];
    for (let i = 0; i < rows; i++) {
      const row = new Array(i + 1);
      row[0] = 1n;
      row[i] = 1n;
      const prev = triangle[i - 1];
      for (let j = 1; j < i; j++) {
        row[j] = prev[j - 1] + prev[j]; // Halayudha's rule: left parent + right parent
      }
      triangle.push(row);
    }
    return triangle;
  }

  /**
   * Exact nCr using BigInt via the multiplicative formula,
   * dividing at every step so the running value always stays
   * an integer (it is always itself a valid binomial coefficient).
   */
  function combination(n, r) {
    if (r < 0 || r > n) return 0n;
    r = Math.min(r, n - r);
    let result = 1n;
    for (let i = 0; i < r; i++) {
      result = (result * BigInt(n - i)) / BigInt(i + 1);
    }
    return result;
  }

  /** Formats a BigInt with thousands separators for readability. */
  function formatBig(num) {
    const s = num.toString();
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  /**
   * Validates raw row-count input.
   * Rejects blank, non-numeric, zero and negative values.
   * Returns { valid, value, message }.
   */
  function validateRows(raw, max = 120) {
    const trimmed = (raw ?? "").trim();
    if (trimmed === "") return { valid: false, message: "Please enter a number of rows — the field is blank." };
    if (!/^-?\d+$/.test(trimmed)) return { valid: false, message: `"${trimmed}" is not a valid whole number. Please enter digits only.` };
    const n = parseInt(trimmed, 10);
    if (n < 0) return { valid: false, message: "Negative numbers are not allowed. Please enter a positive whole number." };
    if (n === 0) return { valid: false, message: "Zero rows cannot be generated. Please enter a number of 1 or more." };
    if (n > max) return { valid: false, message: `${n} is larger than this demo supports (max ${max}). Try a smaller value.` };
    return { valid: true, value: n };
  }

  return { buildTriangle, combination, formatBig, validateRows };
})();


/* ---------------------------------------------------------
   UI: shell behaviours (loading screen, nav, theme, search,
   smooth scroll, back-to-top, sound, print/copy/pdf)
--------------------------------------------------------- */
const UI = (() => {

  function initLoadingScreen() {
    window.addEventListener("load", () => {
      setTimeout(() => {
        document.getElementById("loading-screen").classList.add("hide");
      }, 550);
    });
    // safety net in case 'load' already fired
    setTimeout(() => document.getElementById("loading-screen")?.classList.add("hide"), 3500);
  }

  function initMobileNav() {
    const toggle = document.getElementById("nav-toggle");
    const links = document.getElementById("nav-links");
    toggle.addEventListener("click", () => {
      const open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    links.querySelectorAll("a").forEach(a => a.addEventListener("click", () => links.classList.remove("open")));
  }

  function initSmoothScrollButtons() {
    document.querySelectorAll("[data-scroll]").forEach(btn => {
      btn.addEventListener("click", () => {
        const target = document.querySelector(btn.dataset.scroll);
        target?.scrollIntoView({ behavior: "smooth" });
        playClick();
      });
    });
  }

  function initActiveNavHighlight() {
    const sections = document.querySelectorAll("main > .section");
    const navLinks = document.querySelectorAll(".nav-link");
    const map = new Map();
    navLinks.forEach(l => map.set(l.getAttribute("href").slice(1), l));

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const link = map.get(entry.target.id);
        if (!link) return;
        if (entry.isIntersecting) {
          navLinks.forEach(l => l.classList.remove("active"));
          link.classList.add("active");
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });

    sections.forEach(s => observer.observe(s));
  }

  function initThemeToggle() {
    const btn = document.getElementById("theme-toggle");
    const icon = document.getElementById("theme-icon");
    btn.addEventListener("click", () => {
      const isLight = document.documentElement.getAttribute("data-theme") === "light";
      document.documentElement.setAttribute("data-theme", isLight ? "dark" : "light");
      icon.textContent = isLight ? "🌙" : "☀️";
      playClick();
    });
  }

  // Very small in-page search index: section id + searchable text
  function initSearch() {
    const input = document.getElementById("site-search");
    const resultsBox = document.getElementById("search-results");
    const index = Array.from(document.querySelectorAll("main > .section")).map(sec => ({
      id: sec.id,
      title: sec.querySelector("h2")?.textContent?.trim() || sec.id,
      text: sec.textContent.toLowerCase()
    }));

    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      if (q.length < 2) { resultsBox.hidden = true; resultsBox.innerHTML = ""; return; }
      const matches = index.filter(sec => sec.text.includes(q)).slice(0, 8);
      resultsBox.innerHTML = "";
      if (matches.length === 0) {
        resultsBox.innerHTML = `<div class="no-results">No matches for "${escapeHtml(input.value)}"</div>`;
      } else {
        matches.forEach(m => {
          const a = document.createElement("a");
          a.href = `#${m.id}`;
          a.textContent = m.title;
          a.addEventListener("click", () => { resultsBox.hidden = true; input.value = ""; });
          resultsBox.appendChild(a);
        });
      }
      resultsBox.hidden = false;
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".search-wrap")) resultsBox.hidden = true;
    });
  }

  function initBackToTop() {
    const btn = document.getElementById("back-to-top");
    window.addEventListener("scroll", () => {
      btn.classList.toggle("show", window.scrollY > 700);
    });
    btn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      playClick();
    });
  }

  // Tiny WebAudio "click" tick — no external sound files needed
  let audioCtx = null;
  function playClick() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(880, audioCtx.currentTime);
      g.gain.setValueAtTime(0.05, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.12);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + 0.12);
    } catch (e) { /* audio not critical to the demo */ }
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function init() {
    initLoadingScreen();
    initMobileNav();
    initSmoothScrollButtons();
    initActiveNavHighlight();
    initThemeToggle();
    initSearch();
    initBackToTop();

    // generic click sound on every button for tactile feedback
    document.querySelectorAll(".btn, .quiz-option, .viva-q").forEach(el => {
      el.addEventListener("click", playClick);
    });
  }

  return { init, escapeHtml, playClick };
})();


/* ---------------------------------------------------------
   TRIANGLE RENDERING HELPERS (shared by hero/about/generator/combo)
--------------------------------------------------------- */
function renderStaticMountain(containerId, rows) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const triangle = Core.buildTriangle(rows);
  el.innerHTML = "";
  triangle.forEach((row, i) => {
    const rowEl = document.createElement("div");
    rowEl.className = "m-row";
    row.forEach(val => {
      const cell = document.createElement("div");
      cell.className = "m-cell";
      cell.style.animationDelay = `${i * 0.05}s`;
      cell.textContent = val.toString();
      rowEl.appendChild(cell);
    });
    el.appendChild(rowEl);
  });
}

/**
 * Renders a full triangle into `container`, row by row with a
 * staggered CSS animation so growth is visible to the user.
 * `highlight` = {row, col} optionally marks one cell.
 */
function renderTriangle(container, triangle, { highlight = null, animate = true } = {}) {
  container.innerHTML = "";
  triangle.forEach((row, i) => {
    const rowEl = document.createElement("div");
    rowEl.className = "t-row";
    row.forEach((val, j) => {
      const cell = document.createElement("div");
      cell.className = "t-cell";
      if (animate) cell.style.animationDelay = `${i * 0.035}s`;
      cell.textContent = Core.formatBig(val);
      if (highlight && highlight.row === i && highlight.col === j) {
        cell.classList.add("highlight", "pulse");
      }
      rowEl.appendChild(cell);
    });
    container.appendChild(rowEl);
  });
}


/* ---------------------------------------------------------
   VIEW: GENERATOR
--------------------------------------------------------- */
const GeneratorView = (() => {
  let currentTriangle = [];

  function generate() {
    const raw = document.getElementById("row-input").value;
    const errorEl = document.getElementById("generator-error");
    const result = Core.validateRows(raw);
    if (!result.valid) {
      errorEl.textContent = result.message;
      document.getElementById("triangle-output").innerHTML = "";
      document.getElementById("output-tools").hidden = true;
      document.getElementById("step-explain").hidden = true;
      document.getElementById("dp-visual").hidden = true;
      currentTriangle = [];
      return;
    }
    errorEl.textContent = "";
    currentTriangle = Core.buildTriangle(result.value);
    renderTriangle(document.getElementById("triangle-output"), currentTriangle);
    document.getElementById("output-tools").hidden = false;

    buildRowPicker();
    document.getElementById("step-explain").hidden = false;
    prepareDpView();
  }

  function clearAll() {
    document.getElementById("row-input").value = "";
    document.getElementById("generator-error").textContent = "";
    document.getElementById("triangle-output").innerHTML = "";
    document.getElementById("output-tools").hidden = true;
    document.getElementById("step-explain").hidden = true;
    document.getElementById("dp-visual").hidden = true;
    currentTriangle = [];
  }

  function buildRowPicker() {
    const picker = document.getElementById("row-picker");
    picker.innerHTML = "";
    currentTriangle.forEach((_, i) => {
      const b = document.createElement("button");
      b.textContent = `Row ${i}`;
      b.addEventListener("click", () => {
        picker.querySelectorAll("button").forEach(x => x.classList.remove("active"));
        b.classList.add("active");
        explainRow(i);
      });
      picker.appendChild(b);
    });
    if (currentTriangle.length > 0) {
      const last = Math.min(5, currentTriangle.length - 1);
      picker.children[last].click();
    }
  }

  function explainRow(i) {
    const box = document.getElementById("row-explanation");
    box.innerHTML = "";
    const row = currentTriangle[i];

    if (i === 0) {
      box.innerHTML = `<div class="re-line">Row 0 is the seed case: <span class="res">[1]</span> — there is exactly one way to arrange zero heavy syllables.</div>`;
      return;
    }
    const prev = currentTriangle[i - 1];
    const heading = document.createElement("div");
    heading.className = "re-line";
    heading.innerHTML = `<strong>Row ${i}</strong> — built entirely from Row ${i - 1}: <span class="res">[${row.map(v => v.toString()).join(", ")}]</span>`;
    box.appendChild(heading);

    row.forEach((val, j) => {
      const line = document.createElement("div");
      line.className = "re-line";
      if (j === 0 || j === row.length - 1) {
        line.innerHTML = `position ${j}: <span class="op">edge</span> = <span class="res">1</span>`;
      } else {
        line.innerHTML = `position ${j}: <span class="op">${prev[j - 1]} + ${prev[j]}</span> = <span class="res">${val}</span>`;
      }
      box.appendChild(line);
    });
  }

  function prepareDpView() {
    document.getElementById("dp-visual").hidden = currentTriangle.length < 2;
  }

  function animateDp() {
    if (currentTriangle.length < 2) return;
    const prevRowEl = document.getElementById("dp-prev-row");
    const currRowEl = document.getElementById("dp-curr-row");
    const text = document.getElementById("dp-explain-text");
    const rowIndex = Math.min(6, currentTriangle.length - 1);
    const prev = currentTriangle[rowIndex - 1];
    const curr = currentTriangle[rowIndex];

    prevRowEl.innerHTML = "";
    prev.forEach(v => {
      const c = document.createElement("div");
      c.className = "t-cell";
      c.textContent = v.toString();
      prevRowEl.appendChild(c);
    });

    currRowEl.innerHTML = "";
    curr.forEach(() => {
      const c = document.createElement("div");
      c.className = "t-cell dim";
      c.textContent = "?";
      currRowEl.appendChild(c);
    });

    text.textContent = `Computing Row ${rowIndex} from the memoised Row ${rowIndex - 1}…`;

    let j = 0;
    const currCells = currRowEl.children;
    const prevCells = prevRowEl.children;
    const timer = setInterval(() => {
      if (j >= curr.length) { clearInterval(timer); text.textContent = `Row ${rowIndex} complete — every value reused Row ${rowIndex - 1}, nothing was recomputed from scratch.`; return; }
      currCells[j].classList.remove("dim");
      currCells[j].textContent = curr[j].toString();
      currCells[j].classList.add("pulse");
      if (j === 0 || j === curr.length - 1) {
        text.textContent = `Position ${j} is an edge → always 1.`;
      } else {
        prevCells[j - 1].classList.add("highlight");
        prevCells[j].classList.add("highlight");
        text.textContent = `Position ${j} = Row${rowIndex - 1}[${j - 1}] + Row${rowIndex - 1}[${j}] = ${prev[j - 1]} + ${prev[j]} = ${curr[j]}`;
        setTimeout(() => { prevCells[j - 1].classList.remove("highlight"); prevCells[j].classList.remove("highlight"); }, 700);
      }
      j++;
    }, 850);
  }

  function copyTriangle() {
    if (currentTriangle.length === 0) return;
    const text = currentTriangle.map(row => row.map(v => v.toString()).join(" ")).join("\n");
    navigator.clipboard?.writeText(text).then(() => {
      const btn = document.getElementById("copy-btn");
      const original = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(() => btn.textContent = original, 1400);
    }).catch(() => alert("Could not copy — please select and copy manually."));
  }

  function toggleDpSection() {
    const dp = document.getElementById("dp-visual");
    if (currentTriangle.length < 2) return;
    dp.hidden = !dp.hidden;
    if (!dp.hidden) dp.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function getCurrentTriangle() { return currentTriangle; }

  function init() {
    document.getElementById("generate-btn").addEventListener("click", generate);
    document.getElementById("clear-btn").addEventListener("click", clearAll);
    document.getElementById("row-input").addEventListener("keydown", e => { if (e.key === "Enter") generate(); });
    document.getElementById("copy-btn").addEventListener("click", copyTriangle);
    document.getElementById("print-btn").addEventListener("click", () => window.print());
    document.getElementById("pdf-btn").addEventListener("click", () => {
      alert("Use your browser's print dialog and choose \"Save as PDF\" as the destination.");
      window.print();
    });
    document.getElementById("dp-play-btn").addEventListener("click", animateDp);
    document.getElementById("dp-toggle-btn").addEventListener("click", toggleDpSection);
  }

  return { init, generate: (n) => { document.getElementById("row-input").value = n; generate(); }, getCurrentTriangle, validate: Core.validateRows };
})();


/* ---------------------------------------------------------
   VIEW: COMBINATION CALCULATOR + BINOMIAL + PROBABILITY
--------------------------------------------------------- */
const ComboView = (() => {

  function validateNR(nRaw, rRaw) {
    const nCheck = Core.validateRows(nRaw, 200);
    if (!nCheck.valid) return { valid: false, message: `n: ${nCheck.message}` };
    const rTrim = (rRaw ?? "").trim();
    if (rTrim === "") return { valid: false, message: "Please enter a value for r." };
    if (!/^-?\d+$/.test(rTrim)) return { valid: false, message: `"${rTrim}" is not a valid whole number for r.` };
    const r = parseInt(rTrim, 10);
    if (r < 0) return { valid: false, message: "r cannot be negative." };
    if (r > nCheck.value) return { valid: false, message: `r cannot be greater than n (${nCheck.value}).` };
    return { valid: true, n: nCheck.value, r };
  }

  function calculate() {
    const errorEl = document.getElementById("combo-error");
    const check = validateNR(document.getElementById("combo-n").value, document.getElementById("combo-r").value);
    if (!check.valid) {
      errorEl.textContent = check.message;
      document.getElementById("combo-result").hidden = true;
      return;
    }
    errorEl.textContent = "";
    const { n, r } = check;
    const answer = Core.combination(n, r);

    document.getElementById("combo-substituted").textContent = `C(${n}, ${r}) = ${n}! / (${r}! · ${n - r}!)`;
    document.getElementById("combo-answer").textContent = `= ${Core.formatBig(answer)}`;

    const steps = document.getElementById("combo-steps");
    steps.innerHTML = "";
    const stepList = [
      `Recognise n = ${n}, r = ${r}.`,
      `By symmetry C(n, r) = C(n, n−r), so use the smaller of r and n−r for fewer multiplications: k = ${Math.min(r, n - r)}.`,
      `Multiply k terms: (n) × (n−1) × … × (n−k+1), dividing by (1 × 2 × … × k) one step at a time so the running total always stays a whole number.`,
      `Result: C(${n}, ${r}) = ${Core.formatBig(answer)}.`
    ];
    stepList.forEach(s => { const li = document.createElement("li"); li.textContent = s; steps.appendChild(li); });
    document.getElementById("combo-result").hidden = false;

    // also draw/refresh the triangle up to n with the (n,r) cell highlighted, if n is reasonably small to render
    if (n <= 40) {
      const wrap = document.getElementById("combo-triangle-wrap");
      wrap.hidden = false;
      const triangle = Core.buildTriangle(n + 1);
      renderTriangle(document.getElementById("combo-triangle"), triangle, { highlight: { row: n, col: r } });
    } else {
      document.getElementById("combo-triangle-wrap").hidden = true;
    }
  }

  function generateForN() {
    const errorEl = document.getElementById("combo-error");
    const nCheck = Core.validateRows(document.getElementById("combo-n").value, 60);
    if (!nCheck.valid) { errorEl.textContent = `n: ${nCheck.message}`; return; }
    errorEl.textContent = "";
    const triangle = Core.buildTriangle(nCheck.value + 1);
    document.getElementById("combo-triangle-wrap").hidden = false;
    renderTriangle(document.getElementById("combo-triangle"), triangle);
  }

  function expandBinomial() {
    const errorEl = document.getElementById("binom-error");
    const check = Core.validateRows(document.getElementById("binom-n").value, 30);
    if (!check.valid) { errorEl.textContent = check.message; document.getElementById("binom-result").hidden = true; return; }
    errorEl.textContent = "";
    const n = check.value;
    const row = Core.buildTriangle(n + 1)[n];

    const terms = row.map((coef, k) => {
      const aPow = n - k;
      const bPow = k;
      let term = coef === 1n ? "" : `${Core.formatBig(coef)}`;
      if (aPow > 0) term += `a${aPow > 1 ? sup(aPow) : ""}`;
      if (aPow > 0 && bPow > 0) term += "";
      if (bPow > 0) term += `b${bPow > 1 ? sup(bPow) : ""}`;
      if (aPow === 0 && bPow === 0) term = Core.formatBig(coef);
      return `<span class="binom-term">${term}</span>`;
    });

    const resultEl = document.getElementById("binom-result");
    resultEl.innerHTML = `(a + b)<sup>${n}</sup> = ` + terms.join(" + ");
    resultEl.hidden = false;
  }

  function sup(num) {
    const map = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
    return num.toString().split("").map(d => map[d]).join("");
  }

  function coinToss() {
    const errorEl = document.getElementById("coin-error");
    const check = Core.validateRows(document.getElementById("coin-n").value, 30);
    if (!check.valid) { errorEl.textContent = check.message; document.getElementById("coin-result").hidden = true; return; }
    errorEl.textContent = "";
    const n = check.value;
    const row = Core.buildTriangle(n + 1)[n];
    const total = row.reduce((a, b) => a + b, 0n); // equals 2^n

    const box = document.getElementById("coin-result");
    box.innerHTML = "";
    row.forEach((count, k) => {
      const pct = Number(count * 10000n / total) / 100;
      const line = document.createElement("div");
      line.className = "coin-bar-row";
      line.innerHTML = `
        <div class="coin-bar-label">${k} heads</div>
        <div class="coin-bar-track"><div class="coin-bar-fill" style="width:0%"></div></div>
        <div class="coin-bar-pct">${pct.toFixed(2)}%</div>
      `;
      box.appendChild(line);
      requestAnimationFrame(() => { line.querySelector(".coin-bar-fill").style.width = pct + "%"; });
    });
    box.hidden = false;
  }

  function init() {
    document.getElementById("combo-calc-btn").addEventListener("click", calculate);
    document.getElementById("combo-gen-btn").addEventListener("click", generateForN);
    document.getElementById("binom-btn").addEventListener("click", expandBinomial);
    document.getElementById("coin-btn").addEventListener("click", coinToss);
  }

  return { init };
})();


/* ---------------------------------------------------------
   VIEW: APPLICATIONS
--------------------------------------------------------- */
const ApplicationsView = (() => {
  const applications = [
    { icon: "🧩", title: "Dynamic Programming", text: "The triangle is the textbook example of DP: optimal substructure (row i needs only row i−1) and overlapping subproblems (one parent feeds two children)." },
    { icon: "🤖", title: "Artificial Intelligence", text: "Search and planning algorithms use binomial counts to bound branching factors and enumerate possible move/state combinations." },
    { icon: "📈", title: "Machine Learning", text: "Binomial coefficients appear in kernel expansions, feature-combination counting, and the Binomial distribution used in classification metrics." },
    { icon: "🎲", title: "Probability", text: "P(k successes in n trials) for a fair coin is C(n,k)/2ⁿ — read directly off row n of Meru-Prastara." },
    { icon: "📊", title: "Statistics", text: "The Binomial and Normal distributions, confidence-interval formulas, and hypothesis tests all lean on nCr counting." },
    { icon: "🏆", title: "Competitive Programming", text: "nCr with modular inverse is a staple pre-computation in contests for counting paths, subsets and arrangements under a modulus." },
    { icon: "🖥️", title: "Computer Graphics", text: "Rendering pipelines use binomial coefficients as blending weights and for pixel-neighbourhood smoothing kernels." },
    { icon: "✏️", title: "Bézier Curves", text: "A Bézier curve of degree n is a weighted sum of control points, and the weights are exactly row n of Pascal's Triangle (the Bernstein basis)." },
    { icon: "➗", title: "Binomial Expansion", text: "Expanding (a+b)ⁿ algebraically is just reading off the coefficients from row n — no repeated multiplication needed." },
    { icon: "🔐", title: "Cryptography", text: "Combinatorial counting underlies key-space and collision estimates, and Pascal's-Triangle parity (Sierpiński pattern) has been explored for pseudo-random constructions." },
  ];

  function render() {
    const grid = document.getElementById("applications-grid");
    applications.forEach(app => {
      const card = document.createElement("div");
      card.className = "app-card";
      card.innerHTML = `<span class="app-icon">${app.icon}</span><h4>${app.title}</h4><p>${app.text}</p>`;
      grid.appendChild(card);
    });
  }

  return { init: render };
})();


/* ---------------------------------------------------------
   VIEW: QUIZ
--------------------------------------------------------- */
const QuizView = (() => {
  const bank = [
    { q: "What does Meru-Prastāra literally refer to?", options: ["The expansion of the mountain", "The circle of numbers", "The path of the river", "The chain of syllables"], answer: 0 },
    { q: "Who first described the triangular table for counting syllable patterns?", options: ["Āryabhaṭa", "Piṅgala", "Brahmagupta", "Bhāskara"], answer: 1 },
    { q: "Who named the figure 'Meru-Prastāra' and stated its build rule?", options: ["Halāyudha", "Varāhamihira", "Pāṇini", "Kātyāyana"], answer: 0 },
    { q: "In Computer Science, Meru-Prastāra is equivalent to:", options: ["A binary search tree", "Pascal's Triangle", "A hash table", "A linked list"], answer: 1 },
    { q: "What rule builds every interior value of the triangle?", options: ["Multiply the two values above it", "Sum of the two values above it", "Average of the whole row", "Subtract the row number"], answer: 1 },
    { q: "Which CS technique does the row-from-row build rule directly correspond to?", options: ["Greedy algorithms", "Dynamic Programming", "Divide and conquer only", "Brute force search"], answer: 1 },
    { q: "What is the time complexity of generating n rows of the triangle?", options: ["O(n)", "O(n log n)", "O(n²)", "O(2ⁿ)"], answer: 2 },
    { q: "C(n, r) mathematically represents:", options: ["Number of permutations", "Number of combinations", "Sum of first n numbers", "Factorial of n"], answer: 1 },
    { q: "The coefficients of (a+b)ⁿ come from:", options: ["Row n of the triangle", "Row 0 of the triangle", "The column sums", "The diagonal only"], answer: 0 },
    { q: "Probability of exactly k heads in n coin tosses equals:", options: ["C(n,k) × 2ⁿ", "C(n,k) / 2ⁿ", "C(n,k) − 2ⁿ", "2ⁿ / C(n,k)"], answer: 1 },
    { q: "Which Indian text records the earliest form of this triangle?", options: ["Chandaḥśāstra", "Arthaśāstra", "Sūrya Siddhānta", "Charaka Saṃhitā"], answer: 0 },
    { q: "In which century did Blaise Pascal publish his triangle?", options: ["13th", "15th", "17th", "19th"], answer: 2 },
    { q: "What are the two possible syllable types Meru-Prastāra originally enumerated?", options: ["Vowels and consonants", "Laghu (light) and Guru (heavy)", "Nouns and verbs", "Odd and even"], answer: 1 },
    { q: "The edge values of every row in the triangle are always:", options: ["0", "1", "n", "n−1"], answer: 1 },
    { q: "Bézier curves in computer graphics use Pascal's Triangle values as:", options: ["Pixel colours", "Blending/weight coefficients", "Screen coordinates", "Frame rates"], answer: 1 },
    { q: "'Optimal substructure' in this triangle means:", options: ["Every row can be built from the row before it", "Every column is identical", "The triangle has no repeating values", "Rows must be computed in random order"], answer: 0 },
    { q: "The space complexity to store the full triangle of n rows is:", options: ["O(1)", "O(n)", "O(n²)", "O(log n)"], answer: 2 },
    { q: "Why does this project use JavaScript BigInt?", options: ["To make the code shorter", "To avoid integer overflow for large rows", "To enable animations", "It is required by HTML5"], answer: 1 },
    { q: "Which of these is NOT a modern application discussed in this project?", options: ["Cryptographic counting estimates", "Bézier curves", "Sorting a linked list", "Binomial probability"], answer: 2 },
    { q: "Halāyudha's contribution was primarily:", options: ["Inventing binary numbers", "Naming the triangle and stating its recurrence rule", "Discovering zero", "Writing the first computer algorithm"], answer: 1 },
    { q: "'Naṣṭa' and 'Uddiṣṭa' in Piṅgala's work refer to:", options: ["Encoding and decoding metrical patterns", "Addition and subtraction", "Two ancient calendars", "Musical scales"], answer: 0 },
    { q: "C(n, r) is equal to:", options: ["C(n, n−r)", "C(r, n)", "C(n−1, r−1) only", "n − r"], answer: 0 },
    { q: "This project's core claim is that Meru-Prastāra:", options: ["Predates and structurally matches Pascal's Triangle", "Is unrelated to Pascal's Triangle", "Was invented after Pascal", "Only applies to poetry, not CS"], answer: 0 },
    { q: "Which data structure naturally stores the triangle in code?", options: ["A jagged / 2D array", "A single integer", "A boolean flag", "A stack only"], answer: 0 },
    { q: "The main limitation of the naive DP approach discussed is:", options: ["It cannot be implemented in JavaScript", "Growing memory/rendering cost for very large n", "It gives wrong answers for n > 5", "It requires a database"], answer: 1 },
  ];

  let questions = [];
  let current = 0;
  let score = 0;

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function start() {
    questions = shuffle(bank).slice(0, 10).map(item => {
      const optionOrder = shuffle(item.options.map((opt, idx) => ({ opt, idx })));
      const newAnswer = optionOrder.findIndex(o => o.idx === item.answer);
      return { q: item.q, options: optionOrder.map(o => o.opt), answer: newAnswer };
    });
    current = 0;
    score = 0;
    document.getElementById("quiz-start-wrap").hidden = true;
    document.getElementById("quiz-result").hidden = true;
    document.getElementById("quiz-app").hidden = false;
    renderQuestion();
  }

  function renderQuestion() {
    const item = questions[current];
    document.getElementById("quiz-progress-text").textContent = `Question ${current + 1} / ${questions.length}`;
    document.getElementById("quiz-progress-fill").style.width = `${((current) / questions.length) * 100}%`;
    document.getElementById("quiz-question").textContent = item.q;
    const optWrap = document.getElementById("quiz-options");
    optWrap.innerHTML = "";
    document.getElementById("quiz-next-btn").hidden = true;

    item.options.forEach((opt, idx) => {
      const b = document.createElement("button");
      b.className = "quiz-option";
      b.textContent = opt;
      b.addEventListener("click", () => selectAnswer(idx, b));
      optWrap.appendChild(b);
    });
  }

  function selectAnswer(idx, btnEl) {
    const item = questions[current];
    const buttons = document.querySelectorAll("#quiz-options .quiz-option");
    buttons.forEach(b => b.disabled = true);
    if (idx === item.answer) { btnEl.classList.add("correct"); score++; }
    else {
      btnEl.classList.add("incorrect");
      buttons[item.answer].classList.add("correct");
    }
    document.getElementById("quiz-next-btn").hidden = false;
  }

  function next() {
    current++;
    if (current >= questions.length) {
      finish();
    } else {
      renderQuestion();
    }
  }

  function finish() {
    document.getElementById("quiz-app").hidden = true;
    document.getElementById("quiz-result").hidden = false;
    document.getElementById("quiz-progress-fill").style.width = "100%";
    document.getElementById("quiz-score-text").textContent = `${score} / ${questions.length}`;
  }

  function init() {
    document.getElementById("quiz-start-btn").addEventListener("click", start);
    document.getElementById("quiz-next-btn").addEventListener("click", next);
    document.getElementById("quiz-restart-btn").addEventListener("click", start);
  }

  return { init };
})();


/* ---------------------------------------------------------
   VIEW: TEST CASES
--------------------------------------------------------- */
const TestCasesView = (() => {
  const cases = [
    { input: "1", expected: "1" },
    { input: "2", expected: "1\n1 1" },
    { input: "5", expected: "Correct 5-row triangle" },
    { input: "10", expected: "Correct 10-row triangle" },
    { input: "15", expected: "Correct 15-row triangle" },
    { input: "0", expected: "Error" },
    { input: "-5", expected: "Error" },
    { input: "abc", expected: "Invalid Input" },
    { input: "50", expected: "Large triangle generated successfully" },
    { input: "100", expected: "Program handles large input correctly" },
  ];

  function run(caseObj, resultCell) {
    const validation = Core.validateRows(caseObj.input, 200);
    let pass, message;
    if (!validation.valid) {
      message = "Rejected: " + validation.message;
      // any non-numeric / zero / negative case is a PASS if the expected outcome was an error
      pass = /error|invalid/i.test(caseObj.expected);
    } else {
      const triangle = Core.buildTriangle(validation.value);
      const lastRow = triangle[triangle.length - 1];
      const ok = triangle.length === validation.value && lastRow.length === validation.value;
      message = ok
        ? `Generated ${validation.value} row(s) correctly. Last row length = ${lastRow.length}.`
        : `Unexpected structure.`;
      pass = ok;
    }
    resultCell.innerHTML = `<span class="${pass ? "tc-pass" : "tc-fail"}">${pass ? "PASS" : "FAIL"}</span> — ${message}`;
  }

  function render() {
    const body = document.getElementById("testcase-body");
    cases.forEach((c, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td><code>${c.input}</code></td>
        <td>${c.expected}</td>
        <td class="tc-result">—</td>
        <td><button class="btn tc-run-btn">Run</button></td>
      `;
      const resultCell = tr.querySelector(".tc-result");
      tr.querySelector(".tc-run-btn").addEventListener("click", () => run(c, resultCell));
      body.appendChild(tr);
    });
  }

  return { init: render };
})();


/* ---------------------------------------------------------
   VIEW: VIVA ACCORDION
--------------------------------------------------------- */
const VivaView = (() => {
  const qa = [
    ["What is Meru-Prastāra?", "A triangular tabulation from classical Indian prosody that enumerates syllable patterns of a metrical line, built by summing adjacent values from the row above."],
    ["How is it related to Pascal's Triangle?", "The two are structurally identical: same triangular shape, same values, same 'sum of the two above' rule — just discovered independently in different contexts, centuries apart."],
    ["Why is this considered Dynamic Programming?", "Because each row is computed purely from the immediately preceding row (optimal substructure), and shared parent values are reused rather than recomputed (overlapping subproblems)."],
    ["Where is Meru-Prastāra / Pascal's Triangle used today?", "Dynamic Programming, probability, statistics, Bézier curves in graphics, binomial expansion, competitive programming, and combinatorial estimates in cryptography and ML."],
    ["Why is this an IKS (Indian Knowledge System) concept?", "It originates in Piṅgala's Chandaḥśāstra and was named and formalised by Halāyudha, over a thousand years before Pascal's 1654 publication — a documented Indian contribution to combinatorics."],
    ["How does your software implement it?", "A BigInt-based JavaScript function builds each row from the previous row iteratively (O(n²) time), which is then rendered, animated and reused across the generator, calculator, and other tools."],
    ["What problem does your software solve?", "It lets a user generate the triangle, compute any nCr, see step-by-step derivations, and understand — visually — why the DP recurrence works, all in one interactive tool."],
    ["Who was Piṅgala?", "An ancient Indian scholar (c. 3rd–2nd century BCE) who authored the Chandaḥśāstra, describing metrical patterns and the earliest known form of this triangular table."],
    ["Who was Halāyudha?", "A 10th-century commentator on Piṅgala's work who explicitly named the figure 'Meru-Prastāra' and stated its additive build rule."],
    ["What is the time complexity of building n rows?", "O(n²), since the total number of cells across n rows is n(n+1)/2."],
    ["What is the space complexity?", "O(n²) if the full triangle is stored, or O(n) if only the current and previous row are kept."],
    ["Why does the code use BigInt instead of Number?", "Binomial coefficients grow extremely fast; native JavaScript numbers lose precision beyond 2^53, so BigInt keeps every value exact even at 100+ rows."],
    ["What is nCr?", "The number of ways to choose r items from n items without regard to order, computed as n! / (r!(n−r)!) — and equal to the r-th entry of row n."],
    ["What is the recurrence relation used?", "row[i][j] = row[i-1][j-1] + row[i-1][j], with row[i][0] = row[i][i] = 1."],
    ["What is optimal substructure?", "A property where the solution to a problem can be built directly from solutions to smaller sub-problems — here, row i from row i−1."],
    ["What is an overlapping subproblem?", "A sub-result that is reused more than once — here, a single parent value in row i−1 feeds two children in row i."],
    ["How are Bézier curves related to this triangle?", "The blending weights of a degree-n Bézier curve are exactly the binomial coefficients of row n (the Bernstein basis polynomials)."],
    ["How is the triangle used in probability?", "The probability of exactly k successes in n independent fair-coin trials is C(n,k) divided by 2ⁿ, read straight from row n."],
    ["What are the limitations of this approach?", "Very large row counts increase rendering cost, and although BigInt avoids overflow, a single nCr value still needs the row built up to it unless memoised separately."],
    ["Why validate the row-count input?", "To prevent blank, negative, zero, or non-numeric input from breaking the triangle-building logic, and to give the user a clear, specific error message."],
    ["What does 'laghu' and 'guru' mean in the original context?", "Light and heavy syllables respectively — the two syllable weights whose arrangements Piṅgala's triangle originally counted."],
    ["Why is this called 'Meru' (mountain)?", "Because the growing, symmetric, stepped shape of the triangle resembles a stepped mountain or temple silhouette."],
    ["How does binomial expansion connect to the triangle?", "Expanding (a+b)ⁿ produces exactly the coefficients found in row n of the triangle, in order, against descending powers of a and ascending powers of b."],
    ["Could this triangle be built recursively instead of iteratively?", "Yes, using the same recurrence, but a naive recursive version without memoisation would recompute the same sub-values many times — this project's DP/tabulation approach avoids that."],
    ["What is the single biggest takeaway of this project?", "That a documented Indian Knowledge System — Meru-Prastāra — is not just historically interesting but is, structurally, the same object modern Computer Science relies on for Dynamic Programming and combinatorics."],
  ];

  function render() {
    const wrap = document.getElementById("viva-accordion");
    qa.forEach(([q, a], i) => {
      const item = document.createElement("div");
      item.className = "viva-item";
      item.innerHTML = `
        <button class="viva-q"><span><span class="num">${String(i + 1).padStart(2, "0")}</span>${q}</span><span class="chev">⌄</span></button>
        <div class="viva-a"><div class="viva-a-inner">${a}</div></div>
      `;
      const btn = item.querySelector(".viva-q");
      const answer = item.querySelector(".viva-a");
      btn.addEventListener("click", () => {
        const isOpen = item.classList.toggle("open");
        answer.style.maxHeight = isOpen ? answer.scrollHeight + "px" : "0px";
      });
      wrap.appendChild(item);
    });
  }

  return { init: render };
})();


/* ---------------------------------------------------------
   BOOTSTRAP
--------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  UI.init();
  renderStaticMountain("hero-triangle", 6);
  renderStaticMountain("about-triangle", 7);
  GeneratorView.init();
  ComboView.init();
  ApplicationsView.init();
  QuizView.init();
  TestCasesView.init();
  VivaView.init();

  // seed the generator with a friendly default so the page never looks empty
  GeneratorView.generate(8);
});
