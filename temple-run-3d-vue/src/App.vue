<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import GameHud from './components/GameHud.vue'
import { TempleRunGame } from './game/TempleRunGame.js'
import { GAME_STATUS } from './game/config.js'

const canvasHost = ref(null)
const hud = reactive({
  status: GAME_STATUS.READY,
  score: 0,
  bestScore: 0,
  coins: 0,
  lives: 3,
  speed: 0,
  distance: 0
})
const soundEnabled = ref(true)
let game = null

const overlayTitle = computed(() => {
  if (hud.status === GAME_STATUS.PAUSED) return '游戏已暂停'
  if (hud.status === GAME_STATUS.GAME_OVER) return '逃亡结束'
  return 'TEMPLE DASH 3D'
})

const showOverlay = computed(() => hud.status !== GAME_STATUS.PLAYING)

const primaryText = computed(() => {
  if (hud.status === GAME_STATUS.PAUSED) return '继续逃亡'
  if (hud.status === GAME_STATUS.GAME_OVER) return '重新挑战'
  return '开始逃亡'
})

function syncHud(next) {
  Object.assign(hud, next)
}

function startOrResume() {
  if (!game) return
  if (hud.status === GAME_STATUS.PAUSED) game.togglePause()
  else game.start()
}

function restart() {
  game?.restart()
}

function togglePause() {
  game?.togglePause()
}

function toggleSound() {
  soundEnabled.value = !soundEnabled.value
  game?.setSoundEnabled(soundEnabled.value)
}

function input(action) {
  game?.handleAction(action)
}

onMounted(() => {
  game = new TempleRunGame(canvasHost.value, {
    onStateChange: syncHud
  })
  game.setSoundEnabled(soundEnabled.value)
})

onBeforeUnmount(() => {
  game?.destroy()
  game = null
})
</script>

<template>
  <main class="game-shell">
    <div ref="canvasHost" class="canvas-host" aria-label="3D 神庙逃亡游戏画面"></div>

    <GameHud
      :hud="hud"
      :sound-enabled="soundEnabled"
      @pause="togglePause"
      @restart="restart"
      @toggle-sound="toggleSound"
    />

    <div class="objective glass-panel">
      <span class="objective-dot"></span>
      <span>避开石墙、跃过路障、滑过拱门</span>
    </div>

    <section v-if="showOverlay" class="overlay">
      <div class="overlay-card glass-panel">
        <p class="eyebrow">AN ENDLESS TEMPLE RUN</p>
        <h1>{{ overlayTitle }}</h1>

        <template v-if="hud.status === GAME_STATUS.GAME_OVER">
          <div class="result-grid">
            <div><span>本局分数</span><strong>{{ hud.score.toLocaleString() }}</strong></div>
            <div><span>收集金币</span><strong>{{ hud.coins }}</strong></div>
            <div><span>逃亡距离</span><strong>{{ hud.distance }}m</strong></div>
            <div><span>最高分</span><strong>{{ hud.bestScore.toLocaleString() }}</strong></div>
          </div>
        </template>
        <template v-else>
          <p class="intro-copy">
            三条轨道无限奔跑。通过方向键或 WASD 左右换道，向上跳跃，向下滑行。
          </p>
          <div class="key-guide">
            <span>← / A 左移</span><span>→ / D 右移</span><span>↑ / W / 空格 跳跃</span><span>↓ / S 下滑</span>
          </div>
        </template>

        <button class="primary-button" type="button" @click="startOrResume">{{ primaryText }}</button>
        <button v-if="hud.status === GAME_STATUS.PAUSED" class="secondary-button" type="button" @click="restart">重新开始</button>
      </div>
    </section>

    <nav class="mobile-controls" aria-label="触摸控制">
      <button type="button" aria-label="左移" @pointerdown.prevent="input('left')">←</button>
      <div class="vertical-controls">
        <button type="button" aria-label="跳跃" @pointerdown.prevent="input('jump')">↑</button>
        <button type="button" aria-label="下滑" @pointerdown.prevent="input('slide')">↓</button>
      </div>
      <button type="button" aria-label="右移" @pointerdown.prevent="input('right')">→</button>
    </nav>
  </main>
</template>
