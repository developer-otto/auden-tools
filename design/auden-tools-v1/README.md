# Auden Tools · UI proposal v1

An isolated, responsive UI prototype for reviewing the product direction.

## Preview

From the repository root:

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Open `http://127.0.0.1:4173/design/auden-tools-v1/`.

The prototype can also be opened directly from `index.html`. The local server provides the best preview, including font loading and clipboard support.

## Screens

- Home / tool directory
- World clocks and meeting time comparison: 24 cities, searchable regional picker, multiple selections
- Currency conversion: 24 common currencies with country/region flags, searchable base and target currency pickers, multi-select and show-all; rates and chart are illustrative and explicitly labeled
- Timestamp conversion: 24 city time zones plus UTC, with both conversion directions and explicit handling of DST gaps and overlaps
- Date calculations
- Unit conversion
- Text tools
- JSON tools

## Review interactions

Navigation, search (⌘/Ctrl K), category filters, favorites, recently used tools, theme switch, city selection, and basic tool interactions are available. The layout adapts to mobile screens. Currency data is a design fixture, not a live rate feed. No product APIs or production application files are modified.

Selected cities and target currencies are remembered locally. Currency coverage includes CNY, USD, EUR, JPY, GBP, HKD, KRW, SGD, AUD, CAD, CHF, NZD, THB, MYR, IDR, VND, INR, AED, SAR, SEK, NOK, ZAR, BRL, and MXN.

## Languages

The top-right language selector supports 简体中文, 繁體中文, English, 日本語, and 한국어. The choice is saved locally and applies to navigation, all tool screens, catalog names, help text, validation messages, accessible labels, dates, and number formatting. Search accepts names in all five languages alongside currency codes and IANA time-zone identifiers.

Switching languages preserves editable values, selected currencies/cities, and the active tool. User text and JSON are never translated. `i18n.js` contains the shared message catalog and interpolation helpers; no translation API or additional dependency is required.

## Precision

Currency amounts, sample rates, and unit factors are parsed from decimal strings. `decimal-utils.js` uses BigInt rational arithmetic, so intermediate calculations retain precision even for repeating fractions. Currency results round half up to the currency's standard decimal places; copied amounts use the same rounded value. Unit results round only for display, to at most eight decimal places. No arithmetic on money uses binary floating point. Input length and exponents are bounded.

Timestamp calculations use integer milliseconds and reject unsafe integers or dates outside the supported range. Local-time conversion explicitly handles skipped and repeated times caused by daylight saving changes.

JSON formatting/minification validates syntax and works on the original tokens, preserving large integers, long decimals, exponents, negative zero, and duplicate keys. It never serializes a parsed JavaScript number back into the user's JSON.

Run the numeric regression checks from the repository root:

```bash
node --test design/auden-tools-v1/precision.test.cjs
```

## Visual direction

Warm neutral surfaces, forest green emphasis, fine borders, compact line icons, generous whitespace, Geist numerals and system Chinese typography. The home page prioritizes recognizable tools and small useful previews; tool pages use a consistent input/result/help layout.
