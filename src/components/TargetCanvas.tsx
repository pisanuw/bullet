import type { MouseEvent } from 'react'
import type {
  Coordinate,
  OverlayVisibility,
  SensorConfig,
  SolverOverlayBundle,
  TargetConfig,
} from '../types/simulation'

type TargetCanvasProps = {
  target: TargetConfig
  sensors: SensorConfig[]
  actualImpact: Coordinate
  estimatedImpact: Coordinate | null
  overlays: SolverOverlayBundle
  overlayVisibility: OverlayVisibility
  onImpactSelect: (impact: Coordinate) => void
  onOverlayVisibilityChange: (
    field: keyof OverlayVisibility,
    value: boolean,
  ) => void
}

const VIEWBOX_SIZE = 240
const MARGIN = 18

export function TargetCanvas({
  target,
  sensors,
  actualImpact,
  estimatedImpact,
  overlays,
  overlayVisibility,
  onImpactSelect,
  onOverlayVisibilityChange,
}: TargetCanvasProps) {
  const scaleX = (VIEWBOX_SIZE - MARGIN * 2) / target.width
  const scaleY = (VIEWBOX_SIZE - MARGIN * 2) / target.height
  const scale = Math.min(scaleX, scaleY)
  const viewWidth = target.width * scale
  const viewHeight = target.height * scale
  const left = (VIEWBOX_SIZE - viewWidth) / 2
  const top = (VIEWBOX_SIZE - viewHeight) / 2

  function toSvgPoint(point: Coordinate) {
    return {
      x: left + (point.x + target.width / 2) * scale,
      y: top + (target.height / 2 - point.y) * scale,
    }
  }

  function handleClick(event: MouseEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const svgX = ((event.clientX - bounds.left) / bounds.width) * VIEWBOX_SIZE
    const svgY = ((event.clientY - bounds.top) / bounds.height) * VIEWBOX_SIZE

    if (
      svgX < left ||
      svgX > left + viewWidth ||
      svgY < top ||
      svgY > top + viewHeight
    ) {
      return
    }

    const x = (svgX - left) / scale - target.width / 2
    const y = target.height / 2 - (svgY - top) / scale
    onImpactSelect({ x, y })
  }

  const actualPoint = toSvgPoint(actualImpact)
  const estimatedPoint = estimatedImpact ? toSvgPoint(estimatedImpact) : null

  return (
    <div className="target-card">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Target View</p>
          <h2>{target.label}</h2>
        </div>
        <p className="panel-copy">Click anywhere on the plate to generate the true impact location.</p>
      </div>
      <div className="overlay-controls">
        <label className="toggle">
          <input
            type="checkbox"
            checked={overlayVisibility.showHyperbolas}
            onChange={(event) =>
              onOverlayVisibilityChange('showHyperbolas', event.target.checked)
            }
          />
          <span>Show TDOA hyperbolas</span>
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={overlayVisibility.showResidualHeatmap}
            onChange={(event) =>
              onOverlayVisibilityChange('showResidualHeatmap', event.target.checked)
            }
          />
          <span>Show residual heatmap</span>
        </label>
      </div>
      <svg
        className="target-svg"
        viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
        onClick={handleClick}
        role="img"
        aria-label="Interactive target surface"
      >
        <defs>
          <pattern id="target-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(108, 83, 58, 0.16)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect x="0" y="0" width={VIEWBOX_SIZE} height={VIEWBOX_SIZE} rx="24" className="target-frame" />
        <rect
          x={left}
          y={top}
          width={viewWidth}
          height={viewHeight}
          rx="20"
          className="target-plate"
        />
        <rect
          x={left}
          y={top}
          width={viewWidth}
          height={viewHeight}
          rx="20"
          fill="url(#target-grid)"
          pointerEvents="none"
        />
        <clipPath id="target-clip">
          <rect x={left} y={top} width={viewWidth} height={viewHeight} rx="20" />
        </clipPath>
        {overlayVisibility.showResidualHeatmap ? (
          <g clipPath="url(#target-clip)" className="overlay-heatmap">
            {overlays.residualHeatmap.map((cell) => {
              const point = toSvgPoint({ x: cell.x, y: cell.y })
              const width = cell.width * scale
              const height = cell.height * scale

              return (
                <rect
                  key={`${cell.x}-${cell.y}`}
                  x={point.x - width / 2}
                  y={point.y - height / 2}
                  width={width}
                  height={height}
                  fill={`rgba(177, 69, 40, ${cell.normalized * 0.5})`}
                  className="overlay-heat-cell"
                >
                  <title>{`${cell.residualMicros.toFixed(2)} microseconds RMS residual`}</title>
                </rect>
              )
            })}
          </g>
        ) : null}
        <line x1={left} x2={left + viewWidth} y1={VIEWBOX_SIZE / 2} y2={VIEWBOX_SIZE / 2} className="target-axis" />
        <line y1={top} y2={top + viewHeight} x1={VIEWBOX_SIZE / 2} x2={VIEWBOX_SIZE / 2} className="target-axis" />
        {overlayVisibility.showHyperbolas
          ? overlays.hyperbolaCurves.map((curve) =>
              curve.branches.map((branch, branchIndex) => (
                <path
                  key={`${curve.id}-${branchIndex}`}
                  d={branch
                    .map((point, pointIndex) => {
                      const svgPoint = toSvgPoint(point)
                      return `${pointIndex === 0 ? 'M' : 'L'} ${svgPoint.x} ${svgPoint.y}`
                    })
                    .join(' ')}
                  className={`overlay-curve ${curve.colorToken}`}
                >
                  <title>{curve.label}</title>
                </path>
              )),
            )
          : null}
        {sensors.filter((sensor) => sensor.enabled).map((sensor) => {
          const sensorPoint = toSvgPoint({ x: sensor.x, y: sensor.y })
          return (
            <g key={sensor.id}>
              <circle cx={sensorPoint.x} cy={sensorPoint.y} r="7" className="sensor-node" />
              <text x={sensorPoint.x + 10} y={sensorPoint.y - 10} className="sensor-label">
                {sensor.label}
              </text>
            </g>
          )
        })}
        <circle cx={actualPoint.x} cy={actualPoint.y} r="6" className="impact-actual" />
        {estimatedPoint ? (
          <>
            <circle cx={estimatedPoint.x} cy={estimatedPoint.y} r="9" className="impact-estimated-ring" />
            <circle cx={estimatedPoint.x} cy={estimatedPoint.y} r="5" className="impact-estimated" />
            <line
              x1={actualPoint.x}
              y1={actualPoint.y}
              x2={estimatedPoint.x}
              y2={estimatedPoint.y}
              className="impact-connection"
            />
          </>
        ) : null}
      </svg>
      <div className="legend-row">
        <span><i className="legend-swatch actual"></i> True impact</span>
        <span><i className="legend-swatch estimated"></i> Estimated impact</span>
        <span><i className="legend-swatch sensor"></i> Active sensor</span>
        <span><i className="legend-swatch curve"></i> TDOA hyperbola</span>
        <span><i className="legend-swatch heat"></i> Residual field</span>
      </div>
    </div>
  )
}
