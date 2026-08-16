const { app, BrowserWindow, ipcMain, screen, Menu, Notification } = require('electron')
const fs = require('fs')
const path = require('path')

function readJsonSafe(p, dflt) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch (e) { return dflt }
}

// 资产根目录（含 web/ 与 task.json 的那一层）：
// 优先读本目录 config.json 的 assetRoot；否则默认仓库布局（本文件上一级 = pets/xilian）
const APP_CFG = readJsonSafe(path.join(__dirname, 'config.json'), {})
const ASSET_DIR = APP_CFG.assetRoot || path.join(__dirname, '..')
const BOUNDS_FILE = path.join(__dirname, 'bounds.json')
const HEARTBEAT_FILE = path.join(ASSET_DIR, 'desktop_alive.json')
const STATE_FILE = path.join(ASSET_DIR, 'state.json')
const ICON_FILE = path.join(ASSET_DIR, 'web', 'icon.png')
const BUBBLE_ZONE = 100

app.disableHardwareAcceleration()

function readJsonSafe(p, dflt) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch (e) { return dflt }
}

function bootPayload() {
  const manifest = readJsonSafe(path.join(ASSET_DIR, 'web', 'manifest.json'), { cols: 8, rows: 9, cellW: 161, cellH: 194, displayScale: 1.15, anims: [] })
  const state = readJsonSafe(STATE_FILE, { scale: 1.15 })
  const b64 = fs.readFileSync(path.join(ASSET_DIR, 'web', 'sprite.b64'), 'utf8').trim()
  const scale = (typeof state.scale === 'number' && state.scale > 0.3 && state.scale <= 3) ? state.scale : 1.15
  return {
    spriteDataUrl: 'data:image/webp;base64,' + b64,
    cols: manifest.cols || 8,
    rows: manifest.rows || 9,
    cellW: manifest.cellW || 161,
    cellH: manifest.cellH || 194,
    scale,
    anims: manifest.anims || [],
    notify: !!state.notify,
  }
}

function writeHeartbeat() {
  try { fs.writeFileSync(HEARTBEAT_FILE, JSON.stringify({ at: Date.now() })) } catch (e) { /* ignore */ }
}

function toggleNotify() {
  const st = readJsonSafe(STATE_FILE, {})
  const next = !st.notify
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(Object.assign(st, { notify: next })))
  } catch (e) { /* ignore */ }
  return next
}

function adjustScale(delta) {
  const st = readJsonSafe(STATE_FILE, {})
  const cur = typeof st.scale === 'number' ? st.scale : 1.15
  const next = Math.min(2.5, Math.max(0.4, Math.round((cur + delta) * 100) / 100))
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(Object.assign(st, { scale: next })))
  } catch (e) { /* ignore */ }
  return next
}

let saveTimer = null
let dragOrigin = null
let heartbeatTimer = null

function createWindow() {
  const payload = bootPayload()
  const petW = Math.round(payload.cellW * payload.scale)
  const petH = Math.round(payload.cellH * payload.scale)
  const w = petW
  const h = petH + BUBBLE_ZONE
  const saved = readJsonSafe(BOUNDS_FILE, null)
  const wa = screen.getPrimaryDisplay().workArea
  const x = saved && typeof saved.x === 'number' ? saved.x : wa.x + wa.width - w - 24
  const y = saved && typeof saved.y === 'number' ? saved.y : wa.y + wa.height - h - 24
  const win = new BrowserWindow({
    x,
    y,
    width: w,
    height: h,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  win.loadFile('index.html')
  win.setIgnoreMouseEvents(true, { forward: true })
  win.on('moved', () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      try {
        const b = win.getBounds()
        fs.writeFileSync(BOUNDS_FILE, JSON.stringify({ x: b.x, y: b.y }))
      } catch (e) { /* ignore */ }
    }, 400)
  })
  return win
}

app.whenReady().then(() => {
  createWindow()
  heartbeatTimer = setInterval(writeHeartbeat, 5000)
  writeHeartbeat()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})
app.on('will-quit', () => {
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  try { fs.unlinkSync(HEARTBEAT_FILE) } catch (e) { /* ignore */ }
  try {
    const st = readJsonSafe(STATE_FILE, {})
    if ('webClosed' in st) {
      delete st.webClosed
      fs.writeFileSync(STATE_FILE, JSON.stringify(st))
    }
  } catch (e) { /* ignore */ }
})
app.on('window-all-closed', () => app.quit())

ipcMain.handle('boot', () => bootPayload())
ipcMain.handle('task', () => readJsonSafe(path.join(ASSET_DIR, 'task.json'), null))
ipcMain.handle('state', () => readJsonSafe(STATE_FILE, null))
ipcMain.handle('exit', () => app.quit())
ipcMain.handle('notify', (e, args) => {
  try {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (win && win.isFocused()) return { shown: false }
    if (!Notification.isSupported()) return { shown: false }
    new Notification({
      title: (args && args.title) || '昔涟',
      body: (args && args.body) || '',
      icon: ICON_FILE,
      silent: false,
    }).show()
    return { shown: true }
  } catch (err) { return { shown: false } }
})
ipcMain.handle('resize-pet', (e, args) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (!win) return
  win.setSize(Math.max(40, Math.round(args.w || 200)), Math.max(60, Math.round((args.h || 200) + BUBBLE_ZONE)))
})
ipcMain.handle('drag-start', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (win) dragOrigin = win.getPosition()
})
ipcMain.handle('drag-move', (e, args) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (win && dragOrigin) {
    win.setPosition(Math.round(dragOrigin[0] + (args.dx || 0)), Math.round(dragOrigin[1] + (args.dy || 0)))
  }
})
ipcMain.handle('drag-end', () => { dragOrigin = null })
ipcMain.handle('set-ignore', (e, args) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (win) win.setIgnoreMouseEvents(!!(args && args.ignore), { forward: true })
})
ipcMain.on('context', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (!win) return
  const state = readJsonSafe(STATE_FILE, {})
  const menu = Menu.buildFromTemplate([
    { label: '🎞 切换动画', click: () => win.webContents.send('menu-action', 'cycle') },
    { label: '📋 恢复任务动画', click: () => win.webContents.send('menu-action', 'task-anim') },
    { label: '💬 隐藏/显示气泡', click: () => win.webContents.send('menu-action', 'bubble') },
    { label: '🔔 系统通知：' + (state.notify ? '开' : '关'), click: () => { toggleNotify(); win.webContents.send('menu-action', 'notify') } },
    { label: '📏 增大', click: () => { adjustScale(0.15); win.webContents.send('menu-action', 'resize') } },
    { label: '📏 减小', click: () => { adjustScale(-0.15); win.webContents.send('menu-action', 'resize') } },
    { type: 'separator' },
    { label: '❌ 退出昔涟', click: () => app.quit() },
  ])
  menu.popup({ window: win })
})
