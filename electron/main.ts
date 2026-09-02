import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join, delimiter } from 'path'
import { homedir } from 'os'
import { existsSync, mkdirSync } from 'fs'
import { execFileSync } from 'child_process'
import { probeVideo, processClipJob, cancelJob, checkTools } from './pipeline'
import type { ClipJobRequest } from '../src/vite-env'

function refreshPath(): void {
  const extras: string[] = []

  if (process.platform === 'win32') {
    try {
      const userPath = execFileSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-Command',
          "[Environment]::GetEnvironmentVariable('Path','User')"
        ],
        { encoding: 'utf8', windowsHide: true, timeout: 8000 }
      ).trim()
      const machinePath = execFileSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-Command',
          "[Environment]::GetEnvironmentVariable('Path','Machine')"
        ],
        { encoding: 'utf8', windowsHide: true, timeout: 8000 }
      ).trim()
      if (userPath) extras.push(userPath)
      if (machinePath) extras.push(machinePath)
    } catch {
      /* ignore */
    }

    const local = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local')
    extras.push(
      join(local, 'Python', 'bin'),
      join(local, 'Programs', 'Python'),
      join(homedir(), '.local', 'bin')
    )
  } else {
    extras.push(join(homedir(), '.local', 'bin'), '/usr/local/bin')
  }

  process.env.PATH = [...extras, process.env.PATH || ''].filter(Boolean).join(delimiter)
}

refreshPath()

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 960,
    minHeight: 640,
    title: 'Clipster',
    backgroundColor: '#0c1017',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function sendProgress(payload: unknown): void {
  mainWindow?.webContents.send('job:progress', payload)
}

function defaultOutputDir(): string {
  const dir = join(homedir(), 'Clipster', 'exports')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

app.whenReady().then(() => {
  refreshPath()
  createWindow()

  ipcMain.handle('dialog:selectVideo', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Select a video',
      properties: ['openFile'],
      filters: [
        { name: 'Videos', extensions: ['mp4', 'mov', 'mkv', 'webm', 'avi', 'm4v'] }
      ]
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('dialog:selectOutputDir', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Choose export folder',
      properties: ['openDirectory', 'createDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('source:info', async (_e, path: string) => probeVideo(path))

  ipcMain.handle('job:start', async (_e, request: ClipJobRequest) => {
    const jobId = `job_${Date.now()}`
    const outputDir = request.outputDir || defaultOutputDir()
    void processClipJob(jobId, { ...request, outputDir }, sendProgress)
    return { jobId }
  })

  ipcMain.handle('job:cancel', async (_e, jobId: string) => {
    cancelJob(jobId)
  })

  ipcMain.handle('shell:openPath', async (_e, path: string) => {
    await shell.openPath(path)
  })

  ipcMain.handle('shell:openExternal', async (_e, url: string) => {
    await shell.openExternal(url)
  })

  ipcMain.handle('app:defaultOutputDir', async () => defaultOutputDir())

  ipcMain.handle('app:checkTools', async () => {
    refreshPath()
    return checkTools()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
