import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

function createManualChunk(id) {
  if (!id.includes('node_modules')) return undefined
  if (id.includes('/node_modules/@supabase/')) return 'supabase'
  if (id.includes('/node_modules/xlsx/')) return 'xlsx'
  if (id.includes('/node_modules/element-plus/') || id.includes('/node_modules/@element-plus/')) return 'element-plus'
  if (
    id.includes('/node_modules/vue/') ||
    id.includes('/node_modules/@vue/') ||
    id.includes('/node_modules/vue-router/') ||
    id.includes('/node_modules/pinia/')
  ) {
    return 'vue-core'
  }
  return 'vendor'
}

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: true
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: createManualChunk
      }
    }
  }
})
