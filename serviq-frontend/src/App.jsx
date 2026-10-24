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
import LiveTrackingModal from './components/LiveTrackingModal.jsx';
import MessagesPage from './pages/MessagesPage.jsx';

import {
  Search, MapPin, ChevronDown, ArrowUpRight, ArrowRight, Star, ShieldCheck,
  Clock3, Wrench, Zap, Paintbrush, Sparkles, Snowflake, Hammer, Flame,
  CalendarDays, TrendingUp, Check, X, Plus, Minus, SlidersHorizontal,
  CircleDollarSign, Phone, Send, BadgeCheck, House, Heart, Filter,
  ClipboardList, CircleCheckBig, Timer, Shield, UserRound, BriefcaseBusiness,
  Wallet, MessageCircle, Navigation
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
        (j) => j.acceptedWorkerId === user.id && ['accepted', 'on_the_way', 'arrived', 'in_progress'].includes(j.status)
      );
      setActiveJobs(
        active.map((j) => ({
          id: j.id,
          title: j.title || `${j.service} service`,
          category: j.service || j.category,
          customer: j.customerName || 'Customer',
          location: j.location || j.area || 'Nearby',
          price: Number(j.agreedPrice || j.budget || j.price || 400),
          status: j.status,
          rawStatus: j.status,
          latitude: j.latitude,
          longitude: j.longitude,
          workerLatitude: j.workerLatitude,
          workerLongitude: j.workerLongitude,
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

  const startTravelAction = async (job) => {
    try {
      await dbService.updateJobStatus(job.id, 'on_the_way', user.id);
      notify('You are en route! Live GPS location sharing is active.');

      // Try reading browser GPS if permitted
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            await dbService.updateWorkerLocation(user.id, {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            });
            await loadWorkerData();
          },
          (err) => {
            console.log('[GPS] Using standard location:', err.message);
          },
          { enableHighAccuracy: true, timeout: 5000 }
        );
      }

      await loadWorkerData();
    } catch (err) {
      notify(err.message || 'Failed to start travel.');
    }
  };

  const stepCloserAction = async (job) => {
    try {
      // Find current worker position and customer destination
      const destLat = job.latitude || 19.298;
      const destLng = job.longitude || 72.855;
      const currentLat = job.workerLatitude || user?.latitude || 19.284;
      const currentLng = job.workerLongitude || user?.longitude || 72.868;

      // Move 25% closer towards customer
      const stepLat = currentLat + (destLat - currentLat) * 0.25;
      const stepLng = currentLng + (destLng - currentLng) * 0.25;

      await dbService.updateWorkerLocation(user.id, {
        latitude: stepLat,
        longitude: stepLng,
      });

      notify('Simulated GPS location update: moved closer to customer destination.');
      await loadWorkerData();
    } catch (err) {
      notify(err.message || 'Failed to update location.');
    }
  };

  const arrivedAction = async (job) => {
    try {
      await dbService.updateJobStatus(job.id, 'arrived', user.id);
      notify('Status updated: You have arrived at the customer address.');
      await loadWorkerData();
    } catch (err) {
      notify(err.message || 'Failed to update status.');
    }
  };

  const startWorkAction = async (job) => {
    try {
      await dbService.updateJobStatus(job.id, 'in_progress', user.id);
      notify('Service underway: Job marked in progress.');
      await loadWorkerData();
    } catch (err) {
      notify(err.message || 'Failed to start job.');
    }
  };

  const completeJobAction = async (job) => {
    try {
      await dbService.updateJobStatus(job.id, 'completed', user.id);
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
                onStartTravel={startTravelAction}
                onStepCloser={stepCloserAction}
                onArrived={arrivedAction}
                onStartWork={startWorkAction}
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
  const [showTrustModal, setShowTrustModal] = useState(false);

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
        <button onClick={() => setShowTrustModal(true)}>
          How it works <ArrowUpRight size={15} />
        </button>
      </section>

      {showTrustModal && (
        <Modal
          title="How Serviq Works"
          subtitle="Your trusted neighborhood marketplace for verified home services."
          onClose={() => setShowTrustModal(false)}
        >
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ShieldCheck size={20} />
              </div>
              <div>
                <strong style={{ fontSize: '15px', color: '#0f172a', display: 'block' }}>1. Verified Professionals</strong>
                <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#64748b' }}>Every service partner undergoes identity verification, trade skill vetting, and background checks.</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Navigation size={20} />
              </div>
              <div>
                <strong style={{ fontSize: '15px', color: '#0f172a', display: 'block' }}>2. Real-time Live GPS Tracking</strong>
                <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#64748b' }}>Watch your technician travel towards your address with turn-by-turn road routes, remaining kilometers, and live arrival ETAs.</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CircleDollarSign size={20} />
              </div>
              <div>
                <strong style={{ fontSize: '15px', color: '#0f172a', display: 'block' }}>3. Transparent Agreed Pricing</strong>
                <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#64748b' }}>No hidden surge charges or surprise bills. You agree on fair rates before technician arrival.</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#fdf4ff', color: '#a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Star size={20} />
              </div>
              <div>
                <strong style={{ fontSize: '15px', color: '#0f172a', display: 'block' }}>4. 100% Satisfaction Guarantee</strong>
                <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#64748b' }}>Pay only after the service is completed to your expectations, backed by 24/7 dedicated customer assistance.</p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <Button onClick={() => setShowTrustModal(false)}>Got it</Button>
            </div>
          </div>
        </Modal>
      )}
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
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [minBudget, setMinBudget] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState('newest');

  const filteredJobs = useMemo(() => {
    return safeJobs.filter((job) => {
      const price = Number(job.price || 0);
      if (price < minBudget) return false;
      if (selectedCategory !== 'All') {
        const cat = (job.category || job.service || '').toLowerCase();
        const title = (job.title || '').toLowerCase();
        const searchCat = selectedCategory.toLowerCase();
        if (!cat.includes(searchCat) && !title.includes(searchCat)) return false;
      }
      return true;
    }).sort((a, b) => {
      if (sortBy === 'price_high') return (b.price || 0) - (a.price || 0);
      if (sortBy === 'price_low') return (a.price || 0) - (b.price || 0);
      return 0;
    });
  }, [safeJobs, minBudget, selectedCategory, sortBy]);

  return (
    <>
      <PageHeading
        eyebrow="YOUR NEXT OPPORTUNITY"
        title="Job requests"
        subtitle="Review the details, then accept or suggest a fair price."
      />
      <div className="request-toolbar">
        <div className="request-toolbar-label">
          <span className="live-dot" /> {filteredJobs.length} matching requests <span>·</span> Nearby matching jobs
          {(minBudget > 0 || selectedCategory !== 'All') && (
            <Tag tone="warning">Filtered</Tag>
          )}
        </div>
        <button
          className="filter-btn"
          onClick={() => setShowFilterModal(true)}
        >
          <SlidersHorizontal size={16} /> Filters
        </button>
      </div>

      {filteredJobs.length ? (
        <div className="job-request-list">
          {filteredJobs.map((job) => (
            <JobRequestCard key={job.id} job={job} onAccept={onAccept} onCounter={onCounter} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={BriefcaseBusiness}
          title={safeJobs.length ? "No jobs match your filter criteria" : "You’re all caught up"}
          text={safeJobs.length ? "Try lowering your minimum budget or selecting all categories to view available requests." : "No job requests right now. We will notify you when a matching job is posted nearby."}
          action={safeJobs.length ? "Reset filters" : "Back to dashboard"}
          onAction={() => {
            if (safeJobs.length) {
              setMinBudget(0);
              setSelectedCategory('All');
              setSortBy('newest');
            } else {
              navigate('/worker');
            }
          }}
        />
      )}

      {showFilterModal && (
        <Modal
          title="Filter job requests"
          subtitle="Refine incoming requests by category, minimum budget, and priority."
          onClose={() => setShowFilterModal(false)}
        >
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label>Service Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
              >
                <option value="All">All Categories</option>
                <option value="Plumbing">Plumbing</option>
                <option value="Electrical">Electrical</option>
                <option value="Cleaning">Cleaning</option>
                <option value="AC repair">AC repair</option>
                <option value="Painting">Painting</option>
                <option value="Carpentry">Carpentry</option>
              </select>
            </div>

            <div className="form-group">
              <label>Minimum Budget ({money(minBudget)})</label>
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                {[0, 300, 450, 600].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setMinBudget(amt)}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      border: minBudget === amt ? '2px solid #FF9900' : '1px solid #cbd5e1',
                      background: minBudget === amt ? '#fffbeb' : '#fff',
                      fontWeight: minBudget === amt ? '700' : '500',
                      cursor: 'pointer',
                    }}
                  >
                    {amt === 0 ? 'Any' : `≥ ${money(amt)}`}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Sort Order</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
              >
                <option value="newest">Most Recent First</option>
                <option value="price_high">Highest Budget First</option>
                <option value="price_low">Lowest Budget First</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
              <button
                type="button"
                className="text-action"
                onClick={() => {
                  setMinBudget(0);
                  setSelectedCategory('All');
                  setSortBy('newest');
                }}
              >
                Reset all
              </button>
              <Button onClick={() => setShowFilterModal(false)}>
                Apply Filters
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function WorkerActive({
  activeJobs = [],
  onStartTravel,
  onStepCloser,
  onArrived,
  onStartWork,
  onCompleteJob,
  notify,
}) {
  const navigate = useNavigate();
  const safeActiveJobs = Array.isArray(activeJobs) ? activeJobs : [];

  return (
    <>
      <PageHeading
        eyebrow="WORK IN PROGRESS"
        title="Active jobs"
        subtitle="Keep each customer updated with real-time GPS tracking from acceptance to completion."
      />
      {safeActiveJobs.length ? (
        <div className="job-request-list">
          {safeActiveJobs.map((job) => {
            const rawStatus = job.rawStatus || 'accepted';
            const isEnRoute = rawStatus === 'on_the_way';
            const isArrived = rawStatus === 'arrived';
            const isInProgress = rawStatus === 'in_progress';

            let statusTone = 'warning';
            let statusLabel = 'Accepted · Ready to depart';

            if (isEnRoute) {
              statusTone = 'blue';
              statusLabel = 'En Route · Sharing Live GPS';
            } else if (isArrived) {
              statusTone = 'blue';
              statusLabel = 'Arrived at Customer Address';
            } else if (isInProgress) {
              statusTone = 'success';
              statusLabel = 'Service Work in Progress';
            }

            return (
              <article className="job-card" key={job.id} style={{ borderLeft: isEnRoute ? '4px solid #FF9900' : undefined }}>
                <div className="job-card-main">
                  <div className="job-category-icon">
                    <Wrench size={19} />
                  </div>
                  <div className="job-card-details">
                    <div className="job-card-eyebrow">
                      <Tag tone={statusTone} dot>
                        {statusLabel}
                      </Tag>
                      <span>
                        {job.id} · {job.time || 'Active now'}
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
                      {isEnRoute ? (
                        <span style={{ color: '#10B981', fontWeight: '600' }}>
                          <Navigation size={14} /> Live GPS broadcasting to customer
                        </span>
                      ) : (
                        <span>
                          <ShieldCheck size={14} /> Customer address confirmed
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="job-card-price">
                    <small>Agreed price</small>
                    <strong>{money(job.price)}</strong>
                    <span>Direct payout</span>
                  </div>
                </div>

                {/* Lifecycle Action Buttons */}
                <div className="job-card-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                  {rawStatus === 'accepted' && (
                    <Button onClick={() => onStartTravel(job)}>
                      <Navigation size={15} /> Start Traveling (Share Live GPS)
                    </Button>
                  )}

                  {isEnRoute && (
                    <>
                      <Button onClick={() => onArrived(job)}>
                        <Check size={15} /> I Have Arrived
                      </Button>
                      <Button variant="secondary" onClick={() => onStepCloser(job)}>
                        <ArrowRight size={14} /> Move Closer (Simulate GPS Step)
                      </Button>
                    </>
                  )}

                  {isArrived && (
                    <Button onClick={() => onStartWork(job)}>
                      <Wrench size={15} /> Start Service Work
                    </Button>
                  )}

                  {isInProgress && (
                    <Button onClick={() => onCompleteJob(job)}>
                      <Check size={15} /> Mark Job Completed
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
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
  const [trackingBookingId, setTrackingBookingId] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalBookings = bookings.length;
  const inProgress = bookings.filter((b) => b.canTrack || b.status === 'In progress' || b.status === 'accepted' || b.rawStatus === 'on_the_way').length;
  const completed = bookings.filter((b) => b.status === 'completed' || b.rawStatus === 'completed').length;

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
        subtitle="Keep track of requests, appointments, and live technician travel."
      />
      <div className="booking-stats">
        <StatCard icon={CalendarDays} label="Total bookings" value={String(totalBookings)} detail="Confirmed appointments" />
        <StatCard icon={Timer} label="In progress" value={String(inProgress)} detail="Active or traveling" />
        <StatCard icon={CircleCheckBig} label="Completed" value={String(completed)} detail="Verified history" />
      </div>
      <SectionTitle title="Recent activity" subtitle="Your service booking records and live tracking." />
      {bookings.length > 0 ? (
        <div className="table-card">
          <div className="table-head">
            <span>Service</span>
            <span>Professional</span>
            <span>Schedule</span>
            <span>Amount</span>
            <span>Status & Tracking</span>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <Tag tone={b.canTrack ? 'blue' : b.status === 'completed' ? 'success' : 'warning'} dot>
                  {b.status}
                </Tag>
                {b.canTrack && (
                  <button
                    className="btn primary small"
                    onClick={() => setTrackingBookingId(b.id)}
                    style={{ fontSize: '11px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '5px' }}
                    title="Track professional's live GPS route"
                  >
                    <Navigation size={12} /> Track Live
                  </button>
                )}
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

      {trackingBookingId && (
        <LiveTrackingModal
          bookingId={trackingBookingId}
          userId={user?.id || 'guest-customer'}
          onClose={() => setTrackingBookingId(null)}
          onRefreshBookings={onRefresh}
        />
      )}
    </>
  );
}

function ProfilePage({ role, notify }) {
  const { user, changePassword, updateUser } = useAuth();
  const navigate = useNavigate();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showLocationsModal, setShowLocationsModal] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);

  // Form states for Edit Profile
  const [editName, setEditName] = useState(user?.fullName || '');
  const [editPhone, setEditPhone] = useState(user?.phoneNumber || '');
  const [editArea, setEditArea] = useState(user?.city || user?.area || user?.serviceArea || 'Bhayandar West, Mumbai');
  const [editSkill, setEditSkill] = useState(user?.primarySkill || 'Plumbing');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Locations state
  const standardLocations = [
    'Bhayandar West, Mumbai',
    'Bhayandar East, Mumbai',
    'Mira Road East, Mumbai',
    'Mira Road West, Mumbai',
    'Borivali West, Mumbai',
    'Kandivali West, Mumbai',
    'Andheri East, Mumbai',
  ];
  const [selectedLoc, setSelectedLoc] = useState(user?.city || user?.area || user?.serviceArea || 'Bhayandar West, Mumbai');
  const [customLoc, setCustomLoc] = useState('');

  // Notification preferences
  const [notifPrefs, setNotifPrefs] = useState(() => {
    try {
      const stored = localStorage.getItem('serviq_notification_prefs');
      return stored ? JSON.parse(stored) : {
        smsTracking: true,
        bookingUpdates: true,
        whatsappReceipts: true,
        promotions: false,
      };
    } catch {
      return { smsTracking: true, bookingUpdates: true, whatsappReceipts: true, promotions: false };
    }
  });

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

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!editName.trim()) {
      notify('Please enter your full name.');
      return;
    }
    setIsSavingProfile(true);
    try {
      const updates = {
        fullName: editName.trim(),
        phoneNumber: editPhone.trim(),
        city: editArea.trim(),
        serviceArea: editArea.trim(),
        ...(role === 'worker' ? { primarySkill: editSkill } : {}),
      };
      if (user?.id) {
        await dbService.updateUserProfile(user.id, updates);
      }
      updateUser?.(updates);
      notify('Profile details updated successfully!');
      setShowEditProfileModal(false);
    } catch (err) {
      notify(err.message || 'Failed to update profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveLocation = async (loc) => {
    const finalLoc = (loc || customLoc || selectedLoc).trim();
    if (!finalLoc) return;
    try {
      const updates = { city: finalLoc, area: finalLoc, serviceArea: finalLoc };
      if (user?.id) {
        await dbService.updateUserProfile(user.id, updates);
      }
      updateUser?.(updates);
      setSelectedLoc(finalLoc);
      setShowLocationsModal(false);
      notify(`Primary service location set to ${finalLoc}`);
    } catch (err) {
      notify(err.message || 'Failed to update location.');
    }
  };

  const handleToggleNotif = (key) => {
    setNotifPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem('serviq_notification_prefs', JSON.stringify(next));
      return next;
    });
    notify('Notification preference saved.');
  };

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
          <Button variant="secondary" onClick={() => {
            setEditName(user?.fullName || '');
            setEditPhone(user?.phoneNumber || '');
            setEditArea(user?.city || user?.area || user?.serviceArea || 'Bhayandar West, Mumbai');
            setEditSkill(user?.primarySkill || 'Plumbing');
            setShowEditProfileModal(true);
          }}>
            Edit profile
          </Button>
        </div>
        <div className="settings-list">
          <SettingsRow
            icon={UserRound}
            title="Personal information"
            subtitle={`${user?.email || 'name@example.com'}${user?.phoneNumber ? ' • ' + user.phoneNumber : ''}`}
            onClick={() => {
              setEditName(user?.fullName || '');
              setEditPhone(user?.phoneNumber || '');
              setEditArea(user?.city || user?.area || user?.serviceArea || 'Bhayandar West, Mumbai');
              setEditSkill(user?.primarySkill || 'Plumbing');
              setShowEditProfileModal(true);
            }}
          />
          <SettingsRow
            icon={MapPin}
            title="Saved locations"
            subtitle={user?.city || user?.area || user?.serviceArea || 'Mumbai Suburbs'}
            onClick={() => setShowLocationsModal(true)}
          />
          <SettingsRow
            icon={CalendarDays}
            title="Notification preferences"
            subtitle="Live GPS tracking alerts and SMS updates active"
            onClick={() => setShowNotifModal(true)}
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

      {/* Edit Profile Modal */}
      {showEditProfileModal && (
        <Modal
          title="Edit account details"
          subtitle="Update your name, contact information, and service area."
          onClose={() => setShowEditProfileModal(false)}
        >
          <form onSubmit={handleSaveProfile} style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label>Full name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Enter full name"
                required
              />
            </div>
            <div className="form-group">
              <label>Phone number</label>
              <input
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="+91 98765 43210"
              />
            </div>
            <div className="form-group">
              <label>Service Area / City</label>
              <input
                type="text"
                value={editArea}
                onChange={(e) => setEditArea(e.target.value)}
                placeholder="e.g. Bhayandar West, Mumbai"
              />
            </div>
            {role === 'worker' && (
              <div className="form-group">
                <label>Primary Skill Category</label>
                <select value={editSkill} onChange={(e) => setEditSkill(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  <option value="Plumbing">Plumbing</option>
                  <option value="Electrical">Electrical</option>
                  <option value="Cleaning">Cleaning</option>
                  <option value="AC repair">AC repair</option>
                  <option value="Painting">Painting</option>
                  <option value="Carpentry">Carpentry</option>
                </select>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
              <Button variant="secondary" onClick={() => setShowEditProfileModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingProfile}>
                {isSavingProfile ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Saved Locations Modal */}
      {showLocationsModal && (
        <Modal
          title="Saved service locations"
          subtitle="Choose or enter your primary address for quick booking."
          onClose={() => setShowLocationsModal(false)}
        >
          <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {standardLocations.map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => handleSaveLocation(loc)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: selectedLoc === loc ? '2px solid #FF9900' : '1px solid #e2e8f0',
                  background: selectedLoc === loc ? '#fffbeb' : '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <MapPin size={16} color={selectedLoc === loc ? '#FF9900' : '#64748b'} />
                  <strong style={{ fontSize: '14px', color: '#0f172a' }}>{loc}</strong>
                </div>
                {selectedLoc === loc && <Tag tone="warning" dot>Default</Tag>}
              </button>
            ))}

            <div style={{ marginTop: '12px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '6px' }}>Or enter custom address</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={customLoc}
                  onChange={(e) => setCustomLoc(e.target.value)}
                  placeholder="Street name, apartment, landmark"
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
                <Button size="small" onClick={() => handleSaveLocation(customLoc)} disabled={!customLoc.trim()}>
                  Set
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Notification Preferences Modal */}
      {showNotifModal && (
        <Modal
          title="Notification preferences"
          subtitle="Manage which alerts and updates you receive."
          onClose={() => setShowNotifModal(false)}
        >
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#f8fafc', borderRadius: '10px' }}>
              <div>
                <strong style={{ fontSize: '14px', display: 'block', color: '#0f172a' }}>Live GPS worker travel alerts</strong>
                <small style={{ color: '#64748b' }}>Notify me when my assigned technician departs and reaches my door</small>
              </div>
              <input
                type="checkbox"
                checked={notifPrefs.smsTracking}
                onChange={() => handleToggleNotif('smsTracking')}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#f8fafc', borderRadius: '10px' }}>
              <div>
                <strong style={{ fontSize: '14px', display: 'block', color: '#0f172a' }}>Booking status confirmations</strong>
                <small style={{ color: '#64748b' }}>Updates on counter offers, acceptance, and completion</small>
              </div>
              <input
                type="checkbox"
                checked={notifPrefs.bookingUpdates}
                onChange={() => handleToggleNotif('bookingUpdates')}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#f8fafc', borderRadius: '10px' }}>
              <div>
                <strong style={{ fontSize: '14px', display: 'block', color: '#0f172a' }}>WhatsApp invoices & receipts</strong>
                <small style={{ color: '#64748b' }}>Receive instant digital receipts upon service completion</small>
              </div>
              <input
                type="checkbox"
                checked={notifPrefs.whatsappReceipts}
                onChange={() => handleToggleNotif('whatsappReceipts')}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#f8fafc', borderRadius: '10px' }}>
              <div>
                <strong style={{ fontSize: '14px', display: 'block', color: '#0f172a' }}>Special offers & discounts</strong>
                <small style={{ color: '#64748b' }}>Seasonal home repair vouchers and neighborhood promos</small>
              </div>
              <input
                type="checkbox"
                checked={notifPrefs.promotions}
                onChange={() => handleToggleNotif('promotions')}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <Button onClick={() => setShowNotifModal(false)}>Done</Button>
            </div>
          </div>
        </Modal>
      )}

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
  const [filterMode, setFilterMode] = useState('all'); // 'all', 'high', 'recent'

  useEffect(() => {
    if (!user?.id) return;
    dbService.getWorkerLedger(user.id).then((data) => setLedgerData(data));
  }, [user?.id]);

  const displayedTransactions = useMemo(() => {
    let list = [...ledgerData.transactions];
    if (filterMode === 'high') {
      list.sort((a, b) => (b.amount || 0) - (a.amount || 0));
    } else if (filterMode === 'recent') {
      list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }
    return list;
  }, [ledgerData.transactions, filterMode]);

  const cycleFilter = () => {
    const next = filterMode === 'all' ? 'high' : filterMode === 'high' ? 'recent' : 'all';
    setFilterMode(next);
    const label = next === 'all' ? 'All Settlements' : next === 'high' ? 'Highest Payouts First' : 'Most Recent First';
    notify(`Ledger view updated: ${label}`);
  };

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
          <button className="filter-btn" onClick={cycleFilter} title="Click to cycle sorting order">
            <Filter size={15} /> {filterMode === 'all' ? 'Filter: All' : filterMode === 'high' ? 'Sorted: Highest' : 'Sorted: Newest'} <ChevronDown size={14} />
          </button>
        </div>
        {displayedTransactions.length > 0 ? (
          displayedTransactions.map((t) => (
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
