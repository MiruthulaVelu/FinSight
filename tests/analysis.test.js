const test = require("node:test");
const assert = require("node:assert/strict");
const FS = require("../src/js/analysis.js");

test("splitCSVLine handles quoted commas", () => {
  assert.deepEqual(FS.splitCSVLine('a,"b, c",d'), ["a", "b, c", "d"]);
});

test("monthKey supports ISO and day-first dates", () => {
  assert.equal(FS.monthKey("2026-08-01"), "2026-08");
  assert.equal(FS.monthKey("01/09/2026"), "2026-09");
  assert.equal(FS.monthKey("1-9-26"), "2026-09");
});

test("parseNum handles currency, commas and brackets", () => {
  assert.equal(FS.parseNum("₹1,250.50"), 1250.5);
  assert.equal(FS.parseNum("(640)"), -640);
  assert.equal(FS.parseNum(""), 0);
});

test("categorise matches keywords and falls back to Other", () => {
  assert.equal(FS.categorise("SWIGGY ORDER 4412").name, "Food delivery");
  assert.equal(FS.categorise("NETFLIX SUBSCRIPTION").name, "Subscriptions");
  assert.equal(FS.categorise("MYSTERY PAYMENT").name, "Other");
});

test("parseStatement rejects a file without the required columns", () => {
  assert.throws(() => FS.parseStatement("Foo,Bar\n1,2"), /Could not find/);
});

test("parseStatement accepts separate debit and credit columns", () => {
  const txns = FS.parseStatement("Date,Narration,Debit,Credit\n2026-08-01,SALARY,,85000\n2026-08-02,RENT,22000,");
  assert.equal(txns[0].amount, 85000);
  assert.equal(txns[1].amount, -22000);
});

test("sample statement analyses to expected totals", () => {
  const r = FS.analyse(FS.parseStatement(FS.SAMPLE_CSV));
  assert.equal(r.monthCount, 2);
  assert.equal(r.income, 170000);
  assert.ok(r.spend > 0 && r.spend < r.income);
  assert.ok(["Low", "Moderate", "High"].includes(r.level));
});

test("high spending relative to income yields High risk and a spending recommendation", () => {
  const csv = "Date,Description,Amount\n2026-08-01,SALARY,10000\n2026-08-02,RENT,-12000\n2026-08-03,SWIGGY ORDER,-3000";
  const r = FS.analyse(FS.parseStatement(csv));
  assert.equal(r.level, "High");
  assert.ok(r.recs[0].startsWith("Spending is higher than income"));
});

test("savings rate and category flags are computed", () => {
  const csv = "Date,Description,Amount\n2026-08-01,SALARY,100000\n2026-08-02,NETFLIX,-5000";
  const r = FS.analyse(FS.parseStatement(csv));
  assert.equal(Math.round(r.savingsRate * 100), 95);
  assert.ok(r.flags.some((f) => f.startsWith("Subscriptions is")));
});
