import type { SensorConfig, TargetConfig } from '../types/simulation'

export function validateLayout(
  target: TargetConfig,
  sensors: SensorConfig[],
): string[] {
  const issues: string[] = []
  const activeSensors = sensors.filter((sensor) => sensor.enabled)

  if (activeSensors.length < 3) {
    issues.push('Activate at least three sensors before solving.')
  }

  if (activeSensors.length > 4) {
    issues.push('The current solver supports up to four active sensors.')
  }

  for (const sensor of activeSensors) {
    if (sensor.depth <= 0) {
      issues.push(`${sensor.label} must sit behind the target with a positive depth.`)
    }

    if (Math.abs(sensor.x) > target.width || Math.abs(sensor.y) > target.height) {
      issues.push(`${sensor.label} is positioned far outside the target footprint.`)
    }
  }

  for (let index = 0; index < activeSensors.length; index += 1) {
    const left = activeSensors[index]
    for (let compareIndex = index + 1; compareIndex < activeSensors.length; compareIndex += 1) {
      const right = activeSensors[compareIndex]
      const sameProjectedPoint = left.x === right.x && left.y === right.y
      const sameDepth = left.depth === right.depth
      if (sameProjectedPoint && sameDepth) {
        issues.push(`${left.label} and ${right.label} overlap.`)
      }
    }
  }

  if (activeSensors.length >= 3) {
    const [first, second, third] = activeSensors
    const twiceArea = Math.abs(
      first.x * (second.y - third.y) +
        second.x * (third.y - first.y) +
        third.x * (first.y - second.y),
    )

    if (twiceArea < 1) {
      issues.push('The first three active sensors are nearly colinear on the target plane.')
    }
  }

  return [...new Set(issues)]
}
