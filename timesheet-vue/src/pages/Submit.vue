<template>
  <AppShell>
    <PageHead
      title="Submit Timesheet"
      desc="Review your weekly timesheet before submission."
    >
      <template #actions>
        <button class="btn" @click="router.push('/timesheet')">Back to Edit</button>
      </template>
    </PageHead>

    <div class="card">
      <div class="grid four">
        <div><div class="hint">Employee</div><b>Chris Wong</b></div>
        <div><div class="hint">Department</div><b>Application Development</b></div>
        <div><div class="hint">Period</div><b>01/06/2026 - 07/06/2026</b></div>
        <div><div class="hint">Weekly Total</div><b>38.5 Hours</b></div>
      </div>

      <br />
      <h3>Daily Summary</h3>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th class="num">Total Hours</th>
            <th>Validation</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(d, i) in SUBMIT_DAYS" :key="i">
            <td>{{ d.date }}</td>
            <td class="num">{{ d.hours.toFixed(1) }}</td>
            <td><span :class="['status', d.cls]">{{ d.status }}</span></td>
          </tr>
        </tbody>
      </table>

      <br />
      <h3>Approval Route</h3>
      <div class="route">
        <span class="node">Chris Wong</span>
        <span class="arrow">→</span>
        <span class="node">Mary Chan</span>
        <span class="arrow">→</span>
        <span class="node">David Lee</span>
      </div>

      <div class="field">
        <label>Submission Note</label>
        <textarea class="textarea" placeholder="Optional note to your supervisor..." />
      </div>

      <br />
      <div style="text-align: right">
        <button class="btn" @click="router.push('/timesheet')">Back to Edit</button>
        {{ ' ' }}
        <button class="btn primary" @click="router.push('/approvals')">Submit for Approval</button>
      </div>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import AppShell from '@/components/AppShell.vue'
import PageHead from '@/components/PageHead.vue'
import { SUBMIT_DAYS } from '@/data/mockData'

const router = useRouter()
</script>
