import { spawn, execFile } from 'child_process'
import { promisify } from 'util'
import { existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync, copyFileSync } from 'fs'
import { join, basename, dirname, delimiter, sep } from 'path'
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
  const candidates: Array<{ cmd: string; prefix: string[] }> = [
    { cmd: 'whisper', prefix: [] },
    { cmd: 'python', prefix: ['-m', 'whisper'] },
    { cmd: 'python3', prefix: ['-m', 'whisper'] },
    { cmd: 'py', prefix: ['-3', '-m', 'whisper'] }
  ]

  if (platform() === 'win32') {
    const home = process.env.USERPROFILE || process.env.HOME || ''
    const local = process.env.LOCALAPPDATA || join(home, 'AppData', 'Local')

    // Python Install Manager / Store-style layout used by this user:
    // C:\Users\<name>\AppData\Local\Python\bin
    const winBinDirs = [
      join(local, 'Python', 'bin'),
      join(home, 'AppData', 'Local', 'Python', 'bin')
    ]
    for (const dir of winBinDirs) {
      const whisperExe = join(dir, 'whisper.exe')
      const pythonExe = join(dir, 'python.exe')
      if (existsSync(whisperExe)) candidates.unshift({ cmd: whisperExe, prefix: [] })
      if (existsSync(pythonExe)) candidates.unshift({ cmd: pythonExe, prefix: ['-m', 'whisper'] })
    }

    const classicRoots = [
      join(local, 'Programs', 'Python'),
      join(home, 'AppData', 'Local', 'Programs', 'Python'),
      join(home, 'AppData', 'Roaming', 'Python')
    ]
    for (const root of classicRoots) {
      if (!root || !existsSync(root)) continue
      try {
        for (const entry of readdirSync(root)) {
          const scripts = join(root, entry, 'Scripts', 'whisper.exe')
          if (existsSync(scripts)) candidates.unshift({ cmd: scripts, prefix: [] })
          const py = join(root, entry, 'python.exe')
          if (existsSync(py)) candidates.push({ cmd: py, prefix: ['-m', 'whisper'] })
        }
      } catch {
        /* ignore */
      }
    }
  }

  // If whisper.exe exists on disk, trust it (GUI apps often miss PATH updates)
  for (const candidate of candidates) {
    const lower = candidate.cmd.toLowerCase()
    if (
      candidate.prefix.length === 0 &&
      (lower.endsWith('whisper.exe') || lower.endsWith(`${sep}whisper`) || lower === 'whisper') &&
      (lower === 'whisper' || existsSync(candidate.cmd))
    ) {
      if (lower !== 'whisper' && existsSync(candidate.cmd)) return candidate
    }
  }

  // Fast check: does the whisper package import without launching the heavy CLI?
  for (const candidate of candidates) {
    if (candidate.prefix[0] === '-m' || candidate.cmd.toLowerCase().includes('python')) {
      const py = candidate.cmd
      if (py !== 'python' && py !== 'python3' && py !== 'py' && !existsSync(py)) continue
      const ok = await canRun(
        py,
        [
          '-c',
          "import importlib.util,sys;sys.exit(0 if importlib.util.find_spec('whisper') else 1)"
        ],
        20000
      )
      if (ok) return { cmd: py, prefix: py === 'py' ? ['-3', '-m', 'whisper'] : ['-m', 'whisper'] }
    }
  }

  for (const candidate of candidates) {
    if (await canRun(candidate.cmd, [...candidate.prefix, '--help'], 90000)) return candidate
  }
  return null
}

export async function checkTools(): Promise<{ ffmpeg: boolean; ytDlp: boolean; whisper: boolean }> {
  const ffmpegOk = await canRun(getFfmpegPath(), ['-version'])
  const ytOk = await canRun(getYtDlpPath(), ['--version'])
  const whisperOk = !!(await resolveWhisper())
  return { ffmpeg: ffmpegOk, ytDlp: ytOk, whisper: whisperOk }
}

async function canRun(cmd: string, args: string[], timeoutMs = 15000): Promise<boolean> {
  try {
    await execFileAsync(cmd, args, { timeout: timeoutMs, windowsHide: true })
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
  // bicubic is much faster than lanczos; keep a light polish when enhance is on
  const flags = enhance ? 'lanczos' : 'bicubic'
  const smart =
    aspect === '9:16'
      ? `scale=1080:1920:force_original_aspect_ratio=increase:flags=${flags},crop=1080:1920`
      : `scale=1920:1080:force_original_aspect_ratio=increase:flags=${flags},crop=1920:1080`
  const sharpen = enhance ? ',eq=contrast=1.05:saturation=1.06:brightness=0.01' : ''
  return smart + sharpen
}

async function extractAudioForWhisper(
  videoPath: string,
  workDir: string,
  onLine: (line: string) => void
): Promise<string> {
  const audioPath = join(workDir, 'audio_16k.wav')
  const ffmpeg = getFfmpegPath()
  await runProcess(
    ffmpeg,
    [
      '-y',
      '-i',
      videoPath,
      '-vn',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-c:a',
      'pcm_s16le',
      audioPath
    ],
    onLine,
    workDir
  )
  return audioPath
}

function countSrtCues(srtPath: string): number {
  if (!existsSync(srtPath)) return 0
  const raw = readFileSync(srtPath, 'utf8').replace(/\r/g, '').trim()
  if (!raw) return 0
  return raw.split(/\n\n+/).filter((b) => b.includes('-->')).length
}

function systemFontsDir(): string | null {
  if (platform() === 'win32') {
    const windir = process.env.WINDIR || 'C:\\Windows'
    const fonts = join(windir, 'Fonts')
    return existsSync(fonts) ? fonts : null
  }
  if (platform() === 'darwin') {
    for (const p of ['/System/Library/Fonts', '/Library/Fonts', '/System/Library/Fonts/Supplemental']) {
      if (existsSync(p)) return p
    }
    return null
  }
  for (const p of ['/usr/share/fonts', '/usr/local/share/fonts', join(process.env.HOME || '', '.fonts')]) {
    if (p && existsSync(p)) return p
  }
  return null
}

/** Escape an absolute path for use inside an ffmpeg filtergraph value. */
function escapeFilterPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'")
}

/** Convert SRT → ASS so burn-in is reliable on Windows (libass). */
function srtToAss(srtPath: string, assPath: string, aspect: '16:9' | '9:16' = '9:16'): void {
  const raw = readFileSync(srtPath, 'utf8').replace(/\r/g, '')
  const blocks = raw.split(/\n\n+/).map((b) => b.trim()).filter(Boolean)
  const events: string[] = []

  for (const block of blocks) {
    const lines = block.split('\n')
    const timeLine = lines.find((l) => l.includes('-->'))
    if (!timeLine) continue
    const [startStr, endStr] = timeLine.split('-->').map((s) => s.trim())
    const text = lines
      .filter((l) => l !== timeLine && !/^\d+$/.test(l))
      .join('\\N')
      .replace(/[{}]/g, '')
    if (!text.trim()) continue
    events.push(`Dialogue: 0,${srtTimeToAss(startStr)},${srtTimeToAss(endStr)},Default,,0,0,0,,${text}`)
  }

  const playResX = aspect === '9:16' ? 1080 : 1920
  const playResY = aspect === '9:16' ? 1920 : 1080
  const fontSize = aspect === '9:16' ? 64 : 52
  const marginV = aspect === '9:16' ? 110 : 64

  const ass = `[Script Info]
ScriptType: v4.00+
PlayResX: ${playResX}
PlayResY: ${playResY}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,${fontSize},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,3,5,0,2,80,80,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events.join('\n')}
`
  writeFileSync(assPath, ass, 'utf8')
}

function srtTimeToAss(ts: string): string {
  // 00:00:01,000 -> 0:00:01.00
  const m = ts.match(/(\d+):(\d+):(\d+)[,.](\d+)/)
  if (!m) return '0:00:00.00'
  const h = Number(m[1])
  const min = m[2]
  const sec = m[3]
  const cs = String(Math.floor(Number(m[4].padEnd(3, '0').slice(0, 3)) / 10)).padStart(2, '0')
  return `${h}:${min}:${sec}.${cs}`
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
    onLine('Extracting audio for faster transcription…')
    const audioPath = await extractAudioForWhisper(videoPath, workDir, onLine)
    const absAudio = audioPath
    const absOut = workDir

    onLine(`Running Whisper (${basename(whisper.cmd)} ${whisper.prefix.join(' ')})…`)
    await runProcess(
      whisper.cmd,
      [
        ...whisper.prefix,
        absAudio,
        '--model',
        'tiny',
        '--task',
        'transcribe',
        '--output_format',
        'srt',
        '--output_dir',
        absOut,
        '--fp16',
        'False',
        '--verbose',
        'True',
        '--condition_on_previous_text',
        'False'
      ],
      onLine
      // no cwd — use absolute paths so Windows Python doesn't lose the output folder
    )

    const preferred = join(workDir, 'audio_16k.srt')
    const candidates = [
      preferred,
      ...readdirSync(workDir)
        .filter((f) => f.endsWith('.srt'))
        .map((f) => join(workDir, f))
    ]

    const srtPath = candidates.find((p) => existsSync(p) && countSrtCues(p) > 0) || null
    if (!srtPath) {
      onLine('Whisper finished but no subtitle cues were written (check speech audio).')
      onLine(`Work folder files: ${readdirSync(workDir).join(', ')}`)
      return null
    }

    onLine(`Captions generated: ${countSrtCues(srtPath)} lines.`)
    return srtPath
  } catch (err) {
    onLine(`Subtitle generation failed: ${(err as Error).message}`)
    return null
  }
}

async function transcribeClipAudio(
  inputVideo: string,
  start: number,
  duration: number,
  workDir: string,
  index: number,
  onLine: (line: string) => void
): Promise<string | null> {
  const whisper = await resolveWhisper()
  if (!whisper) return null
  const ffmpeg = getFfmpegPath()
  const wav = join(workDir, `clip_${index}.wav`)

  try {
    await runProcess(
      ffmpeg,
      [
        '-y',
        '-ss',
        String(start),
        '-t',
        String(duration),
        '-i',
        inputVideo,
        '-vn',
        '-ac',
        '1',
        '-ar',
        '16000',
        '-c:a',
        'pcm_s16le',
        wav
      ],
      onLine
    )

    await runProcess(
      whisper.cmd,
      [
        ...whisper.prefix,
        wav,
        '--model',
        'tiny',
        '--task',
        'transcribe',
        '--output_format',
        'srt',
        '--output_dir',
        workDir,
        '--fp16',
        'False',
        '--verbose',
        'False',
        '--condition_on_previous_text',
        'False'
      ],
      onLine
    )

    const produced = join(workDir, `clip_${index}.srt`)
    if (existsSync(produced) && countSrtCues(produced) > 0) return produced
    const any = readdirSync(workDir)
      .filter((f) => f.startsWith(`clip_${index}`) && f.endsWith('.srt'))
      .map((f) => join(workDir, f))
      .find((p) => countSrtCues(p) > 0)
    return any || null
  } catch (err) {
    onLine(`Clip ${index} captions failed: ${(err as Error).message}`)
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
    if (!text.trim()) continue
    kept.push(`${idx}\n${formatTs(ns)} --> ${formatTs(ne)}\n${text}`)
    idx++
  }

  writeFileSync(outPath, kept.length ? kept.join('\n\n') + '\n' : '', 'utf8')
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

function encodeArgs(
  input: string,
  output: string,
  start: number,
  duration: number,
  vf: string,
  enhance: boolean
): string[] {
  return [
    '-y',
    '-ss',
    String(start),
    '-t',
    String(duration),
    '-i',
    input,
    '-vf',
    vf,
    '-c:v',
    'libx264',
    '-preset',
    enhance ? 'faster' : 'veryfast',
    '-crf',
    enhance ? '20' : '23',
    '-pix_fmt',
    'yuv420p',
    '-threads',
    '0',
    '-c:a',
    'aac',
    '-b:a',
    '160k',
    '-movflags',
    '+faststart',
    output
  ]
}

async function renderClip(opts: {
  input: string
  output: string
  start: number
  duration: number
  aspect: '16:9' | '9:16'
  enhance: boolean
  subtitlePath?: string | null
  workDir: string
  onLine: (line: string) => void
}): Promise<void> {
  const ffmpeg = getFfmpegPath()
  const baseVf = aspectFilter(opts.aspect, opts.enhance)
  const cueCount =
    opts.subtitlePath && existsSync(opts.subtitlePath) ? countSrtCues(opts.subtitlePath) : 0

  if (!opts.subtitlePath || cueCount === 0) {
    await runProcess(
      ffmpeg,
      encodeArgs(opts.input, opts.output, opts.start, opts.duration, baseVf, opts.enhance),
      opts.onLine,
      opts.workDir
    )
    return
  }

  // Copy into workDir so filters can use short relative names (Windows drive letters break libass)
  const localSrt = join(opts.workDir, 'burn.srt')
  const localAss = join(opts.workDir, 'burn.ass')
  writeFileSync(localSrt, readFileSync(opts.subtitlePath))
  srtToAss(localSrt, localAss, opts.aspect)

  const fonts = systemFontsDir()
  const fontsOpt = fonts ? `:fontsdir='${escapeFilterPath(fonts)}'` : ''
  const attempts = [
    `ass=burn.ass${fontsOpt}`,
    `subtitles=burn.srt${fontsOpt}`,
    `subtitles=burn.srt${fontsOpt}:force_style='FontName=Arial,FontSize=28,PrimaryColour=&H00FFFFFF&,OutlineColour=&H00000000&,BorderStyle=3,Outline=3,Shadow=0,MarginV=70,Alignment=2'`
  ]

  opts.onLine(`Burning ${cueCount} caption lines into clip…`)

  let lastErr: Error | null = null
  for (const filter of attempts) {
    try {
      await runProcess(
        ffmpeg,
        encodeArgs(
          opts.input,
          opts.output,
          opts.start,
          opts.duration,
          `${baseVf},${filter}`,
          opts.enhance
        ),
        opts.onLine,
        opts.workDir
      )
      opts.onLine(`Captions burned successfully (${filter.split(':')[0]}).`)
      return
    } catch (err) {
      lastErr = err as Error
      opts.onLine(`Caption burn attempt failed (${filter.split(':')[0]}): ${lastErr.message}`)
    }
  }

  // Last resort: export video without burn-in but keep the sidecar .srt
  opts.onLine(
    `Could not burn captions into pixels (${lastErr?.message || 'unknown'}). Exporting video + .srt sidecar.`
  )
  await runProcess(
    ffmpeg,
    encodeArgs(opts.input, opts.output, opts.start, opts.duration, baseVf, opts.enhance),
    opts.onLine,
    opts.workDir
  )
}

function childEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env }
  const ffmpeg = getFfmpegPath()
  const binDir = dirname(ffmpeg)
  if (binDir && binDir !== '.' && existsSync(binDir)) {
    env.PATH = [binDir, env.PATH || ''].filter(Boolean).join(delimiter)
  }
  // Help Whisper / imageio find the same ffmpeg we ship
  if (ffmpeg && existsSync(ffmpeg)) {
    env.FFMPEG_BINARY = ffmpeg
    env.IMAGEIO_FFMPEG_EXE = ffmpeg
  }
  return env
}

function runProcess(
  cmd: string,
  args: string[],
  onLine: (line: string) => void,
  cwd?: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd,
      env: childEnv(),
      windowsHide: true
    })
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
        message: 'Generating subtitles with Whisper (audio-only, auto language)…',
        percent: 25
      })
      masterSrt = await transcribe(sourcePath, workRoot, (line) => {
        report({ status: 'transcribing', message: line.slice(0, 140), percent: 30 })
      })
      if (!masterSrt) {
        report({
          status: 'clipping',
          message:
            'No captions were produced (Whisper missing, failed, or no speech). Continuing without subtitles…',
          percent: 34
        })
      } else {
        report({
          status: 'clipping',
          message: 'Captions ready — encoding clips with burned-in subtitles…',
          percent: 34
        })
      }
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

      if (request.burnSubtitles) {
        if (masterSrt) {
          clipSrt = join(workRoot, `part_${i + 1}.srt`)
          sliceSrt(masterSrt, start, start + duration, clipSrt)
          if (countSrtCues(clipSrt) === 0) clipSrt = undefined
        }

        // Fallback: transcribe this clip alone if master captions missing/empty
        if (!clipSrt) {
          report({
            status: 'transcribing',
            message: `No sliced captions — transcribing clip ${i + 1} directly…`,
            percent: 35 + Math.round((i / Math.max(totalClips, 1)) * 50)
          })
          const direct = await transcribeClipAudio(
            sourcePath,
            start,
            duration,
            workRoot,
            i + 1,
            (line) =>
              report({
                status: 'transcribing',
                message: line.slice(0, 140),
                percent: 35 + Math.round((i / Math.max(totalClips, 1)) * 50)
              })
          )
          if (direct) clipSrt = direct
        }
      }

      const basePct = 35 + Math.round((i / Math.max(totalClips, 1)) * 55)
      report({
        status: clipSrt ? 'subtitling' : 'clipping',
        message: clipSrt
          ? `Rendering clip ${i + 1}/${totalClips} with captions…`
          : `Rendering clip ${i + 1}/${totalClips} (no captions for this part)…`,
        percent: basePct
      })

      await renderClip({
        input: sourcePath,
        output: outPath,
        start,
        duration,
        aspect: request.aspectRatio,
        enhance: request.enhanceQuality,
        subtitlePath: clipSrt,
        workDir: workRoot,
        onLine: (line) => {
          if (line.includes('time=') || line.toLowerCase().includes('error') || line.includes('Subtitle')) {
            report({
              status: clipSrt ? 'subtitling' : 'enhancing',
              message: `Encoding clip ${i + 1}/${totalClips}: ${line.slice(0, 120)}`,
              percent: Math.min(94, basePct + 5)
            })
          }
        }
      })

      // Always keep a sidecar .srt next to the mp4 when captions exist
      if (clipSrt && countSrtCues(clipSrt) > 0) {
        try {
          copyFileSync(clipSrt, outPath.replace(/\.mp4$/i, '.srt'))
        } catch {
          /* ignore sidecar copy errors */
        }
      }

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
