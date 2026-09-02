import { useEffect, useMemo, useState } from 'react'
import type { AspectRatio, ClipDuration, ClipJobProgress, ClipSegment, SourceInfo } from './vite-env'
import markUrl from './assets/clipster-mark.png'

type SourceMode = 'file' | 'youtube'

function formatDuration(sec: number): string {
  if (!sec || Number.isNaN(sec)) return '—'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function statusLabel(status: ClipJobProgress['status']): string {
  switch (status) {
    case 'downloading':
      return 'Downloading'
    case 'analyzing':
      return 'Analyzing'
    case 'transcribing':
      return 'Subtitles'
    case 'clipping':
      return 'Clipping'
    case 'enhancing':
      return 'Enhancing'
    case 'subtitling':
      return 'Burning captions'
    case 'done':
      return 'Complete'
    case 'error':
      return 'Failed'
    default:
      return 'Ready'
  }
}

const hasApi = typeof window !== 'undefined' && !!window.clipster

export default function App() {
  const [mode, setMode] = useState<SourceMode>('file')
  const [filePath, setFilePath] = useState<string | null>(null)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [sourceInfo, setSourceInfo] = useState<SourceInfo | null>(null)
  const [duration, setDuration] = useState<ClipDuration>(60)
  const [aspect, setAspect] = useState<AspectRatio>('9:16')
  const [enhance, setEnhance] = useState(true)
  const [subtitles, setSubtitles] = useState(true)
  const [outputDir, setOutputDir] = useState('')
  const [busy, setBusy] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [progress, setProgress] = useState<ClipJobProgress>({
    status: 'idle',
    message: 'Import a video or paste a YouTube link to begin.',
    percent: 0
  })
  const [logLines, setLogLines] = useState<string[]>([])
  const [segments, setSegments] = useState<ClipSegment[]>([])
  const [tools, setTools] = useState({ ffmpeg: false, ytDlp: false, whisper: false })

  useEffect(() => {
    if (!hasApi) return
    void window.clipster.getDefaultOutputDir().then(setOutputDir)
    void window.clipster.checkTools().then(setTools)
    const off = window.clipster.onProgress((p) => {
      setProgress(p)
      if (p.message) {
        setLogLines((prev) => [...prev.slice(-80), p.message])
      }
      if (p.segments) setSegments(p.segments)
      if (p.status === 'done' || p.status === 'error') {
        setBusy(false)
        setJobId(null)
      }
    })
    return off
  }, [])

  const estimatedClips = useMemo(() => {
    if (!sourceInfo?.durationSec) return null
    return Math.max(1, Math.floor(sourceInfo.durationSec / duration))
  }, [sourceInfo, duration])

  const canStart =
    hasApi &&
    !busy &&
    ((mode === 'file' && !!filePath) || (mode === 'youtube' && youtubeUrl.trim().length > 8))

  async function pickFile() {
    if (!hasApi) return
    const path = await window.clipster.selectVideoFile()
    if (!path) return
    setFilePath(path)
    setMode('file')
    try {
      const info = await window.clipster.getSourceInfo(path)
      setSourceInfo(info)
      setProgress({
        status: 'idle',
        message: `Loaded “${info.title}” (${formatDuration(info.durationSec)}).`,
        percent: 0
      })
    } catch (err) {
      setSourceInfo(null)
      setProgress({
        status: 'error',
        message: 'Could not read that video.',
        percent: 0,
        error: (err as Error).message
      })
    }
  }

  async function pickOutput() {
    if (!hasApi) return
    const dir = await window.clipster.selectOutputDir()
    if (dir) setOutputDir(dir)
  }

  async function startJob() {
    if (!canStart) return
    setBusy(true)
    setSegments([])
    setLogLines([])
    setProgress({ status: 'analyzing', message: 'Starting job…', percent: 2 })
    try {
      const { jobId: id } = await window.clipster.startJob({
        sourceType: mode,
        sourcePath: mode === 'file' ? filePath || undefined : undefined,
        youtubeUrl: mode === 'youtube' ? youtubeUrl.trim() : undefined,
        duration,
        aspectRatio: aspect,
        enhanceQuality: enhance,
        burnSubtitles: subtitles,
        outputDir: outputDir || undefined
      })
      setJobId(id)
    } catch (err) {
      setBusy(false)
      setProgress({
        status: 'error',
        message: 'Failed to start.',
        percent: 0,
        error: (err as Error).message
      })
    }
  }

  async function cancel() {
    if (!jobId || !hasApi) return
    await window.clipster.cancelJob(jobId)
    setBusy(false)
    setJobId(null)
    setProgress({ status: 'idle', message: 'Cancelled.', percent: 0 })
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <img className="brand-mark" src={markUrl} alt="" />
          <div>
            <h1>Clipster</h1>
            <p>Precision clips for Shorts, TikTok, and Reels</p>
          </div>
        </div>
        <div className="tool-pills" title="Local processing tools">
          <span className={`pill ${tools.ffmpeg ? 'ok' : 'bad'}`}>FFmpeg {tools.ffmpeg ? 'ready' : 'missing'}</span>
          <span className={`pill ${tools.ytDlp ? 'ok' : 'bad'}`}>yt-dlp {tools.ytDlp ? 'ready' : 'missing'}</span>
          <span className={`pill ${tools.whisper ? 'ok' : 'bad'}`}>
            Whisper {tools.whisper ? 'ready' : 'not installed'}
          </span>
        </div>
      </header>
      {!tools.whisper && (
        <p className="whisper-hint">
          Auto subtitles need Whisper. Install Python, then run{' '}
          <code>pip install -U openai-whisper</code>, restart Clipster, and this badge should turn green.
        </p>
      )}

      <main className="workspace">
        <section className="panel">
          <div className="panel-header">
            <h2>Source & format</h2>
            <p>Import a local video or a YouTube URL, then choose clip length and frame.</p>
          </div>
          <div className="panel-body">
            <div className="source-tabs" role="tablist">
              <button
                type="button"
                className={`tab ${mode === 'file' ? 'active' : ''}`}
                onClick={() => setMode('file')}
              >
                Local video
              </button>
              <button
                type="button"
                className={`tab ${mode === 'youtube' ? 'active' : ''}`}
                onClick={() => setMode('youtube')}
              >
                YouTube URL
              </button>
            </div>

            {mode === 'file' ? (
              <button type="button" className="dropzone" onClick={() => void pickFile()}>
                <strong>{filePath ? 'Change video file' : 'Choose a downloaded video'}</strong>
                <span>MP4, MOV, MKV, WEBM — click to browse</span>
              </button>
            ) : (
              <div className="field">
                <label htmlFor="yt">YouTube link</label>
                <input
                  id="yt"
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=…"
                  value={youtubeUrl}
                  onChange={(e) => {
                    setYoutubeUrl(e.target.value)
                    setSourceInfo(null)
                  }}
                />
              </div>
            )}

            {sourceInfo && mode === 'file' && (
              <div className="meta-card">
                <div>
                  <strong>{sourceInfo.title}</strong>
                </div>
                <div>
                  {formatDuration(sourceInfo.durationSec)} · {sourceInfo.width}×{sourceInfo.height}
                  {estimatedClips ? ` · ~${estimatedClips} clip${estimatedClips === 1 ? '' : 's'}` : ''}
                </div>
                <div className="muted">{sourceInfo.path}</div>
              </div>
            )}

            <div className="field">
              <label>Clip length</label>
              <div className="choice-row">
                {(
                  [
                    { value: 60, title: '1 minute', hint: 'Fast hooks' },
                    { value: 120, title: '2 minutes', hint: 'Story beats' },
                    { value: 180, title: '3 minutes', hint: 'Longer cuts' }
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`choice ${duration === opt.value ? 'selected' : ''}`}
                    onClick={() => setDuration(opt.value)}
                  >
                    <span className="title">{opt.title}</span>
                    <span className="hint">{opt.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label>Aspect ratio</label>
              <div className="choice-row two">
                <button
                  type="button"
                  className={`choice ${aspect === '9:16' ? 'selected' : ''}`}
                  onClick={() => setAspect('9:16')}
                >
                  <span className="title">9:16 vertical</span>
                  <span className="hint">Shorts · TikTok · Reels</span>
                </button>
                <button
                  type="button"
                  className={`choice ${aspect === '16:9' ? 'selected' : ''}`}
                  onClick={() => setAspect('16:9')}
                >
                  <span className="title">16:9 widescreen</span>
                  <span className="hint">YouTube · landscape</span>
                </button>
              </div>
              <div className="platforms">
                <span className="platform-chip">YouTube Shorts</span>
                <span className="platform-chip">TikTok</span>
                <span className="platform-chip">Instagram Reels</span>
              </div>
            </div>

            <div className="toggle-list">
              <div className="toggle">
                <div className="copy">
                  <strong>Enhanced quality</strong>
                  <span>Faster encode with clearer color (recommended)</span>
                </div>
                <button
                  type="button"
                  className={`switch ${enhance ? 'on' : ''}`}
                  aria-pressed={enhance}
                  onClick={() => setEnhance((v) => !v)}
                />
              </div>
              <div className="toggle">
                <div className="copy">
                  <strong>Auto subtitles</strong>
                  <span>Whisper captions burned into each clip</span>
                </div>
                <button
                  type="button"
                  className={`switch ${subtitles ? 'on' : ''}`}
                  aria-pressed={subtitles}
                  onClick={() => setSubtitles((v) => !v)}
                />
              </div>
            </div>

            <div className="actions">
              <button type="button" className="btn btn-primary" disabled={!canStart} onClick={() => void startJob()}>
                {busy ? 'Working…' : 'Create clips'}
              </button>
              {busy && (
                <button type="button" className="btn btn-ghost" onClick={() => void cancel()}>
                  Cancel
                </button>
              )}
              <button type="button" className="btn btn-ghost" onClick={() => void pickOutput()} title={outputDir}>
                Folder
              </button>
            </div>
            <div className="muted-path">{outputDir || 'Exports go to ~/Clipster/exports'}</div>
          </div>
        </section>

        <section className="panel progress-panel">
          <div className="panel-header">
            <h2>Export status</h2>
            <p>Progress, logs, and finished files appear here while Clipster processes locally.</p>
          </div>
          <div className="panel-body" style={{ flex: 1 }}>
            <div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progress.percent}%` }} />
              </div>
              <div className="status-line">
                <strong>{statusLabel(progress.status)}</strong>
                <span>{progress.percent}%</span>
              </div>
              <p style={{ margin: '8px 0 0', color: 'var(--muted)', fontSize: '0.9rem' }}>{progress.message}</p>
            </div>

            {progress.error && <div className="error-box">{progress.error}</div>}

            <div className="log" aria-live="polite">
              {logLines.length === 0
                ? 'Waiting for a job…'
                : logLines.map((line, i) => <div key={`${i}-${line.slice(0, 12)}`}>{line}</div>)}
            </div>

            {segments.length > 0 ? (
              <div className="results">
                {segments.map((seg) => (
                  <div className="result-item" key={seg.outputPath}>
                    <div>
                      <div className="name">
                        Clip {seg.index} · {formatDuration(seg.endSec - seg.startSec)}
                      </div>
                      <div className="path">{seg.outputPath}</div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => void window.clipster.openPath(seg.outputPath)}
                    >
                      Open
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => void window.clipster.openPath(outputDir)}
                >
                  Open export folder
                </button>
              </div>
            ) : (
              <div className="empty-state">
                <strong>No exports yet</strong>
                Finished Shorts, TikTok, and Reels clips will list here.
              </div>
            )}

            {!hasApi && (
              <div className="error-box">
                Desktop bridge unavailable. Run with <code>npm run dev</code> inside Electron.
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
