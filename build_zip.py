#!/usr/bin/env python3
"""
CF Themer: package the extension for the Chrome Web Store.

Run it from the extension folder (the one that contains manifest.json):

    python build_zip.py

It refuses to build until everything a store reviewer would trip over is fixed:
  - every file the manifest and the HTML pages point to exists
  - every icon exists, is a real PNG and has the size its name says
  - no [PLACEHOLDER] text is left in the files that ship or in the policy pages
  - every JavaScript file parses (only checked when Node.js is installed)

Only the runtime files go into the zip, at the top level of the zip (not inside
a folder). README, tests, store notes and this script are left out on purpose.
"""
import json
import re
import shutil
import struct
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# Everything the extension needs at runtime. Add a file here if you add one to the extension.
RUNTIME = [
    "manifest.json",
    "themes.js", "mashup-core.js", "content.js", "hud.js", "content.css",
    "popup.html", "popup.css", "popup.js",
    "mashup.html", "mashup.css", "mashup.js",
    "LICENSE",
]
ICON_DIR = "icons"

# Text that must be replaced with real details before release.
PLACEHOLDERS = ["[DEVELOPER NAME]", "[CONTACT EMAIL]", "[PRIVACY POLICY URL]", "[Your Name]"]
# Files that are not shipped but must also be filled in (they are published or pasted elsewhere).
ALSO_CHECK = ["PRIVACY.md", "privacy.html", "STORE_LISTING.md"]

errors, warnings = [], []


def png_size(path):
    data = path.read_bytes()[:24]
    if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        return None
    return struct.unpack(">II", data[16:24])


def manifest_files(m):
    """Every path the manifest points to."""
    out = set()
    for cs in m.get("content_scripts", []):
        out.update(cs.get("js", []))
        out.update(cs.get("css", []))
    act = m.get("action", {})
    if act.get("default_popup"):
        out.add(act["default_popup"])
    di = act.get("default_icon", {})
    out.update(di.values() if isinstance(di, dict) else [di])
    out.update((m.get("icons") or {}).values())
    return out


def html_refs(path):
    text = path.read_text(encoding="utf-8")
    refs = re.findall(r'(?:src|href)="([^"]+)"', text)
    return [r for r in refs if not re.match(r"(https?:|#|data:|mailto:)", r)]


def main():
    mpath = ROOT / "manifest.json"
    if not mpath.exists():
        sys.exit("manifest.json not found. Run this script from the extension folder.")
    try:
        m = json.loads(mpath.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        sys.exit(f"manifest.json is not valid JSON: {e}")

    version = str(m.get("version", ""))
    if not re.fullmatch(r"\d+(\.\d+){0,3}", version):
        errors.append(f"manifest version '{version}' is not like 1.2.3")

    # 1. files exist
    needed = manifest_files(m)
    for name in ("popup.html", "mashup.html"):
        p = ROOT / name
        if p.exists():
            needed.update(html_refs(p))
    for rel in sorted(needed):
        if not (ROOT / rel).is_file():
            errors.append(f"missing file: {rel}")
    for rel in RUNTIME:
        if not (ROOT / rel).is_file():
            errors.append(f"missing runtime file: {rel}")

    # 2. icons
    for size, rel in (m.get("icons") or {}).items():
        p = ROOT / rel
        if not p.is_file():
            continue
        got = png_size(p)
        if got is None:
            errors.append(f"{rel} is not a valid PNG")
        elif got != (int(size), int(size)):
            errors.append(f"{rel} is {got[0]}x{got[1]}, the manifest says {size}x{size}")
    if not (m.get("icons") or {}):
        errors.append("manifest has no icons")

    # 3. placeholders
    for rel in RUNTIME + ALSO_CHECK:
        p = ROOT / rel
        if not p.is_file():
            if rel in ALSO_CHECK:
                warnings.append(f"{rel} not found (skipped placeholder check)")
            continue
        try:
            text = p.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for ph in PLACEHOLDERS:
            if ph in text:
                errors.append(f"{rel} still contains {ph}")

    # 4. JavaScript parses
    node = shutil.which("node")
    if node:
        for rel in RUNTIME:
            if rel.endswith(".js") and (ROOT / rel).is_file():
                r = subprocess.run([node, "--check", str(ROOT / rel)], capture_output=True, text=True)
                if r.returncode != 0:
                    errors.append(f"{rel} has a syntax error:\n{r.stderr.strip()}")
    else:
        warnings.append("Node.js not found: JavaScript syntax was not checked")

    for w in warnings:
        print("warning:", w)
    if errors:
        print("\nNot built. Fix these first:")
        for e in errors:
            print("  x", e)
        sys.exit(1)

    out = ROOT / f"CF-Themer-{version}.zip"
    if out.exists():
        out.unlink()
    files = list(RUNTIME) + sorted(
        str(p.relative_to(ROOT)).replace("\\", "/") for p in (ROOT / ICON_DIR).glob("*.png")
    )
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for rel in files:
            z.write(ROOT / rel, rel)   # forward slashes, files at the top level of the zip
    print(f"\nBuilt {out.name} ({out.stat().st_size / 1024:.0f} KB) with {len(files)} files:")
    for rel in files:
        print("  ", rel)
    print("\nUpload this zip in the Chrome Web Store dashboard.")


if __name__ == "__main__":
    main()
