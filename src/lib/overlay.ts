import { computeDistance } from './geometry'
import type {
  Coordinate,
  SensorConfig,
  SensorMeasurement,
  SolverOverlayBundle,
  SolverOverlayCurve,
  SolverOverlayHeatCell,
  TargetConfig,
} from '../types/simulation'

const GRID_SIZE = 22
const CONTOUR_STEPS = 56
const EPSILON = 1e-9

type SensorEntry = {
  sensor: SensorConfig
  measurement: SensorMeasurement
}

export function buildSolverOverlayBundle(input: {
  target: TargetConfig
  sensors: SensorConfig[]
  measurements: SensorMeasurement[]
  estimatedImpact: Coordinate | null
  speedOfSound: number
}): SolverOverlayBundle {
  const sensorEntries = getSensorEntries(input.sensors, input.measurements)

  if (sensorEntries.length < 3) {
    return { hyperbolaCurves: [], residualHeatmap: [] }
  }

  const reference = [...sensorEntries].sort(
    (left, right) => left.measurement.noisyTimeSeconds - right.measurement.noisyTimeSeconds,
  )[0]

  const hyperbolaCurves = sensorEntries
    .filter((entry) => entry.sensor.id !== reference.sensor.id)
    .map((entry, index) =>
      buildHyperbolaCurve({
        target: input.target,
        reference,
        comparison: entry,
        speedOfSound: input.speedOfSound,
        colorIndex: index,
      }),
    )
    .filter((curve): curve is SolverOverlayCurve => curve !== null)

  const residualHeatmap = input.estimatedImpact
    ? buildResidualHeatmap({
        target: input.target,
        sensorEntries,
        estimatedImpact: input.estimatedImpact,
        speedOfSound: input.speedOfSound,
      })
    : []

  return {
    hyperbolaCurves,
    residualHeatmap,
  }
}

function buildHyperbolaCurve(input: {
  target: TargetConfig
  reference: SensorEntry
  comparison: SensorEntry
  speedOfSound: number
  colorIndex: number
}): SolverOverlayCurve | null {
  const deltaDistance =
    (input.comparison.measurement.noisyTimeSeconds -
      input.reference.measurement.noisyTimeSeconds) *
    input.speedOfSound
  const yValues = Array.from({ length: CONTOUR_STEPS + 1 }, (_, index) =>
    -input.target.height / 2 + (input.target.height * index) / CONTOUR_STEPS,
  )
  const pointRows: Coordinate[][] = []

  for (const y of yValues) {
    const row = sampleRow(input.target, y, (x) =>
      evaluateHyperbola(
        { x, y },
        input.reference.sensor,
        input.comparison.sensor,
        deltaDistance,
      ),
    )

    if (row.length > 0) {
      pointRows.push(row)
    }
  }

  const branches = splitCurveBranches(pointRows)
  if (branches.length === 0) {
    return null
  }

  return {
    id: `${input.reference.sensor.id}-${input.comparison.sensor.id}`,
    label: `${input.comparison.sensor.label} vs ${input.reference.sensor.label}`,
    colorToken: getCurveColor(input.colorIndex),
    branches,
  }
}

function buildResidualHeatmap(input: {
  target: TargetConfig
  sensorEntries: SensorEntry[]
  estimatedImpact: Coordinate
  speedOfSound: number
}): SolverOverlayHeatCell[] {
  const estimatedOffset = getEstimatedOffset(
    input.estimatedImpact,
    input.sensorEntries,
    input.speedOfSound,
  )
  const cells: SolverOverlayHeatCell[] = []
  let maxResidual = 0

  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let column = 0; column < GRID_SIZE; column += 1) {
      const x =
        -input.target.width / 2 +
        ((column + 0.5) * input.target.width) / GRID_SIZE
      const y =
        input.target.height / 2 -
        ((row + 0.5) * input.target.height) / GRID_SIZE
      const residualMicros = computeResidualMicros(
        { x, y },
        input.sensorEntries,
        estimatedOffset,
        input.speedOfSound,
      )
      maxResidual = Math.max(maxResidual, residualMicros)
      cells.push({
        x,
        y,
        width: input.target.width / GRID_SIZE,
        height: input.target.height / GRID_SIZE,
        residualMicros,
        normalized: 0,
      })
    }
  }

  const denominator = Math.max(maxResidual, 1)

  return cells.map((cell) => ({
    ...cell,
    normalized: Math.min(cell.residualMicros / denominator, 1),
  }))
}

function evaluateHyperbola(
  point: Coordinate,
  reference: SensorConfig,
  comparison: SensorConfig,
  deltaDistance: number,
): number {
  return (
    computeDistance(point, comparison) -
    computeDistance(point, reference) -
    deltaDistance
  )
}

function sampleRow(
  target: TargetConfig,
  y: number,
  evaluator: (x: number) => number,
): Coordinate[] {
  const row: Coordinate[] = []
  const step = target.width / CONTOUR_STEPS
  let previousX = -target.width / 2
  let previousValue = evaluator(previousX)

  if (Math.abs(previousValue) < EPSILON) {
    row.push({ x: previousX, y })
  }

  for (let index = 1; index <= CONTOUR_STEPS; index += 1) {
    const currentX = -target.width / 2 + step * index
    const currentValue = evaluator(currentX)

    if (Math.abs(currentValue) < EPSILON) {
      row.push({ x: currentX, y })
    }

    if (previousValue === 0 || currentValue === 0 || previousValue * currentValue < 0) {
      const ratio = previousValue / (previousValue - currentValue)
      row.push({
        x: previousX + (currentX - previousX) * ratio,
        y,
      })
    }

    previousX = currentX
    previousValue = currentValue
  }

  return row.sort((left, right) => left.x - right.x)
}

function splitCurveBranches(pointRows: Coordinate[][]): Coordinate[][] {
  const branches: Coordinate[][] = []

  for (const row of pointRows) {
    row.forEach((point, index) => {
      if (!branches[index]) {
        branches[index] = []
      }

      const branch = branches[index]
      const previousPoint = branch[branch.length - 1]
      if (!previousPoint || Math.abs(previousPoint.x - point.x) < 12) {
        branch.push(point)
      }
    })
  }

  return branches.filter((branch) => branch.length > 1)
}

function getEstimatedOffset(
  estimatedImpact: Coordinate,
  sensorEntries: SensorEntry[],
  speedOfSound: number,
): number {
  let sum = 0

  for (const entry of sensorEntries) {
    sum +=
      entry.measurement.noisyTimeSeconds -
      computeDistance(estimatedImpact, entry.sensor) / speedOfSound
  }

  return sum / sensorEntries.length
}

function computeResidualMicros(
  point: Coordinate,
  sensorEntries: SensorEntry[],
  timeOffset: number,
  speedOfSound: number,
): number {
  let sum = 0

  for (const entry of sensorEntries) {
    const predicted = computeDistance(point, entry.sensor) / speedOfSound + timeOffset
    const residualMicros = (predicted - entry.measurement.noisyTimeSeconds) * 1_000_000
    sum += residualMicros * residualMicros
  }

  return Math.sqrt(sum / sensorEntries.length)
}

function getSensorEntries(
  sensors: SensorConfig[],
  measurements: SensorMeasurement[],
): SensorEntry[] {
  const measurementMap = new Map(
    measurements.map((measurement) => [measurement.sensorId, measurement]),
  )

  return sensors
    .filter((sensor) => sensor.enabled)
    .map((sensor) => ({ sensor, measurement: measurementMap.get(sensor.id) }))
    .filter(
      (entry): entry is SensorEntry =>
        Boolean(entry.measurement),
    )
}

function getCurveColor(index: number): string {
  const tokens = ['curve-a', 'curve-b', 'curve-c']
  return tokens[index % tokens.length]
}
