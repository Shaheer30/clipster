# ReelCut

Desktop app that turns long videos into ready-to-post **YouTube Shorts**, **TikTok**, and **Instagram Reels** clips.

> **End users:** start with the **[User Guide](./USER_GUIDE.md)** — installers, Whisper setup, step-by-step usage, and troubleshooting.  
> **Developers:** keep reading below.

## Download installers (production)

Latest release: **[v1.0.2](https://github.com/Shaheer30/reelcut/releases/tag/v1.0.2)**  
(or always: [https://github.com/Shaheer30/reelcut/releases/latest](https://github.com/Shaheer30/reelcut/releases/latest))

| Platform | Download |
|---|---|
| **Windows** | [ReelCut-Setup-1.0.2.exe](https://github.com/Shaheer30/reelcut/releases/download/v1.0.2/ReelCut-Setup-1.0.2.exe) |
| **macOS** | [ReelCut-1.0.2-mac.dmg](https://github.com/Shaheer30/reelcut/releases/download/v1.0.2/ReelCut-1.0.2-mac.dmg) |
| **Linux** | [AppImage](https://github.com/Shaheer30/reelcut/releases/download/v1.0.2/ReelCut-1.0.2-x86_64.AppImage) · [Deb](https://github.com/Shaheer30/reelcut/releases/download/v1.0.2/ReelCut-1.0.2-amd64.deb) |

## Features

- Import a **local video** or a **YouTube URL**
- Split into **1 / 2 / 3 minute** clips
- Export **9:16** (vertical) or **16:9** (widescreen)
- **Enhanced quality** encode (sharpen + high-quality H.264)
- **Automatic subtitles** via Whisper (burned into the video)
- Packaged installers for **Windows**, **macOS**, and **Linux** (GitHub Releases)

## Requirements (development)

- Node.js 20+
- FFmpeg (bundled via `ffmpeg-static` / staged into `resources/bin` at package time)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) for YouTube downloads (bundled into installer resources)
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
npm run dist:win    # NSIS setup: release/ReelCut-Setup-<version>.exe
npm run dist:mac    # DMG
npm run dist:linux  # AppImage + .deb
```

`npm run prepare:binaries` copies platform `ffmpeg` / `ffprobe` into `resources/bin` before packaging so Windows installs can spawn them outside `app.asar`.

Installers are written to the `release/` folder.

### Publish a GitHub Release

1. Bump `version` in `package.json`
2. Push a version tag, for example `v1.0.2`
3. GitHub Actions (`.github/workflows/release.yml`) builds Windows, macOS, and Linux packages and attaches them to the release
4. Users follow **[USER_GUIDE.md](./USER_GUIDE.md)** to install

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
resources/    Extra binaries (yt-dlp; ffmpeg staged at build time)
scripts/      Packaging helpers (prepare-binaries)
release/      Built setup packages (after npm run dist)
USER_GUIDE.md End-user install + usage notes
```

## License

MIT
