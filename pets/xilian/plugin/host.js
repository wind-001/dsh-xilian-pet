// ============================================================
// 部署配置（开源版）— 把下面三项改成你的环境再使用
//   workspaceRoot: 仓库根目录的绝对路径（包含 pets/xilian/ 的那一层）
//   desktopAppDir: Electron 桌面应用目录（看门狗自动拉起用；留空则禁用自动拉起）
//   desktopExe:    Electron 可执行文件绝对路径（留空则从 desktopAppDir 推导）
// ============================================================
const CONFIG = {
  workspaceRoot: '',
  desktopAppDir: '',
  desktopExe: '',
}

return {
  inject: ['timer'],
  apply(ctx) {
    const fsService = ctx.get('fs')
    let base = ''
    try {
      const sp = ctx.get('sandboxPolicy')
      if (sp && sp.workspaceRoot) base = String(sp.workspaceRoot).replace(/[\\/]+$/, '')
    } catch (e) { /* ignore */ }
    let writePolicy
    try {
      const sp = ctx.get('sandboxPolicy')
      if (sp && typeof sp.resolve === 'function') writePolicy = sp.resolve()
    } catch (e) { /* ignore */ }
    const FALLBACK_ROOT = CONFIG.workspaceRoot ? String(CONFIG.workspaceRoot).replace(/[\\/]+$/, '') : ''
    const candidates = (rel) => {
      const list = []
      if (FALLBACK_ROOT) list.push(FALLBACK_ROOT + '/' + rel)
      if (base && base !== FALLBACK_ROOT) list.push(base + '/' + rel)
      list.push(rel)
      return list
    }
    let logQueue = Promise.resolve()
    function appendLog(line) {
      logQueue = logQueue.then(async () => {
        if (!fsService) return
        try {
          let prev = ''
          for (const p of candidates('pets/xilian/debug.log')) {
            try {
              const t = await fsService.resolve(p)
              prev = await fsService.readText(t)
              break
            } catch (e) { /* try next */ }
          }
          const lines = prev.split(/\r?\n/).filter(Boolean).slice(-200)
          lines.push(line)
          for (const p of candidates('pets/xilian/debug.log')) {
            try {
              const t = await fsService.resolve(p)
              await fsService.writeText(t, lines.join('\n'), undefined, undefined, writePolicy)
              break
            } catch (e) { /* try next */ }
          }
        } catch (e) { /* ignore */ }
      }).catch(() => {})
    }
    async function readFirst(rel) {
      if (!fsService) return { error: 'fs service unavailable' }
      let last = ''
      for (const p of candidates(rel)) {
        try {
          const t = await fsService.resolve(p)
          return { text: await fsService.readText(t) }
        } catch (e) { last = last + ' | ' + p + ' -> ' + String((e && e.message) || e) }
      }
      return { error: last }
    }
    const spriteCache = {}
    async function loadSprite(force, res) {
      res = (res === '2x') ? '2x' : '1x'
      if (spriteCache[res] && !force) return spriteCache[res]
      const manifest = { cols: 8, rows: 9, cellW: 103, cellH: 124, anims: [], identity: { displayName: '昔涟', description: '' } }
      let dataUrl = ''
      let error = ''
      const b64name = res === '2x' ? 'sprite2x.b64' : 'sprite.b64'
      const b64 = await readFirst('pets/xilian/web/' + b64name)
      if (b64.text !== undefined) {
        dataUrl = 'data:image/webp;base64,' + b64.text.trim()
      } else {
        error = b64name + ': ' + b64.error
      }
      const m = await readFirst('pets/xilian/web/manifest.json')
      if (m.text !== undefined) {
        try {
          const parsed = JSON.parse(m.text)
          if (parsed && typeof parsed === 'object') Object.assign(manifest, parsed)
        } catch (e) { error = (error ? error + '; ' : '') + 'manifest parse: ' + String(e) }
      } else {
        error = (error ? error + '; ' : '') + 'manifest: ' + m.error
      }
      let cellW = manifest.cellW, cellH = manifest.cellH
      if (res === '2x') { cellW = cellW * 2; cellH = cellH * 2 }
      spriteCache[res] = {
        dataUrl, error, res,
        cols: manifest.cols, rows: manifest.rows,
        cellW, cellH,
        anims: manifest.anims || [],
        identity: manifest.identity || { displayName: '昔涟', description: '' },
      }
      return spriteCache[res]
    }
    async function loadState() {
      const r = await readFirst('pets/xilian/state.json')
      if (r.text === undefined) return null
      try { return JSON.parse(r.text) } catch (e) { return null }
    }
    async function saveState(args) {
      const prev = (await loadState()) || {}
      const next = (args && typeof args === 'object') ? args : {}
      const merged = {
        x: typeof next.x === 'number' ? next.x : (typeof prev.x === 'number' ? prev.x : null),
        y: typeof next.y === 'number' ? next.y : (typeof prev.y === 'number' ? prev.y : null),
        anim: typeof next.anim === 'number' ? next.anim : (typeof prev.anim === 'number' ? prev.anim : 0),
        hidden: typeof next.hidden === 'boolean' ? next.hidden : (typeof prev.hidden === 'boolean' ? prev.hidden : false),
        scale: typeof next.scale === 'number' ? next.scale : (typeof prev.scale === 'number' ? prev.scale : 1.15),
        notify: typeof next.notify === 'boolean' ? next.notify : (typeof prev.notify === 'boolean' ? prev.notify : false),
        webClosed: typeof next.webClosed === 'boolean' ? next.webClosed : (typeof prev.webClosed === 'boolean' ? prev.webClosed : false),
      }
      if (fsService) {
        for (const p of candidates('pets/xilian/state.json')) {
          try {
            const t = await fsService.resolve(p)
            await fsService.writeText(t, JSON.stringify(merged), undefined, undefined, writePolicy)
            return merged
          } catch (e) { /* try next */ }
        }
      }
      return merged
    }
    function pick(obj, keys, dflt) {
      if (!obj || typeof obj !== 'object') return dflt
      for (const k of keys) {
        if (obj[k] !== undefined && obj[k] !== null) return obj[k]
      }
      return dflt
    }
    let todoCache = null
    let lastTodoDone = null
    let lastAssistantText = ''
    const task = { mode: 'idle', phase: 0, pct: 0, toolName: '', toolArgs: '', message: '', revision: 0 }
    let watchdog = null
    let taskQueue = Promise.resolve()
    const writeTaskFile = () => {
      const t = getTask()
      taskQueue = taskQueue.then(async () => {
        try {
          const payload = JSON.stringify(Object.assign({ at: Date.now() }, t))
          for (const p of candidates('pets/xilian/task.json')) {
            try {
              const target = await fsService.resolve(p)
              await fsService.writeText(target, payload, undefined, undefined, writePolicy)
              break
            } catch (e) { /* try next */ }
          }
        } catch (e) { /* ignore */ }
      }).catch(() => {})
    }
    const agentBusy = () => {
      try {
        const agentsSvc = ctx.get('agents')
        const list = agentsSvc && agentsSvc.list()
        return !!(list || []).some((a) => a && (a.status === 'running' || a.status === 'working'))
      } catch (e) { return false }
    }
    const armWatchdog = () => {
      if (watchdog) watchdog()
      watchdog = ctx.timeout(() => {
        watchdog = null
        if (task.mode !== 'running') return
        if (agentBusy()) {
          task.mode = 'degraded'
          task.message = '长时间无进度更新，可能遇到阻力'
          task.revision += 1
          appendLog('[task] degraded (busy)')
          writeTaskFile()
        } else if (lastAssistantText) {
          task.mode = 'review'
          task.message = '✅ 任务完成！快来检查成果吧！'
          task.revision += 1
          appendLog('[task] review (idle after silence)')
          writeTaskFile()
        } else {
          task.mode = 'idle'
          task.message = ''
          task.revision += 1
          appendLog('[task] idle (silence)')
          writeTaskFile()
        }
      }, 10000)
    }
    const clearWatchdog = () => { if (watchdog) watchdog(); watchdog = null }
    const bump = (patch) => {
      let changed = false
      for (const k of Object.keys(patch)) {
        if (task[k] !== patch[k]) { task[k] = patch[k]; changed = true }
      }
      if (changed) {
        task.revision += 1
        appendLog('[task] ' + task.mode + ' ' + (task.toolName || task.message || '').slice(0, 40))
        writeTaskFile()
      }
    }
    ctx.on('session/event', (session, event) => {
      try {
        const t = event && (event.type || event.kind || event.name)
        const data = event && (event.data || event.payload || event)
        if (t === 'todo/write') {
          const items = data && (data.todos || data.items)
          if (Array.isArray(items)) {
            todoCache = { items, time: event.time || event.time0 || Date.now() }
            const done = items.filter((it) => it && (it.status === 'completed' || it.done === true)).length
            if (lastTodoDone !== null && done > lastTodoDone && task.mode !== 'waiting') {
              bump({ mode: 'review', message: '✅ 任务完成！快来检查成果吧！' })
              clearWatchdog()
            }
            lastTodoDone = done
          }
          return
        }
        if (t === 'tool/call') {
          const nm = data && data.name
          let args = ''
          try {
            const a = JSON.parse(data.arguments || '{}')
            args = String(a.command || a.path || a.query || a.pattern || a.content || '').slice(0, 60)
          } catch (e) { /* ignore */ }
          bump({ mode: 'running', toolName: String(nm || ''), toolArgs: args })
          clearWatchdog(); armWatchdog()
          return
        }
        if (t === 'tool/result') { bump({ mode: 'running' }); clearWatchdog(); armWatchdog(); return }
        if (t === 'step/start') { bump({ mode: 'running' }); clearWatchdog(); armWatchdog(); return }
        if (t === 'assistant/message') {
          let text = ''
          try {
            const c = data && (data.text || data.content)
            if (typeof c === 'string') text = c
            else if (Array.isArray(c)) text = c.map((b) => (b && (b.text || b.content)) || '').join(' ')
            else if (c && typeof c === 'object') text = String(c.text || c.summary || '')
          } catch (e) { /* ignore */ }
          if (text) lastAssistantText = String(text).slice(0, 120)
          return
        }
      } catch (e) { /* ignore */ }
    })
    ctx.on('agent/status', (payload) => {
      try {
        const status = payload && payload.status
        if (status === 'running') {
          bump({ mode: 'running' })
          clearWatchdog(); armWatchdog()
        } else if (status === 'idle') {
          if (task.mode === 'running' || task.mode === 'degraded') {
            if (lastAssistantText) bump({ mode: 'review', message: '✅ 任务完成！快来检查成果吧！' })
            else bump({ mode: 'idle', message: '' })
          }
          clearWatchdog()
        }
      } catch (e) { /* ignore */ }
    })
    ctx.on('agent/inbox/claimed', () => {
      try {
        if (task.mode === 'waiting') bump({ mode: 'running' })
        clearWatchdog(); armWatchdog()
      } catch (e) { /* ignore */ }
    })
    ctx.on('approval/request', (req, next) => {
      try {
        let why = ''
        try {
          const r = req || {}
          why = String(r.reason || r.message || r.description || '').slice(0, 80)
        } catch (e) { /* ignore */ }
        bump({ mode: 'waiting', message: why })
      } catch (e) { /* ignore */ }
      return next()
    })
    const getTask = () => {
      let pct = 50
      let todoText = ''
      if (todoCache && Array.isArray(todoCache.items) && todoCache.items.length) {
        const done = todoCache.items.filter((it) => it && (it.status === 'completed' || it.done === true)).length
        const total = todoCache.items.length
        pct = Math.round((done / total) * 100)
        const inProg = todoCache.items.find((it) => it && it.status === 'in_progress')
        const pending = todoCache.items.find((it) => it && (it.status === 'pending' || it.status === 'todo' || it.status === 'open' || !it.status))
        const cur = (inProg && inProg.content) || (pending && pending.content) || null
        todoText = '📋 ' + done + '/' + total + (cur ? ' · ' + String(cur).slice(0, 16) : '')
      }
      const phase = pct < 30 ? 0 : pct < 70 ? 1 : 2
      return {
        revision: task.revision,
        mode: task.mode,
        phase,
        pct,
        toolName: task.toolName,
        toolArgs: task.toolArgs,
        message: task.message,
        todoText,
      }
    }
    async function desktopAlive() {
      let alive = false
      let webClosed = false
      try {
        for (const p of candidates('pets/xilian/desktop_alive.json')) {
          try {
            const t = await fsService.resolve(p)
            const text = await fsService.readText(t)
            const at = JSON.parse(text).at
            alive = typeof at === 'number' && Date.now() - at < 15000
            break
          } catch (e) { /* try next */ }
        }
      } catch (e) { /* ignore */ }
      try {
        const st = await loadState()
        webClosed = !!(st && st.webClosed)
      } catch (e) { /* ignore */ }
      return { alive, webClosed }
    }
    async function closeWeb() {
      const st = (await loadState()) || {}
      st.webClosed = true
      try {
        for (const p of candidates('pets/xilian/state.json')) {
          try {
            const t = await fsService.resolve(p)
            await fsService.writeText(t, JSON.stringify(st), undefined, undefined, writePolicy)
            break
          } catch (e) { /* try next */ }
        }
      } catch (e) { /* ignore */ }
      appendLog('[pet] web closed')
      return { ok: true }
    }
    // ---- 宠物看门狗 ----
    let lastClientBeat = Date.now()
    let lastDesktopSeen = 0
    let exitInfo = null
    let lastSpawnAt = 0
    const ELECTRON_APP = CONFIG.desktopAppDir || ''
    const ELECTRON_EXE = CONFIG.desktopExe || (ELECTRON_APP ? ELECTRON_APP + '/node_modules/electron/dist/electron.exe' : '')
    const clientBeat = () => { lastClientBeat = Date.now() }
    const spawnDesktop = async () => {
      lastSpawnAt = Date.now()
      if (!ELECTRON_EXE) {
        appendLog('[pet] desktop app not configured; set CONFIG in host.js')
        return
      }
      try {
        const sub = ctx.get('subprocess')
        if (!sub) { appendLog('[pet] no subprocess service'); return }
        const exe = await sub.resolveExecutable(ELECTRON_EXE)
        sub.spawn({
          argv: [exe, ELECTRON_APP],
          cwd: ELECTRON_APP,
          stdio: { stdin: 'ignore', stdout: 'ignore', stderr: 'ignore' },
          graceMs: 10000,
        })
        appendLog('[pet] desktop spawned')
      } catch (e) {
        appendLog('[pet] spawn failed: ' + String((e && e.message) || e).slice(0, 80))
      }
    }
    const petWatchdog = () => {
      desktopAlive().then((r) => {
        const now = Date.now()
        const desktop = !!(r && r.alive)
        const webClosed = !!(r && r.webClosed)
        const clientAlive = now - lastClientBeat < 15000
        if (desktop) {
          lastDesktopSeen = now
          exitInfo = null
        } else if (lastDesktopSeen && now - lastDesktopSeen < 10000 && !exitInfo) {
          exitInfo = { at: now, clientWasAlive: clientAlive }
        }
        const needPet = !desktop && (!clientAlive || webClosed)
        if (needPet) {
          const grace = !webClosed && exitInfo && now - exitInfo.at < 600000 && !exitInfo.clientWasAlive
          if (!grace && now - lastSpawnAt > 60000) {
            spawnDesktop()
          }
        }
      }).catch(() => {})
    }
    ctx.interval(petWatchdog, 5000)
    writeTaskFile()
    ctx.effect(() => harness.handle('get-sprite', async (args) => { clientBeat(); appendLog('[rpc] get-sprite ' + new Date().toISOString()); return await loadSprite(false, args && args.res) }))
    ctx.effect(() => harness.handle('retry-sprite', async (args) => { clientBeat(); appendLog('[rpc] retry-sprite ' + new Date().toISOString()); return await loadSprite(true, args && args.res) }))
    ctx.effect(() => harness.handle('load-state', async () => { clientBeat(); appendLog('[rpc] load-state ' + new Date().toISOString()); return await loadState() }))
    ctx.effect(() => harness.handle('save-state', async (args) => { clientBeat(); appendLog('[rpc] save-state ' + new Date().toISOString()); return await saveState(args) }))
    ctx.effect(() => harness.handle('get-task', async () => { clientBeat(); return getTask() }))
    ctx.effect(() => harness.handle('desktop-alive', async () => { clientBeat(); return await desktopAlive() }))
    ctx.effect(() => harness.handle('web-close', async () => { clientBeat(); return await closeWeb() }))
  },
}