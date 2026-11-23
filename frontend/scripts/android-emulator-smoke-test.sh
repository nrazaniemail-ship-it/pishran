#!/usr/bin/env bash
set -euo pipefail

capture_diagnostics() {
  adb shell dumpsys activity activities > "$RUNNER_TEMP/pishran-activity.txt" 2>&1 || true
  adb logcat -d -v time > "$RUNNER_TEMP/pishran-logcat.txt" 2>&1 || true
}
trap capture_diagnostics EXIT

app_activity_record() {
  adb shell dumpsys activity activities | awk '
    /ActivityRecord.*com\\.pishran\\.app\\/\\.MainActivity/ { capture=1 }
    capture { print }
    capture && /mIsExiting=/ { exit }
  '
}

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
ui_drawn=0
# Foreground Activity alone is not sufficient: Android can report MainActivity
# as resumed while its splash-screen starting window is still covering the UI.
for attempt in $(seq 1 60); do
  activity_dump="$(adb shell dumpsys activity activities)"
  if printf '%s\\n' "$activity_dump" | grep -E "mResumedActivity|topResumedActivity" | grep -Fq "com.pishran.app/.MainActivity"; then
    resumed=1
  fi

  app_record="$(printf '%s\\n' "$activity_dump" | awk '
    /ActivityRecord.*com\\.pishran\\.app\\/\\.MainActivity/ { capture=1 }
    capture { print }
    capture && /mIsExiting=/ { exit }
  ')"
  if [[ "$resumed" -eq 1 ]] &&
     printf '%s\\n' "$app_record" | grep -q "firstWindowDrawn=true" &&
     printf '%s\\n' "$app_record" | grep -q "reportedDrawn=true" &&
     ! printf '%s\\n' "$activity_dump" | grep -q "mTopFullscreenOpaqueWindowState=Window.*Splash Screen com.pishran.app"; then
    ui_drawn=1
    break
  fi
  sleep 2
done

capture_diagnostics

if [[ "$resumed" -ne 1 ]]; then
  echo "MainActivity did not reach foreground within 120 seconds." >&2
  exit 1
fi
if [[ "$ui_drawn" -ne 1 ]]; then
  echo "MainActivity stayed on its splash screen or did not report its first window drawn within 120 seconds." >&2
  grep -E "topResumedActivity|firstWindowDrawn|reportedDrawn|mTopFullscreenOpaqueWindowState" "$RUNNER_TEMP/pishran-activity.txt" >&2 || true
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
echo "MainActivity reached foreground and drew its first window; splash screen dismissed."
grep -E "mResumedActivity|topResumedActivity" "$RUNNER_TEMP/pishran-activity.txt" | grep -F "com.pishran.app/.MainActivity"
