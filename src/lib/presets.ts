import type { Preset, SensorConfig, SimulationState, TargetConfig } from '../types/simulation'

export const DEFAULT_TARGET: TargetConfig = {
  width: 120,
  height: 120,
  label: 'Square practice target',
  units: 'cm',
}

export function buildDefaultSensors(target: TargetConfig): SensorConfig[] {
  const halfWidth = target.width / 2
  const halfHeight = target.height / 2

  return [
    {
      id: 'sensor-a',
      label: 'Sensor A',
      x: -halfWidth,
      y: -halfHeight,
      depth: 18,
      biasMicros: 0,
      enabled: true,
    },
    {
      id: 'sensor-b',
      label: 'Sensor B',
      x: halfWidth,
      y: -halfHeight,
      depth: 18,
      biasMicros: 0,
      enabled: true,
    },
    {
      id: 'sensor-c',
      label: 'Sensor C',
      x: halfWidth,
      y: halfHeight,
      depth: 18,
      biasMicros: 0,
      enabled: true,
    },
    {
      id: 'sensor-d',
      label: 'Sensor D',
      x: -halfWidth,
      y: halfHeight,
      depth: 18,
      biasMicros: 0,
      enabled: false,
    },
  ]
}

export function createDefaultState(): SimulationState {
  return {
    target: DEFAULT_TARGET,
    sensors: buildDefaultSensors(DEFAULT_TARGET),
    noise: {
      enabled: true,
      timingJitterMicros: 12,
      clockDriftMicros: 6,
      speedVariationPercent: 0.35,
      temperatureCelsius: 21,
    },
    impact: { x: 8, y: -12 },
  }
}

export const PRESETS: Preset[] = [
  {
    id: 'classic-square',
    name: 'Classic square',
    description: 'Three corners active with an optional fourth sensor ready for comparison.',
    state: createDefaultState(),
  },
  {
    id: 'wide-target',
    name: 'Wide target',
    description: 'A wider rectangle to explore how sensor spread changes the estimate.',
    state: {
      target: {
        width: 180,
        height: 90,
        label: 'Wide plate',
        units: 'cm',
      },
      sensors: [
        {
          id: 'sensor-a',
          label: 'Sensor A',
          x: -90,
          y: -45,
          depth: 20,
          biasMicros: -2,
          enabled: true,
        },
        {
          id: 'sensor-b',
          label: 'Sensor B',
          x: 90,
          y: -45,
          depth: 20,
          biasMicros: 3,
          enabled: true,
        },
        {
          id: 'sensor-c',
          label: 'Sensor C',
          x: 90,
          y: 45,
          depth: 20,
          biasMicros: 0,
          enabled: true,
        },
        {
          id: 'sensor-d',
          label: 'Sensor D',
          x: -90,
          y: 45,
          depth: 20,
          biasMicros: 1,
          enabled: false,
        },
      ],
      noise: {
        enabled: true,
        timingJitterMicros: 18,
        clockDriftMicros: 10,
        speedVariationPercent: 0.5,
        temperatureCelsius: 16,
      },
      impact: { x: -34, y: 11 },
    },
  },
]
