import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './styles/global.css';

import SignIn        from './pages/SignIn';
import Timesheet     from './pages/Timesheet';
import AddEntry      from './pages/AddEntry';
import Submit        from './pages/Submit';
import Approvals     from './pages/Approvals';
import ApprovalDetail from './pages/ApprovalDetail';
import Report        from './pages/Report';
import Organisation  from './pages/Organisation';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"                 element={<Navigate to="/signin" replace />} />
        <Route path="/signin"           element={<SignIn />} />
        <Route path="/timesheet"        element={<Timesheet />} />
        <Route path="/add-entry"        element={<AddEntry />} />
        <Route path="/submit"           element={<Submit />} />
        <Route path="/approvals"        element={<Approvals />} />
        <Route path="/approval-detail"  element={<ApprovalDetail />} />
        <Route path="/report"           element={<Report />} />
        <Route path="/organisation"     element={<Organisation />} />
        <Route path="*"                 element={<Navigate to="/signin" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
