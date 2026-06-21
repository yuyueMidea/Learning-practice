<template>
  <table>
    <thead>
      <tr>
        <th>Project</th>
        <th>Role</th>
        <th>Work Type</th>
        <th>Task Nature</th>
        <th>Module</th>
        <th>Ticket</th>
        <th class="num">Hours</th>
        <th>Action</th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="(e, i) in ENTRIES"
        :key="i"
        style="cursor: pointer"
        @click="router.push('/add-entry')"
      >
        <td>{{ e.project }}</td>
        <td>{{ e.role }}</td>
        <td>{{ e.workType }}</td>
        <td>{{ e.taskNature }}</td>
        <td>{{ e.module }}</td>
        <td>
          <span v-if="e.ticket !== '—'" class="kbd">{{ e.ticket }}</span>
          <span v-else>—</span>
        </td>
        <td class="num">{{ e.hours.toFixed(1) }}</td>
        <td>Edit</td>
      </tr>
    </tbody>
  </table>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ENTRIES } from '@/data/mockData'

const router = useRouter()
</script>
