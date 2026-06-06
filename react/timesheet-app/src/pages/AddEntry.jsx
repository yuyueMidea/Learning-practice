import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import PageHead from '../components/PageHead';
import { TICKETS } from '../data/mockData';

export default function AddEntry() {
  const navigate = useNavigate();
  const [selectedTicket, setSelectedTicket] = useState('CRM-1023');

  return (
    <AppShell>
      <PageHead
        title="Add / Edit Time Entry"
        desc="Create or update a daily time entry. Jira lookup is mocked for review."
        actions={<button className="btn" onClick={() => navigate('/timesheet')}>Back</button>}
      />

      <div className="modal-screen card">
        <div className="grid two">
          <div className="field">
            <label>Work Date <span className="required">*</span></label>
            <input className="input" defaultValue="04/06/2026" />
          </div>
          <div className="field">
            <label>Project <span className="required">*</span></label>
            <select className="select">
              <option>Core CRM Project</option>
              <option>Finance Portal</option>
              <option>Internal Support</option>
            </select>
          </div>
          <div className="field">
            <label>Role <span className="required">*</span></label>
            <select className="select">
              <option>Developer</option>
              <option>Tester</option>
              <option>Business Analyst</option>
              <option>Project Manager</option>
            </select>
          </div>
          <div className="field">
            <label>Work Type <span className="required">*</span></label>
            <select className="select">
              <option>Project</option>
              <option>BAU</option>
              <option>Internal</option>
              <option>Leave</option>
            </select>
          </div>
          <div className="field">
            <label>Task Nature <span className="required">*</span></label>
            <select className="select">
              <option>Bug Fix</option>
              <option>Development</option>
              <option>Testing</option>
              <option>Meeting</option>
            </select>
          </div>
          <div className="field">
            <label>Module <span className="required">*</span></label>
            <select className="select">
              <option>Billing</option>
              <option>Login</option>
              <option>Payment</option>
              <option>General</option>
            </select>
          </div>
        </div>

        <br />

        <div className="field">
          <label>Jira Ticket</label>
          <input className="input" defaultValue="payment timeout" />
          <div className="hint">Search by ticket number or keyword. Suggestions below are mocked.</div>
        </div>

        {TICKETS.map((t) => (
          <div
            key={t.id}
            className={`ticket-card ${selectedTicket === t.id ? 'selected' : ''}`}
            onClick={() => setSelectedTicket(t.id)}
          >
            <div className="ticket-title">{t.title}</div>
            <div className="ticket-meta">{t.meta}</div>
          </div>
        ))}

        <br />

        <div className="field">
          <label>Selected Ticket</label>
          <input className="input" value={TICKETS.find(t => t.id === selectedTicket)?.title || ''} readOnly />
        </div>

        <br />

        <div className="grid two">
          <div className="field">
            <label>Hours <span className="required">*</span></label>
            <input className="input" type="number" step="0.25" defaultValue="2.5" />
          </div>
          <div className="notice">
            The system warns when the total recorded hours for a day exceed 8 hours, but does not block submission.
          </div>
        </div>

        <br />

        <div className="field">
          <label>Description</label>
          <textarea className="textarea" defaultValue="Investigated API timeout and added retry logic." />
        </div>

        <br />

        <div style={{ textAlign: 'right' }}>
          <button className="btn" onClick={() => navigate('/timesheet')}>Cancel</button>{' '}
          <button className="btn primary" onClick={() => navigate('/timesheet')}>Save Entry</button>
        </div>
      </div>
    </AppShell>
  );
}
