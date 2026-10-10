import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { SoundProvider } from './contexts/SoundContext';
import { CallProvider, useCall } from './contexts/CallContext';
import { PTTProvider } from './contexts/PTTContext';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import QrApprovePage from './components/auth/QrApprovePage';
import OrgSignin from './components/auth/OrgSignin';
import OrgSignup from './components/auth/OrgSignup';
import OwnerPortal from './components/owner/OwnerPortal';
import DispatchConsole from './components/dispatch/DispatchConsole';
import ShiftKiosk from './components/retail/ShiftKiosk';
import ChatView from './components/messaging/ChatView';
import IncomingCallModal from './components/calls/IncomingCallModal';
import ActiveCallScreen from './components/calls/ActiveCallScreen';
import AdminPanel from './components/admin/AdminPanel';
import Landing from './components/landing/Landing';
import Industries from './components/landing/Industries';
import Resources from './components/landing/Resources';
import Enterprise from './components/landing/Enterprise';
import Pricing from './components/landing/Pricing';
import Contact from './components/landing/Contact';
import CustomerBooking from './components/booking/CustomerBooking';
import PlatformLayout from './components/platform/PlatformLayout';
import PlatformOverview from './components/platform/pages/PlatformOverview';
import PlatformStands from './components/platform/pages/PlatformStands';
import PlatformCreateStand from './components/platform/pages/PlatformCreateStand';
import PlatformStandDetail from './components/platform/pages/PlatformStandDetail';
import PlatformMap from './components/platform/pages/PlatformMap';
import PlatformTrips from './components/platform/pages/PlatformTrips';
import PlatformDrivers from './components/platform/pages/PlatformDrivers';
import PlatformBilling from './components/platform/pages/PlatformBilling';
import PlatformAdmins from './components/platform/pages/PlatformAdmins';
import PlatformUsers from './components/platform/pages/PlatformUsers';
import PlatformAudit from './components/platform/pages/PlatformAudit';
import PlatformSystem from './components/platform/pages/PlatformSystem';
import './App.css';
import './styles/tokens.css';
import './styles/redesign.css';
import './styles/telegram-ui.css';
import './styles/shell-consistency.css';
import './styles/admin.css';
import './styles/owner-portal.css';
import './styles/dispatch-console.css';
import './styles/shift-kiosk.css';
import './styles/zello-auth.css';
import './styles/landing.css';
import './components/platform/platform.css';
import LoadingScreen from './components/common/LoadingScreen';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (user) {
    return <Navigate to="/app" />;
  }

  return <>{children}</>;
};

function AppContent() {
  const { activeCall, isIncomingCall, isCallActive } = useCall();

  return (
    <Router>
      <div className="app">
        <Routes>
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <Register />
              </PublicRoute>
            }
          />
          <Route
            path="/login/approve"
            element={<QrApprovePage />}
          />
          <Route
            path="/org/signin"
            element={<OrgSignin />}
          />
          <Route
            path="/org/signup"
            element={<OrgSignup />}
          />
          <Route
            path="/portal"
            element={
              <ProtectedRoute>
                <OwnerPortal />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dispatch"
            element={
              <ProtectedRoute>
                <DispatchConsole />
              </ProtectedRoute>
            }
          />
          <Route
            path="/kiosk"
            element={
              <ProtectedRoute>
                <ShiftKiosk />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <ChatView />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Landing />} />
          <Route path="/industries" element={<Industries />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/enterprise" element={<Enterprise />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/book/:subdomain" element={<CustomerBooking />} />
          <Route
            path="/platform"
            element={
              <ProtectedRoute>
                <PlatformLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<PlatformOverview />} />
            <Route path="stands" element={<PlatformStands />} />
            <Route path="stands/new" element={<PlatformCreateStand />} />
            <Route path="stands/:id" element={<PlatformStandDetail />} />
            <Route path="map" element={<PlatformMap />} />
            <Route path="trips" element={<PlatformTrips />} />
            <Route path="drivers" element={<PlatformDrivers />} />
            <Route path="billing" element={<PlatformBilling />} />
            <Route path="admins" element={<PlatformAdmins />} />
            <Route path="users" element={<PlatformUsers />} />
            <Route path="audit" element={<PlatformAudit />} />
            <Route path="system" element={<PlatformSystem />} />
            <Route path="*" element={<Navigate to="/platform" replace />} />
          </Route>
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminPanel />
              </ProtectedRoute>
            }
          />
        </Routes>

        {isIncomingCall && activeCall && (
          <IncomingCallModal call={activeCall} />
        )}

        {isCallActive && activeCall && (
          <ActiveCallScreen call={activeCall} />
        )}
      </div>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <SoundProvider>
          <NotificationProvider>
            <CallProvider>
              <PTTProvider>
                <AppContent />
              </PTTProvider>
            </CallProvider>
          </NotificationProvider>
        </SoundProvider>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App
