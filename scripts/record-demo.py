# Records the Drape demo against the live site, one clip per narration beat, at the exact
# beat durations measured from docs/voiceover/beat-NN.wav. Frames are captured on a
# background thread while the main thread drives the app, so interactions are in motion.
#
# Runs at 1920x1080 so the finished cut is true 1080p rather than an upscale.

import base64
import json
import subprocess
import threading
import time
from pathlib import Path

OUT = Path(
    "/private/tmp/claude-501/-Users-arunbrahma-Desktop-AltGAN-codepad-hackathons/"
    "be6e9d41-0589-4f01-97fe-8d1d8f6be1d3/scratchpad/frames"
)
VO = Path(
    "/Users/arunbrahma/Desktop/AltGAN/codepad/hackathons/youcam_api/docs/voiceover"
)
BASE = "https://drape-youcam.vercel.app"

# True 1080p output, but laid out at 1280 CSS pixels and rendered at 1.5x.
#
# Capturing at a literal 1920-wide viewport looks correct and reads badly: the site's
# content column is capped around 1150px, so at 1920 it floats in the middle of the frame
# and the type comes out small on a phone or an embedded player. Driving the layout at
# 1280 and letting the device pixel ratio do the rest gives the same 1920x1080 file with
# everything half again as large, still rendered at full resolution rather than upscaled.
VW, VH, DSF = 1280, 720, 1.5
FPS = 12
JPEG_Q = 92

OUT.mkdir(parents=True, exist_ok=True)

# The capture thread and the main thread both talk to the daemon over one socket, and that
# socket is not thread-safe: interleaved requests corrupt each other, which shows up as
# helpers mysteriously returning None. Serialize every harness call through one lock.
LOCK = threading.RLock()
_js, _click_at_xy, _goto_url, _wait_for_load, _cdp = (
    js,
    click_at_xy,
    goto_url,
    wait_for_load,
    cdp,
)


def js(expr):
    with LOCK:
        return _js(expr)


def click_at_xy(x, y):
    with LOCK:
        return _click_at_xy(x, y)


def goto_url(u):
    with LOCK:
        return _goto_url(u)


def wait_for_load(*a, **k):
    with LOCK:
        return _wait_for_load(*a, **k)


def cdp(method, **params):
    with LOCK:
        return _cdp(method, **params)


def beat_durations():
    out = []
    for f in sorted(VO.glob("beat-*.wav")):
        d = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "csv=p=0",
                str(f),
            ],
            capture_output=True,
            text=True,
        ).stdout.strip()
        out.append(float(d))
    return out


DUR = beat_durations()
print(f"{len(DUR)} beats, total {sum(DUR):.1f}s")

# Pin a dedicated tab. There are many tabs open and the daemon's session drifts between
# navigations, which has silently recorded somebody else's page before now.
with LOCK:
    TID = new_tab(BASE + "/")
    wait_for_load()
print("pinned tab", TID)


def pin(tid=None):
    """Re-attach to our tab and re-assert the 16:9 viewport, which does not survive a
    session switch."""
    with LOCK:
        try:
            switch_tab(tid or TID)
            _cdp(
                "Emulation.setDeviceMetricsOverride",
                width=VW,
                height=VH,
                deviceScaleFactor=DSF,
                mobile=False,
            )
        except Exception as e:
            print("  !! pin failed:", str(e)[:80])


pin()
time.sleep(0.6)


class Recorder:
    """Captures frames into frames/beat-NN/ while the main thread drives the page."""

    def __init__(self):
        self.stop = threading.Event()
        self.thread = None
        self.dir = None
        self.n = 0

    def start(self, beat):
        self.dir = OUT / f"beat-{beat:02d}"
        self.dir.mkdir(exist_ok=True)
        for old in self.dir.glob("*.jpg"):
            old.unlink()
        self.n = 0
        self.stop.clear()

        def loop():
            period = 1.0 / FPS
            while not self.stop.is_set():
                t = time.time()
                try:
                    r = cdp("Page.captureScreenshot", format="jpeg", quality=JPEG_Q)
                    data = r.get("data")
                    if data:
                        self.n += 1
                        (self.dir / f"{self.n:05d}.jpg").write_bytes(
                            base64.b64decode(data)
                        )
                except Exception:
                    pass
                slack = period - (time.time() - t)
                if slack > 0:
                    self.stop.wait(slack)

        self.thread = threading.Thread(target=loop, daemon=True)
        self.thread.start()

    def end(self):
        self.stop.set()
        if self.thread:
            self.thread.join(timeout=5)
        return self.n


rec = Recorder()


def hold(seconds):
    time.sleep(max(0.0, seconds))


def scroll_to(y, steps=18, per=0.05):
    """Eased scroll so the capture shows motion rather than a jump cut."""
    cur = js("document.documentElement.scrollTop") or 0
    for i in range(1, steps + 1):
        p = i / steps
        p = 1 - (1 - p) ** 3
        js(f"document.documentElement.scrollTop={cur + (y - cur) * p}")
        time.sleep(per)


def drift(delta, seconds, steps=None):
    """Creep the page by `delta` px over `seconds`. Long narration beats look dead without
    it, and a slow drift reads as intentional camera movement."""
    steps = steps or max(8, int(seconds * 12))
    cur = js("document.documentElement.scrollTop") or 0
    per = seconds / steps
    for i in range(1, steps + 1):
        js(f"document.documentElement.scrollTop={cur + delta * (i / steps)}")
        time.sleep(per)


def box(sel_js):
    return js(
        f"(()=>{{const e={sel_js}; if(!e) return null; const r=e.getBoundingClientRect();"
        f"return {{x:r.x+r.width/2,y:r.y+r.height/2,top:r.top}};}})()"
    )


def by_text(tag, text):
    return f"[...document.querySelectorAll('{tag}')].find(x=>x.textContent.trim()==={json.dumps(text)})"


def by_any(pattern):
    """The tightest element whose text matches.

    Matching in document order picks an outer wrapper, because a section div contains the
    words too and comes first. That is how beat 2 ended up framed on the page's own
    embedded demo video instead of the line about stylists. Take the shortest match, which
    is the element that actually holds the text.
    """
    return ("(()=>{const m=[...document.querySelectorAll('h1,h2,h3,p,span,li')]"
            f".filter(x=>/{pattern}/i.test(x.textContent));"
            " if(!m.length) return null;"
            " return m.reduce((a,b)=>b.textContent.length<a.textContent.length?b:a);})()")


def by_re(tag, pattern):
    return f"[...document.querySelectorAll('{tag}')].find(x=>/{pattern}/i.test(x.textContent))"


def click_el(sel_js, settle=0.4):
    """click_at_xy takes viewport coordinates, so an element scrolled off-screen has a
    negative y and the click silently lands nowhere. Bring it into view first."""
    for _ in range(3):
        b = box(sel_js)
        if b:
            if b["y"] < 40 or b["y"] > VH - 40:
                js(
                    f"(()=>{{const e={sel_js}; e && e.scrollIntoView({{block:'center'}});}})()"
                )
                time.sleep(0.35)
                b = box(sel_js)
            if b and 0 < b["y"] < VH:
                click_at_xy(b["x"], b["y"])
                time.sleep(settle)
                return True
        time.sleep(0.4)
    print("  !! not clickable:", sel_js[:70])
    return False


def anchor(sel_js, offset=120, steps=18, per=0.05):
    """Scroll an element to a comfortable position. Beats that spend most of their length
    on interaction pass a faster scroll so the travel does not eat the whole budget."""
    y = js(
        f"(()=>{{const e={sel_js}; if(!e) return null;"
        f"return e.getBoundingClientRect().top + window.scrollY - {offset};}})()"
    )
    if y is not None:
        scroll_to(max(0, y), steps=steps, per=per)


def goto(path):
    pin()
    goto_url(BASE + path if path.startswith("/") else path)
    wait_for_load()
    time.sleep(1.4)
    # The site scrolls smoothly, which fights scripted scrolling and lands mid-animation
    # on capture. Turn it off for the recording only.
    js("document.documentElement.style.scrollBehavior='auto'")


def beat(n, fn):
    d = DUR[n - 1]
    print(f"beat {n:2d}  {d:5.1f}s")
    pin()
    rec.start(n)
    t0 = time.time()
    try:
        fn(d)
    except Exception as e:
        print("   error:", str(e)[:120])
    remain = d - (time.time() - t0)
    if remain > 0:
        hold(remain)
    print(f"        captured {rec.end()} frames in {time.time() - t0:.1f}s")


# ---------------------------------------------------------------- choreography

SEASON_H1 = "document.querySelector('h1')"
DEPTH_CHIP = by_re("button", "^Depth")
MEDIUM_OPT = by_text(
    "button", "medium"
)  # options render lowercase; CSS capitalizes them
RESET_BTN = by_re("button", "Reset to the measured read")
DISCOVER = by_re("button", "Discover your palette")
LIGHT = by_text("button", "Light")
COMPARE_H2 = by_re("h2", "See yourself in it")
SHOP_H2 = by_re("h2", "Shop your palette")
TAB = lambda name: by_text("button", name)
STYLE_BTN = by_re("button", "Style a full look|Style another")
# Third swatch in the palette grid: far enough from the hero shade that the change reads.
SWATCH = ("(()=>{const g=[...document.querySelectorAll('button')]"
          ".filter(b=>/aspect-square/.test(b.className)); return g[2]||g[0]||null;})()")
# The hair row is "Your own" followed by the season's shades; index 2 is the middle one,
# which on this face is Copper, i.e. an obvious change from near-black hair.
HAIR_CHIP = ("(()=>{const own=[...document.querySelectorAll('button')]"
             ".find(b=>/Your own/.test(b.textContent)); if(!own) return null;"
             " return own.parentElement.children[2]||null;})()")


def to_light_result():
    goto("/")
    click_el(DISCOVER, settle=1.4)
    click_el(LIGHT, settle=3.2)


# 1. hook: the two-shade comparison, already on screen
pin()
to_light_result()
anchor(COMPARE_H2, offset=60)
beat(1, lambda d: drift(60, d))


# 2. the problem, on the landing page
def b2(d):
    # The old cut scrolled to 1500 and parked on the page's own embedded demo video, so the
    # film showed a still of itself while the narration talked about stylists. Travel to
    # the line that actually makes the point instead.
    goto("/")
    hold(d * 0.34)
    scroll_to(700, steps=24, per=0.05)
    hold(d * 0.18)
    anchor(by_any("150 in a studio"), offset=260, steps=22, per=0.05)


beat(2, b2)


# 3. one selfie, then a sample face
def b3(d):
    # "You give it a selfie" belongs over the capture screen. The previous cut clicked
    # through to the result almost immediately and spent the line on a season name.
    scroll_to(0, steps=10, per=0.03)
    click_el(DISCOVER, settle=1.4)
    hold(d * 0.55)                      # dwell on the upload options and the sample faces
    click_el(LIGHT, settle=2.2)


beat(3, b3)


# 4. the season, the measured colors, the palette grid
def b4(d):
    # The travel down the reveal has to fit the beat: the anchor scroll alone costs about
    # a second, so the drift gets what is left rather than the whole length.
    # Ends on the palette grid: the line is about twelve seasons each carrying a dozen
    # shades, so the shades are what should be on screen when it finishes.
    anchor(SEASON_H1, offset=150, steps=12, per=0.04)
    hold(0.4)
    drift(700, d - 2.2)


beat(4, b4)


# 5. the confidence card
def b5(d):
    # "Drape tells you how sure it is" wants the confidence card in frame, not the top of
    # the reveal. Anchoring on the card keeps the score and its reason line together.
    anchor(by_any("confidence"), offset=200, steps=14, per=0.045)
    hold(max(0.3, d - 1.4))


beat(5, b5)

# 6. the number and the reason line, with a slow creep so it is not a frozen frame
beat(6, lambda d: drift(110, d))

# 7. open the correction
beat(7, lambda d: (click_el(DEPTH_CHIP, settle=0.9), hold(d - 1.1)))


# 8. correct it, watch the whole result re-derive
def b8(d):
    click_el(MEDIUM_OPT, settle=1.4)
    hold(d - 1.6)


beat(8, b8)


# 9. back to the measured read, then the try-on comparison. The reset matters: the shop
# numbers spoken in beat 13 are True Spring's, so the correction has to be undone first.
def b9(d):
    if not click_el(RESET_BTN, settle=1.2):
        to_light_result()
    anchor(COMPARE_H2, offset=60)
    hold(max(0.5, d - 3.0))


beat(9, b9)

# 10. tap a shade so the garment colour visibly changes under "the color is the only
# thing that moved". Renders are pre-baked on the sample path, so this is instant.
def b10(d):
    anchor(TAB("Colors"), offset=70, steps=10, per=0.04)
    click_el(SWATCH, settle=0.8)
    hold(max(0.4, d - 2.0))


beat(10, b10)

# 11. into the shop
beat(11, lambda d: (anchor(SHOP_H2, offset=90), hold(max(0.3, d - 1.4))))

# 12. the garment grid
beat(12, lambda d: drift(340, d))

# 13. the top card and its delta E badge
beat(13, lambda d: (anchor(SHOP_H2, offset=-40), hold(max(0.5, d - 1.4))))


# 14. the rest of the studio: hair, skin, and the generated look
def b14(d):
    # Anchor on the tab strip rather than the comparison above it. Framed off the
    # comparison the tabs sat at the very bottom of the shot, so switching to Hair or Skin
    # changed something the viewer could not see, which is what the previous cut did.
    pin()
    anchor(TAB("Colors"), offset=70, steps=10, per=0.04)
    spare = max(1.5, d - 2.6)
    click_el(TAB("Hair"), settle=0.5)
    click_el(HAIR_CHIP, settle=0.7)          # pre-baked on the sample path, so instant
    hold(spare * 0.5)
    click_el(TAB("Skin"), settle=0.5)
    hold(spare * 0.5)


beat(14, b14)


# 15. ask for a whole outfit and let it spin. This is the one live generative call in the
# recording, and the only place the demo spends units.
def b15(d):
    click_el(TAB("Colors"), settle=0.5)
    click_el(STYLE_BTN, settle=0.4)
    hold(max(0.5, d - 1.6))                  # the button reads "Styling..." through here


beat(15, b15)

# The render takes the better part of a minute, and no beat can hold that. Nothing is
# captured between beats, so the wait costs the viewer nothing: beat 15 ends on the
# spinner and beat 16 opens on the finished look.
print("      waiting for the generated look...")
for _ in range(45):
    time.sleep(2)
    if js("return /Styled by YouCam AI/.test(document.body.innerText)"):
        print("      look ready")
        break
else:
    print("      !! look did not arrive; beat 16 will show the studio instead")


# 16. the finished look
def b16(d):
    anchor(TAB("Colors"), offset=70, steps=10, per=0.04)
    hold(max(0.5, d - 1.2))


beat(16, b16)


# 17. the fairness evidence
def b17(d):
    goto("/fairness")
    hold(1.6)
    scroll_to(620, steps=26, per=0.06)
    hold(d * 0.28)
    scroll_to(1240, steps=28, per=0.06)


beat(17, b17)

# 18. the before and after summary
beat(18, lambda d: (scroll_to(1720, steps=24, per=0.05), hold(max(0.5, d - 2.0))))


# 19. five APIs, the tests, and MCP
def b19(d):
    goto("/mcp")
    hold(1.4)
    drift(520, max(1.0, d - 3.0))


beat(19, b19)


# 20. close on the landing page
def b20(d):
    goto("/")
    hold(max(0.5, d - 1.6))


beat(20, b20)

rec.end()
cdp("Emulation.clearDeviceMetricsOverride")
print("\ndone. frames in", OUT)
