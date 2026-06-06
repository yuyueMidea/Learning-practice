import AppShell from '../components/AppShell';
import PageHead from '../components/PageHead';
import { ORG_EMPLOYEES } from '../data/mockData';

export default function Organisation() {
  return (
    <AppShell>
      <PageHead
        title="Organisation & User Management"
        desc="Manage organisation units, reporting lines and system access."
        actions={<button className="btn primary">+ Add Employee</button>}
      />

      <div className="split">
        <div className="tree">
          <h3>Organisation Tree</h3>
          <ul>
            <li>▾ PCCW Group
              <ul>
                <li>▾ Technology
                  <ul>
                    <li>▾ IT Delivery
                      <ul>
                        <li className="active">▾ Application Development</li>
                        <li>▸ QA Team</li>
                        <li>▸ Support</li>
                      </ul>
                    </li>
                  </ul>
                </li>
                <li>▸ Finance</li>
                <li>▸ HR</li>
              </ul>
            </li>
          </ul>
          <div className="sponsor-note">
            Recommended pattern: left organisation tree + right employee table. This is clearer than a single huge expandable table.
          </div>
        </div>

        <div>
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0 }}>Employees</h3>
                <div className="hint">Department: Application Development</div>
              </div>
              <div className="spacer" />
              <input className="input" style={{ width: 240 }} placeholder="Search employee..." />
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
                {ORG_EMPLOYEES.map((e, i) => (
                  <tr key={i}>
                    <td>{e.name}</td>
                    <td>{e.email}</td>
                    <td>{e.supervisor}</td>
                    <td>{e.second}</td>
                    <td>{e.role}</td>
                    <td><span className="status approved">{e.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <br />

          <div className="drawer">
            <h3>Employee Details</h3>
            <div className="grid two">
              <div className="field">
                <label>Full Name</label>
                <input className="input" defaultValue="Chris Wong" />
              </div>
              <div className="field">
                <label>Company Email</label>
                <input className="input" defaultValue="chris@company.com" />
              </div>
              <div className="field">
                <label>Organisation Unit</label>
                <select className="select"><option>Application Development</option></select>
              </div>
              <div className="field">
                <label>Direct Supervisor</label>
                <select className="select"><option>Mary Chan</option></select>
              </div>
              <div className="field">
                <label>Second-level Supervisor</label>
                <select className="select"><option>David Lee</option></select>
              </div>
              <div className="field">
                <label>Account Status</label>
                <select className="select">
                  <option>Active</option>
                  <option>Suspended</option>
                </select>
              </div>
            </div>
            <br />
            <div>
              <b>System Roles</b><br />
              <label><input type="checkbox" defaultChecked /> Employee</label>
              {' '}&nbsp;
              <label><input type="checkbox" /> Supervisor</label>
              {' '}&nbsp;
              <label><input type="checkbox" /> Project Manager</label>
              {' '}&nbsp;
              <label><input type="checkbox" /> System Administrator</label>
            </div>
            <br />
            <button className="btn primary">Save Changes</button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
