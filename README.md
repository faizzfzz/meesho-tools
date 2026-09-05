# Meesho Tools

A Chrome (Manifest V3) extension for `supplier.meesho.com`, combining two tools behind a single tabbed popup:

- **Autofill** — capture form field values from a catalog page into a named profile, then replay them on other products. Supports manual click-to-capture, full-page auto scan, per-profile export/import, and a "Captured Fields" viewer showing exactly what's saved (with inline edit/delete). After running Autofill, any saved field that couldn't be found on the current page is flagged so you can jump straight into capture mode to add it.
- **Shipping Optimizer** — generates image variations (background, border, size, emoji/badge overlays) and tests them against Meesho's shipping calculation until one lands inside a target ₹ range.

## Install (unpacked)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select this folder
4. Open a `supplier.meesho.com` catalog add/edit page and use the popup

## Structure

- `manifest.json` — MV3 manifest, permissions, content script registration
- `background.js` — service worker (profile field storage + shipping variant testing)
- `selector-utils.js`, `autofill-content.js`, `shipping-content.js` — content scripts injected into the Meesho page
- `popup.html`, `styles.css`, `tabs.js` — shared popup shell and tab switching
- `popup-autofill.js`, `popup-shipping.js` — per-tool popup logic
