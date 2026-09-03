#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$ROOT_DIR/vendor/native"
PREFIX="${MINGW_PREFIX:-/ucrt64}"
BIN="$PREFIX/bin"

mkdir -p "$DEST"
rm -f "$DEST"/*.exe "$DEST"/*.dll "$DEST"/openssl-legacy.cnf "$DEST"/README.txt
rm -rf "$DEST/licenses" "$DEST/ossl-modules"
mkdir -p "$DEST/licenses"

CFLAGS="$(pkg-config --cflags libimobiledevice-1.0)"
LIBS="$(pkg-config --libs libimobiledevice-1.0)"

declare -A seen
declare -A licensed_packages

copy_package_licenses() {
  local file="$1"
  local pkg
  pkg="$(pacman -Qqo "$file" 2>/dev/null || true)"
  [[ -n "$pkg" ]] || return 0
  [[ -z "${licensed_packages[$pkg]:-}" ]] || return 0
  licensed_packages[$pkg]=1

  local out="$DEST/licenses/$pkg"
  mkdir -p "$out"
  while IFS= read -r license_file; do
    [[ -f "$license_file" ]] || continue
    cp "$license_file" "$out/$(basename "$license_file")"
  done < <(pacman -Ql "$pkg" 2>/dev/null | awk '$2 ~ /\/share\/licenses\// && $2 !~ /\/$/ {print $2}')
}

copy_deps() {
  local file="$1"
  while IFS= read -r dep; do
    [[ -n "$dep" ]] || continue
    [[ "$dep" == "$PREFIX"/bin/*.dll ]] || continue
    local base
    base="$(basename "$dep")"
    if [[ -z "${seen[$base]:-}" ]]; then
      seen[$base]=1
      copy_package_licenses "$dep"
      cp "$dep" "$DEST/$base"
      copy_deps "$dep"
    fi
  done < <(ldd "$file" 2>/dev/null | awk '{ for (i=1;i<=NF;i++) if ($i ~ /^\/(ucrt64|mingw64)\/bin\/.*\.dll$/) print $i }')
}

echo "Building read-only AFC helper..."
gcc $CFLAGS "$ROOT_DIR/native/afc_ro.c" -O2 -Wall -Wextra -Werror -o "$DEST/afc-ro.exe" $LIBS -lbcrypt -municode
cp "$ROOT_DIR/native/openssl-legacy.cnf" "$DEST/openssl-legacy.cnf"

for tool in idevice_id ideviceinfo idevicepair; do
  src="$BIN/$tool.exe"
  if [[ ! -f "$src" ]]; then
    echo "Missing required libimobiledevice tool: $src" >&2
    exit 1
  fi
  cp "$src" "$DEST/$tool.exe"
  copy_package_licenses "$src"
done

for exe in "$DEST"/*.exe; do
  copy_deps "$exe"
done

# OpenSSL provider modules are loaded dynamically and therefore do not appear in ldd output.
if [[ -d "$PREFIX/lib/ossl-modules" ]]; then
  mkdir -p "$DEST/ossl-modules"
  for module in "$PREFIX"/lib/ossl-modules/*.dll; do
    [[ -f "$module" ]] || continue
    cp "$module" "$DEST/ossl-modules/$(basename "$module")"
    copy_package_licenses "$module"
  done
fi

cat > "$DEST/README.txt" <<'TXT'
iMusicRecovery native runtime

This directory is generated during the Windows build. It contains:
- afc-ro.exe: iMusicRecovery's read-only AFC transfer helper
- libimobiledevice command-line utilities used for device identity/pairing
- required runtime DLLs from MSYS2
- license notices for staged third-party packages
- an OpenSSL compatibility profile scoped to these native child processes

The helper intentionally exposes list/read operations only. It contains no AFC
write, delete, rename, mkdir, restore, sync, or firmware-update operation.
TXT

printf 'Native runtime staged: %s\n' "$DEST"
ls -lh "$DEST"
