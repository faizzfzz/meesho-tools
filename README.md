# Meesho Tools

A Chrome (Manifest V3) extension covering two marketplaces behind one tabbed popup: **Meesho** (`supplier.meesho.com`) and **Flipkart** (`seller.flipkart.com`). Top-level tabs switch marketplace; the Meesho tab has its own Autofill/Shipping sub-tabs.

- **Meesho › Autofill** — capture form field values from a catalog page into a named profile, then replay them on other products. Supports manual click-to-capture, full-page auto scan, per-profile export/import, and a "Captured Fields" viewer showing exactly what's saved (with inline edit/delete). After running Autofill, any saved field that couldn't be found on the current page is flagged so you can jump straight into capture mode to add it.
- **Meesho › Shipping Optimizer** — generates image variations (background, border, size, emoji/badge overlays) and tests them against Meesho's shipping calculation until one lands inside a target ₹ range.
- **Flipkart › Autofill** — a Flipkart Seller Hub-specific engine (its own profiles storage, so the two marketplaces never mix), built from a live investigation of the real page. It handles two structurally different surfaces:
  - The **"Add a Single Listing" wizard**: tabs actually unmount their content when inactive, so Autofill/Auto Scan switch tabs and fill/scan each one in turn. Every dropdown (single- or multi-select) is a custom component whose closed-state input is a decoy search box, not the real control — Autofill opens each one and drives the real radio/checkbox options directly. The tag/chip input (Brand Color, etc.) needs a real `keydown Enter`, not just `input`/`change` events, to commit a tag. The "Variant addition" tab is gated behind the other tabs being error-free, and Autofill respects that gate instead of trying to force it.
  - The **"Edit Listing" drawer** (editing an existing single/non-variant SKU): one long form, everything mounted at once — this uses the same simple selector-based engine as Meesho's.
  - Not yet verified: a real multi-row variant grid (size/color variants) — no evidence yet either way of a Meesho-style duplicate-id-per-row bug there.

## Install (unpacked)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select this folder
4. Open a `supplier.meesho.com` or `seller.flipkart.com` product page and use the popup

## Structure

- `manifest.json` — MV3 manifest, permissions, content script registration for both marketplaces
- `background.js` — service worker (profile field storage, keyed per marketplace via a `store` field, + shipping variant testing)
- `selector-utils.js` — shared generic selector-capture helper, used by both content scripts
- `autofill-content.js`, `shipping-content.js` — Meesho content scripts
- `flipkart-content.js` — Flipkart content script (generic engine, `FK_`-prefixed messages so it never responds to a Meesho-tab message or vice versa)
- `popup.html`, `styles.css`, `tabs.js` — shared popup shell and nested tab switching (`tabs.js` handles any number of independent `.tab-group` wrappers)
- `popup-autofill.js`, `popup-shipping.js`, `popup-flipkart.js` — per-tool popup logic
