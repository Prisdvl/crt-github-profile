import fs from "fs/promises";
import path from "path";
import { DOMParser } from "@xmldom/xmldom";
import { THEME } from "./theme.mjs";

/** @deprecated prefer THEME — kept for older generators */
export const COLORS = {
  bg: THEME.bg,
  surface: THEME.surface,
  border: THEME.border,
  text: THEME.text,
  muted: THEME.muted,
  accent: THEME.accent,
};

export function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function assertParseableSvg(xml) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (!doc?.documentElement) throw new Error("SVG parse failed: missing documentElement");
  const pe = doc.getElementsByTagName("parsererror");
  if (pe && pe.length > 0) throw new Error("SVG parse failed: parsererror");
  if (doc.documentElement.nodeName.toLowerCase() !== "svg") {
    throw new Error(`SVG parse failed: root is ${doc.documentElement.nodeName}`);
  }
  return doc;
}

/** Atomic write: tmp -> validate -> rename. Keeps previous output on failure. */
export async function writeSvgAtomic(outPath, xml) {
  assertParseableSvg(xml);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  const tmp = `${outPath}.tmp`;
  await fs.writeFile(tmp, xml, "utf8");
  try {
    const raw = await fs.readFile(tmp, "utf8");
    assertParseableSvg(raw);
    await fs.rename(tmp, outPath);
  } catch (err) {
    try {
      await fs.unlink(tmp);
    } catch {
      /* ignore */
    }
    throw err;
  }
}

export async function fetchText(url, { token, headers = {} } = {}) {
  const h = {
    "User-Agent": "crt-github-profile-generator",
    Accept: "text/html,application/json",
    ...headers,
  };
  const auth = token || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (auth) h.Authorization = `Bearer ${auth}`;
  const res = await fetch(url, { headers: h });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

export async function fetchJson(url, opts = {}) {
  const text = await fetchText(url, {
    ...opts,
    headers: { Accept: "application/vnd.github+json", ...(opts.headers || {}) },
  });
  return JSON.parse(text);
}
