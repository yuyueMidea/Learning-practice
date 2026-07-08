import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const CUBIE_SIZE = 0.94
const SPACING = 1.04
const TURN_DURATION = 260
const HALF_TURN_DURATION = 340

const FACE_COLORS = {
  R: '#e53935',
  L: '#fb8c00',
  U: '#f5f5f5',
  D: '#ffd600',
  F: '#24b66f',
  B: '#1677d2',
}

const MOVE_DEFINITIONS = {
  R: { axis: new THREE.Vector3(1, 0, 0), layer: 1, angle: -Math.PI / 2 },
  L: { axis: new THREE.Vector3(1, 0, 0), layer: -1, angle: Math.PI / 2 },
  U: { axis: new THREE.Vector3(0, 1, 0), layer: 1, angle: -Math.PI / 2 },
  D: { axis: new THREE.Vector3(0, 1, 0), layer: -1, angle: Math.PI / 2 },
  F: { axis: new THREE.Vector3(0, 0, 1), layer: 1, angle: -Math.PI / 2 },
  B: { axis: new THREE.Vector3(0, 0, 1), layer: -1, angle: Math.PI / 2 },
}

const CLICK_MOVE_BY_NORMAL = {
  '1,0,0': 'R',
  '-1,0,0': 'L',
  '0,1,0': 'U',
  '0,-1,0': 'D',
  '0,0,1': 'F',
  '0,0,-1': 'B',
}

const QUARTER_VALUES = [0, 0.5, Math.SQRT1_2, 1]

function roundedGrid(vector) {
  return new THREE.Vector3(Math.round(vector.x), Math.round(vector.y), Math.round(vector.z))
}

function snapQuaternion(quaternion) {
  const snapped = quaternion.clone()
  for (const key of ['x', 'y', 'z', 'w']) {
    const value = snapped[key]
    const sign = value < 0 ? -1 : 1
    const closest = QUARTER_VALUES.reduce((best, candidate) => (
      Math.abs(candidate - Math.abs(value)) < Math.abs(best - Math.abs(value)) ? candidate : best
    ), QUARTER_VALUES[0])
    snapped[key] = Math.abs(value) < 1e-7 ? 0 : sign * closest
  }
  return snapped.normalize()
}

function normalKey(normal) {
  const vector = roundedGrid(normal)
  return `${vector.x},${vector.y},${vector.z}`
}

function canonicalMove(token) {
  if (typeof token !== 'string') return null
  const match = token.trim().match(/^([RLUDFB])([2']?)$/i)
  if (!match) return null
  return `${match[1].toUpperCase()}${match[2] || ''}`
}

function inverseMove(token) {
  const move = canonicalMove(token)
  if (!move) return null
  if (move.endsWith('2')) return move
  return move.endsWith("'") ? move[0] : `${move}'`
}

function moveAmount(token) {
  if (token.endsWith('2')) return 2
  return token.endsWith("'") ? -1 : 1
}

function normalizeAlgorithm(input) {
  const clean = input
    .replace(/#[^\n]*/g, ' ')
    .replace(/[，、；;\n\t]/g, ' ')
    .trim()

  if (!clean) return { moves: [], invalid: [] }

  const tokens = clean.split(/\s+/).filter(Boolean)
  const moves = []
  const invalid = []

  for (const token of tokens) {
    const canonical = canonicalMove(token)
    if (canonical) moves.push(canonical)
    else invalid.push(token)
  }

  return { moves, invalid }
}

function createSticker({ color, position, rotation, face }) {
  const geometry = new THREE.PlaneGeometry(0.72, 0.72, 1, 1)
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.42,
    metalness: 0.02,
    side: THREE.FrontSide,
  })
  const sticker = new THREE.Mesh(geometry, material)
  sticker.position.copy(position)
  sticker.rotation.set(rotation.x, rotation.y, rotation.z)
  sticker.userData = { isSticker: true, face }
  return sticker
}

function createCubie(x, y, z) {
  const cubie = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE, 3, 3, 3),
    new THREE.MeshStandardMaterial({ color: '#0a0d14', roughness: 0.33, metalness: 0.12 }),
  )
  body.userData = { isCubieBody: true }
  cubie.add(body)

  const offset = CUBIE_SIZE / 2 + 0.004
  const faces = [
    { when: x === 1, color: FACE_COLORS.R, position: new THREE.Vector3(offset, 0, 0), rotation: new THREE.Euler(0, Math.PI / 2, 0), face: 'R' },
    { when: x === -1, color: FACE_COLORS.L, position: new THREE.Vector3(-offset, 0, 0), rotation: new THREE.Euler(0, -Math.PI / 2, 0), face: 'L' },
    { when: y === 1, color: FACE_COLORS.U, position: new THREE.Vector3(0, offset, 0), rotation: new THREE.Euler(-Math.PI / 2, 0, 0), face: 'U' },
    { when: y === -1, color: FACE_COLORS.D, position: new THREE.Vector3(0, -offset, 0), rotation: new THREE.Euler(Math.PI / 2, 0, 0), face: 'D' },
    { when: z === 1, color: FACE_COLORS.F, position: new THREE.Vector3(0, 0, offset), rotation: new THREE.Euler(0, 0, 0), face: 'F' },
    { when: z === -1, color: FACE_COLORS.B, position: new THREE.Vector3(0, 0, -offset), rotation: new THREE.Euler(0, Math.PI, 0), face: 'B' },
  ]

  faces.filter((item) => item.when).forEach((item) => cubie.add(createSticker(item)))

  cubie.position.set(x * SPACING, y * SPACING, z * SPACING)
  cubie.userData = {
    grid: new THREE.Vector3(x, y, z),
    initialGrid: new THREE.Vector3(x, y, z),
    initialQuaternion: new THREE.Quaternion(),
  }
  return cubie
}

function createScramble(length = 24) {
  const faces = Object.keys(MOVE_DEFINITIONS)
  const suffixes = ['', "'", '2']
  const result = []
  let previous = null

  while (result.length < length) {
    const face = faces[Math.floor(Math.random() * faces.length)]
    if (face === previous) continue
    result.push(`${face}${suffixes[Math.floor(Math.random() * suffixes.length)]}`)
    previous = face
  }
  return result
}

export const __cubeTestApi = {
  MOVE_DEFINITIONS,
  canonicalMove,
  inverseMove,
  moveAmount,
  roundedGrid,
  snapQuaternion,
}

export function useRubiksCube() {
  const canvasHost = ref(null)
  const state = reactive({
    initialized: false,
    isAnimating: false,
    isSolved: true,
    elapsedSeconds: 0,
    moveCount: 0,
    queueLength: 0,
    historyLength: 0,
    redoLength: 0,
    lastMove: '—',
    message: '点击彩色贴纸即可转动对应一层。',
    algorithmError: '',
  })

  let scene
  let camera
  let renderer
  let controls
  let root
  let raycaster
  let pointer
  let animationFrameId = 0
  let resizeObserver
  let elapsedInterval
  let startedAt = 0
  let timerStarted = false
  let cubelets = []
  let queue = []
  let activeTurn = null
  let timeline = []
  let redoStack = []
  let suppressCanvasClick = false

  const canUndo = computed(() => state.historyLength > 0 && !state.isAnimating && state.queueLength === 0)
  const canRedo = computed(() => state.redoLength > 0 && !state.isAnimating && state.queueLength === 0)
  const canSolve = computed(() => state.historyLength > 0 && !state.isAnimating && state.queueLength === 0)
  const timerText = computed(() => {
    const minutes = Math.floor(state.elapsedSeconds / 60).toString().padStart(2, '0')
    const seconds = (state.elapsedSeconds % 60).toString().padStart(2, '0')
    return `${minutes}:${seconds}`
  })

  function setMessage(message) {
    state.message = message
  }

  function rebuildCube() {
    if (!root) return
    root.clear()
    cubelets = []
    for (let x = -1; x <= 1; x += 1) {
      for (let y = -1; y <= 1; y += 1) {
        for (let z = -1; z <= 1; z += 1) {
          const cubie = createCubie(x, y, z)
          root.add(cubie)
          cubelets.push(cubie)
        }
      }
    }
  }

  function setupScene() {
    const host = canvasHost.value
    if (!host || state.initialized) return

    scene = new THREE.Scene()
    scene.background = new THREE.Color('#0a1020')

    camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
    camera.position.set(6.8, 6.2, 7.5)

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    host.appendChild(renderer.domElement)

    controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 0, 0)
    controls.enableDamping = true
    controls.dampingFactor = 0.075
    controls.enablePan = false
    controls.minDistance = 5.1
    controls.maxDistance = 13
    controls.maxPolarAngle = Math.PI * 0.87
    controls.minPolarAngle = Math.PI * 0.12

    const ambient = new THREE.HemisphereLight('#d9efff', '#091020', 2.3)
    scene.add(ambient)

    const key = new THREE.DirectionalLight('#ffffff', 3.2)
    key.position.set(5, 8, 8)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    scene.add(key)

    const fill = new THREE.DirectionalLight('#5b8cff', 1.25)
    fill.position.set(-7, 2, -6)
    scene.add(fill)

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(5.8, 96),
      new THREE.MeshStandardMaterial({ color: '#111b31', roughness: 0.75, metalness: 0.05 }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -2.05
    floor.receiveShadow = true
    scene.add(floor)

    const grid = new THREE.GridHelper(12, 24, '#233353', '#16233b')
    grid.position.y = -2.04
    scene.add(grid)

    root = new THREE.Group()
    scene.add(root)
    rebuildCube()

    raycaster = new THREE.Raycaster()
    pointer = new THREE.Vector2()

    renderer.domElement.addEventListener('click', onCanvasClick)
    renderer.domElement.addEventListener('pointerdown', () => { suppressCanvasClick = false })
    renderer.domElement.addEventListener('pointermove', () => { suppressCanvasClick = true })
    window.addEventListener('keydown', onKeydown)

    resizeObserver = new ResizeObserver(resizeRenderer)
    resizeObserver.observe(host)
    resizeRenderer()

    elapsedInterval = window.setInterval(updateTimer, 250)
    state.initialized = true
    renderLoop()
  }

  function resizeRenderer() {
    if (!canvasHost.value || !renderer || !camera) return
    const { clientWidth: width, clientHeight: height } = canvasHost.value
    if (!width || !height) return
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize(width, height, false)
  }

  function renderLoop() {
    animationFrameId = requestAnimationFrame(renderLoop)
    controls?.update()
    updateTurn(performance.now())
    renderer?.render(scene, camera)
  }

  function updateTimer() {
    if (!timerStarted || !startedAt || state.isSolved) return
    state.elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000)
  }

  function resetTimer() {
    timerStarted = false
    startedAt = 0
    state.elapsedSeconds = 0
  }

  function startTimer() {
    if (!timerStarted) {
      timerStarted = true
      startedAt = Date.now() - state.elapsedSeconds * 1000
    }
  }

  function ensureTurnLoop() {
    state.queueLength = queue.length + (activeTurn ? 1 : 0)
    if (!activeTurn && queue.length) beginTurn(queue.shift())
  }

  function enqueueMoves(tokens, options = {}) {
    const moves = tokens.map(canonicalMove).filter(Boolean)
    if (!moves.length) return false
    queue.push(...moves.map((move) => ({ move, ...options })))
    state.queueLength = queue.length + (activeTurn ? 1 : 0)
    ensureTurnLoop()
    return true
  }

  function beginTurn(entry) {
    const definition = MOVE_DEFINITIONS[entry.move[0]]
    const turns = moveAmount(entry.move)
    const angle = definition.angle * turns
    const axisName = definition.axis.x ? 'x' : definition.axis.y ? 'y' : 'z'
    const selected = cubelets
      .filter((cubie) => Math.round(cubie.userData.grid[axisName]) === definition.layer)
      .map((cubie) => ({
        cubie,
        beforeGrid: cubie.userData.grid.clone(),
        beforeQuaternion: cubie.quaternion.clone(),
      }))

    const pivot = new THREE.Group()
    root.add(pivot)
    selected.forEach(({ cubie }) => pivot.attach(cubie))

    activeTurn = {
      ...entry,
      definition,
      angle,
      pivot,
      selected,
      startedAt: performance.now(),
      duration: Math.abs(turns) === 2 ? HALF_TURN_DURATION : TURN_DURATION,
    }
    state.isAnimating = true
    state.queueLength = queue.length + 1
  }

  function updateTurn(now) {
    if (!activeTurn) {
      ensureTurnLoop()
      return
    }

    const progress = Math.min((now - activeTurn.startedAt) / activeTurn.duration, 1)
    const eased = 1 - Math.pow(1 - progress, 4)
    activeTurn.pivot.quaternion.setFromAxisAngle(activeTurn.definition.axis, activeTurn.angle * eased)

    if (progress >= 1) finishTurn()
  }

  function finishTurn() {
    const turn = activeTurn
    if (!turn) return

    const rotation = new THREE.Quaternion().setFromAxisAngle(turn.definition.axis, turn.angle)
    turn.selected.forEach(({ cubie, beforeGrid, beforeQuaternion }) => {
      root.attach(cubie)
      cubie.userData.grid.copy(roundedGrid(beforeGrid.applyQuaternion(rotation)))
      cubie.position.copy(cubie.userData.grid).multiplyScalar(SPACING)
      cubie.quaternion.copy(snapQuaternion(beforeQuaternion.premultiply(rotation)))
    })

    root.remove(turn.pivot)
    state.lastMove = turn.move

    if (turn.record === 'push') {
      timeline.push(turn.move)
      redoStack = []
      state.historyLength = timeline.length
      state.redoLength = 0
      if (turn.startTimer) startTimer()
      state.moveCount += turn.countMove === false ? 0 : 1
    } else if (turn.record === 'undo') {
      const original = inverseMove(turn.move)
      if (original) redoStack.push(original)
      state.redoLength = redoStack.length
    } else if (turn.record === 'redo') {
      timeline.push(turn.move)
      state.historyLength = timeline.length
      state.redoLength = redoStack.length
    } else if (turn.record === 'solve') {
      timeline.pop()
      state.historyLength = timeline.length
    }

    updateSolvedState()
    if (turn.onComplete) turn.onComplete()

    activeTurn = null
    state.isAnimating = false
    state.queueLength = queue.length
    ensureTurnLoop()
  }

  function updateSolvedState() {
    const solved = cubelets.every((cubie) => {
      const sameGrid = cubie.userData.grid.equals(cubie.userData.initialGrid)
      const sameOrientation = Math.abs(cubie.quaternion.dot(cubie.userData.initialQuaternion)) > 0.999999
      return sameGrid && sameOrientation
    })

    const wasSolved = state.isSolved
    state.isSolved = solved
    if (solved && !wasSolved && timerStarted) {
      updateTimer()
      setMessage(`完成复原，用时 ${timerText.value}，共 ${state.moveCount} 步。`)
    }
  }

  function turn(move, options = {}) {
    const canonical = canonicalMove(move)
    if (!canonical) return false
    const accepted = enqueueMoves([canonical], {
      record: options.record ?? 'push',
      countMove: options.countMove ?? true,
      startTimer: options.startTimer ?? true,
      onComplete: options.onComplete,
    })
    if (accepted) setMessage(`执行 ${canonical}`)
    return accepted
  }

  function applyAlgorithm(input) {
    const { moves, invalid } = normalizeAlgorithm(input)
    state.algorithmError = invalid.length ? `无法识别：${invalid.join('、')}` : ''
    if (!moves.length) {
      if (!invalid.length) state.algorithmError = '请输入公式，例如：R U R\' U\''
      return false
    }

    enqueueMoves(moves, { record: 'push', countMove: true, startTimer: true })
    setMessage(`已加入 ${moves.length} 个转动。`)
    return true
  }

  function scramble() {
    if (state.isAnimating || queue.length) return
    const moves = createScramble(24)
    resetTimer()
    state.moveCount = 0
    state.algorithmError = ''
    enqueueMoves(moves, { record: 'push', countMove: false, startTimer: false })
    const lastIndex = queue.length - 1
    if (lastIndex >= 0) {
      queue[lastIndex].onComplete = () => {
        startTimer()
        setMessage('已打乱，开始计时。点击贴纸、按钮或输入公式开始复原。')
      }
    }
    setMessage(`正在打乱：${moves.join(' ')}`)
  }

  function undo() {
    if (!timeline.length || state.isAnimating || queue.length) return
    const last = timeline.pop()
    state.historyLength = timeline.length
    const inverse = inverseMove(last)
    if (!inverse) return
    enqueueMoves([inverse], { record: 'undo', countMove: false, startTimer: false })
    setMessage(`撤销 ${last}`)
  }

  function redo() {
    if (!redoStack.length || state.isAnimating || queue.length) return
    const next = redoStack.pop()
    state.redoLength = redoStack.length
    enqueueMoves([next], { record: 'redo', countMove: true, startTimer: false })
    setMessage(`重做 ${next}`)
  }

  function solve() {
    if (!timeline.length || state.isAnimating || queue.length) return
    const solveMoves = [...timeline].reverse().map(inverseMove).filter(Boolean)
    enqueueMoves(solveMoves, { record: 'solve', countMove: false, startTimer: false })
    setMessage(`正在按 ${solveMoves.length} 步回放复原。`)
  }

  function resetCube() {
    queue = []
    activeTurn = null
    state.isAnimating = false
    state.queueLength = 0
    timeline = []
    redoStack = []
    state.historyLength = 0
    state.redoLength = 0
    state.moveCount = 0
    state.lastMove = '—'
    state.isSolved = true
    state.algorithmError = ''
    resetTimer()
    rebuildCube()
    setMessage('魔方已重置为完成状态。')
  }

  function onCanvasClick(event) {
    if (suppressCanvasClick || state.isAnimating || queue.length || !renderer || !camera) return
    const bounds = renderer.domElement.getBoundingClientRect()
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1
    pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)

    const intersections = raycaster.intersectObjects(root.children, true)
    const stickerHit = intersections.find(({ object }) => object.userData.isSticker)
    if (!stickerHit) return

    const normal = new THREE.Vector3(0, 0, 1)
      .applyQuaternion(stickerHit.object.getWorldQuaternion(new THREE.Quaternion()))
    const face = CLICK_MOVE_BY_NORMAL[normalKey(normal)]
    if (!face) return
    turn(`${face}${event.shiftKey ? "'" : ''}`)
  }

  function onKeydown(event) {
    const target = event.target
    const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable
    if (isTyping || event.altKey || event.ctrlKey || event.metaKey) return

    const codeMap = {
      KeyR: 'R',
      KeyL: 'L',
      KeyU: 'U',
      KeyD: 'D',
      KeyF: 'F',
      KeyB: 'B',
    }
    const face = codeMap[event.code]
    if (!face) return
    event.preventDefault()
    turn(`${face}${event.shiftKey ? "'" : ''}`)
  }

  function dispose() {
    cancelAnimationFrame(animationFrameId)
    if (elapsedInterval) window.clearInterval(elapsedInterval)
    window.removeEventListener('keydown', onKeydown)
    resizeObserver?.disconnect()
    if (renderer?.domElement) renderer.domElement.removeEventListener('click', onCanvasClick)
    controls?.dispose()
    renderer?.dispose()
    if (renderer?.domElement?.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement)
    state.initialized = false
  }

  onBeforeUnmount(dispose)

  return {
    canvasHost,
    state,
    canUndo,
    canRedo,
    canSolve,
    timerText,
    setupScene,
    turn,
    scramble,
    undo,
    redo,
    solve,
    resetCube,
    applyAlgorithm,
  }
}
