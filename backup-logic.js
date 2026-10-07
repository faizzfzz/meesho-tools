// Pure helpers for backing up and restoring ALL profiles (no DOM/chrome dependencies, so
// they can be tested with plain node). In a page, import-logic.js must be loaded first for
// mergeFields; in node it's required below.

const BACKUP_DIRS = { profiles: "meesho", flipkartProfiles: "flipkart" };

function backupMergeFields(a, b){
  const fn = typeof mergeFields === "function" ? mergeFields : require("./import-logic.js").mergeFields;
  return fn(a, b);
}

function isBackupProfile(p){
  return !!p && typeof p === "object" && typeof p.name === "string" && Array.isArray(p.fields);
}

function safeFileName(name){
  let s = String(name == null ? "" : name).trim().replace(/[^\w\-.() ]+/g, "_").replace(/\s+/g, "_").replace(/^\.+|\.+$/g, "");
  if(s.length > 80) s = s.slice(0, 80);
  if(!s || /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(s)) s = "profile_" + s;
  return s;
}

// Deterministic output: same data -> same files/paths/bytes, so a re-export only changes
// the files whose profile actually changed (clean git diffs).
// stores: { profiles: {id: profile}, flipkartProfiles: {id: profile} } -> [{ path, text }]
function buildBackupFiles(stores){
  const files = [];
  for(const [key, dir] of Object.entries(BACKUP_DIRS)){
    const profs = (stores && stores[key]) || {};
    const ids = Object.keys(profs).sort((a, b) =>
      String(profs[a].name).localeCompare(String(profs[b].name)) || a.localeCompare(b));
    const used = new Set();
    for(const id of ids){
      let base = safeFileName(profs[id].name);
      if(used.has(base.toLowerCase())) base = base + "__" + safeFileName(id);
      used.add(base.toLowerCase());
      files.push({ path: dir + "/" + base + ".json", text: JSON.stringify({ [id]: profs[id] }, null, 2) + "\n" });
    }
  }
  return files;
}

// Which store a file belongs to, from its path. null = not a profile file.
function classifyBackupPath(path){
  const parts = String(path).replace(/\\/g, "/").split("/").filter(Boolean);
  const base = (parts[parts.length - 1] || "").toLowerCase();
  if(!base.endsWith(".json")) return null;
  const dirs = parts.slice(0, -1).map(s => s.toLowerCase());
  if(dirs.includes(".git") || dirs.includes("node_modules")) return null;
  if(dirs.includes("flipkart") || base.startsWith("flipkart_")) return "flipkartProfiles";
  return "profiles";
}

// -> [{ id, name, fields }]  (id is null for a bare {name, fields} object)
function parseBackupText(text){
  const data = JSON.parse(text);
  const clean = f => Array.isArray(f) ? f.filter(x => x && typeof x === "object") : [];
  if(isBackupProfile(data)) return [{ id: null, name: data.name, fields: clean(data.fields) }];
  if(data && typeof data === "object" && !Array.isArray(data)){
    const entries = Object.entries(data);
    if(entries.length > 0 && entries.every(([, p]) => isBackupProfile(p))){
      return entries.map(([id, p]) => ({ id, name: p.name, fields: clean(p.fields) }));
    }
  }
  throw new Error("Unrecognized file format");
}

// Matches each incoming profile to an existing one BY NAME (preferring one with the same id
// when several share a name), so syncing the same profile twice updates it instead of piling
// up duplicates. The id alone is deliberately NOT trusted: real exports exist where different
// products ("black lower", "Grey lower", "Olive lower") carry the same id, and merging on id
// would mix their values. The cost is that a renamed profile arrives as a new one.
// Returns the new profiles object plus counts; the input is never mutated. mode "merge"
// (default) keeps everything already in the profile and lets the incoming fields win on
// conflicts; "replace" makes the profile exactly match the file.
function planImport(existing, incoming, opts){
  const o = opts || {};
  const replace = o.mode === "replace";
  const idPrefix = o.idPrefix || "profile_";
  const result = JSON.parse(JSON.stringify(existing || {}));
  const summary = { added: 0, merged: 0, replaced: 0, unchanged: 0 };
  let counter = 0;

  for(const inc of incoming){
    const want = String(inc.name).trim().toLowerCase();
    const sameName = Object.keys(result).filter(id => String(result[id].name).trim().toLowerCase() === want);
    const target = (inc.id && sameName.includes(inc.id)) ? inc.id : (sameName[0] || null);

    if(!target){
      let id = inc.id && !result[inc.id] ? inc.id : null;
      while(!id || result[id]) id = idPrefix + Date.now() + "_" + (counter++);
      result[id] = { name: inc.name, fields: inc.fields };
      summary.added++;
      continue;
    }

    const before = JSON.stringify([result[target].name, result[target].fields]);
    if(replace){
      result[target].fields = inc.fields;
      result[target].name = inc.name;
    }else{
      result[target].fields = backupMergeFields(result[target].fields, inc.fields).fields;
    }
    if(JSON.stringify([result[target].name, result[target].fields]) === before) summary.unchanged++;
    else if(replace) summary.replaced++;
    else summary.merged++;
  }

  return { result, summary };
}

if(typeof module !== "undefined") module.exports = { BACKUP_DIRS, safeFileName, buildBackupFiles, classifyBackupPath, parseBackupText, planImport };
