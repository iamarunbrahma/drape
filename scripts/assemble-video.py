# Assembles the captured frames into an MP4 synced to the generated voiceover.
#
# Each beat's frames are time-scaled to that beat's exact narration length, then the last
# frame is held for the same 0.45s gap the voiceover inserts between beats. That way the
# picture cannot drift from the audio no matter how long the capture actually took.

import subprocess, sys
from pathlib import Path

SP = Path("/private/tmp/claude-501/-Users-arunbrahma-Desktop-AltGAN-codepad-hackathons/"
          "be6e9d41-0589-4f01-97fe-8d1d8f6be1d3/scratchpad")
FRAMES = SP / "frames"
VO = Path("/Users/arunbrahma/Desktop/AltGAN/codepad/hackathons/youcam_api/docs/voiceover")
OUT = SP / "drape-demo.mp4"
GAP = 0.45


def dur(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "csv=p=0", str(path)], capture_output=True, text=True)
    return float(r.stdout.strip())


beats = sorted(VO.glob("beat-*.wav"))
lines = []
total = 0.0
last_frame = None

for i, wav in enumerate(beats, start=1):
    d = dur(wav)
    frames = sorted((FRAMES / f"beat-{i:02d}").glob("*.jpg"))
    if not frames:
        print(f"beat {i}: NO FRAMES", file=sys.stderr)
        sys.exit(1)
    per = d / len(frames)
    for f in frames:
        lines.append(f"file '{f}'")
        lines.append(f"duration {per:.5f}")
    # hold the last frame across the silence the voiceover inserts after this beat
    lines.append(f"file '{frames[-1]}'")
    lines.append(f"duration {GAP:.5f}")
    last_frame = frames[-1]
    total += d + GAP
    print(f"beat {i:2d}  {len(frames):4d} frames  {d:6.2f}s  {per*1000:5.1f}ms/frame")

# concat demuxer needs the final image repeated with no duration
lines.append(f"file '{last_frame}'")

listing = SP / "concat_video.txt"
listing.write_text("\n".join(lines) + "\n")
print(f"\nvideo timeline {total:.2f}s, audio {dur(VO / 'voiceover.wav'):.2f}s")

cmd = [
    "ffmpeg", "-y", "-v", "error", "-stats",
    "-f", "concat", "-safe", "0", "-i", str(listing),
    "-i", str(VO / "voiceover.wav"),
    "-map", "0:v:0", "-map", "1:a:0",
    "-vf", "scale=1920:1080:flags=lanczos,format=yuv420p",
    "-r", "30", "-fps_mode", "cfr",
    "-c:v", "libx264", "-preset", "slow", "-crf", "18",
    "-profile:v", "high", "-level", "4.2", "-pix_fmt", "yuv420p",
    "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "160k", "-ar", "48000",
    "-movflags", "+faststart", "-shortest",
    str(OUT),
]
print("\nencoding...")
subprocess.run(cmd, check=True)
print("\nwrote", OUT, f"{OUT.stat().st_size/1e6:.1f} MB, {dur(OUT):.2f}s")
