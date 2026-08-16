const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  boot: () => ipcRenderer.invoke('boot'),
  task: () => ipcRenderer.invoke('task'),
  state: () => ipcRenderer.invoke('state'),
  exit: () => ipcRenderer.invoke('exit'),
  notify: (title, body) => ipcRenderer.invoke('notify', { title, body }),
  resizePet: (w, h) => ipcRenderer.invoke('resize-pet', { w, h }),
  dragStart: () => ipcRenderer.invoke('drag-start'),
  dragMove: (dx, dy) => ipcRenderer.invoke('drag-move', { dx, dy }),
  dragEnd: () => ipcRenderer.invoke('drag-end'),
  setIgnore: (ignore) => ipcRenderer.invoke('set-ignore', { ignore }),
  context: () => ipcRenderer.send('context'),
  onMenu: (cb) => ipcRenderer.on('menu-action', (_e, a) => cb(a)),
})
