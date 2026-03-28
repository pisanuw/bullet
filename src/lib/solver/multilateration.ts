import { solveTdoa } from './tdoa'
import type { SensorConfig, SensorMeasurement, SolverResult, TargetConfig } from '../../types/simulation'

type MultilaterationInput = {
  target: TargetConfig
  sensors: SensorConfig[]
  measurements: SensorMeasurement[]
  speedOfSound: number
}

export function solveMultilateration(
  input: MultilaterationInput,
): SolverResult {
  return solveTdoa(input)
}
