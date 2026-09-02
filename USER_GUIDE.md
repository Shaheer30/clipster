# ReelCut — User Guide

This guide is for **people who want to install and use ReelCut**, not for developers building the app from source.

ReelCut turns long videos into ready-to-post clips for **YouTube Shorts**, **TikTok**, and **Instagram Reels**.

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

**[https://github.com/Shaheer30/reelcut/releases/latest](https://github.com/Shaheer30/reelcut/releases/latest)**

Or the current production build (**v1.0.2**):

**[https://github.com/Shaheer30/reelcut/releases/tag/v1.0.2](https://github.com/Shaheer30/reelcut/releases/tag/v1.0.2)**

| Your computer | Download this file |
|---|---|
| **Windows** | `ReelCut-Setup-1.0.2.exe` |
| **macOS** | `ReelCut-1.0.2-mac.dmg` |
| **Linux (any)** | `ReelCut-1.0.2-x86_64.AppImage` |
| **Ubuntu / Debian** | `ReelCut-1.0.2-amd64.deb` |

---

## 3. Install ReelCut

### Windows

1. Download `ReelCut-Setup-1.0.2.exe`.
2. Double-click the file.
3. If Windows SmartScreen appears, choose **More info** → **Run anyway** (common for new apps).
4. Follow the installer:
   - Choose the install folder (default is fine)
   - Allow desktop / Start menu shortcuts
5. Click **Finish** and open **ReelCut**.
6. Confirm the top badges show **FFmpeg ready** and **yt-dlp ready**.  
   **Whisper** may say optional/missing until you install it (section 5).

**Upgrading from an older version**

1. Close ReelCut.
2. Uninstall the old version from **Settings → Apps** (recommended).
3. Install the new setup `.exe`.
4. Open ReelCut and try a short test clip.

### macOS

1. Download `ReelCut-1.0.2-mac.dmg`.
2. Open the DMG and drag **ReelCut** into **Applications**.
3. First launch: right-click ReelCut → **Open** (macOS may block unsigned apps once).
4. Confirm the tool badges in the app header.

### Linux

**AppImage**

```bash
chmod +x ReelCut-1.0.2-x86_64.AppImage
./ReelCut-1.0.2-x86_64.AppImage
```

**Debian / Ubuntu (.deb)**

```bash
sudo dpkg -i ReelCut-1.0.2-amd64.deb
# if dependencies are missing:
sudo apt-get install -f
```

Then launch **ReelCut** from your app menu.

---

## 4. First launch checklist

When ReelCut opens, check the header pills:

| Badge | Meaning |
|---|---|
| **FFmpeg ready** | Clipping / encoding will work |
| **yt-dlp ready** | YouTube URLs can be downloaded |
| **Whisper ready** | Auto subtitles can burn captions into clips |
| **Whisper optional / missing** | App still works; turn off Auto subtitles or install Whisper |

Default export folder:

- Windows: `C:\Users\<YourName>\ReelCut\exports`
- macOS / Linux: `~/ReelCut/exports`

You can change this with the **Folder** button.

---

## 5. Optional: install Whisper (auto subtitles)

### What Whisper is

**Whisper** is OpenAI’s speech-to-text tool. ReelCut uses it only for **Auto subtitles**:

1. Transcribe speech from your video  
2. Create caption timing  
3. Burn captions into each exported clip  

Without Whisper, ReelCut still clips, crops, and enhances video — just without burned-in captions.

### Windows install (detailed)

1. Install **Python 3.10+** from [https://www.python.org/downloads/](https://www.python.org/downloads/)  
   - Enable **“Add python.exe to PATH”**.
2. Open **PowerShell** and confirm Python works:

```powershell
python --version
pip --version
```

3. Install Whisper:

```powershell
pip install -U openai-whisper
```

4. Confirm the command exists:

```powershell
whisper --help
```

5. Fully quit and reopen **ReelCut**.  
   The header should show **Whisper ready**.

**Notes**

- First subtitle job may download a model (ReelCut uses the small `tiny` model) and can take several minutes.
- Subtitles need clear speech audio; music-only videos produce little or no text.
- If install fails, try:

```powershell
python -m pip install -U openai-whisper
```

### macOS install

```bash
brew install python ffmpeg
pip3 install -U openai-whisper
whisper --help
```

Restart ReelCut afterward.

### Linux install

```bash
sudo apt update
sudo apt install -y python3 python3-pip ffmpeg
pip3 install -U openai-whisper
# or: python3 -m pip install -U openai-whisper
whisper --help
```

Restart ReelCut afterward.

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
2. Or leave the default `ReelCut/exports` folder.

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

1. Use **v1.0.2+** installer from GitHub Releases.  
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

You are on an old build. Install **v1.0.2 or newer**:

[ReelCut-Setup-1.0.2.exe](https://github.com/Shaheer30/reelcut/releases/download/v1.0.2/ReelCut-Setup-1.0.2.exe)

Uninstall the previous ReelCut first, then install again.

### Whisper badge missing / “exporting without burned-in subtitles”

1. Install Whisper (section 5).  
2. Restart the computer if PATH was just updated.  
3. Reopen ReelCut.  
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

That is normal for:

- Long videos  
- Many clips  
- Enhanced quality ON  
- Subtitles ON (Whisper + burn-in)

Try a short test clip first.

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

**Settings → Apps → Installed apps → ReelCut → Uninstall**

You may manually delete leftover folders if desired:

- `%LOCALAPPDATA%\Programs\ReelCut`
- `%USERPROFILE%\ReelCut\exports`

### macOS

Delete **ReelCut** from **Applications**.

### Linux

```bash
# deb install
sudo apt remove reelcut
# AppImage: just delete the .AppImage file
```

---

## 12. Getting help

1. Check the log panel inside ReelCut (right side).  
2. Confirm you are on the latest release.  
3. Open an issue on GitHub with:
   - Your OS (Windows / macOS / Linux)
   - ReelCut version
   - Screenshot of the error
   - Whether source was local file or YouTube URL

Repository: [https://github.com/Shaheer30/reelcut](https://github.com/Shaheer30/reelcut)  
Releases: [https://github.com/Shaheer30/reelcut/releases](https://github.com/Shaheer30/reelcut/releases)

---

## Quick start (short version)

1. Download **ReelCut-Setup** for your OS from Releases.  
2. Install and open ReelCut.  
3. (Optional) Install Whisper for auto subtitles.  
4. Import a video or paste a YouTube URL.  
5. Pick **1/2/3 min**, **9:16 or 16:9**, quality + subtitles.  
6. Click **Create clips**.  
7. Upload the exported MP4s to Shorts, TikTok, or Reels.
