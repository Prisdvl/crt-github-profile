#!/usr/bin/env node
/**
 * scripts/enhance-crt.mjs
 *
 * Structural post-processor for svg-terminal-generated SVGs.
 * Uses @xmldom/xmldom DOMParser + XMLSerializer.
 *
 * Usage:
 *   node scripts/enhance-crt.mjs <input.svg> <output.svg> --linespace <int> --line-opacity <0..1> --glow <float> --vignette <0..1> [--static]
 *
 * Behavior:
 *  - Parse input as XML. If parse errors -> exit code 1.
 *  - Modify pattern#scanlines height & inner rect opacity.
 *  - Modify filter#textGlow feGaussianBlur stdDeviation (multiplies existing).
 *  - Modify radialGradient#vignette last stop stop-opacity.
 *  - In --static mode remove scanline-overlay class from overlay rects and validate.
 *  - Write to tmp file and re-parse for validation; on success rename tmp->output.
 *  - On failure, exit 1 and do not overwrite original.
 */
import fs from "fs/promises";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

function usageAndExit(msg) {
  if (msg) console.error(msg);
  console.error("Usage: node scripts/enhance-crt.mjs <input.svg> <output.svg> --linespace <int> --line-opacity <0..1> --glow <float> --vignette <0..1> [--static]");
  process.exit(2);
}

function parseArgs(argv) {
  if (argv.length < 2) usageAndExit("not enough args");
  const res = { input: argv[0], output: argv[1], linespace: undefined, lineOpacity: undefined, glow: undefined, vignette: undefined, isStatic: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--linespace") res.linespace = parseInt(argv[++i], 10);
    else if (a === "--line-opacity") res.lineOpacity = parseFloat(argv[++i]);
    else if (a === "--glow") res.glow = parseFloat(argv[++i]);
    else if (a === "--vignette") res.vignette = parseFloat(argv[++i]);
    else if (a === "--static") res.isStatic = true;
    else usageAndExit("unknown arg: " + a);
  }
  if (!Number.isInteger(res.linespace) || res.linespace <= 0) usageAndExit("linespace must be positive integer");
  if (isNaN(res.lineOpacity) || res.lineOpacity < 0 || res.lineOpacity > 1) usageAndExit("line-opacity must be between 0 and 1");
  if (isNaN(res.glow) || res.glow <= 0) usageAndExit("glow must be > 0");
  if (isNaN(res.vignette) || res.vignette < 0 || res.vignette > 1) usageAndExit("vignette must be between 0 and 1");
  return res;
}

function findElementById(doc, tagName, id) {
  const list = doc.getElementsByTagName(tagName);
  for (let i = 0; i < list.length; i++) {
    const el = list[i];
    if (el && el.getAttribute && el.getAttribute("id") === id) return el;
  }
  return null;
}

function hasParserError(doc) {
  try {
    if (!doc || !doc.documentElement) return true;
    const pe = doc.getElementsByTagName("parsererror");
    if (pe && pe.length > 0) return true;
    const rootName = doc.documentElement.nodeName;
    if (!rootName || rootName.toLowerCase() === "parsererror") return true;
    return false;
  } catch (e) {
    return true;
  }
}

function serializeDoc(doc) {
  const s = new XMLSerializer();
  let xml = s.serializeToString(doc);
  if (!xml.startsWith("<?xml")) xml = '<?xml version="1.0" encoding="utf-8"?>\n' + xml;
  return xml;
}

async function fileExists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

(async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inPath = args.input;
  const outPath = args.output;
  const tmpPath = outPath + ".tmp";

  if (!await fileExists(inPath)) {
    console.error("Input not found:", inPath);
    process.exit(3);
  }

  let tmpWritten = false;
  try {
    const raw = await fs.readFile(inPath, "utf8");
    const parser = new DOMParser();
    const doc = parser.parseFromString(raw, "application/xml");

    if (hasParserError(doc)) throw new Error("XML parse error: input SVG not well-formed");

    // 1) pattern#scanlines
    const pattern = findElementById(doc, "pattern", "scanlines");
    if (!pattern) throw new Error("pattern#scanlines not found");
    pattern.setAttribute("height", String(args.linespace));

    // update inner rect
    const rects = pattern.getElementsByTagName("rect");
    let updatedRect = null;
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      const y = r.getAttribute("y");
      if (y === "1" || rects.length === 1 || i === 1) {
        const fill = r.getAttribute("fill") || "";
        const rgbaMatch = fill.match(/rgba\\(\\s*255\\s*,\\s*255\\s*,\\s*255\\s*,\\s*([0-9.]+)\\s*\\)/i);
        if (rgbaMatch) {
          const newFill = `rgba(255,255,255,${Number(args.lineOpacity)})`;
          r.setAttribute("fill", newFill);
        } else {
          r.setAttribute("fill", "#ffffff");
          r.setAttribute("fill-opacity", String(Number(args.lineOpacity)));
        }
        updatedRect = r;
        break;
      }
    }
    if (!updatedRect) throw new Error("No inner <rect> updated inside pattern#scanlines");

    // 2) filter#textGlow -> feGaussianBlur
    const filter = findElementById(doc, "filter", "textGlow");
    if (!filter) throw new Error("filter#textGlow not found");
    const gauss = filter.getElementsByTagName("feGaussianBlur");
    if (!gauss || gauss.length === 0) throw new Error("feGaussianBlur not found inside filter#textGlow");
    const g0 = gauss[0];
    const curStr = g0.getAttribute("stdDeviation") || g0.getAttribute("stddeviation") || "1.4";
    const cur = parseFloat(curStr);
    if (isNaN(cur) || cur <= 0) throw new Error("Invalid existing stdDeviation in feGaussianBlur");
    const newDev = Number((cur * args.glow).toFixed(3));
    g0.setAttribute("stdDeviation", String(newDev));

    // 3) radialGradient#vignette -> last stop
    const grad = findElementById(doc, "radialGradient", "vignette");
    if (!grad) throw new Error("radialGradient#vignette not found");
    const stops = grad.getElementsByTagName("stop");
    if (!stops || stops.length === 0) throw new Error("No <stop> elements in radialGradient#vignette");
    let lastStop = null;
    for (let i = 0; i < stops.length; i++) {
      const s = stops[i];
      if (s.getAttribute("offset") === "100%" || s.getAttribute("offset") === "1") { lastStop = s; break; }
    }
    if (!lastStop) lastStop = stops[stops.length - 1];
    lastStop.setAttribute("stop-opacity", String(Number(args.vignette)));

    // 4) overlay rect handling
    const allRects = doc.getElementsByTagName("rect");
    let overlayFound = false;
    for (let i = 0; i < allRects.length; i++) {
      const r = allRects[i];
      const fillAttr = r.getAttribute("fill") || "";
      if (fillAttr.includes("url(#scanlines)")) {
        overlayFound = true;
        let classes = (r.getAttribute("class") || "").split(/\\s+/).filter(Boolean);
        if (args.isStatic) {
          classes = classes.filter(c => c !== "scanline-overlay");
          if (classes.length > 0) r.setAttribute("class", classes.join(" "));
          else if (r.hasAttribute("class")) r.removeAttribute("class");
        } else {
          if (!classes.includes("scanline-overlay")) classes.push("scanline-overlay");
          r.setAttribute("class", classes.join(" "));
        }
        r.setAttribute("opacity", String(0.5));
      }
    }
    if (!overlayFound) throw new Error('No overlay rect with fill="url(#scanlines)" found');

    // write tmp
    const xmlOut = serializeDoc(doc);
    await fs.writeFile(tmpPath, xmlOut, "utf8");
    tmpWritten = true;

    // re-parse tmp and validate
    const tmpRaw = await fs.readFile(tmpPath, "utf8");
    const doc2 = new DOMParser().parseFromString(tmpRaw, "application/xml");
    if (hasParserError(doc2)) throw new Error("Post-write XML parse error (temporary output invalid)");

    // validations
    const pattern2 = findElementById(doc2, "pattern", "scanlines");
    if (!pattern2) throw new Error("Validation failed: pattern#scanlines missing after write");
    const h2 = pattern2.getAttribute("height");
    if (String(Number(h2)) !== String(Number(args.linespace))) throw new Error(`Validation failed: pattern height expected ${args.linespace} got ${h2}`);

    const rects2 = pattern2.getElementsByTagName("rect");
    let rectOk = false;
    for (let i = 0; i < rects2.length; i++) {
      const r = rects2[i];
      const y = r.getAttribute("y");
      if (y === "1" || rects2.length === 1 || i === 1) {
        const fill = r.getAttribute("fill") || "";
        const fo = r.getAttribute("fill-opacity");
        if (fill.includes("rgba(") && fill.includes(String(Number(args.lineOpacity)))) rectOk = true;
        else if (fo && Math.abs(Number(fo) - Number(args.lineOpacity)) < 1e-6) rectOk = true;
        else if (r.getAttribute("fill") === "#ffffff" && r.getAttribute("fill-opacity") && Math.abs(Number(r.getAttribute("fill-opacity")) - Number(args.lineOpacity)) < 1e-6) rectOk = true;
      }
    }
    if (!rectOk) throw new Error("Validation failed: inner rect opacity not set as requested");

    const filter2 = findElementById(doc2, "filter", "textGlow");
    if (!filter2) throw new Error("Validation failed: filter#textGlow missing after write");
    const g2 = filter2.getElementsByTagName("feGaussianBlur")[0];
    const dev2 = parseFloat(g2.getAttribute("stdDeviation") || "0");
    if (!(dev2 > 0)) throw new Error("Validation failed: feGaussianBlur stdDeviation invalid after write");

    const grad2 = findElementById(doc2, "radialGradient", "vignette");
    if (!grad2) throw new Error("Validation failed: radialGradient#vignette missing after write");
    const stops2 = grad2.getElementsByTagName("stop");
    let stop100 = null;
    for (let i = 0; i < stops2.length; i++) {
      if (stops2[i].getAttribute("offset") === "100%" || stops2[i].getAttribute("offset") === "1") { stop100 = stops2[i]; break; }
    }
    if (!stop100) stop100 = stops2[stops2.length - 1];
    const finalOpacity = parseFloat(stop100.getAttribute("stop-opacity") || "0");
    if (Math.abs(finalOpacity - Number(args.vignette)) > 1e-3) throw new Error(`Validation failed: vignette stop-opacity expected ${args.vignette} got ${finalOpacity}`);

    if (args.isStatic) {
      const allRects2 = doc2.getElementsByTagName("rect");
      for (let i = 0; i < allRects2.length; i++) {
        const r = allRects2[i];
        const fillAttr = r.getAttribute("fill") || "";
        if (fillAttr.includes("url(#scanlines)")) {
          const cls = (r.getAttribute("class") || "").split(/\\s+/).filter(Boolean);
          if (cls.includes("scanline-overlay")) throw new Error("Validation failed: static mode expected no scanline-overlay class but found one");
        }
      }
    }

    await fs.rename(tmpPath, outPath);
    tmpWritten = false;
    console.log("Enhanced SVG written to", outPath);
    process.exit(0);
  } catch (err) {
    console.error("ERROR:", err.message || err);
    try { if (await fileExists(tmpPath)) await fs.unlink(tmpPath); } catch (_) {}
    process.exit(1);
  }
})();
