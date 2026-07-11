export const LANES = Object.freeze([-3.2, 0, 3.2])

export const GAME_CONFIG = Object.freeze({
  startSpeed: 17,
  maxSpeed: 36,
  acceleration: 0.42,
  laneMoveSpeed: 12,
  gravity: 31,
  jumpVelocity: 13.2,
  slideDuration: 0.72,
  invulnerableDuration: 1.35,
  startLives: 3,
  obstacleHitDistance: 1.2,
  coinHitDistance: 1.1,
  spawnZ: -95,
  despawnZ: 15,
  playerZ: 6.5,
  roadSegmentLength: 18,
  roadSegmentCount: 8
})

export const GAME_STATUS = Object.freeze({
  READY: 'ready',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'gameover'
})
