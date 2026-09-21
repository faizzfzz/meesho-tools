// Pure parsing/merge helpers for profile import (no DOM/chrome dependencies, so they
// can be unit-tested with plain node - see the module.exports guard at the bottom).

// A field is identified either by its CSS selector (Meesho, and Flipkart's Edit Listing
// drawer) or by its wizard tab+label (Flipkart's Add a Single Listing wizard). Must stay
// in sync with fieldKey() in background.js.
function fieldKey(field){
  if(field.selector) return "sel::" + field.selector
  if(field.tab !== undefined && field.label !== undefined) return "lbl::" + field.tab + "::" + field.label
  return null
}

function isProfileShape(p){
  return !!p && typeof p === "object" && typeof p.name === "string" && Array.isArray(p.fields)
}

// Accepts a bare {name, fields} object, or a {id: {name, fields}, ...} map (what Export
// writes, and what older all-profiles exports look like). Returns [{name, fields}, ...].
function parseImportText(text){
  const data = JSON.parse(text)
  if(isProfileShape(data)) return [{ name: data.name, fields: data.fields.filter(f => f && typeof f === "object") }]
  if(data && typeof data === "object" && !Array.isArray(data)){
    const values = Object.values(data)
    if(values.length > 0 && values.every(isProfileShape)){
      return values.map(p => ({ name: p.name, fields: p.fields.filter(f => f && typeof f === "object") }))
    }
  }
  throw new Error("Unrecognized file format")
}

// Union merge: a field in `incoming` replaces the existing field with the same key,
// otherwise it's appended. Existing fields not in `incoming` are kept untouched.
function mergeFields(existing, incoming){
  const result = existing.slice()
  const indexByKey = new Map()
  result.forEach((f, i) => {
    const k = fieldKey(f)
    if(k !== null) indexByKey.set(k, i)
  })
  let added = 0, updated = 0
  for(const f of incoming){
    const k = fieldKey(f)
    if(k !== null && indexByKey.has(k)){
      result[indexByKey.get(k)] = f
      updated++
    }else{
      result.push(f)
      if(k !== null) indexByKey.set(k, result.length - 1)
      added++
    }
  }
  return { fields: result, added, updated }
}

if(typeof module !== "undefined") module.exports = { fieldKey, isProfileShape, parseImportText, mergeFields }
