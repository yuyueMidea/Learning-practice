import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import PageHead from '../components/PageHead';
import { SUBMIT_DAYS } from '../data/mockData';

export default function Submit() {
  const navigate = useNavigate();

  return (
    <AppShell>
      <PageHead
        title="Submit Timesheet"
        desc="Review your weekly timesheet before submission."
        actions={<button className="btn" onClick={() => navigate('/timesheet')}>Back to Edit</button>}
      />

      <div className="card">
        <div className="grid four">
          <div><div className="hint">Employee</div><b>Chris Wong</b></div>
          <div><div className="hint">Department</div><b>Application Development</b></div>
          <div><div className="hint">Period</div><b>01/06/2026 - 07/06/2026</b></div>
          <div><div className="hint">Weekly Total</div><b>38.5 Hours</b></div>
        </div>

        <br />
        <h3>Daily Summary</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th className="num">Total Hours</th>
              <th>Validation</th>
            </tr>
          </thead>
          <tbody>
            {SUBMIT_DAYS.map((d, i) => (
              <tr key={i}>
                <td>{d.date}</td>
                <td className="num">{d.hours.toFixed(1)}</td>
                <td><span className={`status ${d.cls}`}>{d.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>

        <br />
        <h3>Approval Route</h3>
        <div className="route">
          <span className="node">Chris Wong</span>
          <span className="arrow">→</span>
          <span className="node">Mary Chan</span>
          <span className="arrow">→</span>
          <span className="node">David Lee</span>
        </div>

        <div className="field">
          <label>Submission Note</label>
          <textarea className="textarea" placeholder="Optional note to your supervisor..." />
        </div>

        <br />
        <div style={{ textAlign: 'right' }}>
          <button className="btn" onClick={() => navigate('/timesheet')}>Back to Edit</button>{' '}
          <button className="btn primary" onClick={() => navigate('/approvals')}>Submit for Approval</button>
        </div>
      </div>
    </AppShell>
  );
}
