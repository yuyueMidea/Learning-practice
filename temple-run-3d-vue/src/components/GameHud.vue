<script setup>
defineProps({
  hud: { type: Object, required: true },
  soundEnabled: { type: Boolean, default: true }
})

defineEmits(['pause', 'restart', 'toggle-sound'])
</script>

<template>
  <div class="hud">
    <section class="hud-stats glass-panel">
      <div class="stat-item">
        <span class="stat-label">分数</span>
        <strong>{{ hud.score.toLocaleString() }}</strong>
      </div>
      <div class="stat-item">
        <span class="stat-label">金币</span>
        <strong>🪙 {{ hud.coins }}</strong>
      </div>
      <div class="stat-item hide-small">
        <span class="stat-label">距离</span>
        <strong>{{ hud.distance }} m</strong>
      </div>
      <div class="stat-item hide-small">
        <span class="stat-label">速度</span>
        <strong>{{ hud.speed }}</strong>
      </div>
    </section>

    <section class="hud-actions glass-panel">
      <div class="lives" aria-label="剩余生命">
        <span v-for="index in 3" :key="index" :class="{ lost: index > hud.lives }">❤</span>
      </div>
      <button class="icon-button" type="button" :aria-label="soundEnabled ? '关闭音效' : '开启音效'" @click="$emit('toggle-sound')">
        {{ soundEnabled ? '🔊' : '🔇' }}
      </button>
      <button class="icon-button" type="button" aria-label="暂停" @click="$emit('pause')">Ⅱ</button>
      <button class="icon-button" type="button" aria-label="重新开始" @click="$emit('restart')">↻</button>
    </section>
  </div>
</template>
