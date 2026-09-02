export type ClipDuration = 60 | 120 | 180
export type AspectRatio = '16:9' | '9:16'
export type JobStatus =
  | 'idle'
  | 'downloading'
  | 'analyzing'
  | 'transcribing'
  | 'clipping'
  | 'enhancing'
  | 'subtitling'
  | 'done'
  | 'error'

export interface ClipJobRequest {
  sourceType: 'file' | 'youtube'
  sourcePath?: string
  youtubeUrl?: string
  duration: ClipDuration
  aspectRatio: AspectRatio
  enhanceQuality: boolean
  burnSubtitles: boolean
  outputDir?: string
}

export interface ClipSegment {
  index: number
  startSec: number
  endSec: number
  outputPath: string
  subtitlePath?: string
}

export interface ClipJobProgress {
  status: JobStatus
  message: string
  percent: number
  segments?: ClipSegment[]
  error?: string
}

export interface SourceInfo {
  title: string
  durationSec: number
  width: number
  height: number
  path: string
}

export interface ClipsterApi {
  selectVideoFile: () => Promise<string | null>
  selectOutputDir: () => Promise<string | null>
  getSourceInfo: (path: string) => Promise<SourceInfo>
  startJob: (request: ClipJobRequest) => Promise<{ jobId: string }>
  cancelJob: (jobId: string) => Promise<void>
  openPath: (path: string) => Promise<void>
  openExternal: (url: string) => Promise<void>
  onProgress: (callback: (progress: ClipJobProgress) => void) => () => void
  getDefaultOutputDir: () => Promise<string>
  checkTools: () => Promise<{ ffmpeg: boolean; ytDlp: boolean; whisper: boolean }>
}

declare global {
  interface Window {
    clipster: ClipsterApi
  }
}

export {}
