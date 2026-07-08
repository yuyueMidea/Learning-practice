<script setup>
import { nextTick, onMounted, ref } from 'vue'
import { useRubiksCube } from './composables/useRubiksCube'

const algorithm = ref('R U R\' U\'')
const {
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
} = useRubiksCube()

const moveRows = [
  ["U", "U'", 'U2'],
  ["L", "L'", 'L2'],
  ["F", "F'", 'F2'],
  ["R", "R'", 'R2'],
  ["B", "B'", 'B2'],
  ["D", "D'", 'D2'],
]

function runAlgorithm() {
  applyAlgorithm(algorithm.value)
}

function selectAlgorithm() {
  nextTick(() => document.querySelector('#algorithm')?.focus())
}

onMounted(setupScene)
</script>

<template>
  <main class="app-shell">
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
        <div>
          <p class="eyebrow">THREE.JS · VUE 3</p>
          <h1>CubeLab <span>3×3</span></h1>
        </div>
      </div>

      <div class="header-status" :class="{ solved: state.isSolved }">
        <span class="status-dot"></span>
        {{ state.isSolved ? '已复原' : state.isAnimating ? '转动中' : '进行中' }}
      </div>
    </header>

    <section class="workspace">
      <section class="stage-panel" aria-label="三维魔方操作区">
        <div ref="canvasHost" class="cube-canvas"></div>
        <div class="stage-gradient" aria-hidden="true"></div>

        <div class="scene-hint">
          <kbd>拖拽</kbd><span>旋转视角</span>
          <i></i>
          <kbd>滚轮</kbd><span>缩放</span>
          <i></i>
          <kbd>点击贴纸</kbd><span>转动层</span>
        </div>

        <div class="stats-card">
          <div>
            <span>计时</span>
            <strong>{{ timerText }}</strong>
          </div>
          <div>
            <span>步数</span>
            <strong>{{ state.moveCount }}</strong>
          </div>
          <div>
            <span>上一手</span>
            <strong class="last-move">{{ state.lastMove }}</strong>
          </div>
        </div>
      </section>

      <aside class="control-panel">
        <section class="panel-section action-section">
          <div class="section-title-row">
            <div>
              <p class="eyebrow">GAME CONTROL</p>
              <h2>开始操作</h2>
            </div>
          </div>
          <div class="primary-actions">
            <button class="button button-primary" :disabled="state.isAnimating" @click="scramble">
              <span>⤨</span> 随机打乱
            </button>
            <button class="button button-secondary" :disabled="!canSolve" @click="solve">
              <span>↶</span> 自动复原
            </button>
          </div>
          <div class="utility-actions">
            <button class="text-button" :disabled="!canUndo" @click="undo">↶ 撤销</button>
            <button class="text-button" :disabled="!canRedo" @click="redo">↷ 重做</button>
            <button class="text-button danger" :disabled="state.isAnimating" @click="resetCube">重置</button>
          </div>
        </section>

        <section class="panel-section move-section">
          <div class="section-title-row">
            <div>
              <p class="eyebrow">LAYER MOVES</p>
              <h2>手动转动</h2>
            </div>
            <span class="key-hint">Shift + 键盘字母 = 逆转</span>
          </div>

          <div class="move-grid">
            <div v-for="row in moveRows" :key="row[0]" class="move-row">
              <button
                v-for="move in row"
                :key="move"
                class="move-button"
                :disabled="state.isAnimating"
                @click="turn(move)"
              >
                {{ move }}
              </button>
            </div>
          </div>
        </section>

        <section class="panel-section formula-section">
          <div class="section-title-row">
            <div>
              <p class="eyebrow">ALGORITHM PLAYER</p>
              <h2>公式播放</h2>
            </div>
          </div>
          <label class="formula-label" for="algorithm">输入空格分隔的公式</label>
          <div class="formula-input-row">
            <input id="algorithm" v-model="algorithm" autocomplete="off" spellcheck="false" @keydown.enter="runAlgorithm" />
            <button class="button button-icon" title="播放公式" :disabled="state.isAnimating" @click="runAlgorithm">▶</button>
          </div>
          <p v-if="state.algorithmError" class="validation-error">{{ state.algorithmError }}</p>
          <p v-else class="formula-tip">支持 <b>R L U D F B</b>、逆时针 <b>'</b> 与双转 <b>2</b>。</p>
        </section>

        <section class="panel-section help-section">
          <div class="section-title-row compact">
            <div>
              <p class="eyebrow">HOW IT WORKS</p>
              <h2>使用说明</h2>
            </div>
          </div>
          <ol>
            <li>点击“随机打乱”后开始计时。</li>
            <li>可点击魔方彩色贴纸、使用按钮或按键 <kbd>R L U D F B</kbd>。</li>
            <li>“自动复原”会回放本局所有操作的逆序动画。</li>
          </ol>
        </section>

        <footer class="control-footer">{{ state.message }}</footer>
      </aside>
    </section>
  </main>
</template>
