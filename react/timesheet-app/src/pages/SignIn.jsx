import { useNavigate } from 'react-router-dom';

export default function SignIn() {
  const navigate = useNavigate();
  return (
    <>
      <div className="topbar">
        <div className="logo">TS</div>
        <div>
          <div className="product">Timesheet Management System</div>
          <div className="sub">Internal Staff Portal</div>
        </div>
        <div className="spacer" />
        <span className="pill">Static clickable prototype</span>
      </div>
      <div className="signin-wrap">
        <div className="signin card">
          <div className="center">
            <div className="brand-mark">TS</div>
            <h1 className="login-title">Timesheet Management System</h1>
            <div className="login-sub">Internal Staff Portal</div>
          </div>
          <div className="field">
            <label>Company Email</label>
            <input className="input" defaultValue="chris.wong@company.com" />
          </div>
          <br />
          <div className="field">
            <label>Password</label>
            <input type="password" className="input" defaultValue="password" />
          </div>
          <br />
          <label style={{ fontSize: 13, color: '#475467' }}>
            <input type="checkbox" /> Remember me
          </label>
          <br /><br />
          <button
            className="btn primary"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => navigate('/timesheet')}
          >
            Sign In
          </button>
          <div className="footer-note">For internal use only · Forgot password?</div>
        </div>
      </div>
    </>
  );
}
