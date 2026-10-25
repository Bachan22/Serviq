import React, { useState, useEffect, useCallback } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { dbService } from '../api/database.js';
import { notificationApi } from '../api/notifications.js';
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
  Phone,
  Mail,
  X,
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
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('serviq_access_token') : null;
    if (!user?.id || !token) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    try {
      const data = await notificationApi.getNotifications();
      const list = Array.isArray(data) ? data : [];
      setNotifications(list);
      setUnreadCount(list.filter((n) => !n.isRead && !n.read).length);
    } catch {
      // ignore
    }
  }, [user?.id]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchNotifications();
    }, 4000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      notify?.('All notifications marked as read.');
    } catch (err) {
      console.warn(err);
    }
  };

  const handleClickNotification = async (n) => {
    try {
      if (!n.isRead && !n.read) {
        await notificationApi.markAsRead(n.id);
        setNotifications((prev) =>
          prev.map((item) => (item.id === n.id ? { ...item, isRead: true } : item))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch {}
    setShowNotifications(false);
    navigate('/worker/jobs');
  };

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

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      refreshJobCount();
    }, 4000);
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
        <div className="top-profile-wrapper">
          <button
            className="icon-btn notification-btn"
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label="Notifications"
            aria-expanded={showNotifications}
          >
            <Bell size={18} />
            {unreadCount > 0 && <i />}
          </button>

          {showNotifications && (
            <div className="profile-dropdown-menu" style={{ width: '320px', right: 0, padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <strong style={{ fontSize: '14px', color: '#0f172a' }}>Partner Alerts</strong>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    style={{ background: 'none', border: 'none', fontSize: '11px', color: '#FF9900', fontWeight: '600', cursor: 'pointer' }}
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '360px', overflowY: 'auto' }}>
                {notifications.length > 0 ? (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleClickNotification(n)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '8px',
                        background: n.isRead || n.read ? '#f8fafc' : '#FFF7ED',
                        cursor: 'pointer',
                        borderLeft: n.isRead || n.read ? '3px solid #CBD5E1' : '3px solid #FF9900',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '600', color: '#0f172a' }}>
                        <span>{n.title}</span>
                        <small style={{ color: '#94a3b8', fontWeight: '400' }}>
                          {n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                        </small>
                      </div>
                      <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b', lineHeight: '1.3' }}>{n.body || n.desc}</p>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '16px 0', fontSize: '12px', color: '#94A3B8' }}>
                    No alerts yet
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

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
              <button onClick={() => setShowSupportModal(true)}>
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

      {showSupportModal && (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setShowSupportModal(false)}>
          <div className="modal-card" role="dialog" aria-modal="true" aria-label="Partner Support">
            <div className="modal-header">
              <div>
                <h2>Serviq Partner Support</h2>
                <p>Priority partner hotline for payout settlements, disputes, and live job safety.</p>
              </div>
              <button className="icon-btn" onClick={() => setShowSupportModal(false)} aria-label="Close dialog">
                <X size={19} />
              </button>
            </div>
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#f8fafc', borderRadius: '10px' }}>
                <Phone size={20} color="#FF9900" />
                <div>
                  <strong style={{ fontSize: '14px', display: 'block', color: '#0f172a' }}>Priority Partner Hotline</strong>
                  <a href="tel:+918000073784" style={{ fontSize: '13px', color: '#FF9900', textDecoration: 'none' }}>+91 80000 PRO-HELP (73784)</a>
                  <small style={{ display: 'block', color: '#94a3b8' }}>Dedicated line for verified service partners (24/7)</small>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#f8fafc', borderRadius: '10px' }}>
                <Mail size={20} color="#FF9900" />
                <div>
                  <strong style={{ fontSize: '14px', display: 'block', color: '#0f172a' }}>Partner Operations Desk</strong>
                  <a href="mailto:partners@serviq.in" style={{ fontSize: '13px', color: '#FF9900', textDecoration: 'none' }}>partners@serviq.in</a>
                  <small style={{ display: 'block', color: '#94a3b8' }}>For banking details, TDS forms, and background checks</small>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button className="btn primary small" onClick={() => setShowSupportModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
