
document.addEventListener("DOMContentLoaded", async () => {

const profileSelect = document.getElementById("profileSelect")

const btnNew = document.getElementById("btnNewProfile")
const btnEdit = document.getElementById("btnEditProfile")
const btnDelete = document.getElementById("btnDeleteProfile")

const btnCapture = document.getElementById("btnCapture")
const btnAutoScan = document.getElementById("btnAutoScan")
const btnAutofill = document.getElementById("btnAutofill")

const btnExport = document.getElementById("btnExport")
const btnImport = document.getElementById("btnImport")
const importFile = document.getElementById("importFile")

const fieldsCountEl = document.getElementById("fieldsCount")
const btnToggleFields = document.getElementById("btnToggleFields")
const fieldsListEl = document.getElementById("fieldsList")
const notFoundBanner = document.getElementById("notFoundBanner")
const notFoundListEl = document.getElementById("notFoundList")
const btnCaptureMissing = document.getElementById("btnCaptureMissing")

let profiles = {}

/* LOAD PROFILES */

async function loadProfiles(){

const data = await chrome.storage.local.get(["profiles"])

profiles = data.profiles || {}

profileSelect.innerHTML = '<option value="" disabled>-- Choose --</option>'

let lastId = null

Object.keys(profiles).forEach(id => {

const opt = document.createElement("option")

opt.value = id
opt.textContent = profiles[id].name

profileSelect.appendChild(opt)

lastId = id

})

if(lastId){
profileSelect.value = lastId
}

renderFieldsList()
renderNotFoundReport()

}

/* CAPTURED FIELDS VIEW */

function labelForField(field){
const selector = field.selector || ""
const m = selector.match(/id=["']([^"']+)["']/) || selector.match(/#([a-zA-Z0-9_-]+)/)
if(m) return m[1]
if(selector.startsWith("SIZE:")){
const sm = selector.match(/^SIZE:(.+?)::/)
if(sm) return `Size "${sm[1]}"`
}
return selector.length > 36 ? selector.slice(0,33) + "..." : selector
}

function renderFieldsList(){

const id = profileSelect.value
const data = profiles[id]
const fields = (data && data.fields) || []

fieldsCountEl.textContent = fields.length
fieldsListEl.innerHTML = ""

if(fields.length === 0){
const empty = document.createElement("div")
empty.className = "fields-empty"
empty.textContent = "No fields captured yet"
fieldsListEl.appendChild(empty)
return
}

fields.forEach((field, index) => {

const row = document.createElement("div")
row.className = "field-row"

const main = document.createElement("div")
main.className = "field-main"

const typeEl = document.createElement("div")
typeEl.className = "field-type"
typeEl.textContent = labelForField(field)

const valueEl = document.createElement("div")
valueEl.className = "field-value"
valueEl.textContent = field.value
valueEl.title = "Click to edit"
valueEl.onclick = () => editFieldValue(id, index, valueEl)

main.appendChild(typeEl)
main.appendChild(valueEl)

const delBtn = document.createElement("button")
delBtn.className = "field-del"
delBtn.textContent = "×"
delBtn.title = "Delete field"
delBtn.onclick = async () => {
if(!confirm("Remove this field from the profile?")) return
profiles[id].fields.splice(index, 1)
await saveProfiles()
renderFieldsList()
}

row.appendChild(main)
row.appendChild(delBtn)
fieldsListEl.appendChild(row)

})

}

function editFieldValue(id, index, valueEl){

const field = profiles[id].fields[index]

const input = document.createElement("input")
input.className = "field-value-input"
input.value = field.value

valueEl.replaceWith(input)
input.focus()
input.select()

let committed = false

const commit = async () => {
if(committed) return
committed = true
profiles[id].fields[index].value = input.value
await saveProfiles()
renderFieldsList()
}

input.addEventListener("keydown", (e) => {
if(e.key === "Enter") input.blur()
})

input.addEventListener("blur", commit)

}

async function renderNotFoundReport(){

const id = profileSelect.value

if(!id){
notFoundBanner.hidden = true
return
}

const key = "autofillReport_" + id
const data = await chrome.storage.local.get([key])
const report = data[key]

if(!report || !report.notFound || report.notFound.length === 0){
notFoundBanner.hidden = true
return
}

notFoundListEl.innerHTML = ""
report.notFound.forEach(field => {
const row = document.createElement("div")
row.textContent = "• " + labelForField(field) + " (" + field.value + ")"
notFoundListEl.appendChild(row)
})

notFoundBanner.hidden = false

}

async function startCaptureForProfile(id){

if(!id){
alert("Select profile first")
return
}

const [tab] = await chrome.tabs.query({
active:true,
currentWindow:true
})

const startCapture=()=>{
chrome.tabs.sendMessage(tab.id,{
action:"START_CAPTURE",
profileId:id
},()=>{
if(chrome.runtime.lastError){
chrome.scripting.executeScript({target:{tabId:tab.id},files:["selector-utils.js","autofill-content.js"]}).then(()=>{
chrome.tabs.sendMessage(tab.id,{action:"START_CAPTURE",profileId:id})
window.close()
}).catch(()=>alert("Capture Fields could not start on this page"))
}else{
window.close()
}
})
}
chrome.tabs.sendMessage(tab.id,{action:"PING"},response=>{
if(chrome.runtime.lastError||!response||!response.ready){
chrome.scripting.executeScript({target:{tabId:tab.id},files:["selector-utils.js","autofill-content.js"]}).then(startCapture).catch(()=>alert("Capture Fields could not start on this page"))
}else startCapture()
})

}

profileSelect.addEventListener("change", () => {
renderFieldsList()
renderNotFoundReport()
})

btnToggleFields.onclick = () => {
const showing = !fieldsListEl.hidden
fieldsListEl.hidden = showing
btnToggleFields.textContent = showing ? "View" : "Hide"
}

btnCaptureMissing.onclick = () => startCaptureForProfile(profileSelect.value)

chrome.storage.onChanged.addListener((changes, area) => {
if(area !== "local") return
if(changes.profiles){
profiles = changes.profiles.newValue || {}
renderFieldsList()
}
const reportKey = "autofillReport_" + profileSelect.value
if(changes[reportKey]) renderNotFoundReport()
})

/* SAVE PROFILES */

async function saveProfiles(){

await chrome.storage.local.set({profiles})

}

/* CREATE PROFILE */

btnNew.onclick = async () => {

const name = prompt("Enter profile name")

if(!name) return

const id = "profile_" + Date.now()

profiles[id] = {
name:name,
fields:[]
}

await saveProfiles()

await loadProfiles()

profileSelect.value = id

}

/* DELETE PROFILE */

btnDelete.onclick = async () => {

const id = profileSelect.value

if(!id) return

if(!confirm("Delete this profile?")) return

delete profiles[id]

await saveProfiles()

loadProfiles()

}

/* RENAME PROFILE */

btnEdit.onclick = async () => {

const id = profileSelect.value

if(!id) return

const newName = prompt("New name", profiles[id].name)

if(!newName) return

profiles[id].name = newName

await saveProfiles()

loadProfiles()

}

/* START CAPTURE */

btnCapture.onclick = () => startCaptureForProfile(profileSelect.value)

/* AUTO SCAN */

btnAutoScan.onclick = async () => {

const id = profileSelect.value

if(!id){
alert("Select profile first")
return
}

const [tab] = await chrome.tabs.query({
active:true,
currentWindow:true
})

const startScan=()=>{
chrome.tabs.sendMessage(tab.id,{
action:"START_AUTOSCAN",
profileId:id
},()=>{
if(chrome.runtime.lastError){
chrome.scripting.executeScript({target:{tabId:tab.id},files:["selector-utils.js","autofill-content.js"]}).then(()=>{
chrome.tabs.sendMessage(tab.id,{action:"START_AUTOSCAN",profileId:id})
window.close()
}).catch(()=>alert("Auto Scan could not start on this page"))
}else{
window.close()
}
})
}
chrome.tabs.sendMessage(tab.id,{action:"PING"},response=>{
if(chrome.runtime.lastError||!response||!response.ready){
chrome.scripting.executeScript({target:{tabId:tab.id},files:["selector-utils.js","autofill-content.js"]}).then(startScan).catch(()=>alert("Auto Scan could not start on this page"))
}else startScan()
})

}

/* AUTOFILL */

btnAutofill.onclick = async () => {

const id = profileSelect.value

if(!id){
alert("Select profile first")
return
}

const data = profiles[id]

if(!data || data.fields.length === 0){
alert("No fields saved in this profile")
return
}

const [tab] = await chrome.tabs.query({
active:true,
currentWindow:true
})

chrome.tabs.sendMessage(tab.id,{
action:"AUTOFILL",
data:data,
profileId:id
})

notFoundBanner.hidden = true

}

/* EXPORT */

btnExport.onclick = () => {

if(Object.keys(profiles).length === 0){
alert("No profiles to export")
return
}

const data = JSON.stringify(profiles,null,2)

const blob = new Blob([data],{type:"application/json"})

const url = URL.createObjectURL(blob)

const a = document.createElement("a")

a.href = url
a.download = "meesho_autofill_profiles_" + Date.now() + ".json"

document.body.appendChild(a)

a.click()

document.body.removeChild(a)

URL.revokeObjectURL(url)

}

/* IMPORT */

btnImport.onclick = () => {

importFile.click()

}

importFile.addEventListener("change", (e)=>{

const file = e.target.files[0]

if(!file) return

const reader = new FileReader()

reader.onload = async (event)=>{

try{

const imported = JSON.parse(event.target.result)

Object.assign(profiles, imported)

await chrome.storage.local.set({profiles})

alert("Profiles imported successfully")

loadProfiles()

}catch{

alert("Invalid file")

}

}

reader.readAsText(file)

})

loadProfiles()

})
