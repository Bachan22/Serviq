import React, { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  House,
  Search,
  CalendarDays,
  MessageCircle,
  Heart,
  UserRound,
  MapPin,
  ChevronDown,
  Bell,
  Menu,
  HelpCircle,
  LogOut,
  ArrowUpRight,
  ShieldCheck,
  Phone,
  Mail,
  X,
  Check,
} from 'lucide-react';

export default function CustomerLayout({ notify }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileNav, setMobileNav] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(2);

  const notifications = [
    { id: 1, title: 'Live GPS Tracking Available', desc: 'Your technician tracking is live for active bookings.', link: '/customer/bookings', time: 'Just now' },
    { id: 2, title: 'Booking Request Matched', desc: 'Local verified partners are reviewing nearby service requests.', link: '/customer/bookings', time: '10m ago' },
    { id: 3, title: 'Welcome to Serviq', desc: 'Your account is verified and ready for booking everyday home services.', link: '/customer/explore', time: '1d ago' },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const getInitials = (name) => {
    if (!name) return 'CS';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  };

  const navGroups = [
    {
      label: 'Discover',
      items: [
        { label: 'Home', path: '/customer', icon: House, end: true },
        { label: 'Explore services', path: '/customer/explore', icon: Search },
        { label: 'My bookings', path: '/customer/bookings', icon: CalendarDays },
      ],
    },
    {
      label: 'Your account',
      items: [
        { label: 'Messages', path: '/customer/messages', icon: MessageCircle },
        { label: 'Saved workers', path: '/customer/saved', icon: Heart },
        { label: 'Profile & settings', path: '/customer/profile', icon: UserRound },
      ],
    },
  ];

  return (
    <div className="app-shell customer-shell">
      {/* Customer Header - Clean, No role switcher */}
      <header className="topbar">
        <button
          className="mobile-menu icon-btn"
          onClick={() => setMobileNav(!mobileNav)}
          aria-label="Toggle navigation"
        >
          <Menu size={20} />
        </button>

        <Link to="/customer" className="brand">
          <span className="brand-mark">
            <House size={19} strokeWidth={2.5} />
          </span>
          <span>
            serviq<span className="brand-dot">.</span>
          </span>
        </Link>

        <div
          className="topbar-location"
          onClick={() => navigate('/customer/profile')}
          style={{ cursor: 'pointer' }}
          title="Click to view or edit saved service location"
          role="button"
          tabIndex={0}
        >
          <MapPin size={16} />
          <span>
            <small>Your location</small>
            <strong>{user?.city || 'Bhayandar, Mumbai'}</strong>
          </span>
          <ChevronDown size={14} />
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
                <strong style={{ fontSize: '14px', color: '#0f172a' }}>Notifications</strong>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setUnreadCount(0);
                      notify?.('All notifications marked as read.');
                    }}
                    style={{ background: 'none', border: 'none', fontSize: '11px', color: '#FF9900', fontWeight: '600', cursor: 'pointer' }}
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => {
                      setShowNotifications(false);
                      navigate(n.link);
                    }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: '#f8fafc',
                      cursor: 'pointer',
                      borderLeft: '3px solid #FF9900',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '600', color: '#0f172a' }}>
                      <span>{n.title}</span>
                      <small style={{ color: '#94a3b8', fontWeight: '400' }}>{n.time}</small>
                    </div>
                    <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b', lineHeight: '1.3' }}>{n.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Profile Menu */}
        <div className="top-profile-wrapper">
          <button
            className="top-profile"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            aria-expanded={showProfileMenu}
          >
            <div className="avatar dark sm">{getInitials(user?.fullName)}</div>
            <span>{user?.fullName?.split(' ')[0] || 'Customer'}</span>
            <ChevronDown size={14} />
          </button>

          {showProfileMenu && (
            <div className="profile-dropdown-menu">
              <div className="dropdown-user-info">
                <strong>{user?.fullName || 'Customer'}</strong>
                <small>{user?.email}</small>
                <span className="role-tag customer">Customer Account</span>
              </div>
              <hr className="dropdown-divider" />
              <Link
                to="/customer/profile"
                className="dropdown-item"
                onClick={() => setShowProfileMenu(false)}
              >
                <UserRound size={16} />
                <span>Account Profile</span>
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
        {/* Customer Sidebar */}
        <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
          <div className="side-context">
            <div className="side-context-icon">
              <House size={17} />
            </div>
            <div>
              <strong>Customer space</strong>
              <span>Find verified local help</span>
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
            <div className="help-card">
              <div className="help-icon">
                <HelpCircle size={18} />
              </div>
              <strong>Need assistance?</strong>
              <p>We’re here to help with your bookings and service questions.</p>
              <button onClick={() => setShowSupportModal(true)}>
                Contact support <ArrowUpRight size={14} />
              </button>
            </div>

            <button className="nav-item logout" onClick={handleLogout}>
              <LogOut size={17} />
              <span>Sign out</span>
            </button>

            <div className="sidebar-foot">
              © 2026 Serviq <span>•</span> Verified Local Services
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="main-content" onClick={() => mobileNav && setMobileNav(false)}>
          <div className="content-wrap">
            <Outlet />
          </div>

          <footer className="page-footer">
            <span>Made for everyday help.</span>
            <span>
              <ShieldCheck size={13} /> Trusted & verified local service marketplace
            </span>
          </footer>
        </main>
      </div>

      {showSupportModal && (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setShowSupportModal(false)}>
          <div className="modal-card" role="dialog" aria-modal="true" aria-label="Customer Support">
            <div className="modal-header">
              <div>
                <h2>Customer Support</h2>
                <p>We are here to assist with bookings, live tracking, and technicians.</p>
              </div>
              <button className="icon-btn" onClick={() => setShowSupportModal(false)} aria-label="Close dialog">
                <X size={19} />
              </button>
            </div>
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#f8fafc', borderRadius: '10px' }}>
                <Phone size={20} color="#FF9900" />
                <div>
                  <strong style={{ fontSize: '14px', display: 'block', color: '#0f172a' }}>Direct Phone Helpline</strong>
                  <a href="tel:+918000073784" style={{ fontSize: '13px', color: '#FF9900', textDecoration: 'none' }}>+91 80000 SERVIQ (73784)</a>
                  <small style={{ display: 'block', color: '#94a3b8' }}>Mon–Sun, 7:00 AM – 11:00 PM IST</small>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#f8fafc', borderRadius: '10px' }}>
                <Mail size={20} color="#FF9900" />
                <div>
                  <strong style={{ fontSize: '14px', display: 'block', color: '#0f172a' }}>Email Support</strong>
                  <a href="mailto:support@serviq.in" style={{ fontSize: '13px', color: '#FF9900', textDecoration: 'none' }}>support@serviq.in</a>
                  <small style={{ display: 'block', color: '#94a3b8' }}>Average response time under 15 minutes</small>
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
