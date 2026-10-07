/* ==========================================================================
   Steam Sales Radar - dashboard logic
   The dashboard ONLY talks to our FastAPI backend (never to Steam or Mongo):
     GET /stats           -> KPIs + both charts
     GET /games           -> table, with ?title= and ?min_discount= filters
     GET /games/{appid}   -> history popup
   ========================================================================== */

// Where uvicorn is running. Change this if you use another port.
const API = "http://localhost:8000";

// Latest collected_date, read from /stats. The table only shows rows from
// this date so the same game doesn't appear once per day collected.
let latestDate = null;

// Keep references to the Chart.js charts so we can redraw them (theme change).
const charts = {};

// ---------- Small helpers ----------

// Format a number as Brazilian reais: 1234.5 -> "R$ 1.234,50"
const brl = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Shortcut for document.getElementById
const $ = (id) => document.getElementById(id);

// Read a color token from style.css (so charts match light/dark mode)
const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// Create an element with optional class and text (textContent = safe, no HTML injection)
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// fetch() + JSON + a clear error if the API is down or returns an error
async function getJSON(path) {
  const res = await fetch(API + path);
  if (!res.ok) throw new Error(`${path} answered HTTP ${res.status}`);
  return res.json();
}

// Show the red error box and mark the API pill as offline
function showError(err) {
  const box = $("error");
  box.hidden = false;
  box.innerHTML =
    "Couldn't reach the API. Start it from <code>src/</code> with " +
    "<code>uvicorn api:app --reload</code> and make sure MongoDB is running, then reload this page.";
  $("api-status").textContent = "API offline";
  $("api-status").className = "pill bad";
  console.error(err);
}

// ---------- 1) Indicators + charts (GET /stats) ----------

async function loadStats() {
  const s = await getJSON("/stats");
  latestDate = s.date;

  // Header + API status
  $("snapshot").textContent = `latest collection: ${s.date}`;
  $("api-status").textContent = "API online";
  $("api-status").className = "pill ok";

  // KPI tiles
  $("kpi-total").textContent = s.total_games;
  $("kpi-avg").textContent = `${s.average_discount.toFixed(1)}%`;
  $("kpi-savings").textContent = brl(s.total_savings);

  // Chart data: the labels shown under the bars + the counts from /stats
  const discountData = {
    labels: ["0–25%", "25–50%", "50–75%", "75–100%"],
    values: [s["range 0-25"], s["range 25-50"], s["range 50-75"], s["range 75-100"]],
  };
  const priceData = {
    labels: ["< R$20", "R$20–50", "R$50–100", "R$100+"],
    values: [s["price: <R$20"], s["price: R$20-50"], s["price: R$50-100"], s["price: R$100+"]],
  };

  // Save the data so we can redraw on theme change, then draw
  charts.data = { discountData, priceData };
  drawCharts();
}

// Build one pie chart. Each slice = one range; the legend shows label + count
// so the reader never has to rely on color alone.
function pieChart(canvasId, { labels, values }) {
  const total = values.reduce((a, b) => a + b, 0);
  return new Chart($(canvasId), {
    type: "pie",
    data: {
      labels,
      datasets: [{
        data: values,
        // light -> dark blue, in the same order as the ranges
        backgroundColor: ["--step-1", "--step-2", "--step-3", "--step-4"].map(token),
        borderColor: token("--surface"),   // thin gap between slices, same color as the card
        borderWidth: 2,
        hoverOffset: 6,                    // slice pops out a little on hover
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: {
            color: token("--text-secondary"),
            usePointStyle: true,
            pointStyle: "circle",
            padding: 14,
            // legend text: "0-25%  66 (26%)"
            generateLabels: (chart) =>
              Chart.overrides.pie.plugins.legend.labels.generateLabels(chart).map((item, i) => ({
                ...item,
                text: `${labels[i]}  ${values[i]} (${total ? Math.round((values[i] / total) * 100) : 0}%)`,
                fontColor: token("--text-secondary"),
              })),
          },
        },
        tooltip: {   // hover: "66 games - 26%"
          callbacks: {
            label: (ctx) => ` ${ctx.parsed} games - ${total ? Math.round((ctx.parsed / total) * 100) : 0}%`,
          },
        },
      },
    },
  });
}

// (Re)draw both charts with the current theme colors
function drawCharts() {
  if (!charts.data) return;
  charts.discount?.destroy();
  charts.price?.destroy();
  Chart.defaults.font.family = "Inter, system-ui, sans-serif";
  charts.discount = pieChart("chart-discount", charts.data.discountData);
  charts.price = pieChart("chart-price", charts.data.priceData);
}

// If the OS switches light/dark, redraw so chart colors follow
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", drawCharts);

// ---------- 2) Table with filters (GET /games?title=&min_discount=) ----------

async function loadGames() {
  // Build the query string from the two filter inputs (only if they have a value)
  const params = new URLSearchParams();
  const title = $("f-title").value.trim();
  const min = $("f-min").value;
  if (title) params.set("title", title);
  if (min) params.set("min_discount", min);

  const all = await getJSON(`/games${params.toString() ? "?" + params : ""}`);

  // /games returns every collected day; keep only the latest snapshot
  const games = latestDate ? all.filter((g) => g.collected_date === latestDate) : all;

  renderRows(games);
}

// Turn the list of games into table rows
function renderRows(games) {
  const tbody = $("rows");
  tbody.replaceChildren();   // clear old rows
  $("count").textContent = `${games.length} game${games.length === 1 ? "" : "s"}`;

  if (games.length === 0) {
    const tr = el("tr");
    const td = el("td", "empty", "No games match these filters.");
    td.colSpan = 6;
    tr.append(td);
    tbody.append(tr);
    return;
  }

  for (const g of games) {
    const tr = el("tr");
    tr.tabIndex = 0;  // keyboard users can focus a row

    // Cover image
    const imgTd = el("td");
    if (g.image) {
      const img = el("img", "cover");
      img.src = g.image;
      img.alt = "";
      img.loading = "lazy";  // only load images when scrolled into view
      imgTd.append(img);
    }

    // Columns: title, release date, discount badge, original (struck), final price
    const discountTd = el("td", "num");
    discountTd.append(el("span", "badge", `-${g.discount_pct}%`));

    tr.append(
      imgTd,
      el("td", "title", g.title),
      el("td", "muted hide-sm", g.release_date || "—"),
      discountTd,
      el("td", "num strike hide-sm", brl(g.original_price)),
      el("td", "num", brl(g.discounted_price)),
    );

    // Click (or Enter) opens that game's history
    tr.addEventListener("click", () => openHistory(g.appid, g.title));
    tr.addEventListener("keydown", (e) => { if (e.key === "Enter") openHistory(g.appid, g.title); });

    tbody.append(tr);
  }
}

// ---------- 3) History popup (GET /games/{appid}) ----------

async function openHistory(appid, title) {
  $("h-title").textContent = title;
  const tbody = $("h-rows");
  tbody.replaceChildren();

  try {
    // Already sorted newest-first by the API
    const history = await getJSON(`/games/${encodeURIComponent(appid)}`);
    for (const h of history) {
      const tr = el("tr");
      tr.append(
        el("td", "", h.collected_date),
        el("td", "num", `-${h.discount_pct}%`),
        el("td", "num", brl(h.original_price)),
        el("td", "num", brl(h.discounted_price)),
      );
      tbody.append(tr);
    }
    $("h-note").textContent =
      `${history.length} collection${history.length === 1 ? "" : "s"} recorded · appid ${appid}`;
  } catch (err) {
    $("h-note").textContent = "Couldn't load the history for this game.";
    console.error(err);
  }

  $("history").showModal();
}

$("h-close").addEventListener("click", () => $("history").close());

// ---------- Wire the filters ----------

// Wait 300ms after the user stops typing before calling the API (avoids a request per keystroke)
let typingTimer;
$("f-title").addEventListener("input", () => {
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => loadGames().catch(showError), 300);
});
$("f-min").addEventListener("change", () => loadGames().catch(showError));

// ---------- Start: stats first (we need latestDate), then the table ----------
loadStats()
  .then(loadGames)
  .catch(showError);
