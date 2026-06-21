<template>
  <AppShell>
    <PageHead
      title="My Timesheet"
      desc="Record and submit your weekly working hours."
    >
      <template #actions>
        <button class="btn ghost" @click="router.push('/submit')">Submit Week</button>
        <button class="btn primary" @click="router.push('/add-entry')">+ Add Time Entry</button>
      </template>
    </PageHead>

    <!-- Week navigator -->
    <div class="card">
      <div style="display: flex; align-items: center; gap: 14px">
        <button class="btn">‹ Previous Week</button>
        <div style="font-weight: 850; font-size: 18px">01/06/2026 - 07/06/2026</div>
        <button class="btn">Next Week ›</button>
        <div class="spacer" />
        <span class="status draft">Draft</span>
        <span class="pill">Weekly Total: 38.5 / 40 Hours</span>
      </div>

      <!-- Day bar -->
      <div class="daybar">
        <div
          v-for="d in DAYS"
          :key="d.id"
          :class="['day', selectedDay === d.id ? 'active' : '']"
          @click="selectedDay = d.id"
        >
          <div class="d">{{ d.label }}</div>
          <div :class="['h', d.cls]">{{ d.hours }}</div>
        </div>
      </div>
    </div>

    <br />

    <!-- Entries card -->
    <div class="card">
      <div style="display: flex; align-items: center; margin-bottom: 12px">
        <div>
          <b>Entries for Monday, 01/06/2026</b>
          <div class="hint">Click a row to edit the entry.</div>
        </div>
        <div class="spacer" />
        <button class="btn" @click="router.push('/add-entry')">+ Add Time Entry</button>
      </div>

      <EntriesTable />

      <div style="display: flex; align-items: center; margin-top: 16px">
        <b>Total for selected day: 8.0 Hours</b>
        <div class="spacer" />
        <button class="btn">Copy Previous Day</button>
        <button class="btn">Copy Selected Entry</button>
        <button class="btn primary" @click="router.push('/submit')">Submit Week</button>
      </div>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppShell from '@/components/AppShell.vue'
import PageHead from '@/components/PageHead.vue'
import EntriesTable from '@/components/EntriesTable.vue'
import { DAYS } from '@/data/mockData'

const router = useRouter()
const selectedDay = ref('mon')
</script>
