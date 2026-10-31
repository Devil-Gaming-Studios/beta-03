#!/usr/bin/env bash
# Builds a signed debug APK for the Mast Meals test shell without Gradle or AGP.
# Requires: Android SDK build-tools + platform, a JDK (javac/keytool), python.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

if [ -n "${ANDROID_SDK_ROOT:-}" ]; then
  SDK="$ANDROID_SDK_ROOT"
elif [ -d "$(cygpath -u "${LOCALAPPDATA:-}" 2>/dev/null)/Android/Sdk" ]; then
  SDK="$(cygpath -u "$LOCALAPPDATA")/Android/Sdk"
else
  echo "Android SDK not found; set ANDROID_SDK_ROOT" >&2
  exit 1
fi

BT="$(ls -d "$SDK"/build-tools/* | sort -V | tail -1)"
PLATFORM_DIR="$(ls -d "$SDK"/platforms/android-* | sort -V | tail -1)"
ANDROID_JAR="$PLATFORM_DIR/android.jar"
MIN_SDK=24
TARGET_SDK="$(basename "$PLATFORM_DIR" | sed 's/android-//')"

echo "build-tools: $(basename "$BT")"
echo "platform:    android-$TARGET_SDK"

rm -rf build
mkdir -p build/classes build/dex

echo "== javac"
javac --release 17 -Xlint:-options -cp "$ANDROID_JAR" -d build/classes \
  java/com/mastmeals/shell/*.java

# The d8/apksigner launchers are .bat on Windows, so drive their jars with java.
javad8() { java -cp "$BT/lib/d8.jar" com.android.tools.r8.D8 "$@"; }
apksigner() { java -jar "$BT/lib/apksigner.jar" "$@"; }

# Strip Windows path prefixes if the SDK path came through cygpath.
echo "== d8"
javad8 --lib "$ANDROID_JAR" --min-api "$MIN_SDK" --output build/dex \
  build/classes/com/mastmeals/shell/*.class

echo "== aapt2 link"
"$BT/aapt2.exe" link -o build/base.apk \
  -I "$ANDROID_JAR" \
  --manifest AndroidManifest.xml \
  --min-sdk-version "$MIN_SDK" \
  --target-sdk-version "$TARGET_SDK" \
  --version-code 1 --version-name 0.1-test

echo "== package classes.dex"
python - <<'PY'
import zipfile
with zipfile.ZipFile("build/base.apk", "a", zipfile.ZIP_DEFLATED) as z:
    z.write("build/dex/classes.dex", "classes.dex")
PY

echo "== zipalign"
"$BT/zipalign.exe" -f 4 build/base.apk build/aligned.apk

mkdir -p keystore
KS="keystore/test-release.keystore"
if [ ! -f "$KS" ]; then
  echo "== generating test keystore"
  keytool -genkeypair -keystore "$KS" -alias mastmeals -storetype PKCS12 \
    -storepass mastmeals -keypass mastmeals \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=Mast Meals Test,O=Mast Meals,C=IN" >/dev/null
fi

echo "== sign"
apksigner sign --ks "$KS" --ks-pass pass:mastmeals --key-pass pass:mastmeals \
  --out build/MastMeals-test.apk build/aligned.apk

echo "== verify"
apksigner verify --print-certs build/MastMeals-test.apk | head -5
"$BT/aapt2.exe" dump badging build/MastMeals-test.apk | head -4

cp build/MastMeals-test.apk "$HERE/../MastMeals-test.apk"
echo "OK -> $(cd .. && pwd)/MastMeals-test.apk ($(wc -c < build/MastMeals-test.apk) bytes)"
