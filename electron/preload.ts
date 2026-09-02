import { contextBridge, ipcRenderer } from 'electron'
import type { ClipJobRequest, ClipJobProgress, ClipsterApi } from '../src/vite-env'

const api: ClipsterApi = {
  selectVideoFile: () => ipcRenderer.invoke('dialog:selectVideo'),
  selectOutputDir: () => ipcRenderer.invoke('dialog:selectOutputDir'),
  getSourceInfo: (path) => ipcRenderer.invoke('source:info', path),
  startJob: (request: ClipJobRequest) => ipcRenderer.invoke('job:start', request),
  cancelJob: (jobId) => ipcRenderer.invoke('job:cancel', jobId),
  openPath: (path) => ipcRenderer.invoke('shell:openPath', path),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  getDefaultOutputDir: () => ipcRenderer.invoke('app:defaultOutputDir'),
  checkTools: () => ipcRenderer.invoke('app:checkTools'),
  onProgress: (callback: (progress: ClipJobProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: ClipJobProgress) => {
      callback(progress)
    }
    ipcRenderer.on('job:progress', listener)
    return () => ipcRenderer.removeListener('job:progress', listener)
  }
}

contextBridge.exposeInMainWorld('clipster', api)
