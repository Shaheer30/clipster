# ReelCut

Desktop app that turns long videos into ready-to-post **YouTube Shorts**, **TikTok**, and **Instagram Reels** clips.

## Features

- Import a **local video** or a **YouTube URL**
- Split into **1 / 2 / 3 minute** clips
- Export **9:16** (vertical) or **16:9** (widescreen)
- **Enhanced quality** encode (sharpen + high-quality H.264)
- **Automatic subtitles** via Whisper (burned into the video)
- Packaged installers for **Windows**, **macOS**, and **Linux** (GitHub Releases)

## Requirements (development)

- Node.js 20+
- FFmpeg (bundled via `ffmpeg-static` when available; system `ffmpeg`/`ffprobe` also work)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) for YouTube downloads
- Optional: [OpenAI Whisper](https://github.com/openai/whisper) (`pip install openai-whisper`) for auto captions

```bash
# macOS
brew install ffmpeg yt-dlp
pip3 install openai-whisper

# Ubuntu / Debian
sudo apt install ffmpeg
pip3 install openai-whisper
# install yt-dlp from https://github.com/yt-dlp/yt-dlp/releases
```

## Run locally

```bash
npm install
npm run dev
```

This opens the **ReelCut** Electron window. Exports default to `~/ReelCut/exports`.

## Build installers (GitHub package release)

```bash
# Current platform
npm run dist

# Explicit targets
npm run dist:win    # NSIS setup: release/ReelCut-Setup-1.0.0.exe
npm run dist:mac    # DMG
npm run dist:linux  # AppImage + .deb
```

Installers are written to the `release/` folder. Attach those artifacts to a **GitHub Release** so users can download the setup and install ReelCut on their machine.

### Publish a GitHub Release

1. Push a version tag, for example `v1.0.0`
2. GitHub Actions (`.github/workflows/release.yml`) builds Windows, macOS, and Linux packages
3. Users download the setup from the Releases page and install

Update `build.publish` in `package.json` to match your GitHub username/repo before publishing.

## How clipping works

1. Source is loaded (file) or downloaded with yt-dlp (YouTube)
2. Duration is probed; the video is split into equal segments of the selected length
3. Each segment is center-cropped/scaled to the chosen aspect ratio
4. Optional Whisper pass creates an `.srt`, sliced per clip, and burned in
5. Finished MP4s land in your export folder — ready to upload

## Project layout

```
electron/     Main process, preload, FFmpeg / yt-dlp / Whisper pipeline
src/          React UI
resources/    Extra binaries (yt-dlp) bundled into installers
release/      Built setup packages (after npm run dist)
```

## License

MIT
