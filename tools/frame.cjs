// node tools/frame.cjs <project> <out-prefix> <t1,t2,...> — load a composition directly, time build + each frame
const { chromium } = require("playwright");
(async () => {
  const [, , proj, out, times] = process.argv;
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on("console", (m) => !m.text().includes("GPU stall") && console.error("console:", m.text().slice(0, 300)));
  p.on("pageerror", (e) => console.error("pageerror:", e.message));
  await p.addInitScript(() => { window.__timelines = {}; });
  const t0 = Date.now();
  await p.goto(`http://127.0.0.1:8765/${proj}/index.html`);
  await p.waitForFunction(() => typeof window.__render === "function", null, { timeout: 600000 });
  console.log("build ms", Date.now() - t0);
  for (const t of times.split(",")) {
    const s = Date.now();
    await p.evaluate((tt) => window.__render(tt), +t);
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
    console.log("frame", t, "ms", Date.now() - s);
    await p.screenshot({ path: `${out}-${t}.png` });
  }
  await b.close();
})();
