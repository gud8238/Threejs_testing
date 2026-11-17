// node tools/shot.cjs <url-path> <out.png> [w h] — screenshot a page served from the repo root (port 8765)
const { chromium } = require("playwright");
(async () => {
  const [, , path, out, w = "1600", h = "600"] = process.argv;
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  p.on("console", (m) => m.type() === "error" && console.error("console:", m.text()));
  p.on("pageerror", (e) => console.error("pageerror:", e.message));
  await p.goto(`http://127.0.0.1:8765/${path}`);
  await p.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
  await p.screenshot({ path: out });
  await b.close();
})();
