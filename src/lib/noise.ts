import type { NoiseProfile, SensorConfig, SensorMeasurement } from '../types/simulation'

export function applyNoiseProfile(
  measurements: SensorMeasurement[],
  sensors: SensorConfig[],
  noise: NoiseProfile,
  random = Math.random,
): SensorMeasurement[] {
  if (!noise.enabled) {
    return measurements.map((measurement) => ({
      ...measurement,
      noisyTimeSeconds: measurement.idealTimeSeconds,
      deltaMicros: 0,
    }))
  }

  const globalSpeedOffset =
    ((random() * 2 - 1) * noise.speedVariationPercent) / 100
  const driftSeconds = noise.clockDriftMicros / 1_000_000

  return measurements.map((measurement) => {
    const sensor = sensors.find((candidate) => candidate.id === measurement.sensorId)
    const biasSeconds = (sensor?.biasMicros ?? 0) / 1_000_000
    const jitterSeconds = gaussianNoise(random) * noise.timingJitterMicros / 1_000_000
    const noisyTimeSeconds =
      measurement.idealTimeSeconds * (1 + globalSpeedOffset) +
      driftSeconds +
      biasSeconds +
      jitterSeconds

    return {
      ...measurement,
      noisyTimeSeconds,
      deltaMicros: (noisyTimeSeconds - measurement.idealTimeSeconds) * 1_000_000,
    }
  })
}

function gaussianNoise(random: () => number): number {
  let first = random()
  let second = random()

  if (first === 0) {
    first = Number.MIN_VALUE
  }

  if (second === 0) {
    second = Number.MIN_VALUE
  }

  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second)
}
