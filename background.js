// ── Autofill: profile field storage (shared by Meesho and Flipkart tools) ───
// `store` selects which top-level storage key holds the profiles - Meesho's
// popup omits it (defaults to "profiles"), Flipkart's popup passes
// "flipkartProfiles", so the two marketplaces never share/clobber profiles.
async function handleSaveField(e){
  try{
    const {profileId,field,store}=e
    const storageKey=store||"profiles"
    if(!profileId||!field) return false

    let data=(await chrome.storage.local.get([storageKey]))[storageKey]||{}

    if(!data[profileId]) return false

    const index=data[profileId].fields.findIndex(
      x=>x.selector===field.selector
    )

    if(index>-1){
      data[profileId].fields[index]=field
    }else{
      data[profileId].fields.push(field)
    }

    await chrome.storage.local.set({[storageKey]:data})

    return true
  }
  catch(e){
    return false
  }
}

chrome.runtime.onMessage.addListener((msg,sender,res)=>{
  if(msg.action==="SAVE_FIELD"){
    handleSaveField(msg.payload).then(r=>{
      res({success:r})
    })
    return true
  }
})

// ── Shipping Optimizer: variant testing ─────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Meesho Optimizer] Extension installed');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openPopup') {
    chrome.action.openPopup();
    return;
  }
  if (request.action === 'testVariant') {
    handleVariantTest(request.tabId, request.dataUrl)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }
});

async function handleVariantTest(tabId, dataUrl) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: async (imgData) => {
        const input = document.querySelector('input[data-testid="changeFrontImage"]') ||
                      document.querySelector('#changeFrontImage');

        if (!input) return { shipping: null, error: 'No input found' };

        const res = await fetch(imgData);
        const blob = await res.blob();
        const file = new File([blob], 'test.jpg', { type: 'image/jpeg' });
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));

        await new Promise(r => setTimeout(r, 4000));

        // Read shipping
        const shippingEl = document.querySelector('[data-mls-applied]');
        const val = shippingEl ? parseInt(shippingEl.getAttribute('data-mls-applied')) : null;

        // Also try text-based
        if (!val) {
          const allEls = document.querySelectorAll('p,span,h4');
          for (const el of allEls) {
            if (el.textContent.includes('Shipping')) {
              const m = el.textContent.match(/₹(\d+)/);
              if (m) return { shipping: parseInt(m[1]) };
            }
          }
        }

        return { shipping: val };
      },
      args: [dataUrl]
    });

    return results[0]?.result || { shipping: null };
  } catch (err) {
    return { error: err.message, shipping: null };
  }
}
