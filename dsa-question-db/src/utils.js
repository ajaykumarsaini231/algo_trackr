// Small shared helpers: HTTP-with-retry, file IO, CSV.
import fs from "node:fs";
import path from "node:path";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const round2 = (n) => (n == null ? null : Math.round(n * 100) / 100);

export function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}

// Fetch + parse JSON with retry/backoff on 429/5xx/network errors.
export async function fetchJson(url, opts = {}, { retries = 4, delay = 700 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, opts);
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(`Non-JSON response (HTTP ${res.status}): ${text.slice(0, 160)}`);
      }
      return { res, json };
    } catch (e) {
      lastErr = e;
      if (i < retries) await sleep(delay * (i + 1));
    }
  }
  throw lastErr;
}

export function writeJson(file, data, pretty = true) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data));
}

export function writeNdjson(file, arr) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, arr.map((o) => JSON.stringify(o)).join("\n") + "\n");
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function exists(file) {
  return fs.existsSync(file);
}

export function toCsv(rows, columns) {
  const esc = (v) => {
    if (v == null) return "";
    let s = Array.isArray(v) ? v.join("|") : String(v);
    if (/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  return (
    columns.join(",") +
    "\n" +
    rows.map((r) => columns.map((c) => esc(r[c])).join(",")).join("\n") +
    "\n"
  );
}
