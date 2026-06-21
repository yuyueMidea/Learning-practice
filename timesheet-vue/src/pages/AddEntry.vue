<template>
  <AppShell>
    <PageHead
      title="Add / Edit Time Entry"
      desc="Create or update a daily time entry. Jira lookup is mocked for review."
    >
      <template #actions>
        <button class="btn" @click="router.push('/timesheet')">Back</button>
      </template>
    </PageHead>

    <div class="modal-screen card">
      <div class="grid two">
        <div class="field">
          <label>Work Date <span class="required">*</span></label>
          <input class="input" value="04/06/2026" />
        </div>
        <div class="field">
          <label>Project <span class="required">*</span></label>
          <select class="select">
            <option>Core CRM Project</option>
            <option>Finance Portal</option>
            <option>Internal Support</option>
          </select>
        </div>
        <div class="field">
          <label>Role <span class="required">*</span></label>
          <select class="select">
            <option>Developer</option>
            <option>Tester</option>
            <option>Business Analyst</option>
            <option>Project Manager</option>
          </select>
        </div>
        <div class="field">
          <label>Work Type <span class="required">*</span></label>
          <select class="select">
            <option>Project</option>
            <option>BAU</option>
            <option>Internal</option>
            <option>Leave</option>
          </select>
        </div>
        <div class="field">
          <label>Task Nature <span class="required">*</span></label>
          <select class="select">
            <option>Bug Fix</option>
            <option>Development</option>
            <option>Testing</option>
            <option>Meeting</option>
          </select>
        </div>
        <div class="field">
          <label>Module <span class="required">*</span></label>
          <select class="select">
            <option>Billing</option>
            <option>Login</option>
            <option>Payment</option>
            <option>General</option>
          </select>
        </div>
      </div>

      <br />

      <div class="field">
        <label>Jira Ticket</label>
        <input class="input" value="payment timeout" />
        <div class="hint">Search by ticket number or keyword. Suggestions below are mocked.</div>
      </div>

      <div
        v-for="t in TICKETS"
        :key="t.id"
        :class="['ticket-card', selectedTicket === t.id ? 'selected' : '']"
        @click="selectedTicket = t.id"
      >
        <div class="ticket-title">{{ t.title }}</div>
        <div class="ticket-meta">{{ t.meta }}</div>
      </div>

      <br />

      <div class="field">
        <label>Selected Ticket</label>
        <input class="input" :value="TICKETS.find(t => t.id === selectedTicket)?.title ?? ''" readonly />
      </div>

      <br />

      <div class="grid two">
        <div class="field">
          <label>Hours <span class="required">*</span></label>
          <input class="input" type="number" step="0.25" value="2.5" />
        </div>
        <div class="notice">
          The system warns when the total recorded hours for a day exceed 8 hours, but does not block submission.
        </div>
      </div>

      <br />

      <div class="field">
        <label>Description</label>
        <textarea class="textarea">Investigated API timeout and added retry logic.</textarea>
      </div>

      <br />

      <div style="text-align: right">
        <button class="btn" @click="router.push('/timesheet')">Cancel</button>
        {{ ' ' }}
        <button class="btn primary" @click="router.push('/timesheet')">Save Entry</button>
      </div>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppShell from '@/components/AppShell.vue'
import PageHead from '@/components/PageHead.vue'
import { TICKETS } from '@/data/mockData'

const router = useRouter()
const selectedTicket = ref('CRM-1023')
</script>
