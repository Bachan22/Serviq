import React, { useMemo, useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { RequireRole, LoadingScreen } from './components/RouteGuards.jsx';
import CustomerLayout from './components/CustomerLayout.jsx';
import WorkerLayout from './components/WorkerLayout.jsx';
import LoginPage from './pages/auth/LoginPage.jsx';
import SignupPage from './pages/auth/SignupPage.jsx';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/auth/ResetPasswordPage.jsx';
import WorkerRatesPage from './pages/worker/WorkerRatesPage.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { dbService } from './api/database.js';

import {
  Search, MapPin, ChevronDown, ArrowUpRight, ArrowRight, Star, ShieldCheck,
  Clock3, Wrench, Zap, Paintbrush, Sparkles, Snowflake, Hammer, Flame,
  CalendarDays, TrendingUp, Check, X, Plus, Minus, SlidersHorizontal,
  CircleDollarSign, Phone, Send, BadgeCheck, House, Heart, Filter,
  ClipboardList, CircleCheckBig, Timer, Shield, UserRound, BriefcaseBusiness,
  Wallet, MessageCircle
} from 'lucide-react';

function money(n) { return '₹' + Number(n || 0).toLocaleString('en-IN'); }
function Avatar({ initials, color = 'sand', size = 'md' }) { return <div className={`avatar ${color} ${size}`}>{initials}</div>; }
function Button({ children, variant = 'primary', size = '', onClick, disabled = false, icon: Icon, type = 'button' }) {
  return <button type={type} className={`btn ${variant} ${size}`} onClick={onClick} disabled={disabled}>{Icon && <Icon size={16}/>}<span>{children}</span></button>;
}
function Tag({ children, tone = 'neutral', dot = false }) { return <span className={`tag ${tone}`}>{dot && <i/>}{children}</span>; }
function SectionTitle({ eyebrow, title, subtitle, action, onAction }) { return <div className="section-title"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action && <button className="text-action" onClick={onAction}>{action}<ArrowRight size={15}/></button>}</div>; }

function RootIndexRedirect() {
  const { user, isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (isAuthenticated && user?.role) {
    return <Navigate to={`/${user.role}`} replace />;
  }
  return <Navigate to="/login" replace />;
}

export default function App() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All services');
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [bookings, setBookings] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [activeJobs, setActiveJobs] = useState([]);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [offers, setOffers] = useState({});
  const [liked, setLiked] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [categoryCounts, setCategoryCounts] = useState({});
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [bookingForm, setBookingForm] = useState({
    service: 'Plumbing',
    date: 'Today',
    time: 'As soon as possible',
    address: 'Bhayandar West, Mumbai',
    details: ''
  });
  const [counterPrice, setCounterPrice] = useState(380);

  const notify = (message) => { setToast(message); window.setTimeout(() => setToast(''), 2800); };

  // Fetch Customer Side dynamic workers and category counts
  const loadCustomerData = async () => {
    try {
      const counts = await dbService.getCategoryCounts();
      setCategoryCounts(counts);

      const list = await dbService.getNearbyWorkers({ category, search });
      setWorkers(list);

      if (user?.id && user.role === 'customer') {
        const custBookings = await dbService.getCustomerBookings(user.id);
        setBookings(custBookings);
      }
    } catch (err) {
      console.error('Error loading customer data:', err);
    }
  };

  // Fetch Worker Side dynamic jobs, active jobs, and dashboard stats
  const loadWorkerData = async () => {
    if (!user?.id || user.role !== 'worker') return;
    try {
      const matching = await dbService.getMatchingJobs(user.id);
      setJobs(matching);

      const stats = await dbService.getWorkerDashboardStats(user.id);
      setDashboardStats(stats);

      const storeJobs = JSON.parse(localStorage.getItem('serviq_db_jobs') || '[]');
      const active = storeJobs.filter(
        (j) => j.acceptedWorkerId === user.id && (j.status === 'accepted' || j.status === 'in_progress')
      );
      setActiveJobs(
        active.map((j) => ({
          id: j.id,
          title: j.title || `${j.service} service`,
          category: j.service || j.category,
          customer: j.customerName || 'Customer',
          location: j.location || j.area || 'Nearby',
          price: Number(j.agreedPrice || j.budget || j.price || 400),
          status: 'Accepted & Active',
          time: j.timeAgo || 'In progress',
          initials: (j.customerName || 'CU').slice(0, 2).toUpperCase(),
          details: j.description || '',
        }))
      );
    } catch (err) {
      console.error('Error loading worker data:', err);
    }
  };

  useEffect(() => {
    loadCustomerData();
    const interval = setInterval(loadCustomerData, 5000);
    return () => clearInterval(interval);
  }, [category, search, user?.id]);

  useEffect(() => {
    if (user?.role === 'worker' && user?.id) {
      loadWorkerData();
      const interval = setInterval(loadWorkerData, 3000);
      return () => clearInterval(interval);
    }
  }, [user?.id, user?.role]);

  const openBooking = (worker, service) => {
    setSelectedWorker(worker);
    setBookingForm((f) => ({
      ...f,
      service: service || (worker?.job ? worker.job.split(' ')[0] : 'Plumbing'),
    }));
    setModal('booking');
  };

  const confirmBooking = async () => {
    try {
      const customerId = user?.id || 'guest-customer';
      const customerName = user?.fullName || 'Valued Customer';
      const budget = selectedWorker?.price || 400;

      await dbService.postJob({
        customerId,
        customerName,
        service: bookingForm.service,
        title: `${bookingForm.service} service`,
        budget,
        address: bookingForm.address,
        details: bookingForm.details,
      });

      setModal(null);
      notify('Booking request submitted to nearby professionals.');
      await loadCustomerData();
    } catch (err) {
      notify(err.message || 'Failed to submit booking.');
    }
  };

  const acceptJob = async (job) => {
    try {
      await dbService.acceptJob(user.id, job.id);
      notify(`You have accepted job ${job.id}.`);
      await loadWorkerData();
    } catch (err) {
      notify(err.message || 'Failed to accept job.');
    }
  };

  const sendCounter = (job) => {
    setSelectedWorker(job);
    setCounterPrice(job.price ? Math.max(100, job.price - 50) : 350);
    setModal('counter');
  };

  const submitCounter = async () => {
    try {
      await dbService.counterJob(user.id, selectedWorker.id, counterPrice);
      setModal(null);
      notify(`Counter-offer of ${money(counterPrice)} sent to customer.`);
      await loadWorkerData();
    } catch (err) {
      notify(err.message || 'Failed to submit counter-offer.');
    }
  };

  const completeJobAction = async (job) => {
    try {
      await dbService.completeJob(job.id);
      notify(`Job ${job.id} marked as completed! Payout credited to your ledger.`);
      await loadWorkerData();
    } catch (err) {
      notify(err.message || 'Failed to complete job.');
    }
  };

  return (
    <ErrorBoundary area="Serviq Application">
      <Routes>
        {/* Index Redirect */}
        <Route path="/" element={<RootIndexRedirect />} />

        {/* Public Authentication Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Protected Customer Routes */}
        <Route
          path="/customer"
          element={
            <RequireRole allowedRole="customer">
              <ErrorBoundary area="Customer Workspace">
                <CustomerLayout notify={notify} />
              </ErrorBoundary>
            </RequireRole>
          }
        >
          <Route
            index
            element={
              <CustomerHome
                search={search}
                setSearch={setSearch}
                category={category}
                setCategory={setCategory}
                workers={workers}
                categoryCounts={categoryCounts}
                onBook={openBooking}
                liked={liked}
                setLiked={setLiked}
                notify={notify}
              />
            }
          />
          <Route
            path="explore"
            element={
              <CustomerExplore
                search={search}
                setSearch={setSearch}
                category={category}
                setCategory={setCategory}
                workers={workers}
                categoryCounts={categoryCounts}
                onBook={openBooking}
                liked={liked}
                setLiked={setLiked}
                notify={notify}
              />
            }
          />
          <Route
            path="bookings"
            element={<BookingsPage bookings={bookings} onRefresh={loadCustomerData} />}
          />
          <Route path="messages" element={<MessagesPage notify={notify} />} />
          <Route
            path="saved"
            element={
              <CustomerSaved
                workers={workers}
                liked={liked}
                setLiked={setLiked}
                onBook={openBooking}
              />
            }
          />
          <Route path="profile" element={<ProfilePage role="customer" notify={notify} />} />
        </Route>

        {/* Protected Worker Routes */}
        <Route
          path="/worker"
          element={
            <RequireRole allowedRole="worker">
              <ErrorBoundary area="Worker Workspace">
                <WorkerLayout notify={notify} />
              </ErrorBoundary>
            </RequireRole>
          }
        >
          <Route
            index
            element={
              <WorkerDashboard
                jobs={jobs}
                activeJobs={activeJobs}
                dashboardStats={dashboardStats}
                onAccept={acceptJob}
                onCounter={sendCounter}
              />
            }
          />
          <Route
            path="jobs"
            element={
              <WorkerJobs
                jobs={jobs}
                onAccept={acceptJob}
                onCounter={sendCounter}
                notify={notify}
              />
            }
          />
          <Route
            path="active"
            element={
              <WorkerActive
                activeJobs={activeJobs}
                onCompleteJob={completeJobAction}
                notify={notify}
              />
            }
          />
          <Route path="earnings" element={<EarningsPage notify={notify} />} />
          <Route path="rates" element={<WorkerRatesPage notify={notify} />} />
          <Route path="reviews" element={<ReviewsPage />} />
          <Route path="messages" element={<MessagesPage notify={notify} />} />
          <Route path="profile" element={<ProfilePage role="worker" notify={notify} />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Booking Modal */}
      {modal === 'booking' && (
        <Modal
          title="Book a trusted professional"
          subtitle="A few details help us connect you with the right specialist."
          onClose={() => setModal(null)}
        >
          {selectedWorker && (
            <div className="booking-worker">
              <Avatar initials={selectedWorker.initials || 'WP'} color={selectedWorker.color || 'sand'} size="lg" />
              <div className="booking-worker-info">
                <strong>{selectedWorker.name}</strong>
                <span>
                  {selectedWorker.rating ? (
                    <>
                      <Star size={13} fill="currentColor" /> {selectedWorker.rating} · {selectedWorker.job}
                    </>
                  ) : (
                    <>
                      <Tag tone="neutral">New</Tag> · {selectedWorker.job}
                    </>
                  )}
                </span>
              </div>
              <div className="booking-price">
                <small>Starting at</small>
                <strong>{money(selectedWorker.price)}</strong>
              </div>
            </div>
          )}
          <div className="form-grid">
            <label>
              Service category
              <select
                value={bookingForm.service}
                onChange={(e) => setBookingForm({ ...bookingForm, service: e.target.value })}
              >
                {['Plumbing', 'Electrical', 'Cleaning', 'Painting', 'AC repair', 'Carpentry', 'Cooking'].map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
            <label>
              Preferred day
              <select
                value={bookingForm.date}
                onChange={(e) => setBookingForm({ ...bookingForm, date: e.target.value })}
              >
                <option>Today</option>
                <option>Tomorrow</option>
                <option>This weekend</option>
              </select>
            </label>
            <label className="full-field">
              Preferred time
              <select
                value={bookingForm.time}
                onChange={(e) => setBookingForm({ ...bookingForm, time: e.target.value })}
              >
                <option>As soon as possible</option>
                <option>Morning · 9 AM – 12 PM</option>
                <option>Afternoon · 12 PM – 4 PM</option>
                <option>Evening · 4 PM – 8 PM</option>
              </select>
            </label>
            <label className="full-field">
              Service address
              <input
                value={bookingForm.address}
                onChange={(e) => setBookingForm({ ...bookingForm, address: e.target.value })}
                placeholder="Enter your address"
              />
            </label>
            <label className="full-field">
              What needs fixing? <span className="optional">Optional</span>
              <textarea
                value={bookingForm.details}
                onChange={(e) => setBookingForm({ ...bookingForm, details: e.target.value })}
                placeholder="Describe the issue briefly…"
                rows="3"
              />
            </label>
          </div>
          <div className="modal-note">
            <ShieldCheck size={16} />
            <span>
              By sending a booking request, nearby verified professionals matching your category and service radius will be notified in real time.
            </span>
          </div>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button onClick={confirmBooking}>
              Send booking request <ArrowRight size={15} />
            </Button>
          </div>
        </Modal>
      )}

      {/* Counter Modal */}
      {modal === 'counter' && selectedWorker && (
        <Modal
          title="Send a counter-offer"
          subtitle={`Propose a fair price for “${selectedWorker.title}”.`}
          onClose={() => setModal(null)}
        >
          <div className="counter-job">
            <div className="mini-icon">
              <Wrench size={18} />
            </div>
            <div>
              <strong>{selectedWorker.title}</strong>
              <span>
                {selectedWorker.customer} · {selectedWorker.location}
              </span>
            </div>
            <div className="counter-original">
              <small>Listed budget</small>
              <strong>{money(selectedWorker.price)}</strong>
            </div>
          </div>
          <label className="counter-label">Your proposed price</label>
          <div className="price-stepper">
            <button
              onClick={() => setCounterPrice((v) => Math.max(100, v - 50))}
              aria-label="Decrease offer"
            >
              <Minus size={18} />
            </button>
            <div>
              <small>Proposed amount</small>
              <strong>{money(counterPrice)}</strong>
            </div>
            <button
              onClick={() => setCounterPrice((v) => v + 50)}
              aria-label="Increase offer"
            >
              <Plus size={18} />
            </button>
          </div>
          <div className="quick-prices">
            {[300, 350, 400, 450, 500].map((p) => (
              <button
                className={counterPrice === p ? 'chosen' : ''}
                key={p}
                onClick={() => setCounterPrice(p)}
              >
                {money(p)}
              </button>
            ))}
          </div>
          <div className="modal-note">
            <CircleDollarSign size={16} />
            <span>
              Agree on a fair price before starting. The customer will review your proposed rate before confirming.
            </span>
          </div>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button onClick={submitCounter}>
              Send counter-offer <Send size={15} />
            </Button>
          </div>
        </Modal>
      )}

      {/* Toast notifications */}
      {toast && (
        <div className="toast">
          <span className="toast-check">
            <Check size={15} />
          </span>
          {toast}
          <button onClick={() => setToast('')} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}
    </ErrorBoundary>
  );
}

// ================= CUSTOMER SUBPAGES =================

function CustomerHome({ search, setSearch, category, setCategory, workers, categoryCounts, onBook, liked, setLiked, notify }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const firstName = user?.fullName ? user.fullName.split(' ')[0] : 'there';
  const city = user?.city || user?.area || 'Bhayandar, Mumbai';

  return (
    <>
      <div className="welcome-row">
        <div>
          <div className="eyebrow">YOUR LOCAL SERVICES, SIMPLIFIED</div>
          <h1>
            Good morning, {firstName} <span className="wave">✳</span>
          </h1>
          <p>What can we help you take care of today?</p>
        </div>
        <div className="welcome-badge">
          <span className="live-dot" />
          Serving {city} <ChevronDown size={14} />
        </div>
      </div>

      <section className="hero-card">
        <div className="hero-copy">
          <Tag tone="dark">
            <Sparkles size={12} /> HOME, MADE EASIER
          </Tag>
          <h2>
            Good help.
            <br />
            <em>Right around the corner.</em>
          </h2>
          <p>Book trusted local professionals for all those things on your to-do list.</p>
          <div className="hero-trust">
            <span>
              <ShieldCheck size={15} /> Verified professionals
            </span>
            <span>
              <Star size={14} fill="currentColor" /> Verified quality rating
            </span>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-orbit orbit-one" />
          <div className="hero-orbit orbit-two" />
          <div className="hero-home">
            <House size={74} strokeWidth={1.25} />
            <div className="home-window" />
            <div className="home-door" />
          </div>
          <div className="floating-note note-top">
            <span className="note-icon green">
              <Check size={14} />
            </span>
            <div>
              <strong>Trusted help</strong>
              <small>Checked professionals</small>
            </div>
          </div>
          <div className="floating-note note-bottom">
            <div className="tiny-avatars">
              <Avatar initials="SP" size="xs" />
              <Avatar initials="EP" color="blue" size="xs" />
              <Avatar initials="CP" color="green" size="xs" />
            </div>
            <div>
              <strong>People nearby</strong>
              <small>Ready when you are</small>
            </div>
          </div>
        </div>
      </section>

      <div className="search-bar home-search">
        <MapPin size={17} />
        <div className="search-location">
          <small>Service location</small>
          <strong>{city}</strong>
        </div>
        <span className="search-divider" />
        <Search size={18} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/customer/explore')}
          placeholder="What do you need help with?"
        />
        <Button onClick={() => navigate('/customer/explore')}>
          Find help <ArrowRight size={15} />
        </Button>
      </div>

      <section className="section-block">
        <SectionTitle
          eyebrow="THE EVERYDAY ESSENTIALS"
          title="What do you need help with?"
          subtitle="A little help goes a long way."
          action="View all services"
          onAction={() => navigate('/customer/explore')}
        />
        <CategoryGrid category={category} setCategory={setCategory} counts={categoryCounts} />
      </section>

      <section className="section-block">
        <SectionTitle
          eyebrow="LOCAL FAVOURITES"
          title="Trusted people, nearby"
          subtitle="Meet highly rated professionals around your neighbourhood."
          action="See all professionals"
          onAction={() => navigate('/customer/explore')}
        />
        {workers.length > 0 ? (
          <WorkerGrid workers={workers.slice(0, 3)} onBook={onBook} liked={liked} setLiked={setLiked} />
        ) : (
          <div className="empty-inline" style={{ padding: '32px 16px', textAlign: 'center', background: '#fff', borderRadius: '12px', border: '1px dashed #cbd5e1', color: '#64748b' }}>
            No verified professionals found nearby in this category yet.
          </div>
        )}
      </section>

      <section className="assurance-strip">
        <div className="assurance-icon">
          <ShieldCheck size={22} />
        </div>
        <div>
          <strong>Good work starts with trust.</strong>
          <p>Look for verified profiles, clear prices, and reviews from other customers.</p>
        </div>
        <button onClick={() => notify('Serviq guarantees transparent pricing and verified partner reviews.')}>
          How it works <ArrowUpRight size={15} />
        </button>
      </section>
    </>
  );
}

function CustomerExplore({ search, setSearch, category, setCategory, workers, categoryCounts, onBook, liked, setLiked, notify }) {
  return (
    <>
      <PageHeading
        eyebrow="FIND YOUR FIX"
        title="Explore local services"
        subtitle="The right help for your home, without the hassle."
      />
      <div className="search-bar wide-search">
        <Search size={18} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Try ‘tap repair’ or ‘electrician’"
        />
        <Button onClick={() => notify(`Showing ${workers.length} verified professionals.`)}>
          Search
        </Button>
      </div>
      <CategoryGrid category={category} setCategory={setCategory} counts={categoryCounts} />
      <SectionTitle
        eyebrow="NEAR YOU"
        title={`${workers.length} professionals available`}
        subtitle="Vetted and rated service providers in your neighbourhood."
      />
      <WorkerGrid workers={workers} onBook={onBook} liked={liked} setLiked={setLiked} />
    </>
  );
}

function CustomerSaved({ workers, liked, setLiked, onBook }) {
  const navigate = useNavigate();
  const savedWorkers = workers.filter((w) => liked.includes(w.id));

  return (
    <>
      <PageHeading
        eyebrow="YOUR SHORTLIST"
        title="Saved professionals"
        subtitle="Keep trusted people close for the next time you need help."
      />
      {savedWorkers.length ? (
        <WorkerGrid workers={savedWorkers} onBook={onBook} liked={liked} setLiked={setLiked} />
      ) : (
        <EmptyState
          icon={Heart}
          title="No saved professionals yet"
          text="Tap the heart on a professional’s card to save them here for quick re-booking."
          action="Explore professionals"
          onAction={() => navigate('/customer/explore')}
        />
      )}
    </>
  );
}

// ================= WORKER SUBPAGES =================

function WorkerDashboard({ jobs = [], activeJobs = [], dashboardStats, onAccept, onCounter }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const safeJobs = Array.isArray(jobs) ? jobs : [];
  const safeActiveJobs = Array.isArray(activeJobs) ? activeJobs : [];
  const firstName = user?.fullName ? user.fullName.trim().split(/\s+/)[0] : 'Partner';

  const todayEarningsVal = dashboardStats?.todayEarnings != null ? money(dashboardStats.todayEarnings) : money(0);
  const completedJobsVal = String(dashboardStats?.completedJobsWeek || 0);
  const ratingVal = dashboardStats?.rating != null ? String(dashboardStats.rating) : 'New';
  const ratingDetail = dashboardStats?.rating != null ? `From ${dashboardStats.reviewCount} reviews` : 'Complete jobs to earn reviews';
  const responseTimeVal = dashboardStats?.avgResponseMinutes != null ? `${dashboardStats.avgResponseMinutes} min` : 'No data yet';
  const responseTimeDetail = dashboardStats?.avgResponseMinutes != null ? 'Average response' : 'Awaiting first response';
  const weeklyTotal = dashboardStats?.weeklyTotal || 0;
  const chartData = dashboardStats?.chartData || [0, 0, 0, 0, 0, 0, 0];
  const checklist = dashboardStats?.checklist || {
    skillChosen: Boolean(user?.primarySkill),
    serviceAreaSet: Boolean(user?.serviceArea || user?.city),
    rateSet: Boolean(Number(user?.hourlyRate) > 0),
    phoneVerified: Boolean(user?.phoneNumber),
  };

  const hasIncompleteChecklist = !checklist.skillChosen || !checklist.serviceAreaSet || !checklist.rateSet || !checklist.phoneVerified;

  return (
    <>
      <div className="welcome-row worker-welcome">
        <div>
          <div className="eyebrow">YOUR BUSINESS AT A GLANCE</div>
          <h1>
            Good morning, {firstName} <span className="wave">✳</span>
          </h1>
          <p>Here’s what’s happening with your work today.</p>
        </div>
      </div>

      {/* Complete your profile checklist on the dashboard for new workers */}
      {hasIncompleteChecklist && (
        <div className="panel profile-checklist-card" style={{ marginBottom: '24px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div>
              <strong style={{ fontSize: '15px', color: '#0f172a' }}>Complete your profile</strong>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>Complete these steps to receive requests and build customer trust.</p>
            </div>
            <button className="btn secondary small" onClick={() => navigate('/worker/profile')}>
              Update profile
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: checklist.skillChosen ? '#16a34a' : '#64748b' }}>
              <Check size={16} color={checklist.skillChosen ? '#16a34a' : '#cbd5e1'} />
              <span>Skill: {user?.primarySkill || 'Not selected'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: checklist.serviceAreaSet ? '#16a34a' : '#64748b' }}>
              <Check size={16} color={checklist.serviceAreaSet ? '#16a34a' : '#cbd5e1'} />
              <span>Service area: {user?.serviceArea || user?.city || 'Not set'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: checklist.rateSet ? '#16a34a' : '#64748b' }}>
              <Check size={16} color={checklist.rateSet ? '#16a34a' : '#cbd5e1'} />
              <span>Rate: {user?.hourlyRate ? `₹${user.hourlyRate}/hr` : 'Not set'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: checklist.phoneVerified ? '#16a34a' : '#64748b' }}>
              <Check size={16} color={checklist.phoneVerified ? '#16a34a' : '#cbd5e1'} />
              <span>Phone contact verified</span>
            </div>
          </div>
        </div>
      )}

      <div className="worker-stat-grid">
        <StatCard icon={Wallet} label="Today’s earnings" value={todayEarningsVal} detail="Direct bank transfer" trend={dashboardStats?.todayEarnings > 0} />
        <StatCard icon={BriefcaseBusiness} label="Jobs completed" value={completedJobsVal} detail="This week" />
        <StatCard icon={Star} label="Your rating" value={ratingVal} detail={ratingDetail} />
        <StatCard icon={Clock3} label="Response time" value={responseTimeVal} detail={responseTimeDetail} />
      </div>

      <div className="worker-dashboard-grid">
        <section className="panel request-panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">READY WHEN YOU ARE</div>
              <h2>
                New job requests <span className="count-pill">{safeJobs.length}</span>
              </h2>
            </div>
            <button className="text-action" onClick={() => navigate('/worker/jobs')}>
              View all <ArrowRight size={15} />
            </button>
          </div>
          {safeJobs.slice(0, 2).map((job) => (
            <CompactRequest key={job.id} job={job} onAccept={onAccept} onCounter={onCounter} />
          ))}
          {safeJobs.length === 0 && (
            <div className="small-empty" style={{ padding: '24px 16px', textAlign: 'center', color: '#64748b' }}>
              No job requests right now. We will notify you when a matching job is posted nearby.
            </div>
          )}
        </section>

        <section className="panel earnings-panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">KEEP IT GOING</div>
              <h2>Earnings overview</h2>
            </div>
            <button className="icon-btn" onClick={() => navigate('/worker/earnings')}>
              <ArrowUpRight size={17} />
            </button>
          </div>
          <div className="earnings-main">
            <div>
              <small>Earned this week</small>
              <strong>{money(weeklyTotal)}</strong>
              {weeklyTotal > 0 ? (
                <span>
                  <TrendingUp size={14} /> Active payouts
                </span>
              ) : (
                <span style={{ color: '#94a3b8' }}>No earnings yet</span>
              )}
            </div>
            {weeklyTotal === 0 ? (
              <div style={{ height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>
                No earnings yet
              </div>
            ) : (
              <div className="earnings-chart" aria-label="Weekly earnings chart">
                {chartData.map((amount, i) => {
                  const maxAmt = Math.max(...chartData, 1);
                  const pct = Math.round((amount / maxAmt) * 100);
                  return (
                    <div key={i} className={amount > 0 ? 'bar active' : 'bar'} style={{ height: `${Math.max(10, pct)}%` }}>
                      <i />
                    </div>
                  );
                })}
              </div>
            )}
            <div className="chart-days">
              <span>M</span>
              <span>T</span>
              <span>W</span>
              <span>T</span>
              <span>F</span>
              <span>S</span>
              <span>S</span>
            </div>
          </div>
          <div className="earnings-foot">
            <span>
              <span className="legend-dot" /> This week
            </span>
            <button onClick={() => navigate('/worker/earnings')}>
              View breakdown <ArrowRight size={14} />
            </button>
          </div>
        </section>
      </div>

      <section className="section-block worker-lower">
        <SectionTitle
          eyebrow="QUICK ACCESS"
          title="Manage your business"
          subtitle="Tools to keep your workday moving efficiently."
        />
        <div className="quick-tools">
          <button onClick={() => navigate('/worker/active')}>
            <span className="quick-tool-icon lavender">
              <ClipboardList size={19} />
            </span>
            <strong>Active jobs</strong>
            <small>{safeActiveJobs.length} in progress</small>
            <ArrowUpRight size={15} />
          </button>
          <button onClick={() => navigate('/worker/rates')}>
            <span className="quick-tool-icon amber">
              <CircleDollarSign size={19} />
            </span>
            <strong>My rates</strong>
            <small>Set hourly fees</small>
            <ArrowUpRight size={15} />
          </button>
          <button onClick={() => navigate('/worker/earnings')}>
            <span className="quick-tool-icon green">
              <Wallet size={19} />
            </span>
            <strong>Earnings</strong>
            <small>Payout ledger</small>
            <ArrowUpRight size={15} />
          </button>
          <button onClick={() => navigate('/worker/reviews')}>
            <span className="quick-tool-icon blue">
              <Star size={19} />
            </span>
            <strong>Ratings & reviews</strong>
            <small>Build reputation</small>
            <ArrowUpRight size={15} />
          </button>
        </div>
      </section>
    </>
  );
}

function WorkerJobs({ jobs = [], onAccept, onCounter, notify }) {
  const navigate = useNavigate();
  const safeJobs = Array.isArray(jobs) ? jobs : [];

  return (
    <>
      <PageHeading
        eyebrow="YOUR NEXT OPPORTUNITY"
        title="Job requests"
        subtitle="Review the details, then accept or suggest a fair price."
      />
      <div className="request-toolbar">
        <div className="request-toolbar-label">
          <span className="live-dot" /> {safeJobs.length} new requests <span>·</span> Nearby matching jobs
        </div>
        <button
          className="filter-btn"
          onClick={() => notify('Filter criteria updated: Showing nearby requests.')}
        >
          <SlidersHorizontal size={16} /> Filters
        </button>
      </div>
      {safeJobs.length ? (
        <div className="job-request-list">
          {safeJobs.map((job) => (
            <JobRequestCard key={job.id} job={job} onAccept={onAccept} onCounter={onCounter} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={BriefcaseBusiness}
          title="You’re all caught up"
          text="No job requests right now. We will notify you when a matching job is posted nearby."
          action="Back to dashboard"
          onAction={() => navigate('/worker')}
        />
      )}
    </>
  );
}

function WorkerActive({ activeJobs = [], onCompleteJob, notify }) {
  const navigate = useNavigate();
  const safeActiveJobs = Array.isArray(activeJobs) ? activeJobs : [];

  return (
    <>
      <PageHeading
        eyebrow="WORK IN PROGRESS"
        title="Active jobs"
        subtitle="Keep each customer updated from acceptance to completion."
      />
      {safeActiveJobs.length ? (
        <div className="job-request-list">
          {safeActiveJobs.map((job) => (
            <article className="job-card" key={job.id}>
              <div className="job-card-main">
                <div className="job-category-icon">
                  <Wrench size={19} />
                </div>
                <div className="job-card-details">
                  <div className="job-card-eyebrow">
                    <Tag tone="success" dot>
                      Accepted & Active
                    </Tag>
                    <span>
                      {job.id} · {job.time || 'In progress'}
                    </span>
                  </div>
                  <h3>{job.title}</h3>
                  <div className="job-customer">
                    <Avatar initials={job.initials || 'CU'} size="xs" />
                    <span>{job.customer}</span>
                    <i />
                    <MapPin size={13} />
                    <span>{job.location}</span>
                  </div>
                  <div className="job-extra">
                    <span>
                      <Clock3 size={14} /> Active job
                    </span>
                    <span>
                      <ShieldCheck size={14} /> Customer address visible
                    </span>
                  </div>
                </div>
                <div className="job-card-price">
                  <small>Agreed price</small>
                  <strong>{money(job.price)}</strong>
                  <span>Direct payout</span>
                </div>
              </div>
              <div className="job-card-actions">
                <Button onClick={() => onCompleteJob(job)}>
                  <Check size={15} /> Mark job completed
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={ClipboardList}
          title="No active jobs right now"
          text="Accept incoming customer requests to manage your active jobs here."
          action="View job requests"
          onAction={() => navigate('/worker/jobs')}
        />
      )}
    </>
  );
}

// ================= SHARED COMPONENTS =================

function PageHeading({ eyebrow, title, subtitle }) {
  return (
    <div className="page-heading">
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  );
}

function CategoryGrid({ category, setCategory, counts = {} }) {
  const serviceCategories = [
    { name: 'Plumbing', icon: Wrench },
    { name: 'Electrical', icon: Zap },
    { name: 'Cleaning', icon: Sparkles },
    { name: 'Painting', icon: Paintbrush },
    { name: 'AC repair', icon: Snowflake },
    { name: 'Carpentry', icon: Hammer },
  ];

  return (
    <div className="category-grid">
      {serviceCategories.map(({ name, icon: Icon }, i) => {
        const count = counts[name] || 0;
        const countText = count > 0 ? `${count} nearby` : 'None nearby yet';
        return (
          <button
            key={name}
            className={`category-card ${category === name ? 'chosen' : ''}`}
            onClick={() => setCategory(category === name ? 'All services' : name)}
          >
            <span className={`category-icon cat-${i}`}>
              <Icon size={21} />
            </span>
            <strong>{name}</strong>
            <small>{countText}</small>
            <ArrowUpRight size={14} className="category-arrow" />
          </button>
        );
      })}
    </div>
  );
}

function WorkerGrid({ workers, onBook, liked, setLiked }) {
  if (!workers || !workers.length) {
    return (
      <div className="empty-inline" style={{ padding: '32px 16px', textAlign: 'center', background: '#fff', borderRadius: '12px', border: '1px dashed #cbd5e1', color: '#64748b' }}>
        No verified service professionals currently available in this category nearby.
      </div>
    );
  }
  return (
    <div className="worker-grid">
      {workers.map((w) => {
        const isNew = w.rating == null || w.reviews === 0;
        return (
          <article className="worker-card" key={w.id}>
            <div className="worker-card-top">
              <Avatar initials={w.initials || 'WP'} color={w.color || 'sand'} size="lg" />
              <button
                className={`heart-btn ${liked.includes(w.id) ? 'liked' : ''}`}
                onClick={() =>
                  setLiked((prev) =>
                    prev.includes(w.id) ? prev.filter((id) => id !== w.id) : [...prev, w.id]
                  )
                }
                aria-label="Save professional"
              >
                <Heart size={17} fill={liked.includes(w.id) ? 'currentColor' : 'none'} />
              </button>
            </div>
            <div className="worker-name-row">
              <h3>{w.name}</h3>
              {w.verified && <BadgeCheck size={16} className="verified-icon" />}
            </div>
            <div className="worker-job">{w.job}</div>
            <div className="worker-meta">
              <span>
                {isNew ? (
                  <Tag tone="neutral">New</Tag>
                ) : (
                  <>
                    <Star size={14} fill="currentColor" /> <b>{w.rating}</b> <small>({w.reviews})</small>
                  </>
                )}
              </span>
              <i />
              <span>
                <MapPin size={13} />
                {w.distance || 'Nearby'}
              </span>
            </div>
            <div className="worker-card-bottom">
              <div>
                <small>Typical visit from</small>
                <strong>
                  {money(w.price)}
                  <small> / visit</small>
                </strong>
              </div>
              <Button size="small" onClick={() => onBook(w, w.job?.split(' ')[0] || 'General')}>
                Book now <ArrowRight size={14} />
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function BookingsPage({ bookings = [], onRefresh }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [reviewJob, setReviewJob] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalBookings = bookings.length;
  const inProgress = bookings.filter((b) => b.status === 'In progress' || b.status === 'accepted').length;
  const completed = bookings.filter((b) => b.status === 'completed').length;

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!reviewJob) return;
    setIsSubmitting(true);
    try {
      await dbService.submitReview({
        customerId: user.id,
        customerName: user.fullName || 'Verified Customer',
        jobId: reviewJob.id,
        rating,
        comment,
      });
      setReviewJob(null);
      setComment('');
      onRefresh?.();
    } catch (err) {
      alert(err.message || 'Failed to submit review');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PageHeading
        eyebrow="YOUR HOME, IN GOOD HANDS"
        title="My bookings"
        subtitle="Keep track of requests, appointments, and completed work."
      />
      <div className="booking-stats">
        <StatCard icon={CalendarDays} label="Total bookings" value={String(totalBookings)} detail="Confirmed appointments" />
        <StatCard icon={Timer} label="In progress" value={String(inProgress)} detail="Underway" />
        <StatCard icon={CircleCheckBig} label="Completed" value={String(completed)} detail="Verified history" />
      </div>
      <SectionTitle title="Recent activity" subtitle="Your service booking records." />
      {bookings.length > 0 ? (
        <div className="table-card">
          <div className="table-head">
            <span>Service</span>
            <span>Professional</span>
            <span>Schedule</span>
            <span>Amount</span>
            <span>Status</span>
          </div>
          {bookings.map((b) => (
            <div className="booking-row" key={b.id}>
              <div className="booking-service">
                <span className="table-service-icon">
                  <Wrench size={17} />
                </span>
                <span>
                  <strong>{b.title}</strong>
                  <small>{b.id}</small>
                </span>
              </div>
              <span className="table-worker">{b.worker}</span>
              <span className="table-schedule">
                {b.date}
                <small>{b.time}</small>
              </span>
              <strong>{money(b.price)}</strong>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Tag tone={b.status === 'In progress' ? 'blue' : b.status === 'completed' ? 'success' : 'warning'} dot>
                  {b.status}
                </Tag>
                {b.status === 'completed' && (
                  <button
                    className="btn secondary small"
                    onClick={() => setReviewJob(b)}
                    style={{ fontSize: '11px', padding: '4px 8px' }}
                  >
                    Leave review
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={CalendarDays}
          title="No bookings yet"
          text="When you book a verified technician, your service appointment will appear here."
          action="Find a service"
          onAction={() => navigate('/customer/explore')}
        />
      )}
      <div className="center-action" style={{ marginTop: '24px' }}>
        <Button variant="secondary" onClick={() => navigate('/customer/explore')}>
          Find another service <ArrowRight size={15} />
        </Button>
      </div>

      {reviewJob && (
        <Modal
          title="Leave a review"
          subtitle={`Rate your experience for ${reviewJob.title} with ${reviewJob.worker}.`}
          onClose={() => setReviewJob(null)}
        >
          <form onSubmit={handleReviewSubmit}>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label>Rating (1 to 5 stars)</label>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '24px',
                      color: star <= rating ? '#f59e0b' : '#cbd5e1',
                    }}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label>Review comment</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="How was the quality of work and punctuality?"
                rows="3"
                required
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <Button variant="secondary" onClick={() => setReviewJob(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting…' : 'Submit review'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function MessagesPage({ notify }) {
  return (
    <>
      <PageHeading
        eyebrow="DIRECT COMMUNICATION"
        title="Messages"
        subtitle="Coordinate service details directly with your technician or customer."
      />
      <EmptyState
        icon={MessageCircle}
        title="No active messages"
        text="Messages will appear here as soon as you connect with customers or service professionals regarding an active job."
      />
    </>
  );
}

function ProfilePage({ role, notify }) {
  const { user, changePassword } = useAuth();
  const navigate = useNavigate();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [isChanging, setIsChanging] = useState(false);

  const fullNameSafe = (user?.fullName || (role === 'customer' ? 'Valued Customer' : 'Service Partner')).trim();
  const parts = fullNameSafe.split(/\s+/).filter(Boolean);
  const initials = parts.length >= 2
    ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    : parts[0]?.slice(0, 2).toUpperCase() || 'SQ';

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!oldPassword) {
      setPwError('Please enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters long.');
      return;
    }
    if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setPwError('Password must contain at least one letter and one number.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match.');
      return;
    }

    setIsChanging(true);
    setPwError('');
    try {
      await changePassword({ oldPassword, newPassword });
      notify('Password updated successfully. Please log in with your new credentials.');
      setShowPasswordModal(false);
      navigate('/login', { replace: true });
    } catch (err) {
      setPwError(err.message || 'Failed to update password.');
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <>
      <PageHeading
        eyebrow="YOUR ACCOUNT"
        title="Profile & settings"
        subtitle="Manage your personal information, addresses, and account security."
      />
      <div className="profile-layout">
        <div className="profile-card">
          <Avatar initials={initials} color="dark" size="xl" />
          <h2>{user?.fullName || (role === 'customer' ? 'Valued Customer' : 'Service Partner')}</h2>
          <p>
            {role === 'customer'
              ? 'Customer Account'
              : `${user?.primarySkill || 'Verified'} Service Professional`}
          </p>
          <Tag tone="success" dot>
            Active Account
          </Tag>
          <Button variant="secondary" onClick={() => notify('Account details are up to date.')}>
            Edit profile
          </Button>
        </div>
        <div className="settings-list">
          <SettingsRow
            icon={UserRound}
            title="Personal information"
            subtitle={`${user?.email || 'name@example.com'}${user?.phoneNumber ? ' • ' + user.phoneNumber : ''}`}
            onClick={() => notify('Personal details view active.')}
          />
          <SettingsRow
            icon={MapPin}
            title="Saved locations"
            subtitle={user?.city || user?.area || user?.serviceArea || 'Mumbai Suburbs'}
            onClick={() => notify('Location settings view active.')}
          />
          <SettingsRow
            icon={CalendarDays}
            title="Notification preferences"
            subtitle="SMS alerts and push notifications enabled"
            onClick={() => notify('Notification settings view active.')}
          />
          <SettingsRow
            icon={ShieldCheck}
            title="Privacy & security"
            subtitle="Password protection and session management"
            onClick={() => {
              setPwError('');
              setOldPassword('');
              setNewPassword('');
              setConfirmPassword('');
              setShowPasswordModal(true);
            }}
          />
        </div>
      </div>

      {showPasswordModal && (
        <Modal
          title="Change account password"
          subtitle="Update your password to keep your Serviq account secure."
          onClose={() => setShowPasswordModal(false)}
        >
          <form onSubmit={handleChangePassword} className="auth-form" style={{ marginTop: '16px' }}>
            {pwError && (
              <div className="auth-alert error" style={{ marginBottom: '16px' }}>
                <span>{pwError}</span>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="current-pw-input">Current password</label>
              <input
                id="current-pw-input"
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Enter current password"
                required
                disabled={isChanging}
              />
            </div>

            <div className="form-group">
              <label htmlFor="new-pw-input">New password</label>
              <input
                id="new-pw-input"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 8 characters with letter & number"
                required
                disabled={isChanging}
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirm-pw-input">Confirm new password</label>
              <input
                id="confirm-pw-input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                required
                disabled={isChanging}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <Button type="button" variant="secondary" onClick={() => setShowPasswordModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isChanging || !oldPassword || !newPassword || !confirmPassword}>
                {isChanging ? 'Updating password…' : 'Update password'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function SettingsRow({ icon: Icon, title, subtitle, onClick }) {
  return (
    <button className="settings-row" onClick={onClick}>
      <span className="settings-row-icon">
        <Icon size={19} />
      </span>
      <span>
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
      <ArrowRight size={17} />
    </button>
  );
}

function StatCard({ icon: Icon, label, value, detail, trend }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span className="stat-icon">
          <Icon size={18} />
        </span>
        {trend && (
          <span className="stat-trend">
            <TrendingUp size={13} />
          </span>
        )}
      </div>
      <small>{label}</small>
      <strong>{value}</strong>
      <span className={trend ? 'stat-detail positive' : 'stat-detail'}>{detail}</span>
    </div>
  );
}

function CompactRequest({ job, onAccept, onCounter }) {
  return (
    <div className="compact-request">
      <div className="compact-job-icon">
        <Wrench size={17} />
      </div>
      <div className="compact-job-info">
        <strong>{job.title}</strong>
        <span>
          {job.location} <i /> {job.time}
        </span>
        <small>
          {job.customer} · {job.id}
        </small>
      </div>
      <div className="compact-job-price">
        <small>Customer budget</small>
        <strong>{money(job.price)}</strong>
        <div>
          <button onClick={() => onCounter(job)}>Counter</button>
          <button onClick={() => onAccept(job)}>Accept</button>
        </div>
      </div>
    </div>
  );
}

function JobRequestCard({ job, onAccept, onCounter, active = false }) {
  return (
    <article className="job-card">
      <div className="job-card-main">
        <div className="job-category-icon">
          <Wrench size={19} />
        </div>
        <div className="job-card-details">
          <div className="job-card-eyebrow">
            <Tag tone={active ? 'success' : 'warning'} dot>
              {active ? 'Accepted & Active' : 'New request'}
            </Tag>
            <span>
              {job.id} · {job.time || 'Just now'}
            </span>
          </div>
          <h3>{job.title}</h3>
          <div className="job-customer">
            <Avatar initials={job.initials || 'CU'} size="xs" />
            <span>{job.customer}</span>
            <i />
            <MapPin size={13} />
            <span>{job.location}</span>
          </div>
          <div className="job-extra">
            <span>
              <Clock3 size={14} /> Flexible timing
            </span>
            <span>
              <ShieldCheck size={14} /> Customer address visible
            </span>
          </div>
        </div>
        <div className="job-card-price">
          <small>Customer budget</small>
          <strong>{money(job.price)}</strong>
          <span>Fixed price agreement</span>
        </div>
      </div>
      <div className="job-card-actions">
        <button
          className="job-secondary-action"
          onClick={() => onCounter(job)}
          disabled={active}
        >
          Make a counter-offer
        </button>
        <Button onClick={() => onAccept(job)} disabled={active}>
          {active ? (
            <>
              <Check size={15} /> Accepted
            </>
          ) : (
            <>
              Accept job <ArrowRight size={15} />
            </>
          )}
        </Button>
      </div>
    </article>
  );
}

function EarningsPage({ notify }) {
  const { user } = useAuth();
  const [ledgerData, setLedgerData] = useState({
    transactions: [],
    thisWeekTotal: 0,
    thisMonthTotal: 0,
    completedJobsCount: 0,
  });

  useEffect(() => {
    if (!user?.id) return;
    dbService.getWorkerLedger(user.id).then((data) => setLedgerData(data));
  }, [user?.id]);

  return (
    <>
      <PageHeading
        eyebrow="YOUR HARD WORK, TRACKED"
        title="Earnings & payouts"
        subtitle="Track completed jobs, weekly payouts, and platform settlements."
      />
      <div className="booking-stats">
        <StatCard icon={Wallet} label="This week" value={money(ledgerData.thisWeekTotal)} detail="Direct bank transfer" trend={ledgerData.thisWeekTotal > 0} />
        <StatCard icon={CircleDollarSign} label="This month" value={money(ledgerData.thisMonthTotal)} detail="Net payouts" />
        <StatCard icon={BriefcaseBusiness} label="Completed jobs" value={String(ledgerData.completedJobsCount)} detail="Verified" />
      </div>
      <div className="panel earnings-breakdown">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">TRANSACTION HISTORY</div>
            <h2>Recent earnings</h2>
          </div>
          <button className="filter-btn" onClick={() => notify('Filtered to your settlements.')}>
            <Filter size={15} /> Filter <ChevronDown size={14} />
          </button>
        </div>
        {ledgerData.transactions.length > 0 ? (
          ledgerData.transactions.map((t) => (
            <div className="earning-row" key={t.id}>
              <span className="earning-check">
                <Check size={15} />
              </span>
              <span>
                <strong>{t.jobTitle || 'Completed service'}</strong>
                <small>{t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-IN') : 'Completed'}</small>
              </span>
              <Tag tone="success">Settled</Tag>
              <strong>{money(t.amount)}</strong>
            </div>
          ))
        ) : (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: '#64748b' }}>
            No earnings yet. Completed jobs will appear here in your payout ledger.
          </div>
        )}
      </div>
      <div className="inline-note">
        <Shield size={15} /> All payout settlements are processed automatically via UPI / NEFT bank transfer within 24 hours of job completion.
      </div>
    </>
  );
}

function ReviewsPage() {
  const { user } = useAuth();
  const [reviewsData, setReviewsData] = useState({
    reviews: [],
    averageRating: null,
    totalCount: 0,
    distribution: [0, 0, 0, 0, 0],
  });

  useEffect(() => {
    if (!user?.id) return;
    dbService.getWorkerReviews(user.id).then((data) => setReviewsData(data));
  }, [user?.id]);

  if (reviewsData.totalCount === 0) {
    return (
      <>
        <PageHeading
          eyebrow="YOUR REPUTATION MATTERS"
          title="Ratings & reviews"
          subtitle="Build your business reputation with every satisfied customer."
        />
        <EmptyState
          icon={Star}
          title="No reviews yet"
          text="Complete jobs for nearby customers to earn your first rating and customer testimonials."
        />
      </>
    );
  }

  const avgScore = reviewsData.averageRating != null ? String(reviewsData.averageRating) : 'New';

  return (
    <>
      <PageHeading
        eyebrow="YOUR REPUTATION MATTERS"
        title="Ratings & reviews"
        subtitle="Build your business reputation with every satisfied customer."
      />
      <div className="reviews-summary">
        <div>
          <strong>{avgScore}</strong>
          <span className="review-stars">{'★'.repeat(Math.round(reviewsData.averageRating || 5))}</span>
          <small>Based on {reviewsData.totalCount} verified review{reviewsData.totalCount === 1 ? '' : 's'}</small>
        </div>
        <div className="rating-bars">
          {[5, 4, 3, 2, 1].map((n, i) => {
            const count = reviewsData.distribution[i];
            const pct = reviewsData.totalCount > 0 ? Math.round((count / reviewsData.totalCount) * 100) : 0;
            return (
              <div key={n}>
                <span>
                  {n} <Star size={11} fill="currentColor" />
                </span>
                <div>
                  <i style={{ width: `${pct}%` }} />
                </div>
                <small>{count}</small>
              </div>
            );
          })}
        </div>
      </div>
      <div className="review-list">
        {reviewsData.reviews.map((r, i) => (
          <div className="review-card" key={r.id}>
            <Avatar initials={(r.customerName || 'CU').slice(0, 2).toUpperCase()} color={['sand', 'blue', 'green'][i % 3]} />
            <div>
              <div className="review-card-head">
                <strong>{r.customerName}</strong>
                <span>{'★'.repeat(r.rating || 5)}</span>
              </div>
              <p>{r.comment || 'Quality service completed.'}</p>
              <small>{r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN') : 'Recent'} · Verified customer</small>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function EmptyState({ icon: Icon, title, text, action, onAction }) {
  return (
    <div className="empty-state">
      <span>
        <Icon size={25} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <Button variant="secondary" onClick={onAction}>
          {action} <ArrowRight size={15} />
        </Button>
      )}
    </div>
  );
}

function Modal({ title, subtitle, onClose, children }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          <div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close dialog">
            <X size={19} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
