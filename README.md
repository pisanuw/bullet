# Bullet Impact Simulator

Interactive web app for simulating where a bullet hit a rectangular target using acoustic arrival times from sensors mounted behind the target.

## Current MVP

- Click on the target to define the true impact point.
- Configure target width and height.
- Configure three active sensors and optionally enable a fourth sensor.
- Model sensor depth, per-sensor timing bias, clock drift, timing jitter, and speed-of-sound variation.
- Display per-sensor distance, ideal arrival time, noisy arrival time, and TDOA deltas.
- Reconstruct the impact point with a browser-side solver and show miss distance, residuals, and confidence.
- Persist the last-used state in local storage.

## Stack

- React 19
- TypeScript
- Vite
- Vitest
- Static deployment via Netlify

## Development

```bash
npm install
npm run dev
```

## Quality Checks

```bash
npm test
npm run lint
npm run build
```

## Chat JSON To PDF

You can convert an exported chat JSON file into readable HTML and, when a Chromium-based browser is installed, a PDF:

```bash
npm run export-chat -- /path/to/chat.json
```

Useful options:

```bash
npm run export-chat -- /path/to/chat.json --out-dir=./exports --title="VS Code Chat Export"
npm run export-chat -- /path/to/chat.json --html-only
npm run export-chat -- /path/to/chat.json --chrome-path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

If automatic PDF generation is unavailable, the script still writes a styled HTML file you can open and print to PDF.

## Deployment

Netlify can deploy this as a static site using the included `netlify.toml`.

- Build command: `npm run build`
- Publish directory: `dist`

## Project Structure

- `src/App.tsx`: top-level simulator composition
- `src/components`: target view, configuration controls, diagnostics, and sensor readout
- `src/lib/geometry.ts`: deterministic arrival-time math
- `src/lib/noise.ts`: timing perturbation layer
- `src/lib/solver/tdoa.ts`: impact reconstruction solver
- `src/lib/__tests__`: math and solver tests
