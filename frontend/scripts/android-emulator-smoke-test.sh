#!/usr/bin/env bash
set -euo pipefail

capture_diagnostics() {
  adb shell dumpsys activity activities > "$RUNNER_TEMP/pishran-activity.txt" 2>&1 || true
  adb logcat -d -v time > "$RUNNER_TEMP/pishran-logcat.txt" 2>&1 || true
}
trap capture_diagnostics EXIT

adb devices -l
adb shell getprop sys.boot_completed
adb shell settings put global package_verifier_enable 0
adb shell settings put global verifier_verify_adb_installs 0
adb logcat -c

APK="$GITHUB_WORKSPACE/frontend/android/app/build/outputs/apk/debug/app-debug.apk"
installed=0
for attempt in 1 2 3; do
  if adb install -r "$APK"; then
    installed=1
    break
  fi
  echo "APK install attempt $attempt failed; retrying after verifier recheck." | tee -a "$RUNNER_TEMP/pishran-launch.txt"
  adb shell settings put global package_verifier_enable 0 || true
  adb shell settings put global verifier_verify_adb_installs 0 || true
  sleep 10
done
if [[ "$installed" -ne 1 ]]; then
  echo "APK installation failed after three attempts." | tee -a "$RUNNER_TEMP/pishran-launch.txt"
  exit 1
fi

adb shell am start -n com.pishran.app/.MainActivity 2>&1 | tee -a "$RUNNER_TEMP/pishran-launch.txt"
resumed=0
for _ in $(seq 1 30); do
  if adb shell dumpsys activity activities | grep -E "mResumedActivity|topResumedActivity" | grep -F "com.pishran.app/.MainActivity"; then
    resumed=1
    break
  fi
  sleep 2
done
sleep 3
capture_diagnostics

if [[ "$resumed" -ne 1 ]]; then
  echo "MainActivity did not reach foreground." >&2
  exit 1
fi
if grep -q "FATAL EXCEPTION" "$RUNNER_TEMP/pishran-logcat.txt"; then
  echo "Fatal exception found in application logcat." >&2
  exit 1
fi
if grep -E "ANR in com.pishran.app|am_anr.*com.pishran.app|Input dispatching timed out.*com.pishran.app" "$RUNNER_TEMP/pishran-logcat.txt"; then
  echo "Application-specific ANR found in logcat." >&2
  exit 1
fi
grep -E "mResumedActivity|topResumedActivity" "$RUNNER_TEMP/pishran-activity.txt" | grep -F "com.pishran.app/.MainActivity"
