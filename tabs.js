document.addEventListener("DOMContentLoaded", () => {
  const tabButtons = document.querySelectorAll(".tab-btn")
  const panels = {
    autofill: document.getElementById("panel-autofill"),
    shipping: document.getElementById("panel-shipping")
  }

  function activateTab(name){
    if(!panels[name]) return
    tabButtons.forEach(b => b.classList.toggle("active", b.dataset.tab === name))
    Object.entries(panels).forEach(([key, el]) => el.classList.toggle("active", key === name))
  }

  const hasStorage = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local

  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      activateTab(btn.dataset.tab)
      if(hasStorage) chrome.storage.local.set({ activeMeeshoTab: btn.dataset.tab })
    })
  })

  if(hasStorage){
    chrome.storage.local.get(["activeMeeshoTab"], (data) => {
      if(data && data.activeMeeshoTab) activateTab(data.activeMeeshoTab)
    })
  }
})
