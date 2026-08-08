# Builds an SRT caption file for the demo video.
#
# YouTube's auto-captions mangle the things this video is actually about: the brand name,
# CIEDE2000, ITA, the hex codes. We already know exactly what was said and exactly how long
# each beat runs, so the captions can be generated rather than transcribed.
#
# Timing comes from the same source the video does: each beat's duration is the length of
# its own WAV, and beats are separated by the same GAP the assembler inserts. That means the
# captions cannot drift from the picture.
#
# Run: python3 scripts/build-captions.py   (writes docs/video/drape-demo.srt)

import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "docs" / "video-script.md"
VOICE = ROOT / "docs" / "voiceover"
OUT = ROOT / "docs" / "video" / "drape-demo.srt"
GAP = 0.45

# A caption should be readable at a glance: roughly two short lines, and long enough
# on screen to actually read.
MAX_CHARS = 84
MIN_CUE_SECONDS = 1.2


def beats() -> list[str]:
    md = SCRIPT.read_text(encoding="utf-8")
    marker = "<!-- narration-start -->"
    body = md[md.index(marker) + len(marker):]
    return [b.strip() for b in re.split(r"^---$", body, flags=re.M) if b.strip()]


def duration(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True,
    ).stdout.strip()
    return float(out.rstrip(","))


def sentences(text: str) -> list[str]:
    """Split on sentence ends, then fold any sentence too long to read at once."""
    parts = re.findall(r"[^.!?]+[.!?]*", text)
    parts = [p.strip() for p in parts if p.strip()]
    out: list[str] = []
    for part in parts:
        if len(part) <= MAX_CHARS:
            out.append(part)
            continue
        # too long: break at commas, else at spaces, keeping chunks under the limit
        chunk = ""
        for piece in re.split(r"(?<=,)\s+", part):
            while len(piece) > MAX_CHARS:
                cut = piece.rfind(" ", 0, MAX_CHARS)
                cut = cut if cut > 0 else MAX_CHARS
                out.append(piece[:cut].strip())
                piece = piece[cut:].strip()
            if len(chunk) + len(piece) + 1 <= MAX_CHARS:
                chunk = f"{chunk} {piece}".strip()
            else:
                if chunk:
                    out.append(chunk)
                chunk = piece
        if chunk:
            out.append(chunk)
    return out


LINE_CHARS = 42


def wrap(text: str) -> str:
    """Two balanced lines read better than one long one. Neither may exceed LINE_CHARS."""
    if len(text) <= LINE_CHARS:
        return text
    words, lines, current = text.split(), [], ""
    for word in words:
        if current and len(current) + 1 + len(word) > LINE_CHARS:
            lines.append(current)
            current = word
        else:
            current = f"{current} {word}".strip()
    if current:
        lines.append(current)
    return "\n".join(lines[:2]) if len(lines) <= 2 else "\n".join([lines[0], " ".join(lines[1:])[:LINE_CHARS]])


def stamp(t: float) -> str:
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


lines = beats()
wavs = sorted(VOICE.glob("beat-*.wav"))
if len(wavs) != len(lines):
    raise SystemExit(f"{len(lines)} narration beats but {len(wavs)} audio files; regenerate the voiceover first")

cues: list[tuple[float, float, str]] = []
clock = 0.0
for text, wav in zip(lines, wavs):
    spoken = duration(wav)
    chunks = sentences(text)
    weights = [len(c) for c in chunks]
    total = sum(weights) or 1
    at = clock
    for chunk, weight in zip(chunks, weights):
        span = spoken * weight / total
        end = at + span
        cues.append((at, end, wrap(chunk)))
        at = end
    clock += spoken + GAP

# A cue too brief to read is worse than a slightly long one, so fold it into its
# neighbour rather than flashing it. Merge forward when the text still fits on two lines.
merged: list[tuple[float, float, str]] = []
for start, end, text in cues:
    if merged:
        p_start, p_end, p_text = merged[-1]
        too_short = (end - start) < MIN_CUE_SECONDS or (p_end - p_start) < MIN_CUE_SECONDS
        joined = f"{p_text.replace(chr(10), ' ')} {text.replace(chr(10), ' ')}"
        if too_short and abs(start - p_end) < 0.05 and len(joined) <= LINE_CHARS * 2:
            merged[-1] = (p_start, end, wrap(joined))
            continue
    merged.append((start, end, text))
cues = merged

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(
    "\n".join(
        f"{i}\n{stamp(a)} --> {stamp(b)}\n{t}\n"
        for i, (a, b, t) in enumerate(cues, start=1)
    ),
    encoding="utf-8",
)

print(f"{len(cues)} cues across {len(lines)} beats -> {OUT}")
print(f"last cue ends at {stamp(cues[-1][1])}")
