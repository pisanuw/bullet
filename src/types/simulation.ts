export type Coordinate = {
  x: number
  y: number
}

export type TargetConfig = {
  width: number
  height: number
  label: string
  units: string
}

export type SensorConfig = {
  id: string
  label: string
  x: number
  y: number
  depth: number
  biasMicros: number
  enabled: boolean
}

export type NoiseProfile = {
  enabled: boolean
  timingJitterMicros: number
  clockDriftMicros: number
  speedVariationPercent: number
  temperatureCelsius: number
}

export type SensorMeasurement = {
  sensorId: string
  label: string
  distance: number
  idealTimeSeconds: number
  noisyTimeSeconds: number
  deltaMicros: number
}

export type TraceEntry = {
  label: string
  value: string
}

export type SolverOverlayCurve = {
  id: string
  label: string
  colorToken: string
  branches: Coordinate[][]
}

export type SolverOverlayHeatCell = {
  x: number
  y: number
  width: number
  height: number
  residualMicros: number
  normalized: number
}

export type SolverOverlayBundle = {
  hyperbolaCurves: SolverOverlayCurve[]
  residualHeatmap: SolverOverlayHeatCell[]
}

export type SolverConfidence = 'high' | 'medium' | 'low'

export type SolverResult = {
  estimatedImpact: Coordinate | null
  converged: boolean
  iterations: number
  residualMicros: number
  confidence: SolverConfidence
  trace: TraceEntry[]
}

export type SimulationState = {
  target: TargetConfig
  sensors: SensorConfig[]
  noise: NoiseProfile
  impact: Coordinate
}

export type OverlayVisibility = {
  showHyperbolas: boolean
  showResidualHeatmap: boolean
}

export type Preset = {
  id: string
  name: string
  description: string
  state: SimulationState
}
