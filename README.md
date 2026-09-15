# Meesho Tools

A Chrome (Manifest V3) extension covering two marketplaces behind one tabbed popup: **Meesho** (`supplier.meesho.com`) and **Flipkart** (`seller.flipkart.com`). Top-level tabs switch marketplace; the Meesho tab has its own Autofill/Shipping sub-tabs.

- **Meesho › Autofill** — capture form field values from a catalog page into a named profile, then replay them on other products. Supports manual click-to-capture, full-page auto scan, per-profile export/import, and a "Captured Fields" viewer showing exactly what's saved (with inline edit/delete). After running Autofill, any saved field that couldn't be found on the current page is flagged so you can jump straight into capture mode to add it.
- **Meesho › Shipping Optimizer** — generates image variations (background, border, size, emoji/badge overlays) and tests them against Meesho's shipping calculation until one lands inside a target ₹ range.
- **Flipkart › Autofill** — the same capture/auto-scan/autofill engine as Meesho's, retargeted to `seller.flipkart.com`, with its own profiles storage so the two marketplaces never mix. This has not been verified live against Flipkart Seller Hub's real page markup yet: plain text/number inputs and native `<select>` elements should just work, but Meesho-specific bits (duplicate per-size-variant ids, the MUI dropdown-popup handling) were deliberately left out rather than guessed. If a field doesn't autofill correctly, report what happened and it'll get fixed the same way Meesho's price-field bug was — by reproducing it live on the real page first.

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
