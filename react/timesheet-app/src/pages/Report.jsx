import AppShell from '../components/AppShell';
import PageHead from '../components/PageHead';
import { REPORT_PROJECTS, REPORT_RECORDS } from '../data/mockData';

export default function Report() {
  return (
    <AppShell>
      <PageHead
        title="Project Hours Report"
        desc="Analyse approved working hours by project, team and task category."
        actions={<button className="btn">Export Excel</button>}
      />

      <div className="card">
        <div className="grid four">
          <div className="field">
            <label>Date Range</label>
            <input className="input" defaultValue="01/06/2026 - 30/06/2026" />
          </div>
          <div className="field">
            <label>Project</label>
            <select className="select"><option>All Projects</option></select>
          </div>
          <div className="field">
            <label>Department</label>
            <select className="select"><option>All Departments</option></select>
          </div>
          <div className="field">
            <label>Employee</label>
            <input className="input" placeholder="All Employees" />
          </div>
          <div className="field">
            <label>Module</label>
            <select className="select"><option>All Modules</option></select>
          </div>
          <div className="field">
            <label>Work Type</label>
            <select className="select"><option>All Types</option></select>
          </div>
          <div className="field">
            <label>Task Nature</label>
            <select className="select"><option>All Task Natures</option></select>
          </div>
          <div className="field">
            <label>Ticket No.</label>
            <input className="input" placeholder="Search Jira ticket..." />
          </div>
        </div>
        <br />
        <button className="btn primary">Apply Filters</button>{' '}
        <button className="btn">Reset</button>
      </div>

      <br />

      <div className="grid four">
        <div className="summary-stat">
          <div className="label">Total Approved Hours</div>
          <div className="value">1,248.5h</div>
          <div className="small">Jun 2026</div>
        </div>
        <div className="summary-stat">
          <div className="label">Project Hours</div>
          <div className="value">985.0h</div>
          <div className="small">78.9% of total</div>
        </div>
        <div className="summary-stat">
          <div className="label">Internal Hours</div>
          <div className="value">263.5h</div>
          <div className="small">21.1% of total</div>
        </div>
        <div className="summary-stat">
          <div className="label">Employees</div>
          <div className="value">42</div>
          <div className="small">Approved data only</div>
        </div>
      </div>

      <br />

      <div className="card">
        <h3>Hours by Project</h3>
        {REPORT_PROJECTS.map((r, i) => (
          <div className="chart-row" key={i}>
            <b>{r.name}</b>
            <div className="bar"><span style={{ width: `${r.pct}%` }} /></div>
            <div>{r.hours}</div>
          </div>
        ))}

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
              <th className="num">Hours</th>
            </tr>
          </thead>
          <tbody>
            {REPORT_RECORDS.map((r, i) => (
              <tr key={i}>
                <td>{r.employee}</td>
                <td>{r.date}</td>
                <td>{r.project}</td>
                <td>{r.module}</td>
                <td>{r.ticket}</td>
                <td className="num">{r.hours.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
