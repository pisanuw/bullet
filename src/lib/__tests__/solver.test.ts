import { describe, expect, it } from 'vitest'
import { generateIdealMeasurements, getSpeedOfSound } from '../geometry'
import { createDefaultState } from '../presets'
import { solveTdoa } from '../solver/tdoa'

describe('solveTdoa', () => {
  it('reconstructs the true impact from perfect 3-sensor timing data', () => {
    const state = createDefaultState()
    const sensors = state.sensors.filter((sensor) => sensor.enabled)
    const measurements = generateIdealMeasurements(
      state.impact,
      sensors,
      state.noise.temperatureCelsius,
    )
    const speedOfSound = getSpeedOfSound(state.noise.temperatureCelsius)

    const result = solveTdoa({
      target: state.target,
      sensors,
      measurements,
      speedOfSound,
    })

    expect(result.estimatedImpact).not.toBeNull()
    expect(result.converged).toBe(true)
    expect(result.estimatedImpact?.x).toBeCloseTo(state.impact.x, 2)
    expect(result.estimatedImpact?.y).toBeCloseTo(state.impact.y, 2)
  })
})
