import { GAME_CONFIG, GAME_STATUS, LANES } from './config.js'

export function obstacleIsAvoided(type, state) {
  if (type === 'barrier') return state.jumpY >= 1.35
  if (type === 'arch') return state.slideTime > 0
  if (type === 'wall') return false
  return false
}

export class GameState {
  constructor(config = GAME_CONFIG) {
    this.config = config
    this.bestScore = 0
    this.reset()
  }

  reset() {
    this.status = GAME_STATUS.READY
    this.laneIndex = 1
    this.targetLaneIndex = 1
    this.jumpY = 0
    this.jumpVelocity = 0
    this.slideTime = 0
    this.invulnerableTime = 0
    this.elapsed = 0
    this.distance = 0
    this.score = 0
    this.coins = 0
    this.lives = this.config.startLives
    this.speed = this.config.startSpeed
    this.combo = 0
    this.lastEvent = null
  }

  start() {
    if (this.status === GAME_STATUS.READY || this.status === GAME_STATUS.GAME_OVER) {
      if (this.status === GAME_STATUS.GAME_OVER) this.reset()
      this.status = GAME_STATUS.PLAYING
    }
  }

  togglePause() {
    if (this.status === GAME_STATUS.PLAYING) this.status = GAME_STATUS.PAUSED
    else if (this.status === GAME_STATUS.PAUSED) this.status = GAME_STATUS.PLAYING
  }

  moveLeft() {
    if (this.status !== GAME_STATUS.PLAYING) return false
    const next = Math.max(0, this.targetLaneIndex - 1)
    const changed = next !== this.targetLaneIndex
    this.targetLaneIndex = next
    return changed
  }

  moveRight() {
    if (this.status !== GAME_STATUS.PLAYING) return false
    const next = Math.min(LANES.length - 1, this.targetLaneIndex + 1)
    const changed = next !== this.targetLaneIndex
    this.targetLaneIndex = next
    return changed
  }

  jump() {
    if (this.status !== GAME_STATUS.PLAYING) return false
    if (this.jumpY > 0.01 || this.slideTime > 0) return false
    this.jumpVelocity = this.config.jumpVelocity
    this.lastEvent = 'jump'
    return true
  }

  slide() {
    if (this.status !== GAME_STATUS.PLAYING) return false
    if (this.jumpY > 0.05) return false
    this.slideTime = this.config.slideDuration
    this.lastEvent = 'slide'
    return true
  }

  collectCoin(value = 1) {
    if (this.status !== GAME_STATUS.PLAYING) return
    this.coins += value
    this.combo += 1
    this.score += value * 35 + Math.min(this.combo, 10) * 2
    this.lastEvent = 'coin'
  }

  hitObstacle(type = 'wall') {
    if (this.status !== GAME_STATUS.PLAYING || this.invulnerableTime > 0) return false
    if (obstacleIsAvoided(type, this)) return false

    this.lives -= 1
    this.combo = 0
    this.invulnerableTime = this.config.invulnerableDuration
    this.speed = Math.max(this.config.startSpeed, this.speed * 0.82)
    this.lastEvent = 'hit'

    if (this.lives <= 0) {
      this.lives = 0
      this.status = GAME_STATUS.GAME_OVER
      this.bestScore = Math.max(this.bestScore, Math.floor(this.score))
      this.lastEvent = 'gameover'
    }
    return true
  }

  update(dt) {
    if (this.status !== GAME_STATUS.PLAYING || !Number.isFinite(dt) || dt <= 0) return

    const safeDt = Math.min(dt, 0.05)
    this.elapsed += safeDt
    this.speed = Math.min(
      this.config.maxSpeed,
      this.speed + this.config.acceleration * safeDt
    )
    this.distance += this.speed * safeDt
    this.score += this.speed * safeDt * 2.1

    if (this.jumpY > 0 || this.jumpVelocity > 0) {
      this.jumpVelocity -= this.config.gravity * safeDt
      this.jumpY += this.jumpVelocity * safeDt
      if (this.jumpY <= 0) {
        this.jumpY = 0
        this.jumpVelocity = 0
      }
    }

    if (this.slideTime > 0) this.slideTime = Math.max(0, this.slideTime - safeDt)
    if (this.invulnerableTime > 0) {
      this.invulnerableTime = Math.max(0, this.invulnerableTime - safeDt)
    }
  }

  snapshot() {
    return {
      status: this.status,
      score: Math.floor(this.score),
      bestScore: Math.max(this.bestScore, Math.floor(this.score)),
      coins: this.coins,
      lives: this.lives,
      speed: Number(this.speed.toFixed(1)),
      distance: Math.floor(this.distance),
      laneIndex: this.targetLaneIndex,
      jumpY: this.jumpY,
      isSliding: this.slideTime > 0,
      isInvulnerable: this.invulnerableTime > 0
    }
  }
}
