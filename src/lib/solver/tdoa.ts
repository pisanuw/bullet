import { clampImpact, computeDistance } from '../geometry'
import type {
  Coordinate,
  SensorConfig,
  SensorMeasurement,
  SolverResult,
  TargetConfig,
  TraceEntry,
} from '../../types/simulation'

type SolverInput = {
  target: TargetConfig
  sensors: SensorConfig[]
  measurements: SensorMeasurement[]
  speedOfSound: number
}

const MAX_ITERATIONS = 16
const EPSILON = 1e-6

export function solveTdoa(input: SolverInput): SolverResult {
  const activeSensors = input.sensors.filter((sensor) => sensor.enabled)

  if (activeSensors.length < 3 || input.measurements.length < 3) {
    return buildFailure('Need at least 3 active sensors to solve.', 0)
  }

  const measurementsById = new Map(
    input.measurements.map((measurement) => [measurement.sensorId, measurement]),
  )
  const sensorData = activeSensors
    .map((sensor) => ({
      sensor,
      measurement: measurementsById.get(sensor.id),
    }))
    .filter(
      (
        entry,
      ): entry is { sensor: SensorConfig; measurement: SensorMeasurement } =>
        Boolean(entry.measurement),
    )

  if (sensorData.length < 3) {
    return buildFailure('Missing measurements for active sensors.', 0)
  }

  const earliestMeasurement = [...input.measurements].sort(
    (left, right) => left.noisyTimeSeconds - right.noisyTimeSeconds,
  )[0]

  const trace: TraceEntry[] = [
    {
      label: 'Earliest arrival',
      value: `${earliestMeasurement.label} (${earliestMeasurement.noisyTimeSeconds.toFixed(6)} s)`,
    },
  ]

  let estimate = clampImpact(getInitialGuess(activeSensors, input.measurements), input.target)
  let timeOffset = getInitialOffset(estimate, sensorData, input.speedOfSound)
  let converged = false
  let iterations = 0

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
    iterations = iteration + 1

    const normalMatrix = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]
    const normalVector = [0, 0, 0]

    for (const entry of sensorData) {
      const distance = computeDistance(estimate, entry.sensor)
      const predictedTime = distance / input.speedOfSound + timeOffset
      const residual = predictedTime - entry.measurement.noisyTimeSeconds
      const row = [
        (estimate.x - entry.sensor.x) /
          (input.speedOfSound * Math.max(distance, EPSILON)),
        (estimate.y - entry.sensor.y) /
          (input.speedOfSound * Math.max(distance, EPSILON)),
        1,
      ]

      for (let rowIndex = 0; rowIndex < 3; rowIndex += 1) {
        normalVector[rowIndex] += row[rowIndex] * residual
        for (let columnIndex = 0; columnIndex < 3; columnIndex += 1) {
          normalMatrix[rowIndex][columnIndex] += row[rowIndex] * row[columnIndex]
        }
      }
    }

    const solution = solveLinear3x3(normalMatrix, [
      -normalVector[0],
      -normalVector[1],
      -normalVector[2],
    ])

    if (!solution) {
      trace.push({
        label: `Iteration ${iterations}`,
        value: 'Degenerate geometry prevented a stable solve.',
      })
      break
    }

    const [stepX, stepY, stepOffset] = solution

    estimate = clampImpact(
      {
        x: estimate.x + stepX,
        y: estimate.y + stepY,
      },
      input.target,
    )
    timeOffset += stepOffset

    trace.push({
      label: `Iteration ${iterations}`,
      value: `dx ${stepX.toFixed(3)} ${input.target.units}, dy ${stepY.toFixed(3)} ${input.target.units}, dt ${(stepOffset * 1_000_000).toFixed(2)} us`,
    })

    if (
      Math.sqrt(stepX * stepX + stepY * stepY) < 0.001 &&
      Math.abs(stepOffset) < 1e-7
    ) {
      converged = true
      break
    }
  }

  const residualMicros = computeResidualMicros(estimate, sensorData, timeOffset, input.speedOfSound)
  if (Number.isFinite(residualMicros) && residualMicros <= 0.5) {
    converged = true
  }

  trace.push({
    label: 'Estimated impact',
    value: `${estimate.x.toFixed(2)}, ${estimate.y.toFixed(2)} ${input.target.units}`,
  })
  trace.push({
    label: 'Residual',
    value: `${residualMicros.toFixed(2)} microseconds RMS`,
  })

  return {
    estimatedImpact: estimate,
    converged,
    iterations,
    residualMicros,
    confidence: getConfidence(residualMicros, converged),
    trace,
  }
}

function computeResidualMicros(
  estimate: Coordinate,
  sensorData: Array<{ sensor: SensorConfig; measurement: SensorMeasurement }>,
  timeOffset: number,
  speedOfSound: number,
): number {
  let sum = 0
  let count = 0

  for (const entry of sensorData) {
    const distance = computeDistance(estimate, entry.sensor)
    const predictedTime = distance / speedOfSound + timeOffset
    const residual = (predictedTime - entry.measurement.noisyTimeSeconds) * 1_000_000
    sum += residual * residual
    count += 1
  }

  return count > 0 ? Math.sqrt(sum / count) : Number.NaN
}

function getInitialGuess(
  sensors: SensorConfig[],
  measurements: SensorMeasurement[],
): Coordinate {
  const measurementMap = new Map(
    measurements.map((measurement) => [measurement.sensorId, measurement]),
  )

  let totalWeight = 0
  let x = 0
  let y = 0

  for (const sensor of sensors) {
    const measurement = measurementMap.get(sensor.id)
    if (!measurement) {
      continue
    }

    const weight = 1 / Math.max(measurement.noisyTimeSeconds, EPSILON)
    totalWeight += weight
    x += sensor.x * weight
    y += sensor.y * weight
  }

  if (totalWeight === 0) {
    return { x: 0, y: 0 }
  }

  return {
    x: x / totalWeight,
    y: y / totalWeight,
  }
}

function getInitialOffset(
  estimate: Coordinate,
  sensorData: Array<{ sensor: SensorConfig; measurement: SensorMeasurement }>,
  speedOfSound: number,
): number {
  let sum = 0

  for (const entry of sensorData) {
    sum += entry.measurement.noisyTimeSeconds - computeDistance(estimate, entry.sensor) / speedOfSound
  }

  return sum / sensorData.length
}

function solveLinear3x3(
  matrix: number[][],
  vector: number[],
): [number, number, number] | null {
  const augmented = matrix.map((row, index) => [...row, vector[index]])

  for (let pivotIndex = 0; pivotIndex < 3; pivotIndex += 1) {
    let maxRowIndex = pivotIndex
    for (let rowIndex = pivotIndex + 1; rowIndex < 3; rowIndex += 1) {
      if (
        Math.abs(augmented[rowIndex][pivotIndex]) >
        Math.abs(augmented[maxRowIndex][pivotIndex])
      ) {
        maxRowIndex = rowIndex
      }
    }

    if (Math.abs(augmented[maxRowIndex][pivotIndex]) < EPSILON) {
      return null
    }

    if (maxRowIndex !== pivotIndex) {
      const temporary = augmented[pivotIndex]
      augmented[pivotIndex] = augmented[maxRowIndex]
      augmented[maxRowIndex] = temporary
    }

    const pivot = augmented[pivotIndex][pivotIndex]
    for (let columnIndex = pivotIndex; columnIndex < 4; columnIndex += 1) {
      augmented[pivotIndex][columnIndex] /= pivot
    }

    for (let rowIndex = 0; rowIndex < 3; rowIndex += 1) {
      if (rowIndex === pivotIndex) {
        continue
      }

      const factor = augmented[rowIndex][pivotIndex]
      for (let columnIndex = pivotIndex; columnIndex < 4; columnIndex += 1) {
        augmented[rowIndex][columnIndex] -= factor * augmented[pivotIndex][columnIndex]
      }
    }
  }

  return [augmented[0][3], augmented[1][3], augmented[2][3]]
}

function getConfidence(residualMicros: number, converged: boolean) {
  if (!converged || Number.isNaN(residualMicros)) {
    return 'low' as const
  }

  if (residualMicros <= 10) {
    return 'high' as const
  }

  if (residualMicros <= 40) {
    return 'medium' as const
  }

  return 'low' as const
}

function buildFailure(message: string, iterations: number): SolverResult {
  return {
    estimatedImpact: null,
    converged: false,
    iterations,
    residualMicros: Number.NaN,
    confidence: 'low',
    trace: [{ label: 'Solver', value: message }],
  }
}
