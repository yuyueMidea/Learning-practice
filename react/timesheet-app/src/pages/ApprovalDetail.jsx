import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import PageHead from '../components/PageHead';
import EntriesTable from '../components/EntriesTable';

export default function ApprovalDetail() {
  const navigate = useNavigate();

  return (
    <AppShell>
      <PageHead
        title="Timesheet Approval Detail"
        desc="Review weekly entries and approve or reject the submitted timesheet."
        actions={<button className="btn" onClick={() => navigate('/approvals')}>Back to Inbox</button>}
      />

      <div className="card">
        <div className="grid four">
          <div><div className="hint">Employee</div><b>Chris Wong</b></div>
          <div><div className="hint">Department</div><b>Application Development</b></div>
          <div><div className="hint">Period</div><b>01/06/2026 - 07/06/2026</b></div>
          <div><div className="hint">Weekly Total</div><b>38.5 Hours</b></div>
        </div>

        <br />

        <div className="progress">
          <div className="step done">
            <span className="circle">1</span>Submitted
          </div>
          <div className="step current">
            <span className="circle">2</span>Supervisor Review
          </div>
          <div className="step">
            <span className="circle">3</span>Second-level Review
          </div>
        </div>

        <br />

        <h3>
          Monday, 01/06/2026 <span className="pill">Total: 8.0 Hours</span>
        </h3>
        <EntriesTable />

        <br />
        <div className="notice">
          Tuesday and Thursday are below standard working hours. Supervisor may approve or reject with comments.
        </div>

        <br />
        <div className="field">
          <label>Employee Note</label>
          <div className="input">Project support activity caused minor variation in daily hours.</div>
        </div>

        <br />
        <div className="field">
          <label>Approval Comment</label>
          <textarea className="textarea" placeholder="Add a comment..." />
        </div>

        <br />
        <div style={{ display: 'flex' }}>
          <button className="btn danger">Reject Timesheet</button>
          <div className="spacer" />
          <button className="btn primary" onClick={() => navigate('/approvals')}>Approve Timesheet</button>
        </div>
      </div>
    </AppShell>
  );
}
