import { startTransition, useEffect, useState } from 'react'
import './App.css'
import { ConfigPanel } from './components/ConfigPanel'
import { DiagnosticsPanel } from './components/DiagnosticsPanel'
import { SensorPanel } from './components/SensorPanel'
import { TargetCanvas } from './components/TargetCanvas'
import { generateIdealMeasurements, getMissDistance, getSpeedOfSound } from './lib/geometry'
import { applyNoiseProfile } from './lib/noise'
import { buildSolverOverlayBundle } from './lib/overlay'
import { PRESETS, createDefaultState } from './lib/presets'
import { solveMultilateration } from './lib/solver/multilateration'
import { solveTdoa } from './lib/solver/tdoa'
import { loadStoredState, saveStoredState } from './lib/storage'
import { validateLayout } from './lib/validation'
import type {
  Coordinate,
  NoiseProfile,
  OverlayVisibility,
  SensorConfig,
  SimulationState,
  TargetConfig,
} from './types/simulation'

function App() {
  const [state, setState] = useState<SimulationState>(
    () => loadStoredState() ?? createDefaultState(),
  )

  useEffect(() => {
    saveStoredState(state)
  }, [state])

  const [overlayVisibility, setOverlayVisibility] = useState<OverlayVisibility>({
    showHyperbolas: true,
    showResidualHeatmap: true,
  })

  const activeSensors = state.sensors.filter((sensor) => sensor.enabled)
  const validationIssues = validateLayout(state.target, state.sensors)
  const speedOfSound = getSpeedOfSound(state.noise.temperatureCelsius)
  const idealMeasurements = generateIdealMeasurements(
    state.impact,
    state.sensors,
    state.noise.temperatureCelsius,
  )
  const measurements = applyNoiseProfile(
    idealMeasurements,
    state.sensors,
    state.noise,
  )
  const solver =
    validationIssues.length === 0
      ? activeSensors.length > 3
        ? solveMultilateration({
            target: state.target,
            sensors: activeSensors,
            measurements,
            speedOfSound,
          })
        : solveTdoa({
            target: state.target,
            sensors: activeSensors,
            measurements,
            speedOfSound,
          })
      : {
          estimatedImpact: null,
          converged: false,
          iterations: 0,
          residualMicros: Number.NaN,
          confidence: 'low' as const,
          trace: validationIssues.map((issue) => ({
            label: 'Validation',
            value: issue,
          })),
        }
  const missDistance = getMissDistance(state.impact, solver.estimatedImpact)
  const overlays = buildSolverOverlayBundle({
    target: state.target,
    sensors: activeSensors,
    measurements,
    estimatedImpact: solver.estimatedImpact,
    speedOfSound,
  })

  function updateTarget(field: keyof Pick<TargetConfig, 'width' | 'height'>, value: number) {
    startTransition(() => {
      setState((current) => {
        const target = {
          ...current.target,
          [field]: clampNumber(value, 30, 300),
        }

        return {
          ...current,
          target,
          impact: clampCoordinate(current.impact, target),
        }
      })
    })
  }

  function updateSensor(
    sensorId: string,
    field: keyof SensorConfig,
    value: number | boolean,
  ) {
    startTransition(() => {
      setState((current) => ({
        ...current,
        sensors: current.sensors.map((sensor) =>
          sensor.id === sensorId ? { ...sensor, [field]: value } : sensor,
        ),
      }))
    })
  }

  function updateNoise(field: keyof NoiseProfile, value: number | boolean) {
    startTransition(() => {
      setState((current) => ({
        ...current,
        noise: {
          ...current.noise,
          [field]: value,
        },
      }))
    })
  }

  function updateImpact(impact: Coordinate) {
    startTransition(() => {
      setState((current) => ({
        ...current,
        impact: clampCoordinate(impact, current.target),
      }))
    })
  }

  function applyPreset(presetId: string) {
    const preset = PRESETS.find((candidate) => candidate.id === presetId)
    if (!preset) {
      return
    }

    startTransition(() => {
      setState(JSON.parse(JSON.stringify(preset.state)) as SimulationState)
    })
  }

  function resetState() {
    startTransition(() => {
      setState(createDefaultState())
    })
  }

  function updateOverlayVisibility(field: keyof OverlayVisibility, value: boolean) {
    setOverlayVisibility((current) => ({
      ...current,
      [field]: value,
    }))
  }

  return (
    <main className="app-shell">
      <section className="hero-panel card">
        <div>
          <p className="eyebrow">Acoustic Impact Simulator</p>
          <h1>Simulate exactly where the bullet struck the target.</h1>
        </div>
        <p className="hero-copy">
          This prototype models a rectangular target, acoustic sensors mounted behind it,
          noisy arrival timing, and a TDOA solver that reconstructs the impact point.
        </p>
        <div className="hero-stats">
          <div>
            <span>Layout</span>
            <strong>{activeSensors.length} active sensors</strong>
          </div>
          <div>
            <span>Model</span>
            <strong>2D plane + depth</strong>
          </div>
          <div>
            <span>Physics</span>
            <strong>{state.noise.enabled ? 'Noisy timing enabled' : 'Ideal timing only'}</strong>
          </div>
        </div>
      </section>

      <section className="workspace-grid">
        <div className="workspace-main">
          <TargetCanvas
            target={state.target}
            sensors={state.sensors}
            actualImpact={state.impact}
            estimatedImpact={solver.estimatedImpact}
            overlays={overlays}
            overlayVisibility={overlayVisibility}
            onImpactSelect={updateImpact}
            onOverlayVisibilityChange={updateOverlayVisibility}
          />
          <SensorPanel measurements={measurements} />
        </div>

        <div className="workspace-side">
          <DiagnosticsPanel
            actualImpact={state.impact}
            estimatedImpact={solver.estimatedImpact}
            missDistance={missDistance}
            speedOfSound={speedOfSound}
            activeSensorCount={activeSensors.length}
            solver={solver}
            units={state.target.units}
          />
          <ConfigPanel
            target={state.target}
            sensors={state.sensors}
            noise={state.noise}
            presets={PRESETS.map((preset) => ({ id: preset.id, name: preset.name }))}
            validationIssues={validationIssues}
            onTargetChange={updateTarget}
            onSensorChange={updateSensor}
            onNoiseChange={updateNoise}
            onPresetSelect={applyPreset}
            onReset={resetState}
          />
        </div>
      </section>
    </main>
  )
}

function clampCoordinate(impact: Coordinate, target: TargetConfig): Coordinate {
  return {
    x: clampNumber(impact.x, -target.width / 2, target.width / 2),
    y: clampNumber(impact.y, -target.height / 2, target.height / 2),
  }
}

function clampNumber(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum)
}

export default App
