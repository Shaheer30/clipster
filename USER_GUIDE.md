# Clipster — User Guide

This guide is for **people who want to install and use Clipster**, not for developers building the app from source.

Clipster turns long videos into ready-to-post clips for **YouTube Shorts**, **TikTok**, and **Instagram Reels**.

---

## 1. What you need

| Item | Required? | Notes |
|---|---|---|
| Windows 10/11 (64-bit), macOS, or Linux | Yes | Download the installer for your system |
| Internet (for YouTube URLs) | Only for YouTube import | Local video files work offline |
| **Whisper** (Python package) | Optional | Needed only if you want **automatic burned-in subtitles** |
| Disk space | Yes | Keep free space for downloads + exported clips |

Bundled with the app (you normally do **not** install these yourself):

- **FFmpeg** — video clipping / encoding  
- **yt-dlp** — YouTube downloads  

---

## 2. Download the installer

Open the latest release:

**[https://github.com/Shaheer30/clipster/releases/latest](https://github.com/Shaheer30/clipster/releases/latest)**

Or the current production build (**v1.1.0**):

**[https://github.com/Shaheer30/clipster/releases/tag/v1.1.0](https://github.com/Shaheer30/clipster/releases/tag/v1.1.0)**

| Your computer | Download this file |
|---|---|
| **Windows** | `Clipster-Setup-1.1.0.exe` |
| **macOS** | `Clipster-1.1.0-mac.dmg` |
| **Linux (any)** | `Clipster-1.1.0-x86_64.AppImage` |
| **Ubuntu / Debian** | `Clipster-1.1.0-amd64.deb` |

---

## 3. Install Clipster

### Windows

1. Download `Clipster-Setup-1.1.0.exe`.
2. Double-click the file.
3. If Windows SmartScreen appears, choose **More info** → **Run anyway** (common for new apps).
4. Follow the installer:
   - Choose the install folder (default is fine)
   - Allow desktop / Start menu shortcuts
5. Click **Finish** and open **Clipster**.
6. Confirm the top badges show **FFmpeg ready** and **yt-dlp ready**.  
   **Whisper** may say optional/missing until you install it (section 5).

**Upgrading from an older version**

1. Close Clipster.
2. Uninstall the old version from **Settings → Apps** (recommended).
3. Install the new setup `.exe`.
4. Open Clipster and try a short test clip.

### macOS

1. Download `Clipster-1.1.0-mac.dmg`.
2. Open the DMG and drag **Clipster** into **Applications**.
3. First launch: right-click Clipster → **Open** (macOS may block unsigned apps once).
4. Confirm the tool badges in the app header.

### Linux

**AppImage**

```bash
chmod +x Clipster-1.1.0-x86_64.AppImage
./Clipster-1.1.0-x86_64.AppImage
```

**Debian / Ubuntu (.deb)**

```bash
sudo dpkg -i Clipster-1.1.0-amd64.deb
# if dependencies are missing:
sudo apt-get install -f
```

Then launch **Clipster** from your app menu.

---

## 4. First launch checklist

When Clipster opens, check the header pills:

| Badge | Meaning |
|---|---|
| **FFmpeg ready** | Clipping / encoding will work |
| **yt-dlp ready** | YouTube URLs can be downloaded |
| **Whisper ready** | Auto subtitles can burn captions into clips |
| **Whisper optional / missing** | App still works; turn off Auto subtitles or install Whisper |

Default export folder:

- Windows: `C:\Users\<YourName>\Clipster\exports`
- macOS / Linux: `~/Clipster/exports`

You can change this with the **Folder** button.

---

## 5. Optional: install Whisper (auto subtitles)

Skip this whole section if you do **not** need burned-in captions. Clipster still works without Whisper.

### What Whisper does

Whisper listens to the video audio and creates **automatic subtitles** that Clipster burns into your Shorts / TikTok / Reels clips.

Official project: [https://github.com/openai/whisper](https://github.com/openai/whisper)

> **Important:** You do **not** need Node.js for Whisper.  
> Node.js is only for developers who build Clipster from source.  
> For subtitles you only need: **① Python** → **② Whisper**.

---

### Easy setup (Windows) — 2 steps

#### Step 1 — Install Python

1. Open the official Python download page:  
   **[https://www.python.org/downloads/](https://www.python.org/downloads/)**
2. Click the big yellow **Download Python** button.
3. Run the installer.
4. On the first screen, turn ON this checkbox (very important):

   **Add python.exe to PATH**

5. Click **Install Now** and finish.
6. Close any old Command Prompt / PowerShell windows.
7. Open a **new** Command Prompt and check:

```bat
python --version
pip --version
```

You should see version numbers (for example `Python 3.12.x`).  
If `python` is not found, reinstall Python and make sure **Add python.exe to PATH** is checked.

#### Step 2 — Install Whisper

1. In the same Command Prompt, run:

```bat
pip install -U openai-whisper
```

2. Wait until it finishes (this can take a few minutes).
3. Check that Whisper installed:

```bat
whisper --help
```

4. If that fails, try:

```bat
python -m pip install -U openai-whisper
python -m whisper --help
```

5. Fully close **Clipster**, then open it again.
6. In the Clipster header, you should now see **Whisper ready**.
7. Turn **Auto subtitles** ON and create a test clip.

**Package page (optional reading):**  
[https://pypi.org/project/openai-whisper/](https://pypi.org/project/openai-whisper/)

---

### Easy setup (macOS) — 2 steps

#### Step 1 — Install Python

- Download: **[https://www.python.org/downloads/macos/](https://www.python.org/downloads/macos/)**  
  **or** with Homebrew:

```bash
brew install python
```

Check:

```bash
python3 --version
pip3 --version
```

#### Step 2 — Install Whisper

```bash
pip3 install -U openai-whisper
whisper --help
```

Restart Clipster → confirm **Whisper ready**.

---

### Easy setup (Linux) — 2 steps

#### Step 1 — Install Python

```bash
sudo apt update
sudo apt install -y python3 python3-pip
python3 --version
pip3 --version
```

#### Step 2 — Install Whisper

```bash
pip3 install -U openai-whisper
# or:
python3 -m pip install -U openai-whisper
whisper --help
```

Restart Clipster → confirm **Whisper ready**.

---

### Whisper tips

- First subtitle run may download a small model and take longer.
- Needs clear speech; music-only videos may produce almost no captions.
- If Whisper is not installed, turn **Auto subtitles** OFF and keep clipping normally.

---

## 6. How to create clips (step by step)

### A) Import a source

**Option 1 — Local video**

1. Select **Local video**.
2. Click **Choose a downloaded video**.
3. Pick an `MP4`, `MOV`, `MKV`, or `WEBM` file.
4. Confirm duration / resolution appear under the file.

**Option 2 — YouTube URL**

1. Select **YouTube URL**.
2. Paste a full link, for example:  
   `https://www.youtube.com/watch?v=...`
3. Keep internet connected for the download.

### B) Choose clip settings

1. **Clip length**
   - **1 minute** — short hooks  
   - **2 minutes** — medium story beats  
   - **3 minutes** — longer cuts  
2. **Aspect ratio**
   - **9:16 vertical** — YouTube Shorts, TikTok, Instagram Reels  
   - **16:9 widescreen** — landscape / classic YouTube  
3. **Enhanced quality** — ON for sharper, higher-quality exports (slower).  
4. **Auto subtitles** — ON only if Whisper is installed; otherwise turn OFF.

### C) Export folder

1. Click **Folder** to pick where finished MP4s are saved.  
2. Or leave the default `Clipster/exports` folder.

### D) Start processing

1. Click **Create clips**.
2. Watch **Export status**:
   - Downloading (YouTube only)
   - Analyzing
   - Subtitles (if enabled)
   - Clipping / Enhancing
   - Complete
3. When done, each clip appears in the results list.
4. Click **Open** on a clip, or **Open export folder**.

### E) Post to social apps

Upload the exported MP4s to:

- YouTube Shorts  
- TikTok  
- Instagram Reels  

Prefer **9:16** exports for those platforms.

---

## 7. What a good production run looks like

For a reliable “ready to post” workflow:

1. Use **v1.1.0+** installer from GitHub Releases.  
2. Confirm **FFmpeg ready** + **yt-dlp ready**.  
3. Install Whisper if you need captions → **Whisper ready**.  
4. Use a clear source video (decent audio if you want subtitles).  
5. Choose **9:16** + **1 or 2 minutes** for Shorts/TikTok/Reels.  
6. Keep **Enhanced quality** ON for final posts.  
7. Review one sample clip before batch-uploading everything.  
8. Keep enough free disk space (source + all exported parts).

---

## 8. Understanding the progress statuses

| Status | Meaning |
|---|---|
| Ready | Waiting for you to start |
| Downloading | Fetching the YouTube video |
| Analyzing | Reading length / resolution |
| Subtitles | Whisper is generating captions |
| Clipping / Enhancing / Burning captions | Encoding each clip |
| Complete | Exports are ready |
| Failed | See the red error box + log panel |

---

## 9. Troubleshooting

### `ffmpeg.exe ENOENT` / spawn error on Windows

You are on an old build. Install **v1.1.0 or newer**:

[Clipster-Setup-1.1.0.exe](https://github.com/Shaheer30/clipster/releases/download/v1.1.0/Clipster-Setup-1.1.0.exe)

Uninstall the previous Clipster first, then install again.

### Whisper badge missing / “exporting without burned-in subtitles”

1. Install Whisper (section 5).  
2. Restart the computer if PATH was just updated.  
3. Reopen Clipster.  
4. Or turn **Auto subtitles** OFF and continue without captions.

### YouTube download fails

1. Check your internet connection.  
2. Confirm the URL opens in a browser.  
3. Try a different public video (private/age-restricted links often fail).  
4. Confirm **yt-dlp ready** in the header.  
5. As a fallback: download the video yourself, then use **Local video**.

### “Video is shorter than the selected clip length”

Choose a shorter clip length (1 or 2 minutes), or use a longer source video.

### Export is very slow

That is normal for very long sources with many clips, but **v1.1.0+** is much faster.

Tips:
- Use **v1.1.0 or newer**
- Turn **Auto subtitles** OFF if you do not need captions (Whisper is the slowest step)
- Prefer **2 or 3 minute** clips (fewer files to encode) for a first pass
- Keep **Enhanced quality** ON — it no longer uses the ultra-slow encoder preset

A 20–30 minute video should usually finish in minutes on a modern PC, not an hour.

### Captions / subtitles missing

1. Confirm the header shows **Whisper ready**
2. Keep **Auto subtitles** ON
3. Use **Clipster 1.1.0+** (fixes Windows caption burn-in + auto language detection)
4. Make sure the video has clear speech (not music-only)
5. Watch the log for:
   - `Whisper not installed`
   - `No captions were produced`
   - `Captions ready — encoding clips…`

### App won’t open on macOS

Right-click → **Open**, or allow it in **System Settings → Privacy & Security**.

### SmartScreen blocks the Windows setup

Choose **More info** → **Run anyway**. The app is distributed from your GitHub Releases page.

---

## 10. Privacy & processing

- Processing runs **on your computer** (local).  
- YouTube downloads and Whisper model downloads need internet.  
- Exported files stay in your chosen export folder until you move/upload them.

---

## 11. Uninstall

### Windows

**Settings → Apps → Installed apps → Clipster → Uninstall**

You may manually delete leftover folders if desired:

- `%LOCALAPPDATA%\Programs\Clipster`
- `%USERPROFILE%\Clipster\exports`

### macOS

Delete **Clipster** from **Applications**.

### Linux

```bash
# deb install
sudo apt remove clipster
# AppImage: just delete the .AppImage file
```

---

## 12. Getting help

1. Check the log panel inside Clipster (right side).  
2. Confirm you are on the latest release.  
3. Open an issue on GitHub with:
   - Your OS (Windows / macOS / Linux)
   - Clipster version
   - Screenshot of the error
   - Whether source was local file or YouTube URL

Repository: [https://github.com/Shaheer30/clipster](https://github.com/Shaheer30/clipster)  
Releases: [https://github.com/Shaheer30/clipster/releases](https://github.com/Shaheer30/clipster/releases)

---

## Quick start (short version)

1. Download **Clipster-Setup** for your OS from Releases.  
2. Install and open Clipster.  
3. (Optional, for auto subtitles only)
   - **Step 1:** Install Python → [python.org/downloads](https://www.python.org/downloads/) (check **Add to PATH**)
   - **Step 2:** Run `pip install -U openai-whisper`, then restart Clipster  
4. Import a video or paste a YouTube URL.  
5. Pick **1/2/3 min**, **9:16 or 16:9**, quality + subtitles.  
6. Click **Create clips**.  
7. Upload the exported MP4s to Shorts, TikTok, or Reels.
