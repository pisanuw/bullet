import type {
  Coordinate,
  SensorConfig,
  SensorMeasurement,
  TargetConfig,
} from '../types/simulation'

export const DEFAULT_TEMPERATURE_CELSIUS = 20

export function getSpeedOfSound(temperatureCelsius: number): number {
  return 331.3 + temperatureCelsius * 0.606
}

export function clampImpact(
  impact: Coordinate,
  target: TargetConfig,
): Coordinate {
  return {
    x: clamp(impact.x, -target.width / 2, target.width / 2),
    y: clamp(impact.y, -target.height / 2, target.height / 2),
  }
}

export function isImpactWithinTarget(
  impact: Coordinate,
  target: TargetConfig,
): boolean {
  return (
    Math.abs(impact.x) <= target.width / 2 &&
    Math.abs(impact.y) <= target.height / 2
  )
}

export function computeDistance(
  impact: Coordinate,
  sensor: Pick<SensorConfig, 'x' | 'y' | 'depth'>,
): number {
  const dx = impact.x - sensor.x
  const dy = impact.y - sensor.y
  return Math.sqrt(dx * dx + dy * dy + sensor.depth * sensor.depth)
}

export function generateIdealMeasurements(
  impact: Coordinate,
  sensors: SensorConfig[],
  temperatureCelsius = DEFAULT_TEMPERATURE_CELSIUS,
): SensorMeasurement[] {
  const speedOfSound = getSpeedOfSound(temperatureCelsius)

  return sensors
    .filter((sensor) => sensor.enabled)
    .map((sensor) => {
      const distance = computeDistance(impact, sensor)
      const idealTimeSeconds = distance / speedOfSound

      return {
        sensorId: sensor.id,
        label: sensor.label,
        distance,
        idealTimeSeconds,
        noisyTimeSeconds: idealTimeSeconds,
        deltaMicros: 0,
      }
    })
}

export function getMissDistance(
  actualImpact: Coordinate,
  estimatedImpact: Coordinate | null,
): number {
  if (!estimatedImpact) {
    return Number.NaN
  }

  const dx = actualImpact.x - estimatedImpact.x
  const dy = actualImpact.y - estimatedImpact.y

  return Math.sqrt(dx * dx + dy * dy)
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum)
}
