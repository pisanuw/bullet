import type { NoiseProfile, SensorConfig, TargetConfig } from '../types/simulation'

type ConfigPanelProps = {
  target: TargetConfig
  sensors: SensorConfig[]
  noise: NoiseProfile
  presets: Array<{ id: string; name: string }>
  validationIssues: string[]
  onTargetChange: (field: 'width' | 'height', value: number) => void
  onSensorChange: (sensorId: string, field: keyof SensorConfig, value: number | boolean) => void
  onNoiseChange: (field: keyof NoiseProfile, value: number | boolean) => void
  onPresetSelect: (presetId: string) => void
  onReset: () => void
}

export function ConfigPanel({
  target,
  sensors,
  noise,
  presets,
  validationIssues,
  onTargetChange,
  onSensorChange,
  onNoiseChange,
  onPresetSelect,
  onReset,
}: ConfigPanelProps) {
  return (
    <section className="panel card config-panel">
      <div className="panel-heading compact">
        <div>
          <p className="eyebrow">Configuration</p>
          <h2>Target and sensor layout</h2>
        </div>
        <p className="panel-copy">Tune geometry, toggle the optional fourth sensor, and stress the solver with timing noise.</p>
      </div>

      <div className="config-actions">
        <label>
          Preset
          <select onChange={(event) => onPresetSelect(event.target.value)} defaultValue="">
            <option value="" disabled>
              Choose a preset
            </option>
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={onReset}>
          Reset default
        </button>
      </div>

      <div className="config-grid two-up">
        <label>
          Width ({target.units})
          <input
            type="number"
            min="30"
            max="300"
            value={target.width}
            onChange={(event) => onTargetChange('width', Number(event.target.value))}
          />
        </label>
        <label>
          Height ({target.units})
          <input
            type="number"
            min="30"
            max="300"
            value={target.height}
            onChange={(event) => onTargetChange('height', Number(event.target.value))}
          />
        </label>
      </div>

      <div className="sensor-stack">
        {sensors.map((sensor) => (
          <div key={sensor.id} className="sensor-editor">
            <div className="sensor-editor__header">
              <h3>{sensor.label}</h3>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={sensor.enabled}
                  onChange={(event) =>
                    onSensorChange(sensor.id, 'enabled', event.target.checked)
                  }
                />
                <span>{sensor.enabled ? 'Active' : 'Inactive'}</span>
              </label>
            </div>
            <div className="config-grid four-up">
              <label>
                X
                <input
                  type="number"
                  value={sensor.x}
                  onChange={(event) =>
                    onSensorChange(sensor.id, 'x', Number(event.target.value))
                  }
                />
              </label>
              <label>
                Y
                <input
                  type="number"
                  value={sensor.y}
                  onChange={(event) =>
                    onSensorChange(sensor.id, 'y', Number(event.target.value))
                  }
                />
              </label>
              <label>
                Depth
                <input
                  type="number"
                  min="1"
                  value={sensor.depth}
                  onChange={(event) =>
                    onSensorChange(sensor.id, 'depth', Number(event.target.value))
                  }
                />
              </label>
              <label>
                Bias (us)
                <input
                  type="number"
                  value={sensor.biasMicros}
                  onChange={(event) =>
                    onSensorChange(sensor.id, 'biasMicros', Number(event.target.value))
                  }
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="noise-grid">
        <label className="toggle wide">
          <input
            type="checkbox"
            checked={noise.enabled}
            onChange={(event) => onNoiseChange('enabled', event.target.checked)}
          />
          <span>Enable advanced timing noise</span>
        </label>
        <label>
          Jitter (us)
          <input
            type="number"
            min="0"
            step="0.5"
            value={noise.timingJitterMicros}
            onChange={(event) =>
              onNoiseChange('timingJitterMicros', Number(event.target.value))
            }
          />
        </label>
        <label>
          Clock drift (us)
          <input
            type="number"
            step="0.5"
            value={noise.clockDriftMicros}
            onChange={(event) =>
              onNoiseChange('clockDriftMicros', Number(event.target.value))
            }
          />
        </label>
        <label>
          Speed variation (%)
          <input
            type="number"
            min="0"
            max="5"
            step="0.05"
            value={noise.speedVariationPercent}
            onChange={(event) =>
              onNoiseChange('speedVariationPercent', Number(event.target.value))
            }
          />
        </label>
        <label>
          Temperature (C)
          <input
            type="number"
            min="-20"
            max="50"
            step="0.5"
            value={noise.temperatureCelsius}
            onChange={(event) =>
              onNoiseChange('temperatureCelsius', Number(event.target.value))
            }
          />
        </label>
      </div>

      {validationIssues.length > 0 ? (
        <div className="validation-box">
          <p className="validation-box__title">Configuration issues</p>
          <ul>
            {validationIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="validation-box ok">
          <p className="validation-box__title">Layout status</p>
          <p>The current layout is solvable with the active sensors.</p>
        </div>
      )}
    </section>
  )
}
