import { describe, expect, it } from 'vitest'
import { generateIdealMeasurements, getSpeedOfSound } from '../geometry'
import { buildSolverOverlayBundle } from '../overlay'
import { createDefaultState } from '../presets'
import { solveTdoa } from '../solver/tdoa'

describe('buildSolverOverlayBundle', () => {
  it('builds hyperbola curves and a residual heatmap for a valid 3-sensor solution', () => {
    const state = createDefaultState()
    const sensors = state.sensors.filter((sensor) => sensor.enabled)
    const measurements = generateIdealMeasurements(
      state.impact,
      sensors,
      state.noise.temperatureCelsius,
    )
    const speedOfSound = getSpeedOfSound(state.noise.temperatureCelsius)
    const solver = solveTdoa({
      target: state.target,
      sensors,
      measurements,
      speedOfSound,
    })

    const overlays = buildSolverOverlayBundle({
      target: state.target,
      sensors,
      measurements,
      estimatedImpact: solver.estimatedImpact,
      speedOfSound,
    })

    expect(overlays.hyperbolaCurves.length).toBeGreaterThan(0)
    expect(overlays.hyperbolaCurves.every((curve) => curve.branches.length > 0)).toBe(true)
    expect(overlays.residualHeatmap).toHaveLength(22 * 22)
    expect(overlays.residualHeatmap.every((cell) => cell.normalized >= 0 && cell.normalized <= 1)).toBe(true)
  })
})
