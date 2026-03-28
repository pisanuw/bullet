import type { SensorMeasurement } from '../types/simulation'

type SensorPanelProps = {
  measurements: SensorMeasurement[]
}

export function SensorPanel({ measurements }: SensorPanelProps) {
  if (measurements.length === 0) {
    return (
      <section className="panel card sensor-panel">
        <div className="panel-heading compact">
          <div>
            <p className="eyebrow">Sensor Readout</p>
            <h2>Arrival timing</h2>
          </div>
          <p className="panel-copy">Enable sensors to generate timing data.</p>
        </div>
        <p className="empty-state">No active sensor measurements are available yet.</p>
      </section>
    )
  }

  const reference = [...measurements].sort(
    (left, right) => left.noisyTimeSeconds - right.noisyTimeSeconds,
  )[0]

  return (
    <section className="panel card sensor-panel">
      <div className="panel-heading compact">
        <div>
          <p className="eyebrow">Sensor Readout</p>
          <h2>Arrival timing</h2>
        </div>
        <p className="panel-copy">Distances, ideal arrivals, noisy arrivals, and TDOA deltas update on every click.</p>
      </div>
      <div className="table-shell">
        <table>
          <thead>
            <tr>
              <th>Sensor</th>
              <th>Distance</th>
              <th>Ideal</th>
              <th>Noisy</th>
              <th>Delta</th>
              <th>TDOA vs ref</th>
            </tr>
          </thead>
          <tbody>
            {measurements.map((measurement) => {
              const tdoaMicros =
                (measurement.noisyTimeSeconds - reference.noisyTimeSeconds) * 1_000_000

              return (
                <tr key={measurement.sensorId}>
                  <td>{measurement.label}</td>
                  <td>{measurement.distance.toFixed(2)}</td>
                  <td>{measurement.idealTimeSeconds.toFixed(6)} s</td>
                  <td>{measurement.noisyTimeSeconds.toFixed(6)} s</td>
                  <td>{measurement.deltaMicros.toFixed(2)} us</td>
                  <td>{tdoaMicros.toFixed(2)} us</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
