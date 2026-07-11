import * as THREE from 'three'
import { GameState } from './GameState.js'
import { GAME_CONFIG, GAME_STATUS, LANES } from './config.js'

const clamp = THREE.MathUtils.clamp
const lerp = THREE.MathUtils.lerp

function disposeObject(root) {
  root.traverse((object) => {
    if (object.geometry) object.geometry.dispose()
    if (object.material) {
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.forEach((material) => {
        Object.values(material).forEach((value) => {
          if (value?.isTexture) value.dispose()
        })
        material.dispose()
      })
    }
  })
}

export class TempleRunGame {
  constructor(host, options = {}) {
    if (!host) throw new Error('TempleRunGame requires a host element')

    this.host = host
    this.onStateChange = options.onStateChange ?? (() => {})
    this.config = GAME_CONFIG
    this.state = new GameState(this.config)
    this.state.bestScore = this.readBestScore()
    this.clock = new THREE.Clock()
    this.animationFrame = 0
    this.lastHudSync = 0
    this.spawnTimer = 0.8
    this.elapsedVisual = 0
    this.soundEnabled = true
    this.audioContext = null
    this.destroyed = false
    this.cameraShake = 0
    this.pointerStart = null

    this.obstacles = []
    this.coins = []
    this.roadSegments = []
    this.scenerySegments = []
    this.torches = []

    this.handleResize = this.handleResize.bind(this)
    this.handleKeyDown = this.handleKeyDown.bind(this)
    this.handlePointerDown = this.handlePointerDown.bind(this)
    this.handlePointerUp = this.handlePointerUp.bind(this)
    this.loop = this.loop.bind(this)

    this.initThree()
    this.createWorld()
    this.createPlayer()
    this.bindEvents()
    this.syncHud(true)
    this.loop()
  }

  initThree() {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x07160f)
    this.scene.fog = new THREE.FogExp2(0x07160f, 0.018)

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 180)
    this.camera.position.set(0, 7.6, 14.8)
    this.camera.lookAt(0, 1.4, -9)

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8))
    this.renderer.setSize(this.host.clientWidth, this.host.clientHeight, false)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.12
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.host.appendChild(this.renderer.domElement)

    const hemi = new THREE.HemisphereLight(0xcce8d0, 0x18230e, 1.65)
    this.scene.add(hemi)

    const moon = new THREE.DirectionalLight(0xffe2a5, 2.2)
    moon.position.set(-9, 17, 8)
    moon.castShadow = true
    moon.shadow.mapSize.set(1024, 1024)
    moon.shadow.camera.left = -15
    moon.shadow.camera.right = 15
    moon.shadow.camera.top = 22
    moon.shadow.camera.bottom = -8
    this.scene.add(moon)

    this.handleResize()
  }

  createWorld() {
    this.world = new THREE.Group()
    this.scene.add(this.world)

    this.createRoad()
    this.createScenery()
    this.createTempleGate()
    this.createAtmosphere()
  }

  createRoad() {
    const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x5d4e36, roughness: 0.92, metalness: 0.02 })
    const edgeMaterial = new THREE.MeshStandardMaterial({ color: 0x28351f, roughness: 1 })
    const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xb39558, transparent: true, opacity: 0.34 })

    for (let index = 0; index < this.config.roadSegmentCount; index += 1) {
      const group = new THREE.Group()
      const z = 12 - index * this.config.roadSegmentLength
      group.position.z = z

      const floor = new THREE.Mesh(
        new THREE.BoxGeometry(11.4, 0.45, this.config.roadSegmentLength + 0.16),
        roadMaterial
      )
      floor.position.y = -0.28
      floor.receiveShadow = true
      group.add(floor)

      for (const x of [-6.2, 6.2]) {
        const edge = new THREE.Mesh(
          new THREE.BoxGeometry(1.1, 0.7, this.config.roadSegmentLength + 0.2),
          edgeMaterial
        )
        edge.position.set(x, -0.1, 0)
        edge.receiveShadow = true
        group.add(edge)
      }

      for (const x of [-1.6, 1.6]) {
        const line = new THREE.Mesh(
          new THREE.PlaneGeometry(0.05, this.config.roadSegmentLength),
          lineMaterial
        )
        line.rotation.x = -Math.PI / 2
        line.position.set(x, 0.012, 0)
        group.add(line)
      }

      for (let crackIndex = 0; crackIndex < 8; crackIndex += 1) {
        const crack = new THREE.Mesh(
          new THREE.PlaneGeometry(0.45 + Math.random() * 0.8, 0.025),
          new THREE.MeshBasicMaterial({ color: 0x302719, transparent: true, opacity: 0.45 })
        )
        crack.rotation.x = -Math.PI / 2
        crack.rotation.z = Math.random() * Math.PI
        crack.position.set((Math.random() - 0.5) * 9.5, 0.018, (Math.random() - 0.5) * 16)
        group.add(crack)
      }

      this.roadSegments.push(group)
      this.world.add(group)
    }
  }

  createScenery() {
    const stoneMaterial = new THREE.MeshStandardMaterial({ color: 0x3c4935, roughness: 0.96 })
    const darkStone = new THREE.MeshStandardMaterial({ color: 0x222c21, roughness: 1 })
    const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x173b22, roughness: 1 })

    for (let index = 0; index < this.config.roadSegmentCount; index += 1) {
      const group = new THREE.Group()
      group.position.z = 12 - index * this.config.roadSegmentLength

      for (const side of [-1, 1]) {
        for (let item = 0; item < 3; item += 1) {
          const z = -7 + item * 6 + (Math.random() - 0.5) * 2
          const x = side * (8.1 + Math.random() * 3.8)

          if ((index + item) % 2 === 0) {
            const pillar = new THREE.Group()
            const base = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.55, 1.45), darkStone)
            base.position.y = 0.26
            const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.62, 4 + Math.random() * 2, 8), stoneMaterial)
            shaft.position.y = 2.35
            shaft.castShadow = true
            const cap = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.38, 1.3), darkStone)
            cap.position.y = 4.4
            pillar.add(base, shaft, cap)
            pillar.position.set(x, 0, z)
            pillar.rotation.y = Math.random() * Math.PI
            group.add(pillar)
          } else {
            const tree = new THREE.Group()
            const trunk = new THREE.Mesh(
              new THREE.CylinderGeometry(0.28, 0.42, 3.4, 7),
              new THREE.MeshStandardMaterial({ color: 0x4c3321, roughness: 1 })
            )
            trunk.position.y = 1.6
            const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.7, 1), leafMaterial)
            crown.position.y = 3.9
            crown.scale.y = 1.35
            tree.add(trunk, crown)
            tree.position.set(x, 0, z)
            tree.rotation.y = Math.random() * Math.PI
            group.add(tree)
          }
        }
      }

      this.scenerySegments.push(group)
      this.world.add(group)
    }
  }

  createTempleGate() {
    const group = new THREE.Group()
    const stone = new THREE.MeshStandardMaterial({ color: 0x58634b, roughness: 0.9 })
    const gold = new THREE.MeshStandardMaterial({ color: 0xa77a2d, roughness: 0.58, metalness: 0.42 })

    const left = new THREE.Mesh(new THREE.BoxGeometry(2.2, 9, 2.3), stone)
    left.position.set(-6.2, 4.4, -42)
    const right = left.clone()
    right.position.x = 6.2
    const top = new THREE.Mesh(new THREE.BoxGeometry(14.6, 2.2, 2.7), stone)
    top.position.set(0, 8.25, -42)
    const emblem = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.25, 8, 24), gold)
    emblem.position.set(0, 8.4, -40.55)
    group.add(left, right, top, emblem)
    group.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = true
        object.receiveShadow = true
      }
    })
    this.scene.add(group)
    this.templeGate = group
  }

  createAtmosphere() {
    const particleCount = 260
    const positions = new Float32Array(particleCount * 3)
    for (let index = 0; index < particleCount; index += 1) {
      positions[index * 3] = (Math.random() - 0.5) * 48
      positions[index * 3 + 1] = Math.random() * 16
      positions[index * 3 + 2] = -120 + Math.random() * 145
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const material = new THREE.PointsMaterial({
      color: 0xe2c978,
      size: 0.12,
      transparent: true,
      opacity: 0.55,
      depthWrite: false
    })
    this.fireflies = new THREE.Points(geometry, material)
    this.scene.add(this.fireflies)
  }

  createPlayer() {
    const player = new THREE.Group()
    const skin = new THREE.MeshStandardMaterial({ color: 0xc98961, roughness: 0.78 })
    const shirt = new THREE.MeshStandardMaterial({ color: 0xd66736, roughness: 0.72 })
    const pants = new THREE.MeshStandardMaterial({ color: 0x243845, roughness: 0.8 })
    const boots = new THREE.MeshStandardMaterial({ color: 0x241a14, roughness: 0.95 })

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.52, 1.15, 5, 10), shirt)
    torso.position.y = 2.25
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.43, 14, 10), skin)
    head.position.y = 3.35

    const createLimb = (material, radius, length) => {
      const limb = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 8), material)
      limb.castShadow = true
      return limb
    }

    this.leftArm = createLimb(skin, 0.13, 0.85)
    this.rightArm = createLimb(skin, 0.13, 0.85)
    this.leftArm.position.set(-0.65, 2.25, 0)
    this.rightArm.position.set(0.65, 2.25, 0)

    this.leftLeg = createLimb(pants, 0.17, 0.9)
    this.rightLeg = createLimb(pants, 0.17, 0.9)
    this.leftLeg.position.set(-0.27, 0.9, 0)
    this.rightLeg.position.set(0.27, 0.9, 0)

    const leftBoot = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.65), boots)
    const rightBoot = leftBoot.clone()
    leftBoot.position.set(-0.27, 0.24, -0.12)
    rightBoot.position.set(0.27, 0.24, -0.12)

    player.add(torso, head, this.leftArm, this.rightArm, this.leftLeg, this.rightLeg, leftBoot, rightBoot)
    player.traverse((object) => {
      if (object.isMesh) object.castShadow = true
    })
    player.position.set(0, 0, this.config.playerZ)
    player.rotation.y = Math.PI
    this.player = player
    this.world.add(player)
  }

  bindEvents() {
    window.addEventListener('resize', this.handleResize)
    window.addEventListener('keydown', this.handleKeyDown, { passive: false })
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown)
    this.renderer.domElement.addEventListener('pointerup', this.handlePointerUp)
  }

  handleResize() {
    if (!this.renderer || !this.camera) return
    const width = Math.max(1, this.host.clientWidth)
    const height = Math.max(1, this.host.clientHeight)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
  }

  handleKeyDown(event) {
    const actionByCode = {
      ArrowLeft: 'left', KeyA: 'left',
      ArrowRight: 'right', KeyD: 'right',
      ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
      ArrowDown: 'slide', KeyS: 'slide'
    }

    if (actionByCode[event.code]) {
      event.preventDefault()
      this.handleAction(actionByCode[event.code])
      return
    }

    if (event.code === 'Escape' || event.code === 'KeyP') {
      event.preventDefault()
      this.togglePause()
    }
  }

  handlePointerDown(event) {
    this.pointerStart = { x: event.clientX, y: event.clientY, time: performance.now() }
  }

  handlePointerUp(event) {
    if (!this.pointerStart || this.state.status !== GAME_STATUS.PLAYING) return
    const dx = event.clientX - this.pointerStart.x
    const dy = event.clientY - this.pointerStart.y
    const elapsed = performance.now() - this.pointerStart.time
    this.pointerStart = null
    if (elapsed > 650 || Math.max(Math.abs(dx), Math.abs(dy)) < 28) return

    if (Math.abs(dx) > Math.abs(dy)) this.handleAction(dx > 0 ? 'right' : 'left')
    else this.handleAction(dy < 0 ? 'jump' : 'slide')
  }

  handleAction(action) {
    if (this.state.status !== GAME_STATUS.PLAYING) return
    if (action === 'left') this.state.moveLeft()
    else if (action === 'right') this.state.moveRight()
    else if (action === 'jump') {
      if (this.state.jump()) this.playTone(420, 0.055, 'sine', 0.025)
    } else if (action === 'slide') {
      if (this.state.slide()) this.playTone(170, 0.07, 'triangle', 0.02)
    }
  }

  start() {
    this.ensureAudioContext()
    const wasGameOver = this.state.status === GAME_STATUS.GAME_OVER
    if (wasGameOver || this.state.status === GAME_STATUS.READY) {
      this.clearDynamicObjects()
      this.resetWorldPositions()
      this.spawnTimer = 0.75
    }
    this.state.start()
    this.clock.getDelta()
    this.syncHud(true)
  }

  restart() {
    const best = Math.max(this.state.bestScore, this.readBestScore())
    this.state.reset()
    this.state.bestScore = best
    this.clearDynamicObjects()
    this.resetWorldPositions()
    this.spawnTimer = 0.75
    this.state.start()
    this.clock.getDelta()
    this.syncHud(true)
  }

  togglePause() {
    this.state.togglePause()
    this.clock.getDelta()
    this.syncHud(true)
  }

  setSoundEnabled(value) {
    this.soundEnabled = Boolean(value)
  }

  ensureAudioContext() {
    if (!this.soundEnabled || this.audioContext) return
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (AudioContextClass) this.audioContext = new AudioContextClass()
  }

  playTone(frequency, duration, type = 'sine', volume = 0.025) {
    if (!this.soundEnabled) return
    this.ensureAudioContext()
    if (!this.audioContext) return
    if (this.audioContext.state === 'suspended') this.audioContext.resume()

    const oscillator = this.audioContext.createOscillator()
    const gain = this.audioContext.createGain()
    const now = this.audioContext.currentTime
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, now)
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(60, frequency * 0.7), now + duration)
    gain.gain.setValueAtTime(volume, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    oscillator.connect(gain).connect(this.audioContext.destination)
    oscillator.start(now)
    oscillator.stop(now + duration)
  }

  spawnRow() {
    const difficulty = clamp(this.state.elapsed / 75, 0, 1)
    const roll = Math.random()

    if (roll < 0.24) {
      const lane = Math.floor(Math.random() * 3)
      this.spawnObstacle(Math.random() < 0.56 ? 'barrier' : 'arch', lane, this.config.spawnZ)
      this.spawnCoinTrail((lane + 1 + Math.floor(Math.random() * 2)) % 3, this.config.spawnZ - 4, 6)
    } else if (roll < 0.46) {
      const safeLane = Math.floor(Math.random() * 3)
      for (let lane = 0; lane < 3; lane += 1) {
        if (lane !== safeLane) this.spawnObstacle('wall', lane, this.config.spawnZ)
      }
      this.spawnCoinTrail(safeLane, this.config.spawnZ - 2, 7)
    } else if (roll < 0.7) {
      const lane = Math.floor(Math.random() * 3)
      this.spawnCoinTrail(lane, this.config.spawnZ, 9, Math.random() < 0.45)
    } else {
      const firstLane = Math.floor(Math.random() * 3)
      const secondLane = (firstLane + 1 + Math.floor(Math.random() * 2)) % 3
      this.spawnObstacle('barrier', firstLane, this.config.spawnZ)
      if (difficulty > 0.25) this.spawnObstacle('arch', secondLane, this.config.spawnZ - 10)
      const safeLane = [0, 1, 2].find((lane) => lane !== firstLane && lane !== secondLane) ?? secondLane
      this.spawnCoinTrail(safeLane, this.config.spawnZ - 1, 6)
    }
  }

  spawnObstacle(type, laneIndex, z) {
    const group = new THREE.Group()
    const stone = new THREE.MeshStandardMaterial({ color: 0x6c624a, roughness: 0.9 })
    const moss = new THREE.MeshStandardMaterial({ color: 0x324b2f, roughness: 1 })
    const wood = new THREE.MeshStandardMaterial({ color: 0x634020, roughness: 0.95 })

    if (type === 'barrier') {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.72, 0.7), wood)
      beam.position.y = 0.62
      const leftPost = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.25, 0.3), wood)
      const rightPost = leftPost.clone()
      leftPost.position.set(-1.05, 0.55, 0)
      rightPost.position.set(1.05, 0.55, 0)
      group.add(beam, leftPost, rightPost)
    } else if (type === 'arch') {
      const leftPost = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.7, 0.75), stone)
      const rightPost = leftPost.clone()
      leftPost.position.set(-1.15, 1.35, 0)
      rightPost.position.set(1.15, 1.35, 0)
      const top = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.75, 0.8), moss)
      top.position.y = 2.25
      group.add(leftPost, rightPost, top)
    } else {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(2.55, 3.4, 1.15), stone)
      wall.position.y = 1.7
      const mossStrip = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.34, 1.2), moss)
      mossStrip.position.y = 2.75
      group.add(wall, mossStrip)
    }

    group.position.set(LANES[laneIndex], 0, z)
    group.userData = { type, laneIndex, resolved: false }
    group.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = true
        object.receiveShadow = true
      }
    })
    this.obstacles.push(group)
    this.world.add(group)
  }

  spawnCoinTrail(laneIndex, startZ, count, arc = false) {
    for (let index = 0; index < count; index += 1) {
      const geometry = new THREE.TorusGeometry(0.31, 0.1, 8, 18)
      const material = new THREE.MeshStandardMaterial({
        color: 0xffc941,
        emissive: 0x8a4d00,
        emissiveIntensity: 0.85,
        roughness: 0.3,
        metalness: 0.72
      })
      const coin = new THREE.Mesh(geometry, material)
      const progress = count > 1 ? index / (count - 1) : 0
      const y = arc ? 1.25 + Math.sin(progress * Math.PI) * 2.2 : 1.25
      coin.position.set(LANES[laneIndex], y, startZ - index * 2.15)
      coin.rotation.y = Math.PI / 2
      coin.userData = { laneIndex, resolved: false, baseY: y }
      coin.castShadow = true
      this.coins.push(coin)
      this.world.add(coin)
    }
  }

  updateWorld(dt) {
    const movement = this.state.speed * dt
    const totalLength = this.config.roadSegmentLength * this.config.roadSegmentCount

    for (const segment of this.roadSegments) {
      segment.position.z += movement
      if (segment.position.z > 21) segment.position.z -= totalLength
    }
    for (const segment of this.scenerySegments) {
      segment.position.z += movement
      if (segment.position.z > 21) segment.position.z -= totalLength
    }

    this.templeGate.position.z += movement * 0.22
    if (this.templeGate.position.z > 80) this.templeGate.position.z = -25

    this.spawnTimer -= dt
    if (this.spawnTimer <= 0) {
      this.spawnRow()
      const difficulty = clamp(this.state.elapsed / 95, 0, 1)
      this.spawnTimer = 1.52 - difficulty * 0.44 + Math.random() * 0.45
    }

    this.updateObstacles(movement)
    this.updateCoins(movement, dt)
  }

  updateObstacles(movement) {
    for (let index = this.obstacles.length - 1; index >= 0; index -= 1) {
      const obstacle = this.obstacles[index]
      obstacle.position.z += movement

      if (!obstacle.userData.resolved) {
        const zDistance = Math.abs(obstacle.position.z - this.config.playerZ)
        const xDistance = Math.abs(obstacle.position.x - this.player.position.x)
        if (zDistance < this.config.obstacleHitDistance && xDistance < 1.28) {
          const hit = this.state.hitObstacle(obstacle.userData.type)
          obstacle.userData.resolved = true
          if (hit) {
            this.cameraShake = 0.55
            this.playTone(105, 0.22, 'sawtooth', 0.045)
            obstacle.rotation.z = (Math.random() - 0.5) * 0.25
          }
        } else if (obstacle.position.z > this.config.playerZ + 1.5) {
          obstacle.userData.resolved = true
          this.state.combo = Math.min(20, this.state.combo + 1)
        }
      }

      if (obstacle.position.z > this.config.despawnZ) {
        this.world.remove(obstacle)
        disposeObject(obstacle)
        this.obstacles.splice(index, 1)
      }
    }
  }

  updateCoins(movement, dt) {
    for (let index = this.coins.length - 1; index >= 0; index -= 1) {
      const coin = this.coins[index]
      coin.position.z += movement
      coin.rotation.y += dt * 5.5
      coin.rotation.x = Math.sin(this.elapsedVisual * 3 + index) * 0.18

      if (!coin.userData.resolved) {
        const zDistance = Math.abs(coin.position.z - this.config.playerZ)
        const xDistance = Math.abs(coin.position.x - this.player.position.x)
        const playerCenterY = 1.35 + this.state.jumpY
        const yDistance = Math.abs(coin.position.y - playerCenterY)
        if (zDistance < this.config.coinHitDistance && xDistance < 1.12 && yDistance < 1.65) {
          coin.userData.resolved = true
          this.state.collectCoin(1)
          this.playTone(720 + (this.state.combo % 5) * 55, 0.06, 'sine', 0.018)
          coin.visible = false
        }
      }

      if (coin.position.z > this.config.despawnZ || coin.userData.resolved) {
        this.world.remove(coin)
        disposeObject(coin)
        this.coins.splice(index, 1)
      }
    }
  }

  updatePlayer(dt) {
    const targetX = LANES[this.state.targetLaneIndex]
    this.player.position.x = lerp(this.player.position.x, targetX, 1 - Math.exp(-this.config.laneMoveSpeed * dt))
    this.player.position.y = this.state.jumpY

    const running = this.state.status === GAME_STATUS.PLAYING
    const runPhase = this.elapsedVisual * (6.4 + this.state.speed * 0.09)
    const swing = running ? Math.sin(runPhase) * 0.72 : 0
    this.leftArm.rotation.x = swing
    this.rightArm.rotation.x = -swing
    this.leftLeg.rotation.x = -swing * 0.82
    this.rightLeg.rotation.x = swing * 0.82

    if (this.state.slideTime > 0) {
      this.player.scale.y = lerp(this.player.scale.y, 0.48, 1 - Math.exp(-15 * dt))
      this.player.rotation.x = lerp(this.player.rotation.x, -0.55, 1 - Math.exp(-12 * dt))
      this.player.position.y += 0.1
    } else {
      this.player.scale.y = lerp(this.player.scale.y, 1, 1 - Math.exp(-12 * dt))
      this.player.rotation.x = lerp(this.player.rotation.x, 0, 1 - Math.exp(-11 * dt))
      if (this.state.jumpY === 0 && running) this.player.position.y += Math.abs(Math.sin(runPhase * 2)) * 0.08
    }

    if (this.state.invulnerableTime > 0) {
      this.player.visible = Math.floor(this.state.invulnerableTime * 12) % 2 === 0
    } else {
      this.player.visible = true
    }
  }

  updateCamera(dt) {
    const targetX = this.player.position.x * 0.24
    const shake = this.cameraShake > 0 ? (Math.random() - 0.5) * this.cameraShake : 0
    this.camera.position.x = lerp(this.camera.position.x, targetX, 1 - Math.exp(-4.4 * dt)) + shake
    this.camera.position.y = 7.6 + shake * 0.35
    this.camera.lookAt(this.player.position.x * 0.13, 1.35 + this.state.jumpY * 0.08, -9)
    this.cameraShake = Math.max(0, this.cameraShake - dt * 1.8)
  }

  updateAtmosphere(dt) {
    this.fireflies.rotation.y += dt * 0.015
    const positions = this.fireflies.geometry.attributes.position
    for (let index = 1; index < positions.count * 3; index += 3) {
      positions.array[index] += Math.sin(this.elapsedVisual + index) * dt * 0.012
    }
    positions.needsUpdate = true
  }

  resetWorldPositions() {
    this.roadSegments.forEach((segment, index) => {
      segment.position.z = 12 - index * this.config.roadSegmentLength
    })
    this.scenerySegments.forEach((segment, index) => {
      segment.position.z = 12 - index * this.config.roadSegmentLength
    })
    this.templeGate.position.z = 0
    this.player.position.set(0, 0, this.config.playerZ)
    this.player.scale.set(1, 1, 1)
    this.player.rotation.set(0, Math.PI, 0)
    this.camera.position.set(0, 7.6, 14.8)
  }

  clearDynamicObjects() {
    for (const obstacle of this.obstacles) {
      this.world.remove(obstacle)
      disposeObject(obstacle)
    }
    for (const coin of this.coins) {
      this.world.remove(coin)
      disposeObject(coin)
    }
    this.obstacles.length = 0
    this.coins.length = 0
  }

  syncHud(force = false) {
    const now = performance.now()
    if (!force && now - this.lastHudSync < 80) return
    this.lastHudSync = now

    if (this.state.status === GAME_STATUS.GAME_OVER) {
      const best = Math.max(this.state.bestScore, Math.floor(this.state.score))
      this.state.bestScore = best
      this.writeBestScore(best)
    }
    this.onStateChange(this.state.snapshot())
  }

  readBestScore() {
    try {
      return Number.parseInt(localStorage.getItem('temple-dash-best') ?? '0', 10) || 0
    } catch {
      return 0
    }
  }

  writeBestScore(score) {
    try {
      localStorage.setItem('temple-dash-best', String(score))
    } catch {
      // Storage can be unavailable in privacy mode; gameplay should continue.
    }
  }

  loop() {
    if (this.destroyed) return
    this.animationFrame = requestAnimationFrame(this.loop)
    const dt = Math.min(this.clock.getDelta(), 0.05)
    this.elapsedVisual += dt

    if (this.state.status === GAME_STATUS.PLAYING) {
      this.state.update(dt)
      this.updateWorld(dt)
    }

    this.updatePlayer(dt)
    this.updateCamera(dt)
    this.updateAtmosphere(dt)
    this.syncHud()
    this.renderer.render(this.scene, this.camera)
  }

  destroy() {
    this.destroyed = true
    cancelAnimationFrame(this.animationFrame)
    window.removeEventListener('resize', this.handleResize)
    window.removeEventListener('keydown', this.handleKeyDown)
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown)
    this.renderer.domElement.removeEventListener('pointerup', this.handlePointerUp)
    this.clearDynamicObjects()
    disposeObject(this.scene)
    this.renderer.dispose()
    this.renderer.domElement.remove()
    this.audioContext?.close()
  }
}
