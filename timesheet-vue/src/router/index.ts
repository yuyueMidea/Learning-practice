import { createRouter, createWebHistory } from 'vue-router'
import SignIn        from '@/pages/SignIn.vue'
import Timesheet     from '@/pages/Timesheet.vue'
import AddEntry      from '@/pages/AddEntry.vue'
import Submit        from '@/pages/Submit.vue'
import Approvals     from '@/pages/Approvals.vue'
import ApprovalDetail from '@/pages/ApprovalDetail.vue'
import Report        from '@/pages/Report.vue'
import Organisation  from '@/pages/Organisation.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/',                  redirect: '/signin' },
    { path: '/signin',            component: SignIn },
    { path: '/timesheet',         component: Timesheet },
    { path: '/add-entry',         component: AddEntry },
    { path: '/submit',            component: Submit },
    { path: '/approvals',         component: Approvals },
    { path: '/approval-detail',   component: ApprovalDetail },
    { path: '/report',            component: Report },
    { path: '/organisation',      component: Organisation },
    { path: '/:pathMatch(.*)*',   redirect: '/signin' },
  ],
})

export default router
