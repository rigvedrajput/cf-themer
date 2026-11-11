#!/usr/bin/env python3
"""
CF Themer: package the extension for Firefox (addons.mozilla.org, "AMO").

Run it from the extension folder (the one that contains manifest.json and icons/):

    python build_firefox.py

The Chrome manifest.json stays the single source of truth. This script copies it,
adjusts it for Firefox, and zips the result:
  - removes "minimum_chrome_version" (Firefox does not use it)
  - adds browser_specific_settings.gecko: the add-on ID, the minimum Firefox
    version, and data_collection_permissions (AMO requires it for new add-ons)
  - shortens the name so it fits AMO's 50-character limit

It refuses to build until everything a reviewer would trip over is fixed:
  - every file the manifest and the HTML pages point to exists
  - every icon exists, is a real PNG and has the size its name says
  - no [PLACEHOLDER] text is left in the files that ship or in the policy pages
  - every JavaScript file parses (only checked when Node.js is installed)

Output:
  firefox-build/                      the unpacked Firefox extension (load it for testing)
  CF-Themer-v.<version>-firefox.zip   what you upload to AMO
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
OUT_DIR = ROOT / "firefox-build"

# The add-on ID is permanent: once the add-on is on AMO it can never change.
GECKO_ID = "cf-themer@rigvedrajput.github.io"
# 140 is the first desktop Firefox that understands data_collection_permissions.
# The CSS also needs :has() (121+) and color-mix() (113+), so 140 covers everything.
MIN_FIREFOX = "140.0"
# The Chrome name is 51 characters; AMO allows 50.
FIREFOX_NAME = "CF Themer – Themes & Contests for Codeforces"

RUNTIME = [
    "manifest.json",
    "themes.js", "mashup-core.js", "content.js", "hud.js", "content.css",
    "popup.html", "popup.css", "popup.js",
    "mashup.html", "mashup.css", "mashup.js",
    "LICENSE",
]
ICON_DIR = "icons"

PLACEHOLDERS = ["[DEVELOPER NAME]", "[CONTACT EMAIL]", "[PRIVACY POLICY URL]", "[Your Name]"]
ALSO_CHECK = ["PRIVACY.md", "privacy.html", "STORE_LISTING.md"]

errors, warnings = [], []


def png_size(path):
    data = path.read_bytes()[:24]
    if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        return None
    return struct.unpack(">II", data[16:24])


def manifest_files(m):
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


def firefox_manifest(m):
    f = json.loads(json.dumps(m))  # deep copy
    f.pop("minimum_chrome_version", None)
    f["name"] = FIREFOX_NAME
    f["browser_specific_settings"] = {
        "gecko": {
            "id": GECKO_ID,
            "strict_min_version": MIN_FIREFOX,
            "data_collection_permissions": {"required": ["none"]},
        }
    }
    return f


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
    if len(FIREFOX_NAME) > 50:
        errors.append(f"Firefox name is {len(FIREFOX_NAME)} characters, AMO allows 50")
    if len(str(m.get("description", ""))) > 132:
        errors.append("manifest description is longer than 132 characters")

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
    icons = m.get("icons") or {}
    if not icons:
        errors.append("manifest has no icons")
    for size, rel in icons.items():
        p = ROOT / rel
        if not p.is_file():
            continue
        got = png_size(p)
        if got is None:
            errors.append(f"{rel} is not a valid PNG")
        elif got != (int(size), int(size)):
            errors.append(f"{rel} is {got[0]}x{got[1]}, the manifest says {size}x{size}")

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

    # 5. assemble the unpacked Firefox extension
    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)
    OUT_DIR.mkdir()
    files = [r for r in RUNTIME if r != "manifest.json"]
    files += sorted(str(p.relative_to(ROOT)).replace("\\", "/") for p in (ROOT / ICON_DIR).glob("*.png"))
    for rel in files:
        dest = OUT_DIR / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / rel, dest)
    (OUT_DIR / "manifest.json").write_text(
        json.dumps(firefox_manifest(m), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    files = ["manifest.json"] + files

    # 6. zip it (forward slashes, files at the top level of the zip)
    out = ROOT / f"CF-Themer-v.{version}-firefox.zip"
    if out.exists():
        out.unlink()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for rel in files:
            z.write(OUT_DIR / rel, rel)

    print(f"\nBuilt {out.name} ({out.stat().st_size / 1024:.0f} KB) with {len(files)} files:")
    for rel in files:
        print("  ", rel)
    print(f"\nUnpacked copy for testing: {OUT_DIR.name}/")
    print("Test it: Firefox -> about:debugging#/runtime/this-firefox -> Load Temporary Add-on -> "
          f"pick {OUT_DIR.name}/manifest.json")
    print("Upload the zip at https://addons.mozilla.org/developers/")


if __name__ == "__main__":
    main()
