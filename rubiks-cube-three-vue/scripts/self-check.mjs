import assert from 'node:assert/strict'
import * as THREE from 'three'
import { __cubeTestApi } from '../src/composables/useRubiksCube.js'

const {
  MOVE_DEFINITIONS,
  canonicalMove,
  inverseMove,
  moveAmount,
  roundedGrid,
  snapQuaternion,
} = __cubeTestApi

function createState() {
  const cubies = []
  for (let x = -1; x <= 1; x += 1) {
    for (let y = -1; y <= 1; y += 1) {
      for (let z = -1; z <= 1; z += 1) {
        cubies.push({
          grid: new THREE.Vector3(x, y, z),
          initialGrid: new THREE.Vector3(x, y, z),
          quaternion: new THREE.Quaternion(),
        })
      }
    }
  }
  return cubies
}

function applyMove(cubies, input) {
  const move = canonicalMove(input)
  assert.ok(move, `非法测试动作：${input}`)
  const definition = MOVE_DEFINITIONS[move[0]]
  const amount = moveAmount(move)
  const axisName = definition.axis.x ? 'x' : definition.axis.y ? 'y' : 'z'
  const rotation = new THREE.Quaternion().setFromAxisAngle(definition.axis, definition.angle * amount)

  cubies
    .filter((cubie) => Math.round(cubie.grid[axisName]) === definition.layer)
    .forEach((cubie) => {
      cubie.grid = roundedGrid(cubie.grid.clone().applyQuaternion(rotation))
      cubie.quaternion = snapQuaternion(cubie.quaternion.clone().premultiply(rotation))
    })
}

function isSolved(cubies) {
  return cubies.every((cubie) => (
    cubie.grid.equals(cubie.initialGrid)
    && Math.abs(cubie.quaternion.dot(new THREE.Quaternion())) > 0.999999
  ))
}

function assertUniquePositions(cubies) {
  const positions = new Set(cubies.map(({ grid }) => `${grid.x},${grid.y},${grid.z}`))
  assert.equal(positions.size, 27, '转动后 27 个小方块的逻辑坐标不得重叠')
}

// 1. 单面连续四次 90° 必须完全复原。
for (const face of Object.keys(MOVE_DEFINITIONS)) {
  const cubies = createState()
  for (let i = 0; i < 4; i += 1) applyMove(cubies, face)
  assert.ok(isSolved(cubies), `${face} 连续四次转动未复原`)
}

// 2. 公式后紧接逆公式必须复原。
const algorithms = [
  ["R", "U", "R'", "U'"],
  ["F", "R", "U", "R'", "U'", "F'"],
  ["R2", "U2", "F2", "D2", "L2", "B2"],
  ["R", "U", "F2", "L'", "D", "B2", "R'", "U2"],
]

for (const algorithm of algorithms) {
  const cubies = createState()
  algorithm.forEach((move) => applyMove(cubies, move))
  assertUniquePositions(cubies)
  algorithm.slice().reverse().map(inverseMove).forEach((move) => applyMove(cubies, move))
  assert.ok(isSolved(cubies), `公式 ${algorithm.join(' ')} 加逆公式未复原`)
}

// 3. 模拟随机长序列，持续保持合法的 3×3×3 占位集合。
const faces = Object.keys(MOVE_DEFINITIONS)
const suffixes = ['', "'", '2']
const cubies = createState()
const randomMoves = Array.from({ length: 180 }, (_, index) => `${faces[(index * 5 + 1) % faces.length]}${suffixes[index % suffixes.length]}`)
randomMoves.forEach((move) => {
  applyMove(cubies, move)
  assertUniquePositions(cubies)
})
randomMoves.slice().reverse().map(inverseMove).forEach((move) => applyMove(cubies, move))
assert.ok(isSolved(cubies), '长序列加逆序未复原')

console.log('✓ 魔方逻辑自检通过：单面循环、公式逆序、长序列坐标唯一性均正常。')
