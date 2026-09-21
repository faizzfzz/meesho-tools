// Import page. Chrome closes an extension popup the moment a native file picker opens
// (the popup loses focus), so the popup's own <input type="file"> change handler never
// ran. This page is opened in a full tab instead, where the picker works normally.
//
// Query params: store=profiles|flipkartProfiles, profile=<id of the profile selected in
// the popup, optional>.
document.addEventListener("DOMContentLoaded", async () => {

const params = new URLSearchParams(window.location.search)
const store = params.get("store") === "flipkartProfiles" ? "flipkartProfiles" : "profiles"
const preselected = params.get("profile") || ""
const idPrefix = store === "flipkartProfiles" ? "fkprofile_" : "profile_"
const marketplace = store === "flipkartProfiles" ? "Flipkart" : "Meesho"

document.getElementById("importTitle").textContent = "Import " + marketplace + " profile"

const btnChoose = document.getElementById("btnChoose")
const importFile = document.getElementById("importFile")
const fileNameEl = document.getElementById("fileName")
const targetSection = document.getElementById("targetSection")
const targetSelect = document.getElementById("targetSelect")
const targetHint = document.getElementById("targetHint")
const btnDoImport = document.getElementById("btnDoImport")
const statusEl = document.getElementById("importStatus")

let parsed = null

function showStatus(message, type){
statusEl.textContent = message
statusEl.className = "status-msg visible" + (type ? " " + type : "")
}

async function loadStore(){
const data = await chrome.storage.local.get([store])
return data[store] || {}
}

btnChoose.onclick = () => importFile.click()

importFile.addEventListener("change", async (e) => {

const file = e.target.files[0]
e.target.value = ""

if(!file) return

parsed = null
btnDoImport.disabled = true
targetSection.hidden = true
statusEl.className = "status-msg"

fileNameEl.textContent = file.name

try{

parsed = parseImportText(await file.text())

}catch{

fileNameEl.textContent = file.name + " - not a valid profile file."
showStatus("Invalid file: expected a profile exported from this tool.", "error")
return

}

const profiles = await loadStore()

if(parsed.length === 1){

const p = parsed[0]
fileNameEl.textContent = file.name + " - \"" + p.name + "\", " + p.fields.length + " field(s)"

targetSelect.innerHTML = ""

Object.keys(profiles).forEach(id => {
const opt = document.createElement("option")
opt.value = id
opt.textContent = profiles[id].name + " (" + profiles[id].fields.length + " fields)"
targetSelect.appendChild(opt)
})

const newOpt = document.createElement("option")
newOpt.value = "__new__"
newOpt.textContent = "New profile (\"" + p.name + "\")"
targetSelect.appendChild(newOpt)

targetSelect.value = profiles[preselected] ? preselected : "__new__"

targetHint.textContent = "Importing into an existing profile merges: fields in the file replace matching ones, everything else already in the profile is kept."
targetSection.hidden = false

}else{

fileNameEl.textContent = file.name + " - " + parsed.length + " profiles"
targetHint.textContent = ""

}

btnDoImport.disabled = false

})

btnDoImport.onclick = async () => {

if(!parsed) return

btnDoImport.disabled = true

try{

const profiles = await loadStore()
let message

if(parsed.length === 1){

const p = parsed[0]
const target = targetSelect.value

if(target === "__new__" || !profiles[target]){
const id = idPrefix + Date.now()
profiles[id] = { name: p.name, fields: p.fields }
message = "Added new profile \"" + p.name + "\" with " + p.fields.length + " field(s)."
}else{
const merged = mergeFields(profiles[target].fields, p.fields)
profiles[target].fields = merged.fields
message = "Merged into \"" + profiles[target].name + "\": " + merged.added + " added, " + merged.updated + " updated (" + merged.fields.length + " total)."
}

}else{

parsed.forEach((p, i) => {
profiles[idPrefix + Date.now() + "_" + i] = { name: p.name, fields: p.fields }
})
message = "Added " + parsed.length + " profiles."

}

await chrome.storage.local.set({ [store]: profiles })

showStatus(message + " Reopen the extension popup to see it.", "success")
parsed = null
fileNameEl.textContent = "No file chosen."
targetSection.hidden = true

}catch(err){

showStatus("Import failed: " + err.message, "error")
btnDoImport.disabled = false

}

}

})
