(async () => {
  const boot = await window.api.boot()
  if (!boot || !boot.spriteDataUrl) return
  const { spriteDataUrl, cols, rows, cellW, cellH, scale: bootScale, anims } = boot
  const pet = document.getElementById('pet')
  const bubble = document.getElementById('bubble')
  const headEl = document.getElementById('b-head')
  const bodyEl = document.getElementById('b-body')
  const barEl = document.getElementById('b-bar')
  const barFill = barEl.querySelector('i')

  const MODE_META = {
    idle: { title: '待命中' },
    running: { title: '运行中' },
    waiting: { title: '等待输入' },
    review: { title: '任务完成' },
    degraded: { title: '思考中' },
  }

  let scale = bootScale
  let dispW = Math.round(cellW * scale)
  let dispH = Math.round(cellH * scale)
  let manualRow = null
  let bubbleVisible = true
  let hideTimer = null
  let dragging = false
  let row = 0
  let frame = 0
  let mode = 'idle'
  let phase = 0
  let toolName = ''
  let toolArgs = ''
  let message = ''
  let todoText = ''
  let pct = null
  let lastUpdate = null
  let prevMode = null
  let notifyEnabled = false

  const framesOf = (r) => (anims[r] && anims[r].frames) || 6
  const taskRowOf = (m, ph) => {
    if (m === 'waiting') return 4
    if (m === 'degraded') return 8
    if (m === 'review') return 6
    if (m === 'running') return ph >= 2 ? 2 : 1
    return 0
  }
  const textOf = (t) => {
    const lines = []
    if (t.mode === 'waiting') {
      lines.push('❗ 我需要你的决定！')
      if (t.message) lines.push('原因：' + t.message)
      lines.push('请在对话中批准或回复「确认」')
    } else if (t.mode === 'degraded') {
      lines.push('🤔 思考中...（可能遇到阻力）')
      lines.push('超过 10 秒没有进度更新')
    } else if (t.mode === 'review') {
      lines.push('✅ 任务完成！快来检查成果吧！')
    } else if (t.mode === 'running') {
      const phaseText = t.phase <= 0 ? '🧠 正在思考方案...' : t.phase === 1 ? '✍️ 正在编写代码 / 读取文件...' : '🔧 正在自检与格式化...'
      lines.push(phaseText + '（' + (typeof t.pct === 'number' ? t.pct : '-') + '%）')
      if (t.toolName) lines.push('🛠 ' + t.toolName + (t.toolArgs ? ' ' + t.toolArgs : ''))
    } else {
      lines.push('💤 等待指令...')
    }
    if (t.todoText) lines.push(t.todoText)
    return lines.join('\n')
  }

  const modeLabel = (m) => m === 'waiting' ? '等待输入' : m === 'degraded' ? '遇阻降级' : m === 'review' ? '可复核' : m === 'running' ? '运行中' : '空闲'
  const detailEl = document.getElementById('detail')
  const detailBody = document.getElementById('detail-body')
  let detailTimer = null
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const showDetail = () => {
    if (!detailEl || !detailBody) return
    if (detailEl.classList.contains('show')) {
      detailEl.classList.remove('show')
      if (detailTimer) clearTimeout(detailTimer)
      return
    }
    const rows = [
      ['状态', modeLabel(mode)],
      ['进度', pct != null ? pct + '%' : '-'],
      ['当前工具', toolName ? (toolName + (toolArgs ? ' ' + toolArgs : '')) : '—'],
      ['任务清单', todoText || '—'],
      ['提示', message || '—'],
      ['更新时间', lastUpdate || '—'],
    ]
    detailBody.innerHTML = rows.map(([k, v]) =>
      '<div class="row"><span class="k">' + esc(k) + '：</span>' + esc(v) + '</div>').join('')
    detailEl.classList.add('show')
    if (detailTimer) clearTimeout(detailTimer)
    detailTimer = setTimeout(() => detailEl.classList.remove('show'), 8000)
  }

  const paint = () => {
    pet.style.backgroundPosition = (-(frame * cellW * scale)) + 'px ' + (-(row * cellH * scale)) + 'px'
  }
  const switchRow = (nr) => {
    if (nr !== row) { row = nr; frame = 0 }
    paint()
  }
  const applySize = () => {
    pet.style.width = dispW + 'px'
    pet.style.height = dispH + 'px'
    pet.style.backgroundSize = (cellW * scale * cols) + 'px ' + (cellH * scale * rows) + 'px'
    window.api.resizePet(dispW, dispH)
  }
  pet.style.backgroundImage = 'url(' + spriteDataUrl + ')'
  applySize()

  // 结构化气泡渲染：标题行（彩色圆点+状态名）+ 正文 + 运行进度条
  const bodyTextOf = (t) => {
    const lines = []
    if (t.mode === 'waiting') {
      lines.push('我需要你的决定！')
      if (t.message) lines.push('原因：' + t.message)
      lines.push('请在对话中批准或回复「确认」')
    } else if (t.mode === 'degraded') {
      lines.push('思考中...（可能遇到阻力）')
      lines.push('超过 10 秒没有进度更新')
    } else if (t.mode === 'review') {
      lines.push(t.message || '任务完成！快来检查成果吧！')
    } else if (t.mode === 'running') {
      const phaseText = t.phase <= 0 ? '正在思考方案...' : t.phase === 1 ? '正在编写代码 / 读取文件...' : '正在自检与格式化...'
      lines.push(phaseText + '（' + (typeof t.pct === 'number' ? t.pct : '-') + '%）')
      if (t.toolName) lines.push('🛠 ' + t.toolName + (t.toolArgs ? ' ' + String(t.toolArgs).slice(0, 24) : ''))
    } else {
      lines.push('等待指令...')
    }
    if (t.todoText) lines.push(t.todoText)
    return lines.join('\n')
  }
  const renderBubble = (t) => {
    if (!bubbleVisible) return
    const meta = MODE_META[t.mode] || MODE_META.idle
    headEl.className = t.mode || 'idle'
    headEl.innerHTML = '<span class="b-dot"></span><span class="b-title">' + meta.title + '</span>'
    bodyEl.textContent = bodyTextOf(t)
    if (t.mode === 'running' && typeof t.pct === 'number') {
      barEl.style.display = 'block'
      barFill.style.width = Math.max(0, Math.min(100, t.pct)) + '%'
    } else {
      barEl.style.display = 'none'
    }
    bubble.className = t.mode === 'waiting' ? 'sticky' : ''
    updateBubblePointer()
    if (hideTimer) clearTimeout(hideTimer)
    if (t.mode !== 'waiting') hideTimer = setTimeout(() => { if (!bubble.className) clearBubble() }, 20000)
  }
  const clearBubble = () => {
    headEl.innerHTML = ''
    bodyEl.textContent = ''
    barEl.style.display = 'none'
    updateBubblePointer()
  }

  setInterval(() => { frame = (frame + 1) % framesOf(row); paint() }, 120)

  window.api.onMenu((a) => {
    if (a === 'cycle') {
      manualRow = manualRow === null ? 0 : (manualRow + 1) % 9
      switchRow(manualRow)
    } else if (a === 'task-anim') {
      manualRow = null
      switchRow(taskRowOf(mode, phase))
    } else if (a === 'bubble') {
      bubbleVisible = !bubbleVisible
      if (!bubbleVisible) clearBubble()
    }
  })

  let dragState = null
  let draggingPet = false
  let ignoring = true

  // 气泡是否出现滚动条（内容溢出）：溢出才允许交互，否则保持点击穿透
  const bubbleScrollable = () => {
    if (!bubbleVisible || !bubble.textContent) return false
    return bubble.scrollHeight > bubble.clientHeight + 2
  }
  const updateBubblePointer = () => {
    bubble.style.pointerEvents = bubbleScrollable() ? 'auto' : 'none'
  }
  const pointIn = (x, y, r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom

  // 悬停检测：光标在身体矩形内（或气泡溢出可滚动时在气泡内）才取消点击穿透，透明区域全部穿透给下层
  const syncIgnore = (x, y, force) => {
    if (draggingPet && !force) return
    const r = pet.getBoundingClientRect()
    let inside = x >= r.left + 4 && x <= r.right - 4 && y >= r.top + 4 && y <= r.bottom - 4
    if (!inside && bubbleScrollable()) {
      inside = pointIn(x, y, bubble.getBoundingClientRect())
    }
    if (inside === !ignoring) return
    ignoring = !inside
    window.api.setIgnore(ignoring)
  }
  document.addEventListener('mousemove', (e) => {
    syncIgnore(e.clientX, e.clientY)
    if (!dragState) return
    const dx = e.screenX - dragState.sx
    const dy = e.screenY - dragState.sy
    dragState.moved += Math.hypot(e.movementX || 0, e.movementY || 0)
    if (dragState.moved > 2) {
      if (!dragging) { dragging = true }
      switchRow(dragState.moved > 40 ? 2 : 1)
      pet.style.transform = dx > 0 ? 'scaleX(-1)' : 'none'
    }
    window.api.dragMove(dx, dy)
  })
  document.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return
    // 气泡可滚动区域与详情卡片内不启动拖拽，保留滚动/查看行为
    const inBubbleScroll = bubbleScrollable() && pointIn(e.clientX, e.clientY, bubble.getBoundingClientRect())
    const inDetailRect = detailEl && detailEl.classList.contains('show') && pointIn(e.clientX, e.clientY, detailEl.getBoundingClientRect())
    if (inBubbleScroll || inDetailRect) return
    draggingPet = true
    dragState = { sx: e.screenX, sy: e.screenY, moved: 0 }
    window.api.dragStart()
    document.body.classList.add('dragging')
  })
  document.addEventListener('mouseup', (e) => {
    draggingPet = false
    if (!dragState) return
    const wasDrag = dragState.moved > 6
    dragState = null
    window.api.dragEnd()
    document.body.classList.remove('dragging')
    if (dragging) {
      dragging = false
      pet.style.transform = 'none'
      switchRow(manualRow !== null ? manualRow : taskRowOf(mode, phase))
    }
    syncIgnore(e.clientX, e.clientY, true)
    if (!wasDrag) showDetail()
  })
  document.addEventListener('dblclick', () => window.api.exit())
  document.addEventListener('contextmenu', (e) => { e.preventDefault(); window.api.context() })

  const refresh = async () => {
    try {
      const t = await window.api.task()
      if (t && t.mode) {
        mode = t.mode
        phase = t.phase
        pct = typeof t.pct === 'number' ? t.pct : null
        toolName = t.toolName || ''
        toolArgs = t.toolArgs || ''
        message = t.message || ''
        todoText = t.todoText || ''
        lastUpdate = new Date().toLocaleTimeString()
        switchRow(manualRow !== null ? manualRow : taskRowOf(mode, phase))
        renderBubble(t)
        if (notifyEnabled && prevMode !== mode && (mode === 'waiting' || mode === 'review' || mode === 'degraded')) {
          window.api.notify('昔涟', textOf(t))
        }
        prevMode = mode
      }
      const st = await window.api.state()
      if (st) {
        if (typeof st.notify === 'boolean') notifyEnabled = st.notify
        if (typeof st.scale === 'number' && st.scale > 0.3 && st.scale <= 3 && Math.abs(st.scale - scale) > 0.01) {
          scale = st.scale
          dispW = Math.round(cellW * scale)
          dispH = Math.round(cellH * scale)
          applySize()
          paint()
        }
      }
    } catch (e) { /* ignore */ }
  }
  setInterval(refresh, 2000)
  refresh()
})()
