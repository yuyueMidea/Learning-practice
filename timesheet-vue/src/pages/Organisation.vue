<template>
  <AppShell>
    <PageHead
      title="Organisation & User Management"
      desc="Manage organisation units, reporting lines and system access."
    >
      <template #actions>
        <button class="btn primary">+ Add Employee</button>
      </template>
    </PageHead>

    <div class="split">
      <!-- Left: Org Tree -->
      <div class="tree">
        <h3>Organisation Tree</h3>
        <ul class="tree-root">
          <TreeNode
            v-for="node in ORG_TREE"
            :key="node.id"
            :node="node"
            :selected-id="selectedNode?.id ?? ''"
            :default-open="true"
            @select="selectedNode = $event"
          />
        </ul>
        <div class="sponsor-note">
          点击节点展开 / 收起，点击叶节点筛选右侧员工表。
        </div>
      </div>

      <!-- Right: Employee table + details -->
      <div>
        <div class="card">
          <div style="display: flex; align-items: center">
            <div>
              <h3 style="margin: 0">Employees</h3>
              <div class="hint">Department: {{ selectedNode?.label ?? 'All' }}</div>
            </div>
            <div class="spacer" />
            <input
              v-model="search"
              class="input"
              style="width: 240px"
              placeholder="Search employee..."
            />
          </div>
          <br />
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Supervisor</th>
                <th>Second-level</th>
                <th>Roles</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(e, i) in filteredEmployees"
                :key="i"
                style="cursor: pointer"
                :style="selectedEmployee?.name === e.name ? { background: '#f0f7ff' } : {}"
                @click="selectedEmployee = e"
              >
                <td>{{ e.name }}</td>
                <td>{{ e.email }}</td>
                <td>{{ e.supervisor }}</td>
                <td>{{ e.second }}</td>
                <td>{{ e.role }}</td>
                <td><span class="status approved">{{ e.status }}</span></td>
              </tr>
              <tr v-if="filteredEmployees.length === 0">
                <td colspan="6" style="text-align: center; color: #98a2b3">No employees found</td>
              </tr>
            </tbody>
          </table>
        </div>

        <br />

        <!-- Employee detail drawer -->
        <div v-if="selectedEmployee" class="drawer">
          <h3>Employee Details</h3>
          <div class="grid two">
            <div class="field">
              <label>Full Name</label>
              <input :key="selectedEmployee.name + '-name'" class="input" :value="selectedEmployee.name" />
            </div>
            <div class="field">
              <label>Company Email</label>
              <input :key="selectedEmployee.name + '-email'" class="input" :value="selectedEmployee.email" />
            </div>
            <div class="field">
              <label>Organisation Unit</label>
              <select class="select">
                <option>Application Development</option>
                <option>QA Team</option>
                <option>Finance</option>
                <option>HR</option>
              </select>
            </div>
            <div class="field">
              <label>Direct Supervisor</label>
              <select :key="selectedEmployee.name + '-sup'" class="select" :value="selectedEmployee.supervisor">
                <option>Mary Chan</option>
                <option>David Lee</option>
                <option>Henry Ng</option>
              </select>
            </div>
            <div class="field">
              <label>Second-level Supervisor</label>
              <select :key="selectedEmployee.name + '-sup2'" class="select" :value="selectedEmployee.second">
                <option>David Lee</option>
                <option>Henry Ng</option>
              </select>
            </div>
            <div class="field">
              <label>Account Status</label>
              <select class="select">
                <option>Active</option>
                <option>Suspended</option>
              </select>
            </div>
          </div>
          <br />
          <div>
            <b>System Roles</b><br />
            <label
              v-for="role in ['Employee', 'Supervisor', 'Project Manager', 'System Administrator']"
              :key="role"
              style="margin-right: 16px"
            >
              <input
                type="checkbox"
                :key="selectedEmployee.name + role"
                :checked="role === selectedEmployee.role"
              />
              {{ role }}
            </label>
          </div>
          <br />
          <button class="btn primary">Save Changes</button>
        </div>
      </div>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import AppShell from '@/components/AppShell.vue'
import PageHead from '@/components/PageHead.vue'
import TreeNode from '@/components/TreeNode.vue'
import { ORG_EMPLOYEES, type OrgEmployee } from '@/data/mockData'

interface OrgNode {
  id: string
  label: string
  children: OrgNode[]
}

const ORG_TREE: OrgNode[] = [
  {
    id: 'pccw',
    label: 'PCCW Group',
    children: [
      {
        id: 'tech',
        label: 'Technology',
        children: [
          {
            id: 'itd',
            label: 'IT Delivery',
            children: [
              { id: 'appdev',  label: 'Application Development', children: [] },
              { id: 'qa',      label: 'QA Team',                 children: [] },
              { id: 'support', label: 'Support',                 children: [] },
            ],
          },
        ],
      },
      { id: 'finance', label: 'Finance', children: [] },
      { id: 'hr',      label: 'HR',      children: [] },
    ],
  },
]

const selectedNode = ref<OrgNode | null>({ id: 'appdev', label: 'Application Development', children: [] })
const selectedEmployee = ref<OrgEmployee | null>(ORG_EMPLOYEES[0])
const search = ref('')

const filteredEmployees = computed(() =>
  ORG_EMPLOYEES.filter(
    (e) =>
      e.name.toLowerCase().includes(search.value.toLowerCase()) ||
      e.email.toLowerCase().includes(search.value.toLowerCase())
  )
)
</script>
