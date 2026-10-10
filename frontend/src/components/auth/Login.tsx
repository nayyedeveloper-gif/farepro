import React from 'react';
import { Link } from 'react-router-dom';
import AuthShell from './AuthShell';
import PhoneLoginPanel from './PhoneLoginPanel';

const Login: React.FC = () => {
  return (
    <AuthShell backTo="/" backLabel="Home">
      <div className="kl-auth-head">
        <h1>Sign in</h1>
        <p>Drivers and staff — use the phone number your stand registered.</p>
      </div>

      <PhoneLoginPanel />

      <div className="kl-auth-foot">
        <p>
          New here? <Link to="/register">Create a personal account</Link>
        </p>
        <p className="kl-auth-foot-alt">
          Fleet owner? <Link to="/org/signup">Set up your stand</Link>
          {' · '}
          <Link to="/org/signin">Open stand</Link>
        </p>
      </div>
    </AuthShell>
  );
};

export default Login;
