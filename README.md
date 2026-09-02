# Clipster

Dark-luxury desktop app that turns long videos into ready-to-post **YouTube Shorts**, **TikTok**, and **Instagram Reels** clips.

> **End users:** start with the **[User Guide](./USER_GUIDE.md)** — installers, Whisper setup, step-by-step usage, and troubleshooting.  
> **Developers:** keep reading below.

## Download installers (production)

Latest release will publish as **Clipster** on GitHub Releases:

[https://github.com/Shaheer30/clipster/releases](https://github.com/Shaheer30/clipster/releases)

| Platform | File pattern |
|---|---|
| **Windows** | `Clipster-Setup-<version>.exe` |
| **macOS** | `Clipster-<version>-mac.dmg` |
| **Linux** | `Clipster-<version>-x86_64.AppImage` · `.deb` |

## Features

- Import a **local video** or a **YouTube URL**
- Split into **1 / 2 / 3 minute** clips
- Export **9:16** (vertical) or **16:9** (widescreen)
- **Enhanced quality** encode
- **Automatic subtitles** via Whisper (burned into the video)
- Packaged installers for **Windows**, **macOS**, and **Linux**

## Brand

- Name: **Clipster**
- Theme: dark luxury (charcoal + champagne gold + ivory)
- Mark / wordmark: `resources/branding/`

## Requirements (development)

- Node.js 20+
- FFmpeg staged into `resources/bin` at package time
- yt-dlp bundled into installer resources
- Optional: OpenAI Whisper for captions

```bash
npm install
npm run dev
```

Exports default to `~/Clipster/exports`.

## Build installers

```bash
npm run dist
npm run dist:win
npm run dist:mac
npm run dist:linux
```

Tag `vX.Y.Z` to publish via GitHub Actions.

## License

MIT
