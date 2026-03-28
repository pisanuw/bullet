import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { spawn } from 'node:child_process'

const DEFAULT_HTML_NAME = 'chat-export.html'
const DEFAULT_PDF_NAME = 'chat-export.pdf'

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.help || !options.inputPath) {
    printUsage()
    process.exit(options.help ? 0 : 1)
  }

  const inputPath = path.resolve(options.inputPath)
  const outputDir = path.resolve(options.outputDir ?? path.dirname(inputPath))
  const htmlPath = path.join(outputDir, options.htmlName || DEFAULT_HTML_NAME)
  const pdfPath = path.join(outputDir, options.pdfName || DEFAULT_PDF_NAME)

  const rawJson = await fs.readFile(inputPath, 'utf8')
  const parsed = JSON.parse(rawJson)
  const messages = extractMessages(parsed)

  if (messages.length === 0) {
    throw new Error('No readable chat messages were found in the JSON file.')
  }

  await fs.mkdir(outputDir, { recursive: true })
  const html = renderHtml({
    sourceFile: path.basename(inputPath),
    title: options.title || 'Chat Export',
    messages,
  })
  await fs.writeFile(htmlPath, html, 'utf8')

  let pdfCreated = false
  if (!options.htmlOnly) {
    const chromeExecutable = await findChromeExecutable(options.chromePath)
    if (chromeExecutable) {
      await renderPdfWithChrome(chromeExecutable, htmlPath, pdfPath)
      pdfCreated = true
    }
  }

  printSummary({ htmlPath, pdfPath, pdfCreated })
}

function parseArgs(argv) {
  const options = {
    inputPath: '',
    outputDir: '',
    title: '',
    htmlName: '',
    pdfName: '',
    chromePath: '',
    htmlOnly: false,
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]

    if (current === '--help' || current === '-h') {
      options.help = true
      continue
    }

    if (current === '--html-only') {
      options.htmlOnly = true
      continue
    }

    if (current.startsWith('--input=')) {
      options.inputPath = current.slice('--input='.length)
      continue
    }

    if (current.startsWith('--out-dir=')) {
      options.outputDir = current.slice('--out-dir='.length)
      continue
    }

    if (current.startsWith('--title=')) {
      options.title = current.slice('--title='.length)
      continue
    }

    if (current.startsWith('--html-name=')) {
      options.htmlName = current.slice('--html-name='.length)
      continue
    }

    if (current.startsWith('--pdf-name=')) {
      options.pdfName = current.slice('--pdf-name='.length)
      continue
    }

    if (current.startsWith('--chrome-path=')) {
      options.chromePath = current.slice('--chrome-path='.length)
      continue
    }

    if (!current.startsWith('-') && !options.inputPath) {
      options.inputPath = current
      continue
    }

    throw new Error(`Unknown argument: ${current}`)
  }

  return options
}

function printUsage() {
  console.log(`Usage:
  npm run export-chat -- /path/to/chat.json

Options:
  --input=/path/to/chat.json    Input file path
  --out-dir=./exports          Output directory for HTML/PDF
  --title="My Chat Export"     Title shown in the document
  --html-name=file.html        Custom HTML file name
  --pdf-name=file.pdf          Custom PDF file name
  --chrome-path=/path/to/app   Explicit Chrome/Chromium executable
  --html-only                  Skip PDF generation and write HTML only
  --help                       Show this help message
`)
}

function extractMessages(payload) {
  const directMessages = findMessageArray(payload)
  if (directMessages.length > 0) {
    return directMessages
  }

  const collected = []
  walk(payload, (node) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      return
    }

    if ('role' in node || 'author' in node || 'speaker' in node) {
      const normalized = normalizeMessage(node)
      if (normalized) {
        collected.push(normalized)
      }
      return
    }

    if ('request' in node || 'response' in node) {
      const requestMessage = normalizeMessage({
        role: 'user',
        content: node.request,
      })
      const responseMessage = normalizeMessage({
        role: 'assistant',
        content: node.response,
      })

      if (requestMessage) {
        collected.push(requestMessage)
      }

      if (responseMessage) {
        collected.push(responseMessage)
      }
    }
  })

  return dedupeMessages(collected)
}

function findMessageArray(payload) {
  const candidateKeys = ['messages', 'items', 'turns', 'entries', 'chat', 'transcript']

  for (const key of candidateKeys) {
    const value = payload?.[key]
    if (Array.isArray(value)) {
      const normalized = value
        .map((item) => normalizeMessage(item))
        .filter(Boolean)
      if (normalized.length > 0) {
        return normalized
      }
    }
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => normalizeMessage(item)).filter(Boolean)
  }

  return []
}

function normalizeMessage(candidate) {
  if (candidate == null) {
    return null
  }

  if (typeof candidate === 'string') {
    return { role: 'message', content: candidate, timestamp: '' }
  }

  if (typeof candidate !== 'object' || Array.isArray(candidate)) {
    return null
  }

  const role = String(
    candidate.role ?? candidate.author ?? candidate.speaker ?? candidate.kind ?? 'message',
  )
  const content = stringifyContent(
    candidate.content ?? candidate.text ?? candidate.message ?? candidate.body ?? candidate.value,
  )
  const timestamp = String(
    candidate.timestamp ?? candidate.createdAt ?? candidate.time ?? candidate.date ?? '',
  )

  if (!content.trim()) {
    return null
  }

  return {
    role,
    content,
    timestamp,
  }
}

function stringifyContent(value) {
  if (value == null) {
    return ''
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (Array.isArray(value)) {
    return value.map((item) => stringifyContent(item)).filter(Boolean).join('\n\n')
  }

  if (typeof value === 'object') {
    const preferredKeys = ['text', 'value', 'content', 'message', 'body', 'markdown']
    for (const key of preferredKeys) {
      if (key in value) {
        const preferred = stringifyContent(value[key])
        if (preferred.trim()) {
          return preferred
        }
      }
    }

    return JSON.stringify(value, null, 2)
  }

  return String(value)
}

function dedupeMessages(messages) {
  const seen = new Set()

  return messages.filter((message) => {
    const key = `${message.role}\u0000${message.timestamp}\u0000${message.content}`
    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function walk(node, visitor) {
  visitor(node)

  if (!node || typeof node !== 'object') {
    return
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      walk(item, visitor)
    }
    return
  }

  for (const value of Object.values(node)) {
    walk(value, visitor)
  }
}

function renderHtml(input) {
  const timestamp = new Date().toLocaleString()

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(input.title)}</title>
    <style>
      :root {
        color-scheme: light;
        --paper: #f7f3ee;
        --ink: #1f1a17;
        --muted: #6d6257;
        --rule: #ddd1c3;
        --user: #fff8ef;
        --assistant: #eef5fb;
        --system: #f3efe9;
      }

      * { box-sizing: border-box; }
      body {
        margin: 0;
        font: 15px/1.6 Georgia, 'Times New Roman', serif;
        color: var(--ink);
        background: var(--paper);
      }

      main {
        max-width: 920px;
        margin: 0 auto;
        padding: 40px 28px 56px;
      }

      header {
        margin-bottom: 32px;
        border-bottom: 2px solid var(--rule);
        padding-bottom: 18px;
      }

      h1 {
        margin: 0 0 8px;
        font-size: 32px;
      }

      .meta {
        color: var(--muted);
        font-size: 13px;
      }

      .message {
        margin-bottom: 18px;
        padding: 18px 20px;
        border: 1px solid var(--rule);
        border-radius: 14px;
        page-break-inside: avoid;
      }

      .message.user { background: var(--user); }
      .message.assistant { background: var(--assistant); }
      .message.system,
      .message.message { background: var(--system); }

      .message-header {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--rule);
      }

      .role {
        text-transform: uppercase;
        font: 600 12px/1.2 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        letter-spacing: 0.12em;
      }

      .time {
        color: var(--muted);
        font: 12px/1.2 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }

      pre {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        font: 14px/1.55 'SFMono-Regular', Menlo, Consolas, monospace;
        background: rgba(255, 255, 255, 0.45);
        border-radius: 10px;
        padding: 14px;
      }

      @page {
        margin: 16mm 14mm;
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>${escapeHtml(input.title)}</h1>
        <div class="meta">Source file: ${escapeHtml(input.sourceFile)}<br />Generated: ${escapeHtml(timestamp)}</div>
      </header>
      ${input.messages.map(renderMessage).join('\n')}
    </main>
  </body>
</html>`
}

function renderMessage(message) {
  const roleClass = escapeHtml(normalizeRoleForClass(message.role))
  return `<section class="message ${roleClass}">
    <div class="message-header">
      <div class="role">${escapeHtml(message.role)}</div>
      <div class="time">${escapeHtml(message.timestamp || '')}</div>
    </div>
    <pre>${escapeHtml(message.content)}</pre>
  </section>`
}

function normalizeRoleForClass(role) {
  const normalized = String(role).toLowerCase()
  if (normalized.includes('assistant')) {
    return 'assistant'
  }
  if (normalized.includes('user')) {
    return 'user'
  }
  if (normalized.includes('system')) {
    return 'system'
  }
  return 'message'
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

async function findChromeExecutable(explicitPath) {
  const candidates = [
    explicitPath,
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ].filter(Boolean)

  for (const candidate of candidates) {
    try {
      await fs.access(candidate)
      return candidate
    } catch {
      continue
    }
  }

  return ''
}

async function renderPdfWithChrome(executable, htmlPath, pdfPath) {
  const fileUrl = new URL(`file://${htmlPath}`)
  await runCommand(executable, [
    '--headless=new',
    `--print-to-pdf=${pdfPath}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    fileUrl.href,
  ])
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'ignore' })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`Command exited with code ${code}`))
    })
  })
}

function printSummary(result) {
  console.log(`HTML written: ${result.htmlPath}`)

  if (result.pdfCreated) {
    console.log(`PDF written: ${result.pdfPath}`)
    return
  }

  console.log('PDF was not generated automatically.')
  console.log('Open the HTML file in a browser and use Print -> Save as PDF, or rerun with --chrome-path.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})