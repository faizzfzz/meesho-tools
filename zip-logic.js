// Minimal ZIP writer (stored entries, no compression) with no dependencies, so the Backup
// page can hand you one .zip of every profile. Profile JSON is small, so compression isn't
// worth pulling in a library. Pure functions - testable in plain node (see the exports guard).

let CRC_TABLE = null;
function crc32(bytes){
  if(!CRC_TABLE){
    CRC_TABLE = new Uint32Array(256);
    for(let n = 0; n < 256; n++){
      let c = n;
      for(let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let crc = 0xFFFFFFFF;
  for(let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// files: [{ name: "meesho/black_lower.json", data: Uint8Array }]
function buildZip(files, date){
  const when = date || new Date();
  const dosTime = ((when.getHours() << 11) | (when.getMinutes() << 5) | (when.getSeconds() >> 1)) & 0xFFFF;
  const dosDate = ((Math.max(when.getFullYear(), 1980) - 1980) << 9 | ((when.getMonth() + 1) << 5) | when.getDate()) & 0xFFFF;
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;

  for(const f of files){
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);        // version needed
    local.setUint16(6, 0x0800, true);    // flags: file names are UTF-8
    local.setUint16(8, 0, true);         // method 0 = stored
    local.setUint16(10, dosTime, true);
    local.setUint16(12, dosDate, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, f.data.length, true);
    local.setUint32(22, f.data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);        // no extra field
    chunks.push(new Uint8Array(local.buffer), name, f.data);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);           // version made by
    cd.setUint16(6, 20, true);           // version needed
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, 0, true);
    cd.setUint16(12, dosTime, true);
    cd.setUint16(14, dosDate, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, f.data.length, true);
    cd.setUint32(24, f.data.length, true);
    cd.setUint16(28, name.length, true);
    cd.setUint16(30, 0, true);           // extra
    cd.setUint16(32, 0, true);           // comment
    cd.setUint16(34, 0, true);           // disk number
    cd.setUint16(36, 0, true);           // internal attrs
    cd.setUint32(38, 0, true);           // external attrs
    cd.setUint32(42, offset, true);      // offset of local header
    central.push(new Uint8Array(cd.buffer), name);

    offset += 30 + name.length + f.data.length;
  }

  const centralSize = central.reduce((n, c) => n + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(4, 0, true);
  end.setUint16(6, 0, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  end.setUint16(20, 0, true);

  const all = chunks.concat(central, [new Uint8Array(end.buffer)]);
  const out = new Uint8Array(all.reduce((n, c) => n + c.length, 0));
  let pos = 0;
  for(const c of all){ out.set(c, pos); pos += c.length; }
  return out;
}

if(typeof module !== "undefined") module.exports = { crc32, buildZip };
