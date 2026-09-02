import { spawn, execFile } from 'child_process'
import { promisify } from 'util'
import { existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync } from 'fs'
import { join, basename, extname } from 'path'
import { platform } from 'os'
import type { ClipJobRequest, ClipJobProgress, ClipSegment, SourceInfo } from '../src/vite-env'

const execFileAsync = promisify(execFile)

// eslint-disable-next-line @typescript-eslint/no-var-requires
function loadOptional<T>(name: string): T | null {
  try {
    // Dynamic require so electron-vite can externalize these packages
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(name) as T
  } catch {
    return null
  }
}

const cancelled = new Set<string>()

/** Electron cannot spawn binaries from inside app.asar — use the unpacked twin. */
function fixPackagedBinaryPath(binaryPath: string): string {
  if (!binaryPath) return binaryPath
  // Avoid double-rewriting paths that are already unpacked
  return binaryPath.replace(/app\.asar(?!\.unpacked)/g, 'app.asar.unpacked')
}

function bundledBinName(tool: 'ffmpeg' | 'ffprobe' | 'yt-dlp'): string {
  if (platform() === 'win32') {
    return tool === 'yt-dlp' ? 'yt-dlp.exe' : `${tool}.exe`
  }
  return tool
}

function resourceBinPath(tool: 'ffmpeg' | 'ffprobe' | 'yt-dlp'): string | null {
  const name = bundledBinName(tool)
  const candidates = [
    process.resourcesPath ? join(process.resourcesPath, 'bin', name) : '',
    join(process.cwd(), 'resources', 'bin', name)
  ].filter(Boolean)
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

function getFfmpegPath(): string {
  const bundled = resourceBinPath('ffmpeg')
  if (bundled) return bundled

  const p = loadOptional<string>('ffmpeg-static')
  if (p) {
    const fixed = fixPackagedBinaryPath(p)
    if (existsSync(fixed)) return fixed
  }
  return 'ffmpeg'
}

function getFfprobePath(): string {
  const bundled = resourceBinPath('ffprobe')
  if (bundled) return bundled

  const ffprobe = loadOptional<{ path: string }>('ffprobe-static')
  if (ffprobe?.path) {
    const fixed = fixPackagedBinaryPath(ffprobe.path)
    if (existsSync(fixed)) return fixed
  }
  return 'ffprobe'
}

function getYtDlpPath(): string {
  const bundled = resourceBinPath('yt-dlp')
  if (bundled) return bundled
  return 'yt-dlp'
}

async function resolveWhisper(): Promise<{ cmd: string; prefix: string[] } | null> {
  if (await canRun('whisper', ['--help'])) return { cmd: 'whisper', prefix: [] }
  if (await canRun('python3', ['-m', 'whisper', '--help'])) {
    return { cmd: 'python3', prefix: ['-m', 'whisper'] }
  }
  return null
}

export async function checkTools(): Promise<{ ffmpeg: boolean; ytDlp: boolean; whisper: boolean }> {
  const ffmpegOk = await canRun(getFfmpegPath(), ['-version'])
  const ytOk = await canRun(getYtDlpPath(), ['--version'])
  const whisperOk = !!(await resolveWhisper())
  return { ffmpeg: ffmpegOk, ytDlp: ytOk, whisper: whisperOk }
}

async function canRun(cmd: string, args: string[]): Promise<boolean> {
  try {
    await execFileAsync(cmd, args, { timeout: 15000 })
    return true
  } catch {
    return false
  }
}

export async function probeVideo(filePath: string): Promise<SourceInfo> {
  const ffprobe = getFfprobePath()
  const { stdout } = await execFileAsync(
    ffprobe,
    [
      '-v',
      'error',
      '-show_entries',
      'format=duration:stream=width,height',
      '-of',
      'json',
      filePath
    ],
    { maxBuffer: 10 * 1024 * 1024 }
  )
  const data = JSON.parse(stdout) as {
    format?: { duration?: string }
    streams?: Array<{ width?: number; height?: number }>
  }
  const stream = data.streams?.find((s) => s.width && s.height) || {}
  return {
    title: basename(filePath, extname(filePath)),
    durationSec: Number(data.format?.duration || 0),
    width: stream.width || 0,
    height: stream.height || 0,
    path: filePath
  }
}

async function downloadYouTube(url: string, workDir: string, onLine: (line: string) => void): Promise<string> {
  const outTemplate = join(workDir, 'source.%(ext)s')
  const yt = getYtDlpPath()
  await runProcess(
    yt,
    [
      '-f',
      'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b',
      '--merge-output-format',
      'mp4',
      '-o',
      outTemplate,
      '--no-playlist',
      url
    ],
    onLine
  )

  const files = readdirSync(workDir).filter((f) => f.startsWith('source.'))
  if (!files.length) throw new Error('YouTube download finished but no file was found.')
  return join(workDir, files[0])
}

function aspectFilter(aspect: '16:9' | '9:16', enhance: boolean): string {
  const smart =
    aspect === '9:16'
      ? `scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920`
      : `scale=1920:1080:force_original_aspect_ratio=increase:flags=lanczos,crop=1920:1080`
  const sharpen = enhance ? ',unsharp=5:5:0.8:5:5:0.0,eq=contrast=1.06:saturation=1.08:brightness=0.02' : ''
  return smart + sharpen
}

async function transcribe(
  videoPath: string,
  workDir: string,
  onLine: (line: string) => void
): Promise<string | null> {
  const whisper = await resolveWhisper()
  if (!whisper) {
    onLine('Whisper not installed — exporting without burned-in subtitles.')
    return null
  }

  try {
    await runProcess(
      whisper.cmd,
      [
        ...whisper.prefix,
        videoPath,
        '--model',
        'tiny',
        '--output_format',
        'srt',
        '--output_dir',
        workDir,
        '--language',
        'en',
        '--fp16',
        'False'
      ],
      onLine
    )
    const base = basename(videoPath, extname(videoPath))
    const srt = join(workDir, `${base}.srt`)
    if (existsSync(srt)) return srt

    // whisper may name by stem differently — pick any srt
    const any = readdirSync(workDir).find((f) => f.endsWith('.srt'))
    return any ? join(workDir, any) : null
  } catch (err) {
    onLine(`Subtitle generation skipped: ${(err as Error).message}`)
    return null
  }
}

function sliceSrt(srtPath: string, startSec: number, endSec: number, outPath: string): void {
  const raw = readFileSync(srtPath, 'utf8')
  const blocks = raw.replace(/\r/g, '').split(/\n\n+/)
  const kept: string[] = []
  let idx = 1

  for (const block of blocks) {
    const lines = block.trim().split('\n')
    if (lines.length < 2) continue
    const timeLine = lines.find((l) => l.includes('-->'))
    if (!timeLine) continue
    const [startStr, endStr] = timeLine.split('-->').map((s) => s.trim())
    const s = parseTs(startStr)
    const e = parseTs(endStr)
    if (e < startSec || s > endSec) continue
    const ns = Math.max(0, s - startSec)
    const ne = Math.max(ns + 0.05, e - startSec)
    const text = lines.filter((l) => l !== timeLine && !/^\d+$/.test(l)).join('\n')
    kept.push(`${idx}\n${formatTs(ns)} --> ${formatTs(ne)}\n${text}`)
    idx++
  }

  writeFileSync(outPath, kept.join('\n\n') + (kept.length ? '\n' : ''), 'utf8')
}

function parseTs(ts: string): number {
  const m = ts.match(/(\d+):(\d+):(\d+)[,.](\d+)/)
  if (!m) return 0
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 1000
}

function formatTs(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  const ms = Math.round((sec - Math.floor(sec)) * 1000)
  return `${pad(h)}:${pad(m)}:${pad(s)},${String(ms).padStart(3, '0')}`
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

async function renderClip(opts: {
  input: string
  output: string
  start: number
  duration: number
  aspect: '16:9' | '9:16'
  enhance: boolean
  subtitlePath?: string | null
  onLine: (line: string) => void
}): Promise<void> {
  const ffmpeg = getFfmpegPath()
  const vf = aspectFilter(opts.aspect, opts.enhance)
  const args = [
    '-y',
    '-ss',
    String(opts.start),
    '-t',
    String(opts.duration),
    '-i',
    opts.input
  ]

  if (opts.subtitlePath && existsSync(opts.subtitlePath)) {
    // Escape path for subtitles filter
    const escaped = opts.subtitlePath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'")
    args.push(
      '-vf',
      `${vf},subtitles='${escaped}':force_style='FontName=Arial,FontSize=22,PrimaryColour=&H00FFFFFF&,OutlineColour=&H00000000&,BorderStyle=3,Outline=1,Shadow=0,MarginV=48,Alignment=2'`
    )
  } else {
    args.push('-vf', vf)
  }

  args.push(
    '-c:v',
    'libx264',
    '-preset',
    opts.enhance ? 'slow' : 'medium',
    '-crf',
    opts.enhance ? '18' : '20',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-movflags',
    '+faststart',
    opts.output
  )

  await runProcess(ffmpeg, args, opts.onLine)
}

function runProcess(cmd: string, args: string[], onLine: (line: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    const fail = (err: Error) => reject(err)

    child.stdout.on('data', (buf: Buffer) => {
      buf
        .toString()
        .split(/\r?\n/)
        .filter(Boolean)
        .forEach((line) => onLine(line))
    })
    child.stderr.on('data', (buf: Buffer) => {
      buf
        .toString()
        .split(/\r?\n/)
        .filter(Boolean)
        .forEach((line) => onLine(line))
    })
    child.on('error', fail)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${basename(cmd)} exited with code ${code}`))
    })
  })
}

export function cancelJob(jobId: string): void {
  cancelled.add(jobId)
}

function assertNotCancelled(jobId: string): void {
  if (cancelled.has(jobId)) throw new Error('Job cancelled')
}

export async function processClipJob(
  jobId: string,
  request: ClipJobRequest,
  emit: (p: ClipJobProgress) => void
): Promise<void> {
  cancelled.delete(jobId)
  const workRoot = join(request.outputDir!, `.work_${jobId}`)
  mkdirSync(workRoot, { recursive: true })
  mkdirSync(request.outputDir!, { recursive: true })

  const report = (partial: Partial<ClipJobProgress>) =>
    emit({
      status: 'idle',
      message: '',
      percent: 0,
      ...partial
    })

  try {
    let sourcePath = request.sourcePath || ''

    if (request.sourceType === 'youtube') {
      if (!request.youtubeUrl?.trim()) throw new Error('Paste a YouTube URL first.')
      report({ status: 'downloading', message: 'Downloading video from YouTube…', percent: 5 })
      sourcePath = await downloadYouTube(request.youtubeUrl.trim(), workRoot, (line) => {
        report({ status: 'downloading', message: line.slice(0, 140), percent: 10 })
      })
    }

    assertNotCancelled(jobId)
    if (!sourcePath || !existsSync(sourcePath)) throw new Error('Source video not found.')

    report({ status: 'analyzing', message: 'Reading video details…', percent: 18 })
    const info = await probeVideo(sourcePath)
    if (!info.durationSec || info.durationSec < 3) {
      throw new Error('Could not read a valid video duration.')
    }

    const clipLen = request.duration
    const clipCount = Math.max(1, Math.floor(info.durationSec / clipLen))
    // If leftover is substantial, still produce full clips only (user-selected length)
    const totalClips = clipCount === 0 ? 1 : clipCount

    let masterSrt: string | null = null
    if (request.burnSubtitles) {
      report({
        status: 'transcribing',
        message: 'Generating subtitles with Whisper (first run may download the model)…',
        percent: 25
      })
      masterSrt = await transcribe(sourcePath, workRoot, (line) => {
        report({ status: 'transcribing', message: line.slice(0, 140), percent: 30 })
      })
    }

    assertNotCancelled(jobId)
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const safeTitle = (info.title || 'clip').replace(/[^\w\-]+/g, '_').slice(0, 48)
    const aspectTag = request.aspectRatio === '9:16' ? 'vertical' : 'widescreen'
    const segments: ClipSegment[] = []

    for (let i = 0; i < totalClips; i++) {
      assertNotCancelled(jobId)
      const start = i * clipLen
      const remaining = info.durationSec - start
      const duration = Math.min(clipLen, remaining)
      if (duration < 5) break

      const outName = `${safeTitle}_${aspectTag}_${clipLen / 60}m_part${i + 1}_${stamp}.mp4`
      const outPath = join(request.outputDir!, outName)
      let clipSrt: string | undefined

      if (masterSrt) {
        clipSrt = join(workRoot, `part_${i + 1}.srt`)
        sliceSrt(masterSrt, start, start + duration, clipSrt)
      }

      const basePct = 35 + Math.round((i / Math.max(totalClips, 1)) * 55)
      report({
        status: request.burnSubtitles ? 'subtitling' : 'clipping',
        message: `Rendering clip ${i + 1} of ${totalClips}…`,
        percent: basePct
      })

      await renderClip({
        input: sourcePath,
        output: outPath,
        start,
        duration,
        aspect: request.aspectRatio,
        enhance: request.enhanceQuality,
        subtitlePath: request.burnSubtitles ? clipSrt : null,
        onLine: (line) => {
          if (line.includes('time=')) {
            report({
              status: 'enhancing',
              message: `Encoding clip ${i + 1}/${totalClips}: ${line.match(/time=\S+/)?.[0] || ''}`,
              percent: Math.min(94, basePct + 5)
            })
          }
        }
      })

      segments.push({
        index: i + 1,
        startSec: start,
        endSec: start + duration,
        outputPath: outPath,
        subtitlePath: clipSrt
      })
    }

    if (!segments.length) {
      throw new Error('Video is shorter than the selected clip length. Choose a shorter duration.')
    }

    report({
      status: 'done',
      message: `Exported ${segments.length} ready-to-post clip${segments.length === 1 ? '' : 's'}.`,
      percent: 100,
      segments
    })
  } catch (err) {
    report({
      status: 'error',
      message: 'Something went wrong.',
      percent: 0,
      error: (err as Error).message
    })
  }
}
