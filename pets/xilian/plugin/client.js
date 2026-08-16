function PetView({ ctx }) {
  const [sprite, setSprite] = React.useState(null)
  const [pos, setPos] = React.useState(null)
  const [anim, setAnim] = React.useState(0)
  const [frame, setFrame] = React.useState(0)
  const [hidden, setHidden] = React.useState(false)
  const [panelOpen, setPanelOpen] = React.useState(false)
  const [drag, setDrag] = React.useState(null)
  const [dragInfo, setDragInfo] = React.useState(null)
  const [err, setErr] = React.useState('')
  const [scale, setScale] = React.useState(1.15)
  const [bubble, setBubble] = React.useState(null)
  const [celebrate, setCelebrate] = React.useState(false)
  const [notify, setNotify] = React.useState(false)
  const [task, setTask] = React.useState(null)
  const [switchOn, setSwitchOn] = React.useState(false)
  const [desktopMode, setDesktopMode] = React.useState(false)
  const [webClosed, setWebClosed] = React.useState(false)
  const [lastUpdate, setLastUpdate] = React.useState(null)
  const lastMove = React.useRef(null)
  const loadedRes = React.useRef('1x')
  const panelOpenRef = React.useRef(false)
  const notifyRef = React.useRef(false)
  const spriteRef = React.useRef(null)
  const taskRef = React.useRef(null)
  const desktopRef = React.useRef(false)
  const webClosedRef = React.useRef(false)
  const lastWaitingNotifyRef = React.useRef(0)
  const bubbleHiddenRef = React.useRef(null)

  const anims = (sprite && sprite.anims && sprite.anims.length) ? sprite.anims : []
  const res = (sprite && sprite.res === '2x') ? 2 : 1
  const baseCellW = (sprite ? sprite.cellW / res : 103)
  const baseCellH = (sprite ? sprite.cellH / res : 124)
  const mode = (task && task.mode) || 'idle'
  const modeLabel = (m) => m === 'waiting' ? '等待输入' : m === 'degraded' ? '遇阻降级' : m === 'review' ? '可复核' : m === 'running' ? '运行中' : '空闲'
  const taskRow = mode === 'waiting' ? 4 : mode === 'degraded' ? 8 : mode === 'review' ? 6 : mode === 'running' ? ((task && task.phase >= 2) ? 2 : 1) : null
  const activeRow = dragInfo ? (dragInfo.speed === 'run' ? 2 : 1) : (taskRow !== null ? taskRow : (celebrate ? 6 : anim))
  const frameCount = anims[activeRow] ? anims[activeRow].frames : 6
  const rawW = baseCellW * scale
  const rawH = baseCellH * scale
  const displayW = Number.isFinite(rawW) ? Math.round(rawW) : 120
  const displayH = Number.isFinite(rawH) ? Math.round(rawH) : 150

  const clampPos = (p, w, h) => {
    const vw = (typeof window !== 'undefined' && window.innerWidth) || 1280
    const vh = (typeof window !== 'undefined' && window.innerHeight) || 800
    const m = 8
    const maxX = Math.max(m, vw - w - m)
    const maxY = Math.max(m, vh - h - m)
    return { x: Math.min(Math.max(p.x, m), maxX), y: Math.min(Math.max(p.y, m), maxY) }
  }

  const tryLoad = (attempt) => {
    host.call('get-sprite', { res: '1x' }).then((spr) => {
      if (!spr) { if (attempt < 3) ctx.timeout(() => tryLoad(attempt + 1), 700 * (attempt + 1)); return }
      loadedRes.current = '1x'
      setSprite(spr)
    }).catch(() => {
      if (attempt < 3) ctx.timeout(() => tryLoad(attempt + 1), 700 * (attempt + 1))
      else setErr('RPC 失败')
    })
  }

  React.useEffect(() => {
    let alive = true
    tryLoad(0)
    host.call('load-state').then((s) => {
      if (!alive || !s) return
      if (typeof s.x === 'number' && typeof s.y === 'number') setPos({ x: s.x, y: s.y })
      if (typeof s.anim === 'number' && s.anim >= 0 && s.anim < 9) setAnim(s.anim)
      if (typeof s.hidden === 'boolean') setHidden(s.hidden)
      if (typeof s.scale === 'number' && s.scale >= 0.3 && s.scale <= 3) setScale(s.scale)
      if (typeof s.notify === 'boolean') setNotify(s.notify)
      if (typeof s.webClosed === 'boolean') setWebClosed(s.webClosed)
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  React.useEffect(() => { panelOpenRef.current = panelOpen }, [panelOpen])
  React.useEffect(() => { notifyRef.current = notify }, [notify])
  React.useEffect(() => { spriteRef.current = sprite }, [sprite])
  React.useEffect(() => { desktopRef.current = desktopMode }, [desktopMode])
  React.useEffect(() => { webClosedRef.current = webClosed }, [webClosed])

  const frameInterval = dragInfo ? 75 : (frameCount >= 8 ? 90 : 140)
  React.useEffect(() => {
    setFrame(0)
    if (!sprite) return
    return ctx.interval(() => setFrame((f) => (f + 1) % frameCount), frameInterval)
  }, [sprite, activeRow, frameCount, frameInterval])

  React.useEffect(() => {
    if (!drag) return
    const move = (e) => {
      const nx = e.clientX, ny = e.clientY
      const prev = lastMove.current
      let speed = 'walk'
      let dir = 1
      if (prev) {
        const dist = Math.hypot(nx - prev.x, ny - prev.y)
        if (dist > 14) speed = 'run'
        if (nx - prev.x > 0) dir = -1
      }
      lastMove.current = { x: nx, y: ny, moved: (prev ? prev.moved : 0) + (prev ? Math.hypot(nx - prev.x, ny - prev.y) : 0) }
      setDragInfo({ dir, speed })
      setPos(clampPos({ x: nx - drag.dx, y: ny - drag.dy }, displayW, displayH))
    }
    const up = () => {
      setDrag(null)
      setDragInfo(null)
      lastMove.current = null
      setPos((p) => {
        if (p) host.call('save-state', { x: p.x, y: p.y, anim, hidden, scale }).catch(() => {})
        return p
      })
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
  }, [drag, anim, hidden, scale, displayW, displayH])

  const fireNotify = (body) => {
    try {
      if (!notifyRef.current) return
      if (typeof Notification === 'undefined') return
      if (Notification.permission !== 'granted') return
      if (typeof document !== 'undefined' && !document.hidden) return
      const s = spriteRef.current
      const opts = { body }
      if (s && s.dataUrl) opts.icon = s.dataUrl
      new Notification('昔涟', opts)
    } catch (e) { /* ignore */ }
  }

  const showBubble = (info, sticky) => {
    if (!panelOpenRef.current) {
      if (bubbleHiddenRef.current && Date.now() - bubbleHiddenRef.current < 30000) return
      setBubble(Object.assign({ sticky: !!sticky }, info))
    }
  }
  const hideBubble = () => {
    bubbleHiddenRef.current = Date.now()
    setBubble(null)
  }

  const MODE_META = {
    idle: { title: '待命中', dot: 'idle' },
    running: { title: '运行中', dot: 'running' },
    waiting: { title: '需要授权', dot: 'waiting' },
    review: { title: '任务完成', dot: 'review' },
    degraded: { title: '思考中', dot: 'degraded' },
  }
  const bubbleInfo = (t) => {
    if (!t) return { head: '待命中', dot: 'idle', body: '暂时没有进行中的任务', bar: null }
    const meta = MODE_META[t.mode] || MODE_META.idle
    const lines = []
    if (t.mode === 'waiting') {
      lines.push('⚠️ 进程已暂停，等待你的批准！')
      if (t.message) lines.push('原因：' + t.message)
      lines.push('在对话中批准或回复「确认」继续')
    } else if (t.mode === 'degraded') {
      lines.push('思考中...（可能遇到阻力）')
      lines.push('超过 10 秒没有进度更新')
    } else if (t.mode === 'review') {
      lines.push(t.message || '任务完成！快来检查成果吧！')
    } else if (t.mode === 'running') {
      const phaseText = t.phase <= 0 ? '正在思考方案...' : t.phase === 1 ? '正在编写代码 / 读取文件...' : '正在自检与格式化...'
      lines.push(phaseText + '（' + (typeof t.pct === 'number' ? t.pct : '-') + '%）')
      if (t.toolName) lines.push('🛠 ' + t.toolName + (t.toolArgs ? ' ' + t.toolArgs : ''))
    } else {
      lines.push('等待指令...')
    }
    if (t.todoText) lines.push(t.todoText)
    return {
      head: meta.title,
      dot: meta.dot,
      body: lines.join('\n'),
      bar: (t.mode === 'running' && typeof t.pct === 'number') ? Math.max(0, Math.min(100, t.pct)) : null,
    }
  }

  React.useEffect(() => {
    if (!sprite) return
    let tick = 0
    const check = () => {
      tick += 1
      if (tick % 5 === 1) {
        host.call('desktop-alive').then((r) => {
          if (!r) return
          setDesktopMode(!!r.alive)
          if (typeof r.webClosed === 'boolean') setWebClosed(r.webClosed)
        }).catch(() => {})
      }
      if (desktopRef.current || webClosedRef.current) return
      host.call('get-task').then((t) => {
        if (!t || !t.mode) return
        const prev = taskRef.current
        const prevMode = prev ? prev.mode : null
        taskRef.current = t
        setTask(t)
        setLastUpdate(new Date().toLocaleTimeString())
        if (prevMode && prevMode !== t.mode) {
          setSwitchOn(true)
          ctx.timeout(() => setSwitchOn(false), 400)
        }
        if (t.mode === 'waiting') {
          showBubble(bubbleInfo(t), true)
          if (Date.now() - lastWaitingNotifyRef.current > 60000) {
            lastWaitingNotifyRef.current = Date.now()
            fireNotify('⚠️ 需要授权：' + (t.message || '请回复以继续'))
          }
        } else if (t.mode === 'degraded') {
          showBubble(bubbleInfo(t))
          fireNotify('🤔 任务可能遇到阻力，请回来看看')
        } else if (t.mode === 'review') {
          showBubble(bubbleInfo(t))
          fireNotify('✅ 任务完成！快来检查成果吧！')
          setCelebrate(true)
          ctx.timeout(() => setCelebrate(false), 5000)
        } else if (t.mode === 'running') {
          showBubble(bubbleInfo(t))
        } else {
          if (prevMode !== 'idle') showBubble(bubbleInfo(t))
        }
        if (prevMode === 'waiting' && t.mode !== 'waiting') setBubble(null)
      }).catch(() => {})
    }
    check()
    return ctx.interval(check, 1000)
  }, [sprite])

  React.useEffect(() => {
    if (!bubble || bubble.sticky) return
    return ctx.timeout(() => setBubble(null), 20000)
  }, [bubble])

  const defaultPos = React.useMemo(() => {
    const vw = (typeof window !== 'undefined' && window.innerWidth) || 1280
    const vh = (typeof window !== 'undefined' && window.innerHeight) || 800
    return { x: vw - displayW - 28, y: vh - displayH - 60 }
  }, [displayW, displayH])

  const shownPos = pos ? clampPos(pos, displayW, displayH) : defaultPos
  const name = (sprite && sprite.identity && sprite.identity.displayName) || '昔涟'
  const desc = (sprite && sprite.identity && sprite.identity.description) || ''
  const loadErr = (sprite && sprite.error) || err
  const layerStyle = {
    left: shownPos.x + 'px',
    top: shownPos.y + 'px',
    width: displayW + 'px',
    height: displayH + 'px',
  }

  const onSpriteMouseDown = (e) => {
    if (e.button !== 0) return
    e.preventDefault()
    lastMove.current = { x: e.clientX, y: e.clientY, moved: 0 }
    setDrag({ dx: e.clientX - shownPos.x, dy: e.clientY - shownPos.y })
  }

  const onSpriteClick = (e) => {
    const lm = lastMove.current
    if (lm && lm.moved > 6) return
    if (mode === 'running') {
      showBubble({
        head: '运行中', dot: 'running',
        body: '🛠 正在执行: ' + (task.toolName || '任务') + (task.toolArgs ? ' ' + task.toolArgs : '') + (typeof task.pct === 'number' ? '（' + task.pct + '%）' : ''),
        bar: (typeof task.pct === 'number') ? Math.max(0, Math.min(100, task.pct)) : null,
      })
    } else if (mode === 'waiting') {
      showBubble({
        head: '需要授权', dot: 'waiting',
        body: '⚠️ 进程已暂停，等待你的批准！' + (task.message ? '\n原因：' + task.message : '') + '\n在对话中批准或回复「确认」继续',
        bar: null,
      }, true)
    } else if (mode === 'review') {
      showBubble({
        head: '任务完成', dot: 'review',
        body: (task.message || '任务完成！快来检查成果吧！') + '\n查看对话确认成果',
        bar: null,
      })
    } else if (mode === 'degraded') {
      showBubble({
        head: '思考中', dot: 'degraded',
        body: '长时间无进度更新，可能遇到阻力；如有问题请在对话中打断我',
        bar: null,
      })
    }
  }

  const retry = () => {
    setErr('')
    host.call('retry-sprite', { res: (sprite && sprite.res) || '1x' }).then((r) => { if (r) setSprite(r) }).catch(() => setErr('RPC 失败'))
  }

  const closePanel = () => {
    setPanelOpen(false)
    host.call('get-task').then((t) => { if (t && t.mode) setBubble(bubbleInfo(t)) }).catch(() => {})
  }

  const onBadgeClick = (e) => {
    e.stopPropagation()
    if (panelOpen) {
      closePanel()
    } else {
      setBubble(null)
      setPanelOpen(true)
    }
  }

  const toggleNotify = () => {
    const next = !notify
    if (next && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().then((p) => {
        setNotify(p === 'granted')
      }).catch(() => setNotify(false))
    } else {
      setNotify(next)
    }
  }

  const closeWebPet = () => {
    host.call('web-close').then(() => {
      setWebClosed(true)
      setPanelOpen(false)
    }).catch(() => {})
  }

  const spriteTitle = mode === 'idle' ? '点击开始新任务' : mode === 'running' ? '点击查看正在执行的指令' : mode === 'waiting' ? '⚠️ 需要授权' : mode === 'review' ? '✅ 查看成果' : '🤔 查看详情'

  if (desktopMode || webClosed) return null

  if (!sprite || !sprite.dataUrl) {
    return React.createElement('div', { className: 'xl-pet-layer', style: layerStyle },
      React.createElement('div', { className: 'xl-pet-chip', title: '点击重试', onClick: retry },
        name + ' · ' + (loadErr ? ('精灵图加载失败:' + loadErr) : '精灵图加载中…')),
    )
  }

  if (hidden) {
    return React.createElement('div', { className: 'xl-pet-layer', style: layerStyle },
      React.createElement('div', { className: 'xl-pet-chip', title: '点击召唤昔涟', onClick: () => setHidden(false) }, '✨ ' + name),
    )
  }

  const bgSizeW = sprite.cellW * (scale / res) * sprite.cols
  const bgSizeH = sprite.cellH * (scale / res) * sprite.rows
  const bgPosX = -(frame * baseCellW * scale)
  const bgPosY = -(activeRow * baseCellH * scale)
  // 面板打开时宠物本体在面板正下方居中（面板宽 260 从层左缘开始）
  const spriteLeft = panelOpen ? Math.max(0, Math.round((260 - displayW) / 2)) : 0
  const spriteStyle = {
    left: spriteLeft + 'px',
    width: displayW + 'px',
    height: displayH + 'px',
    backgroundImage: 'url(' + sprite.dataUrl + ')',
    backgroundSize: (Number.isFinite(bgSizeW) ? bgSizeW : displayW * 8) + 'px ' + (Number.isFinite(bgSizeH) ? bgSizeH : displayH * 9) + 'px',
    backgroundPosition: (Number.isFinite(bgPosX) ? bgPosX : 0) + 'px ' + (Number.isFinite(bgPosY) ? bgPosY : 0) + 'px',
    backgroundRepeat: 'no-repeat',
    transform: (dragInfo && dragInfo.dir === -1) ? 'scaleX(-1)' : 'none',
  }

  return React.createElement('div', { className: 'xl-pet-layer' + (switchOn ? ' xl-pet-switch' : ''), style: layerStyle },
    panelOpen && React.createElement('div', { className: 'xl-pet-panel-wrap' },
      React.createElement('div', { className: 'xl-pet-panel' },
        React.createElement('button', { className: 'xl-pet-panel-close', title: '关闭面板', onClick: closePanel }, '✕'),
        React.createElement('h3', null, name),
        React.createElement('p', null, desc),
      React.createElement('div', { className: 'xl-pet-size' },
        React.createElement('span', null, '大小 ' + Math.round(scale * 100) + '%'),
        React.createElement('input', {
          type: 'range', min: '0.4', max: '2.5', step: '0.05',
          value: String(scale),
          onChange: (e) => setScale(parseFloat(e.target.value)),
        }),
      ),
      React.createElement('button', {
        className: 'xl-pet-notify' + (notify ? ' on' : ''),
        onClick: toggleNotify,
      }, '🔔 系统提醒（最小化时通知）' + (notify ? '：开' : '：关')),
      React.createElement('div', { className: 'xl-pet-detail' },
        React.createElement('h4', null, '📊 任务详情'),
        React.createElement('div', { className: 'row' }, React.createElement('span', { className: 'k' }, '状态：'), modeLabel(mode)),
        React.createElement('div', { className: 'row' }, React.createElement('span', { className: 'k' }, '进度：'), (task && typeof task.pct === 'number') ? task.pct + '%' : '-'),
        React.createElement('div', { className: 'row' }, React.createElement('span', { className: 'k' }, '当前工具：'), (task && task.toolName) ? (task.toolName + (task.toolArgs ? ' ' + task.toolArgs : '')) : '—'),
        React.createElement('div', { className: 'row' }, React.createElement('span', { className: 'k' }, '任务清单：'), (task && task.todoText) || '—'),
        React.createElement('div', { className: 'row' }, React.createElement('span', { className: 'k' }, '提示：'), (task && task.message) || '—'),
        React.createElement('div', { className: 'row' }, React.createElement('span', { className: 'k' }, '更新时间：'), lastUpdate || '—'),
      ),
      React.createElement('div', { className: 'xl-pet-anims' },
        anims.map((a, i) => React.createElement('button', {
          key: i,
          className: 'xl-pet-anim-btn' + (i === anim ? ' active' : ''),
          onClick: () => { setAnim(i); setFrame(0) },
        }, a.name + ' (' + a.frames + ')')),
      ),
      React.createElement('button', { className: 'xl-pet-hide', onClick: () => setHidden(true) }, '暂时休息'),
      React.createElement('button', { className: 'xl-pet-close-web', onClick: closeWebPet }, '🚪 关闭网页昔涟（改用桌面版）'),
      React.createElement('button', { className: 'xl-pet-close', onClick: closePanel }, '收起'),
      ),
    ),
    bubble && React.createElement('div', { className: 'xl-pet-bubble' + (bubble.sticky ? ' xl-pet-sticky' : '') },
      React.createElement('div', { className: 'xl-pet-b-head ' + (bubble.dot || 'idle') },
        React.createElement('span', { className: 'xl-pet-b-dot' }),
        React.createElement('span', { className: 'xl-pet-b-title' }, bubble.head || '待命中'),
        React.createElement('button', { className: 'xl-pet-b-close', title: '隐藏气泡', onClick: (e) => { e.stopPropagation(); hideBubble() } }, '✕'),
      ),
      React.createElement('div', { className: 'xl-pet-b-body' }, bubble.body || ''),
      bubble.bar !== null && bubble.bar !== undefined && React.createElement('div', { className: 'xl-pet-b-bar' },
        React.createElement('i', { style: { width: bubble.bar + '%' } }),
      ),
    ),
    !panelOpen && React.createElement('div', { className: 'xl-pet-badge', title: '打开面板', onClick: onBadgeClick }, name + ' ✦'),
    React.createElement('div', {
      className: 'xl-pet-sprite' + (drag ? ' dragging' : '') + (switchOn ? ' xl-pet-fade' : ''),
      style: spriteStyle,
      onMouseDown: onSpriteMouseDown,
      onClick: onSpriteClick,
      title: spriteTitle,
    }),
  )
}

return {
  inject: ['timer'],
  apply(ctx) {
    const css = '.xl-pet-layer { position: fixed; z-index: 2147483000; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; } .xl-pet-sprite { position: absolute; left: 0; top: 0; cursor: pointer; user-select: none; -webkit-user-select: none; image-rendering: auto; } .xl-pet-sprite.dragging { cursor: grabbing; } .xl-pet-fade { animation: xlFade .35s ease; } .xl-pet-switch .xl-pet-bubble { animation: xlFade .35s ease; } @keyframes xlFade { from { opacity: .25; transform: scale(.96); } to { opacity: 1; transform: scale(1); } } .xl-pet-badge { position: absolute; top: -26px; left: 50%; transform: translateX(-50%); background: rgba(22,18,44,0.9); color: #e8d9ff; border: 1px solid rgba(168,120,255,0.55); border-radius: 11px; padding: 1px 11px; font-size: 12px; cursor: pointer; white-space: nowrap; box-shadow: 0 2px 10px rgba(0,0,0,0.4); } .xl-pet-badge:hover { background: rgba(60,44,110,0.95); } .xl-pet-panel-wrap { position: absolute; left: 0; bottom: 100%; margin-bottom: 12px; } .xl-pet-panel-close { position: absolute; top: 6px; right: 8px; width: 18px; height: 18px; line-height: 16px; text-align: center; border: none; border-radius: 50%; background: rgba(255,255,255,0.12); color: rgba(240,233,255,0.75); font-size: 11px; cursor: pointer; padding: 0; z-index: 6; } .xl-pet-panel-close:hover { background: rgba(255,150,100,0.55); color: #fff; } .xl-pet-panel h3 { padding-right: 22px; } .xl-pet-panel { position: relative; width: 260px; max-height: 420px; overflow-y: auto; background: rgba(22,20,40,0.97); color: #e8e2ff; border: 1px solid rgba(168,120,255,0.5); border-radius: 14px; padding: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.55); backdrop-filter: blur(8px); } .xl-pet-panel::-webkit-scrollbar { width: 6px; } .xl-pet-panel::-webkit-scrollbar-thumb { background: rgba(178,132,255,0.4); border-radius: 3px; } .xl-pet-panel::-webkit-scrollbar-track { background: transparent; } .xl-pet-panel h3 { margin: 0 0 4px; font-size: 15px; color: #dcc6ff; } .xl-pet-panel p { margin: 0 0 10px; font-size: 12px; line-height: 1.55; color: #b9b0d6; } .xl-pet-detail { margin-bottom: 10px; font-size: 12px; color: #c9c0e8; background: rgba(255,255,255,0.04); border: 1px solid rgba(168,120,255,0.25); border-radius: 10px; padding: 8px 10px; } .xl-pet-detail h4 { margin: 0 0 6px; font-size: 13px; color: #dcc6ff; } .xl-pet-detail .k { color: #9a8fc8; } .xl-pet-detail .row { margin-bottom: 3px; line-height: 1.5; word-break: break-all; } .xl-pet-anims { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; } .xl-pet-anim-btn { border: 1px solid rgba(168,120,255,0.45); background: rgba(80,60,150,0.35); color: #e8e2ff; border-radius: 8px; padding: 3px 8px; font-size: 12px; cursor: pointer; } .xl-pet-anim-btn:hover { background: rgba(100,75,180,0.45); } .xl-pet-anim-btn.active { background: rgba(150,100,255,0.55); border-color: #a678ff; color: #fff; } .xl-pet-size { margin-bottom: 10px; font-size: 12px; color: #c9c0e8; } .xl-pet-size span { display: block; margin-bottom: 4px; } .xl-pet-size input { width: 100%; accent-color: #a678ff; } .xl-pet-notify { width: 100%; border: 1px solid rgba(168,120,255,0.4); background: rgba(60,50,110,0.35); color: #c9c0e8; border-radius: 8px; padding: 5px 0; font-size: 12px; cursor: pointer; margin-bottom: 10px; } .xl-pet-notify.on { background: rgba(150,100,255,0.45); border-color: #a678ff; color: #fff; } .xl-pet-hide { width: 100%; border: 1px solid rgba(255,120,140,0.45); background: rgba(120,40,60,0.35); color: #ffd7de; border-radius: 8px; padding: 4px 0; font-size: 12px; cursor: pointer; margin-bottom: 6px; } .xl-pet-close-web { width: 100%; border: 1px solid rgba(120,170,255,0.45); background: rgba(40,70,140,0.35); color: #d8e6ff; border-radius: 8px; padding: 4px 0; font-size: 12px; cursor: pointer; margin-bottom: 6px; } .xl-pet-close { width: 100%; border: 1px solid rgba(168,120,255,0.35); background: rgba(60,50,110,0.35); color: #c9c0e8; border-radius: 8px; padding: 4px 0; font-size: 12px; cursor: pointer; } .xl-pet-chip { position: absolute; background: rgba(22,18,44,0.9); color: #e8d9ff; border: 1px solid rgba(168,120,255,0.55); border-radius: 11px; padding: 2px 12px; font-size: 12px; cursor: pointer; white-space: nowrap; box-shadow: 0 2px 10px rgba(0,0,0,0.4); max-width: 420px; overflow: hidden; text-overflow: ellipsis; } .xl-pet-bubble { position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); margin-bottom: 34px; max-width: 440px; max-height: 240px; width: max-content; overflow: auto; background: linear-gradient(165deg, rgba(58,46,104,0.96) 0%, rgba(30,24,58,0.97) 100%); color: #f0e9ff; border: 1px solid rgba(178,132,255,0.45); border-radius: 16px; padding: 10px 16px 12px; font-size: 12.5px; line-height: 1.6; text-align: left; white-space: pre-line; word-break: break-word; letter-spacing: 0.4px; box-shadow: 0 10px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.09); } .xl-pet-bubble::-webkit-scrollbar { width: 6px; } .xl-pet-bubble::-webkit-scrollbar-thumb { background: rgba(178,132,255,0.4); border-radius: 3px; } .xl-pet-b-head { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; } .xl-pet-b-close { margin-left: auto; width: 16px; height: 16px; line-height: 14px; text-align: center; border: none; border-radius: 50%; background: rgba(255,255,255,0.12); color: rgba(240,233,255,0.75); font-size: 10px; cursor: pointer; padding: 0; flex: none; } .xl-pet-b-close:hover { background: rgba(255,150,100,0.55); color: #fff; } .xl-pet-b-dot { width: 7px; height: 7px; border-radius: 50%; flex: none; background: #9aa4ff; box-shadow: 0 0 6px #9aa4ff; } .xl-pet-b-head.running .xl-pet-b-dot { background: #7cc4ff; box-shadow: 0 0 6px #7cc4ff; } .xl-pet-b-head.waiting .xl-pet-b-dot { background: #ffb84d; box-shadow: 0 0 8px #ffb84d; animation: xlDotPulse 1.2s ease-in-out infinite; } .xl-pet-b-head.review .xl-pet-b-dot { background: #6fe3a1; box-shadow: 0 0 6px #6fe3a1; } .xl-pet-b-head.degraded .xl-pet-b-dot { background: #ff8fa3; box-shadow: 0 0 6px #ff8fa3; } .xl-pet-b-title { font-size: 12px; font-weight: 600; letter-spacing: 0.5px; color: #dcc6ff; } .xl-pet-b-body { white-space: pre-line; } .xl-pet-b-bar { margin-top: 8px; height: 4px; border-radius: 2px; background: rgba(255,255,255,0.1); overflow: hidden; } .xl-pet-b-bar i { display: block; height: 100%; border-radius: 2px; background: linear-gradient(90deg, #a678ff, #7cc4ff); transition: width .4s ease; } .xl-pet-bubble.xl-pet-sticky { border-color: #ffb84d; background: linear-gradient(165deg, rgba(110,66,20,0.97) 0%, rgba(64,36,14,0.97) 100%); color: #ffe9c9; box-shadow: 0 0 24px rgba(255,140,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08); animation: xlBlink 1.6s ease-in-out infinite; } .xl-pet-bubble.xl-pet-sticky .xl-pet-b-title { color: #ffd9a0; } .xl-pet-bubble::after { content: ""; position: absolute; top: 100%; left: 50%; transform: translateX(-50%); border: 7px solid transparent; border-top-color: rgba(178,132,255,0.55); } .xl-pet-bubble.xl-pet-sticky::after { border-top-color: rgba(255,150,40,0.7); } @keyframes xlBlink { 0%,100% { opacity: 1; } 50% { opacity: .55; } } @keyframes xlDotPulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .45; transform: scale(1.45); } }'
    const register = () => {
      try {
        styles.insert(css)
      } catch (e) {
        console.error('xilian: styles failed', String(e))
      }
      const slots = ctx.get('slots')
      if (slots === undefined) return false
      try {
        slots.inject('shell.overlay', () => slots.register(
          { name: 'shell.overlay', id: 'xilian-pet' },
          () => React.createElement(PetView, { ctx }),
        ))
        return true
      } catch (e) {
        console.error('xilian: slot register failed', String(e))
        return false
      }
    }
    if (!register()) {
      const h = ctx.interval(() => { if (register()) h() }, 500)
    }
  },
}