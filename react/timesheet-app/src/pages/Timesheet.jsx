import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import PageHead from '../components/PageHead';
import EntriesTable from '../components/EntriesTable';
import { DAYS } from '../data/mockData';

export default function Timesheet() {
  const navigate = useNavigate();
  const [selectedDay, setSelectedDay] = useState('mon');

  return (
    <AppShell>
      <PageHead
        title="My Timesheet"
        desc="Record and submit your weekly working hours."
        actions={
          <>
            <button className="btn ghost" onClick={() => navigate('/submit')}>Submit Week</button>
            <button className="btn primary" onClick={() => navigate('/add-entry')}>+ Add Time Entry</button>
          </>
        }
      />

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="btn">‹ Previous Week</button>
          <div style={{ fontWeight: 850, fontSize: 18 }}>01/06/2026 - 07/06/2026</div>
          <button className="btn">Next Week ›</button>
          <div className="spacer" />
          <span className="status draft">Draft</span>
          <span className="pill">Weekly Total: 38.5 / 40 Hours</span>
        </div>
        <div className="daybar">
          {DAYS.map((d) => (
            <div
              key={d.id}
              className={`day ${selectedDay === d.id ? 'active' : ''}`}
              onClick={() => setSelectedDay(d.id)}
            >
              <div className="d">{d.label}</div>
              <div className={`h ${d.cls}`}>{d.hours}</div>
            </div>
          ))}
        </div>
      </div>

      <br />

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <b>Entries for Monday, 01/06/2026</b>
            <div className="hint">Click a row to edit the entry.</div>
          </div>
          <div className="spacer" />
          <button className="btn" onClick={() => navigate('/add-entry')}>+ Add Time Entry</button>
        </div>
        <EntriesTable />
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 16 }}>
          <b>Total for selected day: 8.0 Hours</b>
          <div className="spacer" />
          <button className="btn">Copy Previous Day</button>
          <button className="btn">Copy Selected Entry</button>
          <button className="btn primary" onClick={() => navigate('/submit')}>Submit Week</button>
        </div>
      </div>
    </AppShell>
  );
}
