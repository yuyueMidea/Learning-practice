import { useNavigate } from 'react-router-dom';
import { ENTRIES } from '../data/mockData';

export default function EntriesTable() {
  const navigate = useNavigate();
  return (
    <table>
      <thead>
        <tr>
          <th>Project</th>
          <th>Role</th>
          <th>Work Type</th>
          <th>Task Nature</th>
          <th>Module</th>
          <th>Ticket</th>
          <th className="num">Hours</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        {ENTRIES.map((e, i) => (
          <tr key={i} onClick={() => navigate('/add-entry')} style={{ cursor: 'pointer' }}>
            <td>{e.project}</td>
            <td>{e.role}</td>
            <td>{e.workType}</td>
            <td>{e.taskNature}</td>
            <td>{e.module}</td>
            <td>{e.ticket === '—' ? '—' : <span className="kbd">{e.ticket}</span>}</td>
            <td className="num">{e.hours.toFixed(1)}</td>
            <td>Edit</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
