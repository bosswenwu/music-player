const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('musicDesktop', {
  getLibrary: () => ipcRenderer.invoke('library:get'),
  pickFolder: () => ipcRenderer.invoke('library:pick'),
  lyricFetch: (artist, title) => ipcRenderer.invoke('lyric:fetch', { artist, title }),
  artistPhoto: (artist) => ipcRenderer.invoke('artist:photo', artist),
  /** 监听托盘 / 全局媒体键命令：'toggle' | 'next' | 'prev' */
  onMediaCommand: (cb) => {
    const handler = (_e, cmd) => cb(cmd)
    ipcRenderer.on('media:command', handler)
    return () => ipcRenderer.removeListener('media:command', handler)
  },
  /** 迷你歌词悬浮窗 */
  lyricFloatUpdate: (data) => ipcRenderer.send('lyricfloat:update', data),
  lyricFloatToggle: () => ipcRenderer.invoke('lyricfloat:toggle'),
  lyricFloatState: () => ipcRenderer.invoke('lyricfloat:state'),
  lyricFloatConfig: (config) => ipcRenderer.send('lyricfloat:config', config),
  onLyricFloat: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('lyricfloat:data', handler)
    return () => ipcRenderer.removeListener('lyricfloat:data', handler)
  },
  onLyricFloatConfig: (cb) => {
    const handler = (_e, config) => cb(config)
    ipcRenderer.on('lyricfloat:config', handler)
    return () => ipcRenderer.removeListener('lyricfloat:config', handler)
  },
})
