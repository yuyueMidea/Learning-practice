<template>
  <AppShell>
    <PageHead
      title="Timesheet Approval Detail"
      desc="Review weekly entries and approve or reject the submitted timesheet."
    >
      <template #actions>
        <button class="btn" @click="router.push('/approvals')">Back to Inbox</button>
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

      <!-- Progress steps -->
      <div class="progress">
        <div class="step done">
          <span class="circle">1</span>Submitted
        </div>
        <div class="step current">
          <span class="circle">2</span>Supervisor Review
        </div>
        <div class="step">
          <span class="circle">3</span>Second-level Review
        </div>
      </div>

      <br />

      <h3>
        Monday, 01/06/2026 <span class="pill">Total: 8.0 Hours</span>
      </h3>
      <EntriesTable />

      <br />
      <div class="notice">
        Tuesday and Thursday are below standard working hours. Supervisor may approve or reject with comments.
      </div>

      <br />
      <div class="field">
        <label>Employee Note</label>
        <div class="input">Project support activity caused minor variation in daily hours.</div>
      </div>

      <br />
      <div class="field">
        <label>Approval Comment</label>
        <textarea class="textarea" placeholder="Add a comment..." />
      </div>

      <br />
      <div style="display: flex">
        <button class="btn danger">Reject Timesheet</button>
        <div class="spacer" />
        <button class="btn primary" @click="router.push('/approvals')">Approve Timesheet</button>
      </div>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import AppShell from '@/components/AppShell.vue'
import PageHead from '@/components/PageHead.vue'
import EntriesTable from '@/components/EntriesTable.vue'

const router = useRouter()
</script>
