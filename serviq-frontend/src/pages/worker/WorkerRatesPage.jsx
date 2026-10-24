import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  Coins,
  ShieldCheck,
  Check,
  TrendingUp,
  Percent,
  CircleDollarSign,
  Info,
  Clock,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

export default function WorkerRatesPage({ notify }) {
  const { user, updateRates } = useAuth();

  const [hourlyRate, setHourlyRate] = useState(user?.hourlyRate || 350);
  const [visitingFee, setVisitingFee] = useState(250);
  const [emergencySurcharge, setEmergencySurcharge] = useState(150);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const takeHomeHourly = Math.round(hourlyRate * 0.9);
  const platformFee = hourlyRate - takeHomeHourly;

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await updateRates(hourlyRate);
      setSaveSuccess(true);
      notify?.(`Rates updated! Your base rate is now ₹${hourlyRate}/hr.`);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      notify?.('Failed to update rates. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="worker-rates-page">
      <div className="page-heading">
        <div className="eyebrow">YOUR PRICING CONTROLS</div>
        <h1>My service rates</h1>
        <p>Set your hourly fees, standard inspection charges, and off-hour surcharges.</p>
      </div>

      <div className="rates-grid-layout">
        {/* Main Editor Card */}
        <form onSubmit={handleSave} className="panel rates-editor-panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">PRICING STRUCTURE</div>
              <h2>Base Hourly Rate ({user?.primarySkill || 'Plumber'})</h2>
            </div>
            <div className="tag success">
              <Sparkles size={12} /> Active Rate: ₹{user?.hourlyRate || hourlyRate}/hr
            </div>
          </div>

          <div className="rates-input-block">
            <label htmlFor="hourly-rate-input">Standard Hourly Labor Rate</label>
            <div className="rate-stepper-row">
              <button
                type="button"
                className="step-btn"
                onClick={() => setHourlyRate((prev) => Math.max(100, prev - 50))}
                aria-label="Decrease rate by ₹50"
              >
                - ₹50
              </button>
              <div className="rate-display-box">
                <span className="currency-symbol">₹</span>
                <input
                  id="hourly-rate-input"
                  type="number"
                  min="50"
                  max="10000"
                  step="25"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(Number(e.target.value))}
                  required
                />
                <span className="unit-label">/ hour</span>
              </div>
              <button
                type="button"
                className="step-btn"
                onClick={() => setHourlyRate((prev) => prev + 50)}
                aria-label="Increase rate by ₹50"
              >
                + ₹50
              </button>
            </div>

            <div className="quick-rate-pills">
              {[250, 300, 350, 400, 500, 600].map((rate) => (
                <button
                  type="button"
                  key={rate}
                  className={`pill-btn ${hourlyRate === rate ? 'active' : ''}`}
                  onClick={() => setHourlyRate(rate)}
                >
                  ₹{rate}
                </button>
              ))}
            </div>
          </div>

          <hr className="panel-divider" />

          {/* Secondary fees */}
          <div className="secondary-fees-grid">
            <div className="form-group">
              <label htmlFor="visiting-fee-input">
                Diagnostic & Inspection Fee (₹)
              </label>
              <div className="input-with-symbol">
                <span>₹</span>
                <input
                  id="visiting-fee-input"
                  type="number"
                  min="100"
                  step="50"
                  value={visitingFee}
                  onChange={(e) => setVisitingFee(Number(e.target.value))}
                />
              </div>
              <small className="field-hint">
                Charged when inspecting an issue before starting repair work.
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="emergency-surcharge-input">
                Emergency / Late Night Surcharge (₹)
              </label>
              <div className="input-with-symbol">
                <span>₹</span>
                <input
                  id="emergency-surcharge-input"
                  type="number"
                  min="0"
                  step="50"
                  value={emergencySurcharge}
                  onChange={(e) => setEmergencySurcharge(Number(e.target.value))}
                />
              </div>
              <small className="field-hint">
                Added automatically for requests booked between 9 PM and 7 AM.
              </small>
            </div>
          </div>

          <div className="rates-action-row">
            {saveSuccess && (
              <span className="rates-saved-indicator">
                <Check size={16} /> Rates saved successfully!
              </span>
            )}
            <button
              type="submit"
              className="btn rates-save-btn"
              disabled={isSaving}
            >
              {isSaving ? 'Updating...' : 'Save & Publish Rates'}
            </button>
          </div>
        </form>

        {/* Breakdown Card */}
        <div className="rates-summary-panel">
          <div className="panel earnings-preview-panel">
            <div className="panel-heading">
              <div>
                <div className="eyebrow">EARNINGS BREAKDOWN</div>
                <h2>Your Take-Home</h2>
              </div>
            </div>

            <div className="take-home-hero">
              <small>You earn per hour</small>
              <strong>₹{takeHomeHourly}</strong>
              <span>
                <Percent size={13} /> 90% direct payout to your bank account
              </span>
            </div>

            <div className="breakdown-list">
              <div className="breakdown-item">
                <span>Gross customer charge</span>
                <strong>₹{hourlyRate}</strong>
              </div>
              <div className="breakdown-item fee">
                <span>Serviq platform guarantee (10%)</span>
                <strong>- ₹{platformFee}</strong>
              </div>
              <div className="breakdown-item net">
                <span>Net Worker Payout</span>
                <strong>₹{takeHomeHourly}</strong>
              </div>
            </div>

            <div className="payout-assurance-note">
              <ShieldCheck size={16} />
              <span>
                Payouts are processed daily to your verified UPI or bank account upon customer job sign-off.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
