import type { Coordinate, SolverResult } from '../types/simulation'

type DiagnosticsPanelProps = {
  actualImpact: Coordinate
  estimatedImpact: Coordinate | null
  missDistance: number
  speedOfSound: number
  activeSensorCount: number
  solver: SolverResult
  units: string
}

export function DiagnosticsPanel({
  actualImpact,
  estimatedImpact,
  missDistance,
  speedOfSound,
  activeSensorCount,
  solver,
  units,
}: DiagnosticsPanelProps) {
  return (
    <section className="panel card diagnostics-panel">
      <div className="panel-heading compact">
        <div>
          <p className="eyebrow">Diagnostics</p>
          <h2>Solver quality</h2>
        </div>
        <p className="panel-copy">This panel exposes the reconstructed point, residuals, and the current confidence band.</p>
      </div>

      <div className="diagnostic-stats">
        <div>
          <span>True impact</span>
          <strong>
            {actualImpact.x.toFixed(2)}, {actualImpact.y.toFixed(2)}
          </strong>
        </div>
        <div>
          <span>Estimated impact</span>
          <strong>
            {estimatedImpact
              ? `${estimatedImpact.x.toFixed(2)}, ${estimatedImpact.y.toFixed(2)}`
              : 'Unavailable'}
          </strong>
        </div>
        <div>
          <span>Miss distance</span>
          <strong>
            {Number.isFinite(missDistance) ? `${missDistance.toFixed(2)} ${units}` : 'n/a'}
          </strong>
        </div>
        <div>
          <span>Residual RMS</span>
          <strong>
            {Number.isFinite(solver.residualMicros)
              ? `${solver.residualMicros.toFixed(2)} us`
              : 'n/a'}
          </strong>
        </div>
        <div>
          <span>Speed of sound</span>
          <strong>{speedOfSound.toFixed(2)} m/s</strong>
        </div>
        <div>
          <span>Active sensors</span>
          <strong>{activeSensorCount}</strong>
        </div>
      </div>

      <div className="confidence-row">
        <span className={`confidence-pill ${solver.confidence}`}>
          {solver.confidence} confidence
        </span>
        <span>{solver.converged ? `Solved in ${solver.iterations} iterations` : 'Solver did not fully converge'}</span>
      </div>

      <div className="trace-list">
        {solver.trace.map((entry) => (
          <div key={`${entry.label}-${entry.value}`} className="trace-row">
            <span>{entry.label}</span>
            <strong>{entry.value}</strong>
          </div>
        ))}
      </div>
    </section>
  )
}
