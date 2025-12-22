// CRC-8 with poly 0x07, init 0x00, no reflection, no final xor
function crc8_poly07(bytes) {
  let crc = 0x00;
  const poly = 0x07;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let b = 0; b < 8; b++) {
      crc = (crc & 0x80) ? ((crc << 1) ^ poly) & 0xff : (crc << 1) & 0xff;
    }
  }
  return crc & 0xff;
}

// Parse helpers: accept spaces and commas
function tokenize(text) {
  return text.replace(/,/g, " ").trim().split(/\s+/).filter(Boolean);
}

// Decimal → bytes
function parseDec(text) {
  const tokens = tokenize(text);
  const out = [];
  for (const t of tokens) {
    if (!/^[0-9]{1,3}$/.test(t)) return null;
    const n = parseInt(t, 10);
    if (n < 0 || n > 255 || Number.isNaN(n)) return null;
    out.push(n);
  }
  return new Uint8Array(out);
}

// Hex → bytes (supports 0xFF or FF)
function parseHex(text) {
  const tokens = tokenize(text.toUpperCase());
  const out = [];
  for (let t of tokens) {
    if (t.startsWith("0X")) t = t.slice(2);
    if (!/^[0-9A-F]{1,2}$/.test(t)) return null;
    out.push(parseInt(t, 16));
  }
  return new Uint8Array(out);
}

// Binary → bytes (supports 0b and plain)
function parseBin(text) {
  const tokens = tokenize(text.toLowerCase());
  const out = [];
  for (let t of tokens) {
    if (t.startsWith("0b")) t = t.slice(2);
    if (!/^[01]{1,8}$/.test(t)) return null;
    out.push(parseInt(t, 2) & 0xff);
  }
  return new Uint8Array(out);
}

// ASCII → bytes
function parseAscii(text) {
  const out = [];
  for (let i = 0; i < text.length; i++) {
    out.push(text.charCodeAt(i) & 0xff);
  }
  return new Uint8Array(out);
}

// Format helpers
function fmtDec(bytes) {
  return Array.from(bytes).map(b => b.toString(10)).join(" ");
}

function fmtHex(bytes) {
  return Array.from(bytes)
    .map(b => b.toString(16).toUpperCase().padStart(2, "0"))
    .join(" ");
}

function fmtBin(bytes) {
  return Array.from(bytes)
    .map(b => b.toString(2).padStart(8, "0"))
    .join(" ");
}

function fmtAscii(bytes) {
  return Array.from(bytes)
    .map(b => (b >= 32 && b <= 126 ? String.fromCharCode(b) : "."))
    .join("");
}

/* ========== Advanced views ========== */

// build LE and BE 16/32-bit from bytes
function buildUnsignedViews(bytes) {
  const u8 = Array.from(bytes).map(b => b.toString(10)).join(" ");

  let u16 = "";
  if (bytes.length >= 2) {
    const pairs = [];
    for (let i = 0; i + 1 < bytes.length; i += 2) {
      const b0 = bytes[i];
      const b1 = bytes[i + 1];
      const le = (b1 << 8) | b0;
      const be = (b0 << 8) | b1;
      pairs.push(`[${i}/${i + 1}] LE:${le} BE:${be}`);
    }
    u16 = pairs.join("\n");
  }

  let u32 = "";
  if (bytes.length >= 4) {
    const quads = [];
    for (let i = 0; i + 3 < bytes.length; i += 4) {
      const b0 = bytes[i];
      const b1 = bytes[i + 1];
      const b2 = bytes[i + 2];
      const b3 = bytes[i + 3];
      const le = (b3 << 24) | (b2 << 16) | (b1 << 8) | b0;
      const be = (b0 << 24) | (b1 << 16) | (b2 << 8) | b3;
      quads.push(`[#${i}..${i + 3}] LE:${le >>> 0} BE:${be >>> 0}`);
    }
    u32 = quads.join("\n");
  }

  return { u8, u16, u32 };
}

function toSigned8(b) {
  return b & 0x80 ? b - 0x100 : b;
}

function toSigned16(n) {
  return n & 0x8000 ? n - 0x10000 : n;
}

function toSigned32(n) {
  n = n >>> 0;
  return n & 0x80000000 ? n - 0x100000000 : n;
}

function buildSignedViews(bytes) {
  const s8 = Array.from(bytes)
    .map(b => toSigned8(b))
    .join(" ");

  let s16 = "";
  if (bytes.length >= 2) {
    const pairs = [];
    for (let i = 0; i + 1 < bytes.length; i += 2) {
      const b0 = bytes[i];
      const b1 = bytes[i + 1];
      const le = toSigned16((b1 << 8) | b0);
      const be = toSigned16((b0 << 8) | b1);
      pairs.push(`[${i}/${i + 1}] LE:${le} BE:${be}`);
    }
    s16 = pairs.join("\n");
  }

  let s32 = "";
  if (bytes.length >= 4) {
    const quads = [];
    for (let i = 0; i + 3 < bytes.length; i += 4) {
      const b0 = bytes[i];
      const b1 = bytes[i + 1];
      const b2 = bytes[i + 2];
      const b3 = bytes[i + 3];
      const le = toSigned32(
        (b3 << 24) | (b2 << 16) | (b1 << 8) | b0
      );
      const be = toSigned32(
        (b0 << 24) | (b1 << 16) | (b2 << 8) | b3
      );
      quads.push(`[#${i}..${i + 3}] LE:${le} BE:${be}`);
    }
    s32 = quads.join("\n");
  }

  return { s8, s16, s32 };
}

function buildBitView(bytes) {
  if (!bytes.length) return "";
  return Array.from(bytes)
    .map((b, i) => {
      const bits = b.toString(2).padStart(8, "0");
      return `Byte ${i}: ${bits}  (7..0)`;
    })
    .join("\n");
}

function buildCArray(bytes) {
  if (!bytes.length) return "uint8_t data[] = { };";
  const hexList = Array.from(bytes)
    .map(b => "0x" + b.toString(16).toUpperCase().padStart(2, "0"))
    .join(", ");
  return `uint8_t data[] = { ${hexList} };`;
}

/* ========== Wiring ========== */

window.addEventListener("DOMContentLoaded", () => {
  const decArea = document.getElementById("decArea");
  const hexArea = document.getElementById("hexArea");
  const binArea = document.getElementById("binArea");
  const asciiArea = document.getElementById("asciiArea");
  const crcArea = document.getElementById("crcArea");

  const uView = document.getElementById("uView");
  const sView = document.getElementById("sView");
  const bitView = document.getElementById("bitView");
  const cArrayView = document.getElementById("cArrayView");
  const copyCArrayBtn = document.getElementById("copyCArray");

  function setAll(bytes) {
    decArea.value = fmtDec(bytes);
    hexArea.value = fmtHex(bytes);
    binArea.value = fmtBin(bytes);
    asciiArea.value = fmtAscii(bytes);
    const crc = crc8_poly07(bytes);
    crcArea.value = bytes.length ? String(crc) : "";

    // Advanced views
    const u = buildUnsignedViews(bytes);
    const s = buildSignedViews(bytes);

    uView.textContent =
      `uint8_t:\n${u.u8 || "-"}\n\n` +
      `uint16_t (LE/BE pairs):\n${u.u16 || "-"}\n\n` +
      `uint32_t (LE/BE groups):\n${u.u32 || "-"}`;

    sView.textContent =
      `int8_t:\n${s.s8 || "-"}\n\n` +
      `int16_t (LE/BE pairs):\n${s.s16 || "-"}\n\n` +
      `int32_t (LE/BE groups):\n${s.s32 || "-"}`;

    bitView.textContent = buildBitView(bytes) || "-";
    cArrayView.textContent = buildCArray(bytes);
  }

  function clearErrors() {
    [decArea, hexArea, binArea, asciiArea].forEach(t =>
      t.classList.remove("error")
    );
  }

  function handle(source) {
    clearErrors();
    let bytes = null;

    if (source === "dec") bytes = parseDec(decArea.value);
    else if (source === "hex") bytes = parseHex(hexArea.value);
    else if (source === "bin") bytes = parseBin(binArea.value);
    else if (source === "ascii") bytes = parseAscii(asciiArea.value);

    const area =
      source === "dec"
        ? decArea
        : source === "hex"
        ? hexArea
        : source === "bin"
        ? binArea
        : asciiArea;

    if (!bytes || bytes.length === 0) {
      area.classList.add("error");
      return;
    }

    setAll(bytes);
  }

  document.getElementById("decConvert").onclick = () => handle("dec");
  document.getElementById("hexConvert").onclick = () => handle("hex");
  document.getElementById("binConvert").onclick = () => handle("bin");
  document.getElementById("asciiConvert").onclick = () => handle("ascii");

  document.getElementById("clearAll").onclick = () => {
    clearErrors();
    [decArea, hexArea, binArea, asciiArea, crcArea].forEach(
      t => (t.value = "")
    );
    uView.textContent = "";
    sView.textContent = "";
    bitView.textContent = "";
    cArrayView.textContent = "uint8_t data[] = { };";
  };

  document.getElementById("copyAll").onclick = () => {
    const text =
      "DEC:\n" +
      decArea.value +
      "\n\nHEX:\n" +
      hexArea.value +
      "\n\nBIN:\n" +
      binArea.value +
      "\n\nASCII:\n" +
      asciiArea.value +
      "\n\nCRC-8 (dec): " +
      crcArea.value;
    navigator.clipboard.writeText(text);
    const btn = document.getElementById("copyAll");
    const old = btn.textContent;
    btn.textContent = "✅ Copied";
    setTimeout(() => (btn.textContent = old), 1200);
  };

  copyCArrayBtn.onclick = () => {
    const txt = cArrayView.textContent || "";
    if (!txt.trim()) return;
    navigator.clipboard.writeText(txt).then(() => {
      const old = copyCArrayBtn.textContent;
      copyCArrayBtn.textContent = "✅ Copied";
      setTimeout(() => (copyCArrayBtn.textContent = old), 1200);
    });
  };
});
