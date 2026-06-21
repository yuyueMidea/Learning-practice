export interface Page {
  id: string
  label: string
  icon: string
}

export interface Day {
  id: string
  label: string
  hours: string
  cls: string
}

export interface Entry {
  project: string
  role: string
  workType: string
  taskNature: string
  module: string
  ticket: string
  hours: number
}

export interface Approval {
  employee: string
  dept: string
  period: string
  hours: number
  submitted: string
  status: string
}

export interface ReportProject {
  name: string
  pct: number
  hours: string
}

export interface ReportRecord {
  employee: string
  date: string
  project: string
  module: string
  ticket: string
  hours: number
}

export interface OrgEmployee {
  name: string
  email: string
  supervisor: string
  second: string
  role: string
  status: string
}

export interface SubmitDay {
  date: string
  hours: number
  status: string
  cls: string
}

export interface Ticket {
  id: string
  title: string
  meta: string
}

export const PAGES: Page[] = [
  { id: 'timesheet',       label: 'My Timesheet',           icon: '🗓️' },
  { id: 'add-entry',       label: 'Add / Edit Entry',        icon: '➕' },
  { id: 'submit',          label: 'Submit Timesheet',        icon: '📤' },
  { id: 'approvals',       label: 'Approval Inbox',          icon: '✅' },
  { id: 'approval-detail', label: 'Approval Detail',         icon: '🔎' },
  { id: 'report',          label: 'Project Hours Report',    icon: '📊' },
  { id: 'organisation',    label: 'Organisation & Users',    icon: '🏢' },
]

export const DAYS: Day[] = [
  { id: 'mon', label: 'Mon 01 Jun', hours: '8.0h', cls: 'ok' },
  { id: 'tue', label: 'Tue 02 Jun', hours: '7.5h', cls: 'warn' },
  { id: 'wed', label: 'Wed 03 Jun', hours: '8.0h', cls: 'ok' },
  { id: 'thu', label: 'Thu 04 Jun', hours: '7.0h', cls: 'warn' },
  { id: 'fri', label: 'Fri 05 Jun', hours: '8.0h', cls: 'ok' },
  { id: 'sat', label: 'Sat 06 Jun', hours: '0.0h', cls: 'zero' },
  { id: 'sun', label: 'Sun 07 Jun', hours: '0.0h', cls: 'zero' },
]

export const ENTRIES: Entry[] = [
  { project: 'Core CRM', role: 'Developer', workType: 'Project',  taskNature: 'Development', module: 'Billing', ticket: 'CRM-21', hours: 4.0 },
  { project: 'Core CRM', role: 'Developer', workType: 'Project',  taskNature: 'Bug Fix',     module: 'Billing', ticket: 'CRM-35', hours: 2.5 },
  { project: 'Internal', role: 'Developer', workType: 'Internal', taskNature: 'Meeting',     module: 'General', ticket: '—',       hours: 1.5 },
]

export const APPROVALS: Approval[] = [
  { employee: 'Chris Wong', dept: 'App Development', period: '01 Jun - 07 Jun', hours: 38.5, submitted: '08 Jun 09:20', status: 'Pending L1' },
  { employee: 'Amy Lau',    dept: 'App Development', period: '01 Jun - 07 Jun', hours: 40.0, submitted: '08 Jun 09:42', status: 'Pending L1' },
  { employee: 'Jason Ho',   dept: 'QA Team',         period: '01 Jun - 07 Jun', hours: 42.0, submitted: '08 Jun 10:15', status: 'Pending L1' },
]

export const REPORT_PROJECTS: ReportProject[] = [
  { name: 'Core CRM Project', pct: 72, hours: '520.5h' },
  { name: 'Finance Portal',   pct: 48, hours: '340.0h' },
  { name: 'Internal Support', pct: 36, hours: '263.5h' },
  { name: 'Mobile App',       pct: 20, hours: '125.0h' },
]

export const REPORT_RECORDS: ReportRecord[] = [
  { employee: 'Chris Wong', date: '04/06/2026', project: 'Core CRM', module: 'Billing', ticket: 'CRM-21', hours: 4.0 },
  { employee: 'Amy Lau',    date: '04/06/2026', project: 'Finance',  module: 'Payment', ticket: 'FIN-83', hours: 3.5 },
]

export const ORG_EMPLOYEES: OrgEmployee[] = [
  { name: 'Chris Wong', email: 'chris@company.com', supervisor: 'Mary Chan', second: 'David Lee', role: 'Employee',   status: 'Active' },
  { name: 'Amy Lau',    email: 'amy@company.com',   supervisor: 'Mary Chan', second: 'David Lee', role: 'Employee',   status: 'Active' },
  { name: 'Mary Chan',  email: 'mary@company.com',  supervisor: 'David Lee', second: 'Henry Ng',  role: 'Supervisor', status: 'Active' },
]

export const SUBMIT_DAYS: SubmitDay[] = [
  { date: 'Monday, 01 Jun',    hours: 8.0, status: 'Complete',             cls: 'approved' },
  { date: 'Tuesday, 02 Jun',   hours: 7.5, status: 'Below standard hours', cls: 'pending' },
  { date: 'Wednesday, 03 Jun', hours: 8.0, status: 'Complete',             cls: 'approved' },
  { date: 'Thursday, 04 Jun',  hours: 7.0, status: 'Below standard hours', cls: 'pending' },
  { date: 'Friday, 05 Jun',    hours: 8.0, status: 'Complete',             cls: 'approved' },
]

export const TICKETS: Ticket[] = [
  { id: 'CRM-1023', title: 'CRM-1023 — Payment API timeout',   meta: 'Status: In Progress · Project: Core CRM' },
  { id: 'CRM-1038', title: 'CRM-1038 — Billing page UI issue', meta: 'Status: Open · Project: Core CRM' },
]
