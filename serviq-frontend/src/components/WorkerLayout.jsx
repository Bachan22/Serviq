import React, { useState, useEffect } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { dbService } from '../api/database.js';
import {
  House,
  LayoutDashboard,
  BriefcaseBusiness,
  ClipboardList,
  Wallet,
  Coins,
  Star,
  MessageCircle,
  Settings,
  HelpCircle,
  LogOut,
  Bell,
  Menu,
  ChevronDown,
  ShieldAlert,
  ArrowUpRight,
  ShieldCheck,
  BadgeCheck,
} from 'lucide-react';

export default function WorkerLayout({ notify }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // New workers default to offline until they turn it on
  const [availability, setAvailability] = useState(() => {
    if (!user?.id) return false;
    const profile = dbService.getWorkerProfile(user.id);
    return profile ? Boolean(profile.isOnline) : Boolean(user.isOnline);
  });
  const [matchingCount, setMatchingCount] = useState(0);
  const [mobileNav, setMobileNav] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const isPendingVerification = user?.verificationStatus === 'pending';

  const refreshJobCount = async () => {
    if (!user?.id) return;
    try {
      const jobs = await dbService.getMatchingJobs(user.id);
      setMatchingCount(jobs.length);
    } catch {
      setMatchingCount(0);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    const profile = dbService.getWorkerProfile(user.id);
    if (profile) {
      setAvailability(Boolean(profile.isOnline));
    }
    refreshJobCount();

    const interval = setInterval(refreshJobCount, 4000);
    return () => clearInterval(interval);
  }, [user?.id, availability]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const getInitials = (name) => {
    if (!name || typeof name !== 'string') return 'WP';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
    if (parts.length === 1 && parts[0].length === 1) return parts[0].toUpperCase();
    return 'WP';
  };

  const navGroups = [
    {
      label: 'Workspace',
      items: [
        { label: 'Dashboard', path: '/worker', icon: LayoutDashboard, end: true },
        {
          label: 'Job requests',
          path: '/worker/jobs',
          icon: BriefcaseBusiness,
          count: matchingCount > 0 ? String(matchingCount) : undefined,
        },
        { label: 'Active jobs', path: '/worker/active', icon: ClipboardList },
        { label: 'Earnings', path: '/worker/earnings', icon: Wallet },
        { label: 'My rates', path: '/worker/rates', icon: Coins },
      ],
    },
    {
      label: 'Manage',
      items: [
        { label: 'Ratings & reviews', path: '/worker/reviews', icon: Star },
        { label: 'Messages', path: '/worker/messages', icon: MessageCircle },
        { label: 'Profile & settings', path: '/worker/profile', icon: Settings },
      ],
    },
  ];

  return (
    <div className="app-shell worker-shell">
      {/* Verification Status Banner */}
      {isPendingVerification && (
        <div className="verification-pending-banner" role="status">
          <div className="banner-content">
            <ShieldAlert size={17} className="banner-icon" />
            <div className="banner-text">
              <strong>Verification pending:</strong> Your professional credentials are currently under review by the Serviq verification team. You can explore your workspace, manage your rates, and review incoming requests in the meantime.
            </div>
          </div>
        </div>
      )}

      {/* Worker Header */}
      <header className="topbar worker-topbar">
        <button
          className="mobile-menu icon-btn"
          onClick={() => setMobileNav(!mobileNav)}
          aria-label="Toggle navigation"
        >
          <Menu size={20} />
        </button>

        <Link to="/worker" className="brand worker-brand">
          <span className="brand-mark worker-mark">
            <House size={19} strokeWidth={2.5} />
          </span>
          <span>
            serviq<span className="worker-pro-tag">PRO</span>
          </span>
        </Link>

        {/* Worker Availability Toggle */}
        <div className={`availability-toggle header-toggle ${availability ? 'on' : ''}`}>
          <span className="availability-copy">
            <i />
            <strong>{availability ? 'Online & Active' : 'Offline'}</strong>
            <small>{availability ? 'Receiving jobs' : 'Paused'}</small>
          </span>
          <button
            type="button"
            onClick={async () => {
              const nextVal = !availability;
              setAvailability(nextVal);
              if (user?.id) {
                await dbService.updateWorkerOnlineStatus(user.id, nextVal);
                const raw = localStorage.getItem('serviq_session_user');
                if (raw) {
                  const u = JSON.parse(raw);
                  u.isOnline = nextVal;
                  localStorage.setItem('serviq_session_user', JSON.stringify(u));
                }
                refreshJobCount();
              }
              notify?.(nextVal ? 'You are now online and visible to nearby customers.' : 'You are now offline.');
            }}
            aria-label="Toggle availability"
          >
            <span />
          </button>
        </div>

        <div className="topbar-spacer" />

        {/* Notifications */}
        <button
          className="icon-btn notification-btn"
          onClick={() => notify?.('No new system alerts.')}
          aria-label="Notifications"
        >
          <Bell size={18} />
          <i />
        </button>

        {/* Profile Dropdown */}
        <div className="top-profile-wrapper">
          <button
            className="top-profile"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            aria-expanded={showProfileMenu}
          >
            <div className="avatar sand sm">{getInitials(user?.fullName)}</div>
            <span>{user?.fullName?.split(' ')[0] || 'Partner'}</span>
            <ChevronDown size={14} />
          </button>

          {showProfileMenu && (
            <div className="profile-dropdown-menu">
              <div className="dropdown-user-info">
                <strong>{user?.fullName || 'Partner'}</strong>
                <small>{user?.email}</small>
                <div className="role-tag worker">
                  {user?.primarySkill || 'Service Professional'}
                </div>
              </div>
              <hr className="dropdown-divider" />
              <Link
                to="/worker/profile"
                className="dropdown-item"
                onClick={() => setShowProfileMenu(false)}
              >
                <Settings size={16} />
                <span>Business Profile</span>
              </Link>
              <Link
                to="/worker/rates"
                className="dropdown-item"
                onClick={() => setShowProfileMenu(false)}
              >
                <Coins size={16} />
                <span>Manage Rates</span>
              </Link>
              <button
                type="button"
                className="dropdown-item logout"
                onClick={handleLogout}
              >
                <LogOut size={16} />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Body */}
      <div className="app-body">
        {/* Worker Sidebar */}
        <aside className={`sidebar worker-sidebar ${mobileNav ? 'open' : ''}`}>
          <div className="side-context worker-context">
            <div className="side-context-icon worker-icon">
              <BriefcaseBusiness size={17} />
            </div>
            <div>
              <strong>Worker workspace</strong>
              <span>{user?.primarySkill || 'Professional Partner'}</span>
            </div>
          </div>

          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-label">{group.label}</div>
              {group.items.map((item) => (
                <NavLink
                  key={item.label}
                  to={item.path}
                  end={item.end}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => setMobileNav(false)}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                  {item.count && <span className="nav-count">{item.count}</span>}
                </NavLink>
              ))}
            </div>
          ))}

          <div className="sidebar-bottom">
            <div className="help-card worker-help">
              <div className="help-icon worker-help-icon">
                <HelpCircle size={18} />
              </div>
              <strong>Partner Support</strong>
              <p>Get priority help regarding payouts, customer disputes, and job safety.</p>
              <button onClick={() => notify?.('Serviq Partner Hotline is available 24/7.')}>
                Partner support <ArrowUpRight size={14} />
              </button>
            </div>

            <button className="nav-item logout" onClick={handleLogout}>
              <LogOut size={17} />
              <span>Sign out</span>
            </button>

            <div className="sidebar-foot">
              © 2026 Serviq Pro <span>•</span> Service Workspace
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="main-content" onClick={() => mobileNav && setMobileNav(false)}>
          <div className="content-wrap">
            <Outlet />
          </div>

          <footer className="page-footer">
            <span>Serviq Partner Platform.</span>
            <span>
              <BadgeCheck size={13} /> Guaranteed payouts & safety standards
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
