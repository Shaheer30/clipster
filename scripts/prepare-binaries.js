#!/usr/bin/env node
/**
 * Copy platform ffmpeg/ffprobe binaries into resources/bin so electron-builder
 * ships them via extraResources (outside asar). Required for Windows installs.
 */
const fs = require('fs')
const path = require('path')

const outDir = path.join(__dirname, '..', 'resources', 'bin')
fs.mkdirSync(outDir, { recursive: true })

const isWin = process.platform === 'win32'
const ffmpegName = isWin ? 'ffmpeg.exe' : 'ffmpeg'
const ffprobeName = isWin ? 'ffprobe.exe' : 'ffprobe'

function copyBinary(src, destName) {
  if (!src || !fs.existsSync(src)) {
    console.warn(`[prepare-binaries] missing source for ${destName}: ${src}`)
    return false
  }
  const dest = path.join(outDir, destName)
  fs.copyFileSync(src, dest)
  if (!isWin) fs.chmodSync(dest, 0o755)
  console.log(`[prepare-binaries] ${destName} <- ${src}`)
  return true
}

let ffmpegPath = null
let ffprobePath = null
try {
  ffmpegPath = require('ffmpeg-static')
} catch (err) {
  console.warn('[prepare-binaries] ffmpeg-static not available', err.message)
}
try {
  ffprobePath = require('ffprobe-static').path
} catch (err) {
  console.warn('[prepare-binaries] ffprobe-static not available', err.message)
}

const okFfmpeg = copyBinary(ffmpegPath, ffmpegName)
const okFfprobe = copyBinary(ffprobePath, ffprobeName)

if (!okFfmpeg || !okFfprobe) {
  console.error('[prepare-binaries] failed to stage one or more binaries')
  process.exit(1)
}
