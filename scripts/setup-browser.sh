#!/usr/bin/env bash
#
# One-time (repeatable) setup for the headless-Chromium smoke test on machines
# where root/apt installs are unavailable: Playwright's Chromium needs a handful
# of shared libraries and a fontconfig config, which we unpack into $HOME and
# reference through environment variables instead of installing system-wide.
#
# Usage:
#   ./scripts/setup-browser.sh
#   source ./scripts/browser-env.sh      # exports LD_LIBRARY_PATH + FONTCONFIG_FILE
#   npm run test:smoke
#
set -euo pipefail

PREFIX="${BROWSER_LIBS_DIR:-$HOME/chromelibs}"
FONTCONF_DIR="${FONTCONF_DIR:-$HOME/fontcfg}"
LISTS="${APT_LISTS_DIR:-/tmp/aptstate/lists}"
CACHE="${APT_CACHE_DIR:-/tmp/aptcache}"
WORK="$(mktemp -d)"

if [ "$(id -u)" -eq 0 ]; then
  echo "Running as root: prefer 'npx playwright install-deps chromium' instead." >&2
fi

mkdir -p "$PREFIX" "$FONTCONF_DIR" "$LISTS/partial" "$CACHE/archives/partial"

# Refresh package lists into a writable location (no root needed).
if ! apt-get update \
    -o Dir::State::lists="$LISTS" \
    -o Dir::Cache="$CACHE" \
    -o APT::Get::List-Cleanup=0 >/dev/null 2>&1; then
  echo "apt-get update failed (no network?)" >&2
  exit 1
fi

PACKAGES=(
  libnspr4 libnss3
  libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libxi6 libxrender1
  libxkbcommon0 libasound2t64
  libatk1.0-0t64 libatk-bridge2.0-0t64 libatspi2.0-0t64
  libfontconfig1 libfreetype6 libexpat1
  fontconfig-config fonts-dejavu-core fonts-liberation
)

echo "Downloading ${#PACKAGES[@]} packages..."
(cd "$WORK" && apt-get download \
  -o Dir::State::lists="$LISTS" \
  -o Dir::Cache="$CACHE" \
  "${PACKAGES[@]}" >/dev/null 2>&1) || {
  echo "apt-get download failed" >&2
  exit 1
}

for deb in "$WORK"/*.deb; do
  dpkg-deb -x "$deb" "$PREFIX"
done
rm -rf "$WORK"

# Minimal fontconfig config pointing at the unpacked fonts and a writable cache.
cat > "$FONTCONF_DIR/fonts.conf" <<EOF
<?xml version="1.0"?>
<fontconfig>
  <dir>$PREFIX/usr/share/fonts</dir>
  <cachedir>${FONT_CACHE_DIR:-$HOME/fontcache}</cachedir>
  <match target="font">
    <edit name="antialias" mode="assign"><bool>true</bool></edit>
    <edit name="hinting" mode="assign"><bool>true</bool></edit>
    <edit name="hintstyle" mode="assign"><const>hintslight</const></edit>
  </match>
</fontconfig>
EOF

# Emit the env file the smoke test needs.
cat > "$(dirname "$0")/browser-env.sh" <<EOF
export LD_LIBRARY_PATH="$PREFIX/usr/lib/x86_64-linux-gnu:$PREFIX/lib/x86_64-linux-gnu\${LD_LIBRARY_PATH:+:\$LD_LIBRARY_PATH}"
export FONTCONFIG_FILE="$FONTCONF_DIR/fonts.conf"
export FONTCONFIG_PATH="$FONTCONF_DIR"
EOF

echo "Browser runtime prepared in $PREFIX"
echo "Next: source scripts/browser-env.sh && npm run test:smoke"
