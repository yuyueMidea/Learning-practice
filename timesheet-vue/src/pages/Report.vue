<template>
  <AppShell>
    <PageHead
      title="Project Hours Report"
      desc="Analyse approved working hours by project, team and task category."
    >
      <template #actions>
        <button class="btn">Export Excel</button>
      </template>
    </PageHead>

    <!-- Filters -->
    <div class="card">
      <div class="grid four">
        <div class="field">
          <label>Date Range</label>
          <input class="input" value="01/06/2026 - 30/06/2026" />
        </div>
        <div class="field">
          <label>Project</label>
          <select class="select"><option>All Projects</option></select>
        </div>
        <div class="field">
          <label>Department</label>
          <select class="select"><option>All Departments</option></select>
        </div>
        <div class="field">
          <label>Employee</label>
          <input class="input" placeholder="All Employees" />
        </div>
        <div class="field">
          <label>Module</label>
          <select class="select"><option>All Modules</option></select>
        </div>
        <div class="field">
          <label>Work Type</label>
          <select class="select"><option>All Types</option></select>
        </div>
        <div class="field">
          <label>Task Nature</label>
          <select class="select"><option>All Task Natures</option></select>
        </div>
        <div class="field">
          <label>Ticket No.</label>
          <input class="input" placeholder="Search Jira ticket..." />
        </div>
      </div>
      <br />
      <button class="btn primary">Apply Filters</button>
      {{ ' ' }}
      <button class="btn">Reset</button>
    </div>

    <br />

    <!-- Summary stats -->
    <div class="grid four">
      <div class="summary-stat">
        <div class="label">Total Approved Hours</div>
        <div class="value">1,248.5h</div>
        <div class="small">Jun 2026</div>
      </div>
      <div class="summary-stat">
        <div class="label">Project Hours</div>
        <div class="value">985.0h</div>
        <div class="small">78.9% of total</div>
      </div>
      <div class="summary-stat">
        <div class="label">Internal Hours</div>
        <div class="value">263.5h</div>
        <div class="small">21.1% of total</div>
      </div>
      <div class="summary-stat">
        <div class="label">Employees</div>
        <div class="value">42</div>
        <div class="small">Approved data only</div>
      </div>
    </div>

    <br />

    <!-- Charts + Records -->
    <div class="card">
      <h3>Hours by Project</h3>
      <div v-for="(r, i) in REPORT_PROJECTS" :key="i" class="chart-row">
        <b>{{ r.name }}</b>
        <div class="bar"><span :style="{ width: r.pct + '%' }" /></div>
        <div>{{ r.hours }}</div>
      </div>

      <br />
      <h3>Detailed Records</h3>
      <table>
        <thead>
          <tr>
            <th>Employee</th>
            <th>Date</th>
            <th>Project</th>
            <th>Module</th>
            <th>Ticket</th>
            <th class="num">Hours</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in REPORT_RECORDS" :key="i">
            <td>{{ r.employee }}</td>
            <td>{{ r.date }}</td>
            <td>{{ r.project }}</td>
            <td>{{ r.module }}</td>
            <td>{{ r.ticket }}</td>
            <td class="num">{{ r.hours.toFixed(1) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import AppShell from '@/components/AppShell.vue'
import PageHead from '@/components/PageHead.vue'
import { REPORT_PROJECTS, REPORT_RECORDS } from '@/data/mockData'
</script>
