(function () {
  "use strict";

  const { SAMPLE_CSV, parseStatement, analyse } = window.FinSight;
  const CURRENCY = "\u20B9";
  let current = null;

  const $ = (id) => document.getElementById(id);
  const fmt = (n) => CURRENCY + Math.round(n).toLocaleString("en-IN");
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function showPage(name) {
    document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
    document.querySelectorAll(".nav-item").forEach((n) => n.classList.toggle("active", n.dataset.page === name));
    const page = $("page-" + name);
    if (page) page.classList.add("active");
  }

  function riskClass(level) { return level.toLowerCase(); }
  function pct(n) { return Math.round((n || 0) * 100) + "%"; }

  function recentRows() {
    return [
      ["Oct 15, 2026", "statement_oct.pdf", "Sep 2026", "Moderate", "Completed"],
      ["Sep 12, 2026", "statement_sep.pdf", "Aug 2026", "Low", "Completed"],
      ["Aug 10, 2026", "statement_aug.pdf", "Jul 2026", "High", "Completed"]
    ];
  }

  function renderRecent() {
    $("recent-body").innerHTML = recentRows().map((row) => `
      <tr><td>${row[0]}</td><td><a href="demo-statements/statement_sep_2026.csv" download>${row[1]}</a></td><td>${row[2]}</td>
      <td><span class="risk-badge ${riskClass(row[3])}">${row[3]}</span></td>
      <td><span class="status">✓ Completed</span></td></tr>`).join("");
  }

  function render(r) {
    current = r;
    $("metrics").innerHTML = `
      <div class="metric"><div class="metric-icon">♧</div><div><small>Monthly Income</small><strong>${fmt(r.avgMonthlyIncome)}</strong></div></div>
      <div class="metric"><div class="metric-icon">♙</div><div><small>Total Expenses</small><strong>${fmt(r.spend)}</strong></div></div>
      <div class="metric"><div class="metric-icon">▣</div><div><small>Savings Rate</small><strong>${r.savingsRate === null ? "n/a" : pct(r.savingsRate)}</strong></div></div>
      <div class="metric"><div class="metric-icon">△</div><div><small>Budget Risk</small><strong class="red">${r.level}</strong></div></div>`;

    const top = r.categories.slice(0, 5);
    const colours = ["#f05c75", "#f5aa4a", "#6aa6f5", "#9a65d8", "#10b58b"];
    let start = 0;
    const stops = top.map(([,v], i) => {
      const share = r.spend ? v / r.spend : 0;
      const end = start + share * 100;
      const stop = `${colours[i]} ${start}% ${end}%`;
      start = end;
      return stop;
    }).join(",");
    $("donut").style.background = top.length ? `conic-gradient(${stops})` : "#e8edf5";
    $("donut-total").textContent = fmt(r.spend);
    $("category-legend").innerHTML = top.map(([name,v],i) =>
      `<div class="legend-row"><i style="background:${colours[i]}"></i><span>${esc(name)}</span><b>${pct(r.spend ? v/r.spend : 0)}</b></div>`
    ).join("");

    const months = [...new Set(r.txns.map((t) => t.month))].slice(-5);
    $("income-bars").innerHTML = months.map((month) => {
      const tx = r.txns.filter((t) => t.month === month);
      const income = tx.reduce((s,t) => s + (t.amount > 0 ? t.amount : 0),0);
      const expense = tx.reduce((s,t) => s + (t.amount < 0 ? -t.amount : 0),0);
      const max = Math.max(income,expense,1);
      const label = new Date(month + "-02").toLocaleString("en-US",{month:"short"});
      return `<div class="bar-group"><i class="in" style="height:${Math.max(8,income/max*105)}px"></i><i class="out" style="height:${Math.max(8,expense/max*105)}px"></i><span>${label}</span></div>`;
    }).join("");

    const bannerText = r.flags[0] || "Your spending is generally within guideline ranges.";
    $("insight-banner").innerHTML = `<span class="insight-icon">△</span><div><strong>Insight: ${esc(bannerText)}</strong><p>Review your recent discretionary purchases and compare them with your 3-month average.</p></div><button class="view-detail" data-go="guidance">View Details →</button>`;

    $("budget-transactions").innerHTML = r.txns.slice(-4).reverse().map((t) => `
      <tr><td>${esc(t.date)}</td><td>${esc(t.desc)}</td><td>${t.cat ? esc(t.cat.name) : "Income"}</td><td class="${t.amount < 0 ? "neg" : "pos"}">${t.amount < 0 ? "-" : "+"}${fmt(Math.abs(t.amount))}</td></tr>`).join("");
    $("all-transactions").innerHTML = r.txns.map((t) => `
      <tr><td>${esc(t.date)}</td><td>${esc(t.desc)}</td><td>${t.cat ? esc(t.cat.name) : "Income"}</td><td class="${t.amount < 0 ? "neg" : "pos"}">${t.amount < 0 ? "-" : "+"}${fmt(Math.abs(t.amount))}</td></tr>`).join("");

    $("guidance-risk").innerHTML = `<span style="margin-right:7px">△</span> Budget Risk: ${r.level}`;
    const topCategory = r.categories[0] ? r.categories[0][0].toLowerCase() : "discretionary spending";
    $("summary-text").textContent = r.flags.length
      ? `Your spending is generally within a safe range, but certain categories (especially ${topCategory}) are higher than your usual budget. With a few small changes, you can improve your savings and reduce overspending next month.`
      : "Your spending is generally within a safe range. Continue tracking recurring commitments and savings.";
    $("recommendations").innerHTML = r.recs.slice(0,3).map((text,i) => {
      const icon = ["↗","▣","♧"][i];
      const title = ["Set a weekly dining limit","Review recurring subscriptions","Build an emergency savings target"][i];
      return `<article class="recommendation"><div class="recommendation-icon">${icon}</div><strong>${title}</strong><p>${esc(text)}</p></article>`;
    }).join("");
    $("counsellor-questions").innerHTML = r.questions.slice(0,5).map((q) => `<li>${esc(q)}</li>`).join("");

    const overspending = r.categories.slice(0,5);
    const overspendingHtml = overspending.map(([name,v]) => {
      const width = r.spend ? Math.round(v/r.spend*100) : 0;
      return `<div class="overspending-row"><span>${esc(name)}</span><div class="overspending-track"><i style="width:${Math.min(width,100)}%"></i></div><span>${width}%</span></div>`;
    }).join("");
    $("overspending-bars").innerHTML = overspendingHtml;
    $("overspending-bars-copy").innerHTML = overspendingHtml;

    const lastMonth = r.txns[r.txns.length-1]?.month || "2026-09";
    const date = new Date(lastMonth + "-02");
    $("date-label").textContent = date.toLocaleString("en-US",{month:"short",year:"numeric"});
  }

  function loadSample(navigateToBudget = true) {
    $("input").value = SAMPLE_CSV;
    try {
      render(analyse(parseStatement(SAMPLE_CSV)));
      $("error").textContent = "";
      if (navigateToBudget) showPage("budget");
    } catch (e) { $("error").textContent = e.message; }
  }

  function runFile(file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      $("error").textContent = "The statement exceeds the 10 MB limit.";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      $("input").value = reader.result;
      try {
        render(analyse(parseStatement(reader.result)));
        $("error").textContent = "";
        showPage("budget");
      } catch (e) {
        $("error").textContent = e.message;
      }
    };
    reader.onerror = () => { $("error").textContent = "Could not read the file."; };
    reader.readAsText(file);
  }

  document.querySelectorAll(".nav-item").forEach((item) => item.addEventListener("click", () => showPage(item.dataset.page)));
  document.querySelectorAll("[data-go]").forEach((button) => button.addEventListener("click", () => showPage(button.dataset.go)));
  $("demo").addEventListener("click", () => loadSample(true));
  $("sample-copy").addEventListener("click", () => loadSample(true));
  $("file").addEventListener("change", (e) => runFile(e.target.files[0]));
  $("file-copy").addEventListener("change", (e) => runFile(e.target.files[0]));

  const dropzone = $("dropzone");
  ["dragenter","dragover"].forEach((name) => dropzone.addEventListener(name, (e) => { e.preventDefault(); dropzone.style.borderColor = "#078d91"; }));
  ["dragleave","drop"].forEach((name) => dropzone.addEventListener(name, (e) => { e.preventDefault(); dropzone.style.borderColor = "#aebdcd"; }));
  dropzone.addEventListener("drop", (e) => runFile(e.dataTransfer.files[0]));

  renderRecent();
  loadSample(false);
})();
