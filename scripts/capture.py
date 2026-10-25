"""Playwright check + capture for maeul-inherit (spec 11.1 C5, 12 C). ASCII source only.

Usage (python -I, headless chromium, --disable-gpu):
  python -I scripts/capture.py --check <base-url>     full path x 3 scenarios, console errors, 360/1920 widths,
                                                     S3 demo timing, poster size. exit 1 on any failure.
  python -I scripts/capture.py <base-url> [--out DIR] 10 PNGs (S0 S1 S2 S3-before S3-after S4 S4-filtered S5 S6 poster)
                                                     into docs/capture (default) or DIR.
Waits use wait_until="load" plus a fixed pause: "networkidle" never settles on the production build.
"""
import argparse
import json
import os
import site
import struct
import sys
import time

try:
    from playwright.sync_api import sync_playwright
except ImportError:  # python -I drops the user site; Playwright lives there on this PC
    sys.path.append(site.getusersitepackages())
    from playwright.sync_api import sync_playwright

SCENARIOS = ["sc1_seungchi", "sc2_waryong", "sc3_ungok"]
REASON_NOT_CAME = "안 왔어요"  # an wasseoyo (first reason chip)
POSTER_FOOT = "가상 인물·가상 시나리오"
KIM_AFTER = ("이동장터 A", "화요일 오전")  # tour A + Tuesday morning, both on the F01 (jangbogi) ledger line
SURE_WORD = "확실"  # hwaksil stamp on that line
PAUSE_MS = 900

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

MEASURE_JS = """async (sel) => {
  const q = (s) => document.querySelector(s);
  const txt = (s) => { const e = q(s); return e ? e.textContent : ''; };
  const mini0 = txt('[data-mini] [data-steps]'), bars0 = txt('[data-bars]'), table0 = txt('[data-table]');
  const b = q(sel); if (!b) return { ms: -1, err: 'no demo button' };
  const t0 = performance.now(); b.click();
  return await new Promise((res) => {
    const tick = () => {
      const host = q('[data-conf-n]');
      const n = host ? host.getAttribute('data-conf-n') : '0';
      const mini = txt('[data-mini] [data-steps]'), bars = txt('[data-bars]'), table = txt('[data-table]');
      const changed = { mini: mini !== mini0, bars: bars !== bars0, table: table !== table0 };
      if (n === '1' && changed.bars && changed.table && (changed.mini || mini0 === '')) {
        res({ ms: performance.now() - t0, changed, recalcMs: host.getAttribute('data-recalc-ms'), mini0, mini });
      } else if (performance.now() - t0 > 5000) {
        res({ ms: -1, changed, n, mini0, mini });
      } else requestAnimationFrame(tick);
    };
    tick();
  });
}"""


def png_size(path):
    with open(path, "rb") as f:
        head = f.read(24)
    return struct.unpack(">II", head[16:24])


class Run:
    def __init__(self):
        self.results = []
        self.ok = True

    def rec(self, name, passed, detail=""):
        self.results.append({"check": name, "pass": bool(passed), "detail": detail})
        if not passed:
            self.ok = False
        print(("PASS " if passed else "FAIL ") + name + (" | " + str(detail) if detail != "" else ""), flush=True)


def new_page(browser, w, h, errors):
    ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=1, locale="ko-KR")
    page = ctx.new_page()
    page.on("console", lambda m: errors.append(f"console:{m.type}:{m.text}"[:300]) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(f"pageerror:{e}"[:300]))
    return ctx, page


def go(page, url):
    resp = page.goto(url, wait_until="load", timeout=60000)
    page.wait_for_timeout(PAUSE_MS)
    return resp.status if resp else 0


def width_ok(page):
    return page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")


def flow(browser, base, sid, run):
    errors = []
    ctx, page = new_page(browser, 1280, 900, errors)
    try:
        st = go(page, base + "/")
        run.rec(f"{sid} S0 200 + hero card", st == 200 and page.locator('[data-card="s0-hero"]').count() == 1, st)
        go(page, base + "/register")
        page.click(f'[data-fill="{sid}"]')
        page.wait_for_timeout(300)
        page.click('[data-submit="decompose"]')
        page.wait_for_url(f"**/s/{sid}/functions", timeout=30000)
        page.wait_for_timeout(PAUSE_MS)
        pieces = page.locator("[data-piece]").count()
        run.rec(f"{sid} S1 -> S2 (pieces)", pieces > 0, pieces)
        page.click('[data-gate="g1"] button')
        page.wait_for_selector('[data-next="open"]', timeout=10000)
        page.locator('a[data-next="open"]').first.click()
        page.wait_for_url(f"**/s/{sid}/plan", timeout=30000)
        page.wait_for_selector("[data-mini]", timeout=20000)
        page.wait_for_timeout(PAUSE_MS)
        demos = page.eval_on_selector_all("[data-demo]", "els => els.map(e => e.getAttribute('data-demo'))")
        run.rec(f"{sid} S3 demo button only on stop:tour_A", len(demos) == 1 and demos[0].startswith("stop:tour_A:"), demos)
        m = page.evaluate(MEASURE_JS, "[data-demo]")
        run.rec(f"{sid} S3 demo -> bars/mini/table < 1000 ms", 0 <= m["ms"] < 1000, json.dumps({k: m.get(k) for k in ("ms", "recalcMs", "changed", "mini0", "mini")}, ensure_ascii=True))
        if sid == "sc1_seungchi":
            row_sel = '[data-mini] [data-fn="F01"]'
            row = page.locator(row_sel).inner_text()
            tri = page.get_attribute(row_sel, "data-tri")
            ok = tri == "Y" and SURE_WORD in row and all(w in row for w in KIM_AFTER)
            run.rec("sc1 S3 Kim card shows tour A Tuesday morning", ok, json.dumps({"tri": tri, "row": row}, ensure_ascii=True))
        bars_after = page.locator("[data-bars]").inner_text()
        page.click('[data-gate="g2"] button')
        page.wait_for_selector('[data-next="open"]', timeout=10000)
        page.locator('a[data-next="open"]').first.click()
        page.wait_for_url(f"**/s/{sid}/residents", timeout=30000)
        page.wait_for_selector("[data-fb-buttons]", timeout=20000)
        page.wait_for_timeout(PAUSE_MS)
        page.locator('[data-fb="failed"]').first.click()
        page.locator(f'[data-fb-reason="{REASON_NOT_CAME}"]').first.click()
        page.wait_for_selector("[data-toast]", timeout=5000)
        run.rec(f"{sid} S4 feedback toast", True, "")
        page.click('[data-gate="g3"] button')
        page.wait_for_selector('[data-gate-record="g3"]', timeout=5000)
        run.rec(f"{sid} S4 approve record", True, "")
        blocked = page.locator('[data-test-sentence="blocked"]').count()
        run.rec(f"{sid} S4 test sentence blocked", blocked == 1, blocked)
        go(page, base + f"/s/{sid}/plan")
        page.wait_for_selector("[data-reports]", timeout=20000)
        r1 = page.get_attribute("[data-reports]", "data-reports")
        page.reload(wait_until="load")
        page.wait_for_timeout(PAUSE_MS)
        page.wait_for_selector("[data-reports]", timeout=20000)
        r2 = page.get_attribute("[data-reports]", "data-reports")
        bars_reload = page.locator("[data-bars]").inner_text()
        run.rec(f"{sid} S3 resident report 1 kept after reload, bars unchanged", r1 == "1" and r2 == "1" and bars_reload == bars_after, f"{r1}/{r2}")
    except Exception as e:  # noqa: BLE001
        run.rec(f"{sid} flow exception", False, repr(e)[:300])
    finally:
        ctx.close()
    run.rec(f"{sid} flow console errors 0", not errors, errors[:5])


def widths(browser, base, run):
    paths = ["/", "/register", "/eval", "/about"]
    for sid in SCENARIOS:
        paths += [f"/s/{sid}/functions", f"/s/{sid}/plan", f"/s/{sid}/residents"]
    for w in (360, 1920):
        errors = []
        ctx, page = new_page(browser, w, 900, errors)
        bad = []
        try:
            for p in paths:
                st = go(page, base + p)
                sw, iw = width_ok(page)
                if st != 200 or sw > iw:
                    bad.append(f"{p} status={st} sw={sw} iw={iw}")
        except Exception as e:  # noqa: BLE001
            bad.append(repr(e)[:200])
        finally:
            ctx.close()
        run.rec(f"width {w}px scrollWidth<=innerWidth on {len(paths)} screens", not bad, bad)
        run.rec(f"width {w}px console errors 0", not errors, errors[:5])


def poster(browser, base, out_png, run=None):
    errors = []
    ctx, page = new_page(browser, 1200, 675, errors)
    try:
        go(page, base + "/poster")
        page.wait_for_selector("[data-poster]")
        box = page.locator("[data-poster]").bounding_box()
        page.screenshot(path=out_png, clip={"x": 0, "y": 0, "width": 1200, "height": 675})
        text = page.locator("[data-poster]").inner_text()
        robots = page.eval_on_selector_all('meta[name="robots"]', "els => els.map(e => e.content)")
        sw, iw = width_ok(page)
        if run:
            size = png_size(out_png)
            run.rec("poster PNG exactly 1200x675", tuple(size) == (1200, 675) and round(box["width"]) == 1200 and round(box["height"]) == 675, f"png={size} box={box['width']}x{box['height']}")
            run.rec("poster has virtual-person/scenario text", POSTER_FOOT in text, "")
            run.rec("poster noindex", any("noindex" in r for r in robots), robots)
            run.rec("poster no overflow", sw <= iw, f"{sw}/{iw}")
            run.rec("poster console errors 0", not errors, errors[:5])
    finally:
        ctx.close()


def capture(browser, base, out):
    os.makedirs(out, exist_ok=True)
    sid = "sc1_seungchi"
    errors = []
    ctx, page = new_page(browser, 1440, 900, errors)
    shots = []

    def shot(name, full=False, el=None):
        path = os.path.join(out, name)
        if el is not None:
            page.locator(el).first.scroll_into_view_if_needed()
            page.wait_for_timeout(300)
            page.evaluate("(s) => { const e = document.querySelector(s); if (e) window.scrollBy(0, e.getBoundingClientRect().top - 80); }", el)
            page.wait_for_timeout(300)
        page.screenshot(path=path, full_page=full)
        shots.append(name)

    try:
        go(page, base + "/")
        page.wait_for_timeout(2200)  # S0 scene (shutter 0.6 s, then marks line by line) has finished
        shot("01_s0_home.png")
        go(page, base + "/register")
        page.click(f'[data-fill="{sid}"]')
        page.wait_for_timeout(500)
        shot("02_s1_register.png")
        go(page, base + f"/s/{sid}/functions")
        page.click('[data-gate="g1"] button')
        page.wait_for_timeout(500)
        page.evaluate("() => window.scrollTo(0, 0)")
        page.wait_for_timeout(300)
        shot("03_s2_functions.png")
        go(page, base + f"/s/{sid}/plan")
        page.wait_for_selector("[data-mini]")
        shot("04_s3_plan_before.png")
        page.evaluate(MEASURE_JS, "[data-demo]")
        page.wait_for_timeout(400)  # inside the 0.8 s highlight
        shot("05_s3_plan_after.png")
        go(page, base + f"/s/{sid}/residents")
        page.wait_for_selector("[data-fb-buttons]")
        shot("06_s4_residents.png")
        shot("07_s4_filtered.png", el="[data-filtered]")
        go(page, base + "/eval")
        shot("08_s5_eval.png", full=True)
        go(page, base + "/about")
        shot("09_s6_about.png")
    finally:
        ctx.close()
    poster(browser, base, os.path.join(out, "10_poster.png"))
    shots.append("10_poster.png")
    for s in shots:
        w, h = png_size(os.path.join(out, s))
        print(f"{s} {w}x{h}")
    if errors:
        print("console errors during capture:", errors[:5])
    return shots


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("base")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--out", default=os.path.join(ROOT, "docs", "capture"))
    ap.add_argument("--json", default="")
    a = ap.parse_args()
    base = a.base.rstrip("/")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--disable-gpu"])
        try:
            if a.check:
                run = Run()
                t0 = time.time()
                for sid in SCENARIOS:
                    flow(browser, base, sid, run)
                widths(browser, base, run)
                tmp = os.path.join(a.out, "_check_poster.png") if a.json else os.path.join(ROOT, ".next", "_check_poster.png")
                os.makedirs(os.path.dirname(tmp), exist_ok=True)
                poster(browser, base, tmp, run)
                n_ok = sum(1 for r in run.results if r["pass"])
                print(f"capture --check {base}: {n_ok}/{len(run.results)} PASS in {time.time() - t0:.0f} s -> {'OK' if run.ok else 'FAIL'}")
                if a.json:
                    with open(a.json, "w", encoding="utf-8") as f:
                        json.dump({"base": base, "ok": run.ok, "results": run.results}, f, ensure_ascii=False, indent=1)
                sys.exit(0 if run.ok else 1)
            capture(browser, base, a.out)
        finally:
            browser.close()


if __name__ == "__main__":
    main()
