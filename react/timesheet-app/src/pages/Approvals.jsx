import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import flatpickr from 'flatpickr';
import 'flatpickr/dist/flatpickr.min.css';
import AppShell from '../components/AppShell';
import PageHead from '../components/PageHead';
import { APPROVALS } from '../data/mockData';

export default function Approvals() {
  const navigate = useNavigate();
  const pickerRef = useRef(null);

  useEffect(() => {
    const fp = flatpickr(pickerRef.current, {
      mode: 'range',
      dateFormat: 'd/m/Y',
      defaultDate: ['01/06/2026', '07/06/2026'],
    });
    return () => fp.destroy();
  }, []);

  return (
    <AppShell>
      <PageHead
        title="Approval Inbox"
        desc="Review and approve submitted timesheets."
        actions={
          <button className="btn primary" onClick={() => navigate('/approval-detail')}>
            Review Timesheet →
          </button>
        }
      />

      <div className="card">
        <div style={{ display: 'flex', gap: 10 }}>
          <span className="status pending">Pending Approval 12</span>
          <span className="status approved">Approved</span>
          <span className="status rejected">Rejected</span>
        </div>

        <br />

        <div className="grid four">
          <div className="field">
            <label>Period</label>
            <input ref={pickerRef} className="input date-range-picker" type="text" readOnly />
          </div>
          <div className="field">
            <label>Department</label>
            <select className="select">
              <option>All Departments</option>
              <option>Application Development</option>
              <option>QA Team</option>
            </select>
          </div>
          <div className="field">
            <label>Employee</label>
            <input className="input" placeholder="Search employee..." />
          </div>
          <div className="field">
            <label>&nbsp;</label>
            <button className="btn primary" style={{ width: '100%', justifyContent: 'center' }}>
              Search
            </button>
          </div>
        </div>

        <br />

        <table>
          <thead>
            <tr>
              <th>☐</th>
              <th>Employee</th>
              <th>Department</th>
              <th>Period</th>
              <th className="num">Hours</th>
              <th>Submitted</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {APPROVALS.map((a, i) => (
              <tr key={i} onClick={() => navigate('/approval-detail')} style={{ cursor: 'pointer' }}>
                <td>☐</td>
                <td>{a.employee}</td>
                <td>{a.dept}</td>
                <td>{a.period}</td>
                <td className="num">{a.hours.toFixed(1)}</td>
                <td>{a.submitted}</td>
                <td><span className="status pending">{a.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>

        <br />
        <div style={{ display: 'flex' }}>
          <b>Selected: 0</b>
          <div className="spacer" />
          <button className="btn">Approve Selected</button>
          <button className="btn primary" onClick={() => navigate('/approval-detail')}>
            Review Timesheet →
          </button>
        </div>
      </div>
    </AppShell>
  );
}
