import { mean, stdDev } from './mathUtils';

export function isNightHour(settings) {
  const h = new Date().getHours();
  return h >= settings.LYING_NIGHT_START || h < settings.LYING_NIGHT_END;
}

export function classifyActivityRaw(mags, recentPeakCount, settings) {
  if (!mags || mags.length < 10) return "UNKNOWN";

  const avgMag = mean(mags);
  const magStd = stdDev(mags);

  const excitedCount = mags.filter(m => m > settings.EXCITED_MAG).length;
  if (excitedCount >= settings.EXCITED_COUNT) return "EXCITED";

  const stdInWalkRange = magStd >= settings.WALK_STD_MIN && magStd <= settings.WALK_STD_MAX;
  const hasRhythm      = recentPeakCount >= settings.WALK_PEAKS_MIN;

  if (stdInWalkRange && hasRhythm) return "WALKING";

  if (magStd < settings.STILL_STD_MAX &&
      avgMag > settings.STILL_MAG_MIN &&
      avgMag < settings.STILL_MAG_MAX) return "STILL";

  return "UNKNOWN";
}

export function detectSteps(smoothedMags, timestamps, stateRef, lastStepTimeRef, settings) {
  let newSteps = 0;
  for (let i = 0; i < smoothedMags.length; i++) {
    const mag  = smoothedMags[i];
    const time = timestamps[i];
    switch (stateRef.current) {
      case "VALLEY":
        if (mag > settings.MAG_PEAK_THRESHOLD) stateRef.current = "RISING";
        break;
      case "RISING":
        if (mag < settings.MAG_PEAK_THRESHOLD) stateRef.current = "FALLING";
        break;
      case "FALLING":
        if (mag <= settings.MAG_VALLEY_THRESHOLD) {
          if (time - lastStepTimeRef.current >= settings.COOLDOWN_MS) {
            newSteps++;
            lastStepTimeRef.current = time;
          }
          stateRef.current = "VALLEY";
        } else if (mag > settings.MAG_PEAK_THRESHOLD) stateRef.current = "RISING";
        break;
      default:
        stateRef.current = "VALLEY";
    }
  }
  return newSteps;
}
