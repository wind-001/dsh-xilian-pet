(async () => {
  const boot = await window.api.boot()
  if (!boot || !boot.spriteDataUrl) return
  const { spriteDataUrl, cols, rows, cellW, cellH, scale: bootScale, anims } = boot
  const pet = document.getElementById('pet')
  const bubble = document.getElementById('bubble')

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
    if (t.mode === 'waiting') return '❗ 我需要你的决定！' + (t.message ? '（' + t.message + '）' : '')
    if (t.mode === 'degraded') return '🤔 思考中...（可能遇到阻力）'
    if (t.mode === 'review') return t.message || '✅ 任务完成！快来检查成果吧！'
    if (t.mode === 'running') {
      const phaseText = t.phase <= 0 ? '🧠 正在思考方案...' : t.phase === 1 ? '✍️ 正在编写代码 / 读取文件...' : '🔧 正在自检与格式化...'
      return phaseText + (t.todoText ? ' ' + t.todoText : '')
    }
    return '💤 等待指令...'
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

  function showBubble(text, sticky) {
    if (!bubbleVisible) return
    bubble.textContent = text
    bubble.className = sticky ? 'sticky' : ''
    if (hideTimer) clearTimeout(hideTimer)
    if (!sticky) hideTimer = setTimeout(() => { if (!bubble.className) bubble.textContent = '' }, 20000)
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
      if (!bubbleVisible) { bubble.textContent = ''; bubble.className = '' }
    }
  })

  let dragState = null
  let draggingPet = false
  let ignoring = true

  // 悬停检测：光标在身体矩形内才取消点击穿透，透明区域全部穿透给下层
  const syncIgnore = (x, y, force) => {
    if (draggingPet && !force) return
    const r = pet.getBoundingClientRect()
    const inside = x >= r.left + 4 && x <= r.right - 4 && y >= r.top + 4 && y <= r.bottom - 4
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
    if (!wasDrag) {
      if (mode === 'running') showBubble('🛠 正在执行: ' + (toolName || '任务') + (toolArgs ? ' ' + toolArgs : ''))
      else if (mode === 'waiting') showBubble('❗ 需要你的决定：' + (message || '请查看对话并回复'), true)
      else if (mode === 'review') showBubble('✅ 任务完成！' + (message || '') + '（查看对话确认成果）')
      else if (mode === 'degraded') showBubble('🤔 长时间无进度更新，可能遇到阻力；请在对话中打断我')
    }
  })
  document.addEventListener('dblclick', () => window.api.exit())
  document.addEventListener('contextmenu', (e) => { e.preventDefault(); window.api.context() })

  const refresh = async () => {
    try {
      const t = await window.api.task()
      if (t && t.mode) {
        mode = t.mode
        phase = t.phase
        toolName = t.toolName || ''
        toolArgs = t.toolArgs || ''
        message = t.message || ''
        todoText = t.todoText || ''
        switchRow(manualRow !== null ? manualRow : taskRowOf(mode, phase))
        const text = textOf(t)
        showBubble(text, t.mode === 'waiting')
        if (notifyEnabled && prevMode !== mode && (mode === 'waiting' || mode === 'review' || mode === 'degraded')) {
          window.api.notify('昔涟', text)
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
