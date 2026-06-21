<template>
  <AppShell>
    <PageHead
      title="Approval Inbox"
      desc="Review and approve submitted timesheets."
    >
      <template #actions>
        <button class="btn primary" @click="router.push('/approval-detail')">
          Review Timesheet →
        </button>
      </template>
    </PageHead>

    <div class="card">
      <div style="display: flex; gap: 10px">
        <span class="status pending">Pending Approval 12</span>
        <span class="status approved">Approved</span>
        <span class="status rejected">Rejected</span>
      </div>

      <br />

      <div class="grid four">
        <div class="field">
          <label>Period</label>
          <input ref="pickerRef" class="input date-range-picker" type="text" readonly />
        </div>
        <div class="field">
          <label>Department</label>
          <select class="select">
            <option>All Departments</option>
            <option>Application Development</option>
            <option>QA Team</option>
          </select>
        </div>
        <div class="field">
          <label>Employee</label>
          <input class="input" placeholder="Search employee..." />
        </div>
        <div class="field">
          <label>&nbsp;</label>
          <button class="btn primary" style="width: 100%; justify-content: center">
            Search
          </button>
        </div>
      </div>

      <br />

      <table>
        <thead>
          <tr>
            <th>☐</th>
            <th>Employee</th>
            <th>Department</th>
            <th>Period</th>
            <th class="num">Hours</th>
            <th>Submitted</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(a, i) in APPROVALS"
            :key="i"
            style="cursor: pointer"
            @click="router.push('/approval-detail')"
          >
            <td>☐</td>
            <td>{{ a.employee }}</td>
            <td>{{ a.dept }}</td>
            <td>{{ a.period }}</td>
            <td class="num">{{ a.hours.toFixed(1) }}</td>
            <td>{{ a.submitted }}</td>
            <td><span class="status pending">{{ a.status }}</span></td>
          </tr>
        </tbody>
      </table>

      <br />
      <div style="display: flex">
        <b>Selected: 0</b>
        <div class="spacer" />
        <button class="btn">Approve Selected</button>
        <button class="btn primary" @click="router.push('/approval-detail')">
          Review Timesheet →
        </button>
      </div>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import flatpickr from 'flatpickr'
import 'flatpickr/dist/flatpickr.min.css'
import AppShell from '@/components/AppShell.vue'
import PageHead from '@/components/PageHead.vue'
import { APPROVALS } from '@/data/mockData'

const router = useRouter()
const pickerRef = ref<HTMLInputElement | null>(null)
let fp: ReturnType<typeof flatpickr> | null = null

onMounted(() => {
  if (pickerRef.value) {
    fp = flatpickr(pickerRef.value, {
      mode: 'range',
      dateFormat: 'd/m/Y',
      defaultDate: ['01/06/2026', '07/06/2026'],
    })
  }
})

onBeforeUnmount(() => {
  if (fp && typeof (fp as { destroy?: () => void }).destroy === 'function') {
    (fp as { destroy: () => void }).destroy()
  }
})
</script>
