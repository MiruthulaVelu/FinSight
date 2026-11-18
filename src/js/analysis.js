/*
 * FinSight analysis engine.
 * Pure functions only (no DOM access) so they can be unit tested with Node.
 * Works in the browser (exposes window.FinSight) and in Node (module.exports).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.FinSight = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Spending categories. "limit" is a guideline share of income; "tip" is shown when it is exceeded.
  const CATEGORIES = [
    { name: "Food delivery", kw: ["swiggy", "zomato", "uber eats", "doordash", "foodpanda", "deliveroo"], discretionary: true, limit: 0.08,
      tip: "Set a monthly cap for food delivery and cook at home a few more times each week." },
    { name: "Subscriptions", kw: ["netflix", "spotify", "prime", "hotstar", "youtube", "icloud", "subscription", "adobe", "notion"], discretionary: true, limit: 0.03,
      tip: "Review active subscriptions and cancel any you have not used in the last 60 days." },
    { name: "Shopping", kw: ["amazon", "flipkart", "myntra", "shop", "store"], discretionary: true, limit: 0.10,
      tip: "Wait 48 hours before non-essential purchases and compare the cost against your monthly limit." },
    { name: "Entertainment", kw: ["movie", "pvr", "bookmyshow", "cinema", "steam", "game"], discretionary: true, limit: 0.05,
      tip: "Choose a fixed monthly entertainment budget and track it against each outing." },
    { name: "Groceries", kw: ["grocery", "bigbasket", "blinkit", "dmart", "supermarket", "walmart", "kroger"], discretionary: false },
    { name: "Transport", kw: ["uber", "ola", "metro", "fuel", "petrol", "shell", "irctc", "rapido"], discretionary: false },
    { name: "Utilities and bills", kw: ["electric", "water", "broadband", "airtel", "jio", "bill", "insurance"], discretionary: false },
    { name: "Rent and housing", kw: ["rent", "landlord", "maintenance"], discretionary: false },
    { name: "Other", kw: [], discretionary: false }
  ];

  const OTHER = CATEGORIES[CATEGORIES.length - 1];

  const SAVINGS_GUIDELINE = 0.2;

  function splitCSVLine(line) {
    const out = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
        else quoted = !quoted;
      } else if (c === "," && !quoted) {
        out.push(cur.trim());
        cur = "";
      } else {
        cur += c;
      }
    }
    out.push(cur.trim());
    return out;
  }

  // Returns "YYYY-MM" or null. Supports 2026-08-01 and 01/08/2026 (day first).
  function monthKey(s) {
    let m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if (m) return m[1] + "-" + m[2].padStart(2, "0");
    m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/);
    if (m) {
      const y = m[3].length === 2 ? "20" + m[3] : m[3];
      return y + "-" + m[2].padStart(2, "0");
    }
    const d = new Date(s);
    if (isNaN(d)) return null;
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }

  function parseNum(s) {
    if (s === undefined || s === null || s === "") return 0;
    let t = String(s).replace(/[,\s]/g, "").replace(/[\u20B9$\u20AC\u00A3]/g, "");
    t = t.replace(/^\((.*)\)$/, "-$1");
    const n = parseFloat(t);
    return isNaN(n) ? 0 : n;
  }

  function categorise(desc) {
    const lower = desc.toLowerCase();
    for (const c of CATEGORIES) {
      if (c.kw.some((k) => lower.includes(k))) return c;
    }
    return OTHER;
  }

  function parseStatement(text) {
    const lines = String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      throw new Error("The statement needs a header row and at least one transaction.");
    }

    const header = splitCSVLine(lines[0]).map((h) => h.toLowerCase());
    const dateIdx = header.findIndex((h) => /date/.test(h));
    const descIdx = header.findIndex((h) => /desc|narration|particular|details|merchant|payee/.test(h));
    const amtIdx = header.findIndex((h) => /^(amount|amt|value)/.test(h));
    const debitIdx = header.findIndex((h) => /debit|withdraw/.test(h));
    const creditIdx = header.findIndex((h) => /credit|deposit/.test(h));

    if (dateIdx < 0 || descIdx < 0 || (amtIdx < 0 && debitIdx < 0 && creditIdx < 0)) {
      throw new Error("Could not find date, description and amount columns. Expected a header like: Date,Description,Amount");
    }

    const txns = [];
    for (let i = 1; i < lines.length; i++) {
      const f = splitCSVLine(lines[i]);
      const month = monthKey(f[dateIdx] || "");
      if (!month) continue;
      const desc = f[descIdx] || "(no description)";
      const amount = amtIdx >= 0
        ? parseNum(f[amtIdx])
        : parseNum(f[creditIdx]) - Math.abs(parseNum(f[debitIdx]));
      txns.push({
        date: f[dateIdx],
        month,
        desc,
        amount,
        cat: amount < 0 ? categorise(desc) : null
      });
    }

    if (!txns.length) {
      throw new Error("No valid transactions were found. Check the date format.");
    }
    return txns;
  }

  function pct(x) { return Math.round(x * 100) + "%"; }

  function analyse(txns) {
    let income = 0;
    let spend = 0;
    const catTotals = {};
    const months = new Set();
    const merchants = {};

    for (const t of txns) {
      months.add(t.month);
      if (t.amount >= 0) {
        income += t.amount;
        continue;
      }
      const a = -t.amount;
      spend += a;
      const name = t.cat.name;
      catTotals[name] = (catTotals[name] || 0) + a;
      const key = t.desc.toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim()
        .split(" ").slice(0, 2).join(" ");
      if (!merchants[key]) merchants[key] = new Set();
      merchants[key].add(t.month);
    }

    const monthCount = months.size || 1;
    const savingsRate = income > 0 ? (income - spend) / income : null;
    const base = income > 0 ? income : spend;

    const discSpend = CATEGORIES.reduce((s, c) => s + (c.discretionary ? (catTotals[c.name] || 0) : 0), 0);
    const discShare = spend > 0 ? discSpend / spend : 0;
    const recurring = Object.values(merchants).filter((s) => s.size >= 2).length;

    // Risk score: higher means riskier.
    let score = 0;
    if (income === 0) score += 3;
    else if (savingsRate < 0) score += 4; // spending above income is High risk on its own
    else if (savingsRate < 0.1) score += 2;
    else if (savingsRate < SAVINGS_GUIDELINE) score += 1;
    if (discShare > 0.4) score += 2;
    else if (discShare > 0.25) score += 1;
    const level = score >= 4 ? "High" : score >= 2 ? "Moderate" : "Low";

    const flags = [];
    const recs = [];
    const questions = [];

    for (const c of CATEGORIES) {
      if (!c.limit) continue;
      const v = catTotals[c.name] || 0;
      const share = base > 0 ? v / base : 0;
      if (share > c.limit) {
        flags.push(`${c.name} is ${pct(share)} of your ${income > 0 ? "income" : "spending"}, above the ${pct(c.limit)} guideline.`);
        recs.push(c.tip);
        questions.push(`What is a realistic monthly limit for ${c.name.toLowerCase()} given my income?`);
      }
    }

    if (income === 0) {
      flags.push("No income credits were found, so savings cannot be measured.");
    } else if (savingsRate < SAVINGS_GUIDELINE) {
      flags.push(`Savings rate is ${pct(savingsRate)}, below the 20% guideline.`);
      recs.unshift("Aim to save at least 20% of income and move that amount on payday, before other spending.");
      questions.push("How many months of expenses should my emergency fund cover, and where should I keep it?");
    }
    if (savingsRate !== null && savingsRate < 0) {
      recs.unshift("Spending is higher than income. Cut the largest discretionary category first and avoid new recurring commitments until the gap closes.");
    }
    if (recurring >= 3) {
      flags.push(`${recurring} payees appear in more than one month, which points to recurring commitments.`);
      recs.push("Review recurring payments for services you no longer use or for duplicate charges.");
    }
    if (!flags.length) {
      recs.push("No spending pattern crossed a guideline. Keep building your emergency fund.");
    }

    questions.push("Would a recurring deposit or SIP suit my savings goal?");
    questions.push("Which fixed bills could I renegotiate or reduce?");

    const categories = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);

    return {
      income,
      spend,
      monthCount,
      savingsRate,
      discShare,
      recurring,
      avgMonthlySpend: spend / monthCount,
      avgMonthlyIncome: income / monthCount,
      level,
      categories,
      flags,
      recs,
      questions: questions.slice(0, 5),
      txns
    };
  }

  const SAMPLE_CSV = `Date,Description,Amount
2026-08-01,SALARY ACME PVT LTD,85000
2026-08-02,RENT TRANSFER LANDLORD,-22000
2026-08-03,SWIGGY ORDER 4412,-640
2026-08-04,NETFLIX SUBSCRIPTION,-649
2026-08-05,BIGBASKET GROCERY,-2150
2026-08-07,ZOMATO ORDER,-820
2026-08-09,AMAZON MARKETPLACE,-3299
2026-08-10,UBER TRIP,-310
2026-08-12,ELECTRICITY BILL TNEB,-1450
2026-08-14,SWIGGY ORDER 4520,-710
2026-08-16,SPOTIFY PREMIUM,-119
2026-08-18,BOOKMYSHOW MOVIE,-900
2026-08-20,ZOMATO ORDER,-905
2026-08-22,PETROL SHELL,-1800
2026-08-25,SWIGGY ORDER 4601,-760
2026-09-01,SALARY ACME PVT LTD,85000
2026-09-02,RENT TRANSFER LANDLORD,-22000
2026-09-03,SWIGGY ORDER 4702,-690
2026-09-04,NETFLIX SUBSCRIPTION,-649
2026-09-06,BIGBASKET GROCERY,-2480
2026-09-08,ZOMATO ORDER,-1050
2026-09-09,AMAZON MARKETPLACE,-9120
2026-09-11,UBER TRIP,-280
2026-09-12,ELECTRICITY BILL TNEB,-1390
2026-09-15,SWIGGY ORDER 4855,-880
2026-09-16,SPOTIFY PREMIUM,-119
2026-09-19,BOOKMYSHOW MOVIE,-1100
2026-09-21,ZOMATO ORDER,-940
2026-09-23,PETROL SHELL,-1750
2026-09-27,SWIGGY ORDER 4920,-710`;

  return {
    CATEGORIES,
    SAVINGS_GUIDELINE,
    SAMPLE_CSV,
    splitCSVLine,
    monthKey,
    parseNum,
    categorise,
    parseStatement,
    analyse
  };
});
