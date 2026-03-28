import { describe, expect, it } from 'vitest'
import { computeDistance, generateIdealMeasurements, getSpeedOfSound } from '../geometry'

const sensor = {
  id: 'sensor-a',
  label: 'Sensor A',
  x: 0,
  y: 0,
  depth: 10,
  biasMicros: 0,
  enabled: true,
}

describe('geometry', () => {
  it('computes a straight-line distance to the sensor plane', () => {
    const distance = computeDistance({ x: 3, y: 4 }, sensor)
    expect(distance).toBeCloseTo(Math.sqrt(125), 6)
  })

  it('generates ideal arrival times from the configured speed of sound', () => {
    const speed = getSpeedOfSound(20)
    const measurements = generateIdealMeasurements({ x: 0, y: 0 }, [sensor], 20)

    expect(measurements).toHaveLength(1)
    expect(measurements[0].distance).toBeCloseTo(10, 6)
    expect(measurements[0].idealTimeSeconds).toBeCloseTo(10 / speed, 6)
  })
})
