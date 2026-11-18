# FinSight

FinSight reads a bank statement (CSV export), groups spending into categories, estimates a
budget risk level, flags spending patterns, and suggests budgeting steps and questions to
ask a financial counsellor.

It is a static web app. All processing happens in the browser, so statement data is not
uploaded or stored.

> FinSight is a decision-support tool. It does not replace advice from a qualified financial counsellor.

## Features

- CSV upload or paste (date, description, and amount, or separate debit and credit columns)
- Automatic category assignment with keyword rules
- Savings rate, discretionary share, and monthly averages
- Rule-based budget risk level (Low, Moderate, High)
- Flagged spending patterns, recommendations, and counsellor questions
- Built-in sample statement for demos

## Project structure

```
finsight-project/
├── src/                      Static site (deployed to Azure)
│   ├── index.html
│   ├── styles.css
│   └── js/
│       ├── analysis.js       Parsing and analysis engine (no DOM code, unit tested)
│       └── app.js            Browser UI
├── tests/
│   └── analysis.test.js      Unit tests (Node built-in test runner)
├── .github/workflows/
│   └── azure-static-web-apps.yml   CI (tests) and CD (deploy to Azure)
├── staticwebapp.config.json  Azure routing and security headers
├── package.json
└── README.md
```

## Run locally

Requirements: Node.js 18 or later.

```bash
# Run the unit tests
npm test

# Serve the site at http://localhost:3000
npm start
```

You can also open `src/index.html` directly in a browser.

## Input format

```csv
Date,Description,Amount
2026-08-01,SALARY ACME PVT LTD,85000
2026-08-02,RENT TRANSFER LANDLORD,-22000
2026-08-03,SWIGGY ORDER 4412,-640
```

Dates may be `YYYY-MM-DD` or `DD/MM/YYYY`. Negative amounts are spending. Quoted fields are supported.

## Customising

- **Currency:** change `CURRENCY` in `src/js/app.js`.
- **Categories and guideline limits:** edit `CATEGORIES` in `src/js/analysis.js`.
- **Risk thresholds:** edit the scoring block in `analyse()` in `src/js/analysis.js`.

## Deploy to GitHub Pages

The workflow in `.github/workflows/github-pages.yml` runs the tests and deploys the
contents of `src` whenever changes are pushed to `main`.

1. Push this project to a GitHub repository on the `main` branch.
2. In the repository, open **Settings → Pages** and set the build and deployment
   source to **GitHub Actions**.
3. Open **Actions** and wait for the **Deploy FinSight to GitHub Pages** workflow to
   finish. The published URL appears in the workflow run and under **Settings → Pages**.

## Security notes

- Statements stay in the browser. Nothing is sent over the network.
- `staticwebapp.config.json` sets a Content Security Policy that blocks outbound connections.
- Do not commit real bank statements to the repository. `.gitignore` excludes `.env` files, but not CSVs, so keep statements out of the project folder.

## Limitations

- The risk level comes from fixed rules, not a trained model.
- Guidance is generic and is not personalised financial advice.
- Only CSV input is supported. PDF and image statements are not parsed.
