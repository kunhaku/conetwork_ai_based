import React, { useEffect, useState } from 'react';
import { verifyBetaInvite } from '../services/inviteAdminApi';

interface BetaGateProps {
  onUnlock: () => void;
}

const BetaGate: React.FC<BetaGateProps> = ({ onUnlock, validCodes }) => {
  const WAITLIST_ENDPOINT = import.meta.env.VITE_WAITLIST_ENDPOINT as string | undefined;
  const WAITLIST_SEND_CODE_ENDPOINT = import.meta.env.VITE_WAITLIST_SEND_CODE_ENDPOINT as string | undefined;
  const WAITLIST_VERIFY_CODE_ENDPOINT = import.meta.env.VITE_WAITLIST_VERIFY_CODE_ENDPOINT as string | undefined;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  const [inviteCode, setInviteCode] = useState('');
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'verifying' | 'verified'>('idle');
  const [gateError, setGateError] = useState('');
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistEmailConfirm, setWaitlistEmailConfirm] = useState('');
  const [waitlistName, setWaitlistName] = useState('');
  const [waitlistCompany, setWaitlistCompany] = useState('');
  const [waitlistTitle, setWaitlistTitle] = useState('');
  const [waitlistConsent, setWaitlistConsent] = useState(false);
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [codeStatus, setCodeStatus] = useState<'idle' | 'sending' | 'sent' | 'verifying' | 'verified'>('idle');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    const storedEmail = localStorage.getItem('beta_invite_email');
    if (storedEmail) {
      setWaitlistEmail(storedEmail);
      setWaitlistEmailConfirm(storedEmail);
    }
  }, []);

  const emailsValid = () => {
    if (!waitlistEmail.trim() || !waitlistEmailConfirm.trim()) {
      setGateError('Please enter and confirm your email.');
      return false;
    }
    if (waitlistEmail.trim().toLowerCase() !== waitlistEmailConfirm.trim().toLowerCase()) {
      setGateError('Emails do not match.');
      return false;
    }
    return true;
  };

  const handleValidate = async () => {
    setGateError('');
    if (!waitlistEmail.trim()) {
      setGateError('Please enter the email tied to your invite.');
      return;
    }
    if (!inviteCode.trim()) {
      setGateError('Enter your invite code.');
      return;
    }
    setInviteStatus('verifying');
    try {
      const res = await verifyBetaInvite({
        email: waitlistEmail.trim().toLowerCase(),
        code: inviteCode.trim(),
      });
      if (res.ok) {
        setInviteStatus('verified');
        localStorage.setItem('beta_access', '1');
        localStorage.setItem('beta_invite_email', waitlistEmail.trim().toLowerCase());
        onUnlock();
        window.location.href = '/app';
      } else {
        setInviteStatus('idle');
        setGateError(`Invite invalid: ${res.error}${res.detail ? ` - ${res.detail}` : ''}`);
      }
    } catch (err) {
      console.error('[beta-gate] verify invite error', err);
      setInviteStatus('idle');
      setGateError('Unable to verify invite code right now. Please try again.');
    }
  };

  const handleSendCode = () => {
    setGateError('');
    if (!emailsValid()) return;
    if (!WAITLIST_SEND_CODE_ENDPOINT) {
      setGateError('Waitlist send-code API not configured (missing VITE_WAITLIST_SEND_CODE_ENDPOINT).');
      return;
    }
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (SUPABASE_ANON_KEY) {
      headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
      headers.apikey = SUPABASE_ANON_KEY;
    }
    setCodeStatus('sending');
    fetch(WAITLIST_SEND_CODE_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email: waitlistEmail.trim(),
        confirmEmail: waitlistEmailConfirm.trim(),
      }),
    })
      .then((resp) => {
        if (resp.ok) {
          setCodeStatus('sent');
          setCooldown(60);
        } else {
          setCodeStatus('idle');
          setGateError('Failed to send verification code. Please try again.');
        }
      })
      .catch(() => {
        setCodeStatus('idle');
        setGateError('Unable to reach send-code API. Please retry.');
      });
  };

  const handleVerifyCode = () => {
    setGateError('');
    if (!emailsValid()) return;
    if (!verificationCode.trim()) {
      setGateError('Enter the verification code we emailed you.');
      return;
    }
    if (!WAITLIST_VERIFY_CODE_ENDPOINT) {
      setGateError('Waitlist verify API not configured (missing VITE_WAITLIST_VERIFY_CODE_ENDPOINT).');
      return;
    }
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (SUPABASE_ANON_KEY) {
      headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
      headers.apikey = SUPABASE_ANON_KEY;
    }
    setCodeStatus('verifying');
    fetch(WAITLIST_VERIFY_CODE_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email: waitlistEmail.trim(),
        code: verificationCode.trim(),
      }),
    })
      .then((resp) => {
        if (resp.ok) {
          setCodeStatus('verified');
        } else {
          setCodeStatus('sent');
          setGateError('Verification code invalid or expired.');
        }
      })
      .catch(() => {
        setCodeStatus('sent');
        setGateError('Unable to reach verify API. Please retry.');
      });
  };

  const handleWaitlist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistConsent) {
      setGateError('Please accept the terms.');
      return;
    }
    if (!emailsValid()) return;
    if (!waitlistCompany.trim() || !waitlistTitle.trim()) {
      setGateError('Company and title are required.');
      return;
    }
    if (codeStatus !== 'verified') {
      setGateError('Please verify your email with the code we sent.');
      return;
    }
    if (!WAITLIST_ENDPOINT) {
      setGateError('Waitlist API not configured (missing VITE_WAITLIST_ENDPOINT).');
      return;
    }
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (SUPABASE_ANON_KEY) {
      headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
      headers.apikey = SUPABASE_ANON_KEY;
    }
    setGateError('');
    fetch(WAITLIST_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email: waitlistEmail,
        emailConfirm: waitlistEmailConfirm,
        name: waitlistName,
        company: waitlistCompany,
        title: waitlistTitle,
        consent: waitlistConsent,
        verificationCode,
      }),
    })
      .then(async (resp) => {
        if (resp.ok) {
          setWaitlistSubmitted(true);
        } else if (resp.status === 409) {
          setGateError('This email is already on the waitlist.');
        } else {
          const text = await resp.text();
          setGateError(text || 'Submission failed, please try again.');
        }
      })
      .catch(() => {
        setGateError('Unable to reach waitlist API, please try again.');
      });
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#050b15] via-[#0b1324] to-[#020617] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-gray-900/90 border border-white/10 rounded-2xl shadow-2xl p-6 space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Beta Access</p>
          <h3 className="text-xl font-bold text-white mt-1">Enter invite code or join the waitlist</h3>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-gray-400">Invite email</label>
          <input
            type="email"
            value={waitlistEmail}
            onChange={(e) => setWaitlistEmail(e.target.value)}
            placeholder="Email used for your invite"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-gray-400">Invite code</label>
          <div className="flex gap-2">
            <input
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Enter your invite code"
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <button
              type="button"
              onClick={handleValidate}
              disabled={inviteStatus === 'verifying'}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                inviteStatus === 'verifying'
                  ? 'bg-white/10 text-gray-300 border border-white/10 cursor-not-allowed'
                  : 'bg-cyan-500 text-white hover:bg-cyan-400'
              }`}
            >
              {inviteStatus === 'verifying' ? 'Verifying...' : inviteStatus === 'verified' ? 'Verified' : 'Enter App'}
            </button>
          </div>
        </div>

        <div className="border-t border-white/10 pt-4">
          <p className="text-sm text-gray-300 mb-2">No code? Join the waitlist and we will email you access.</p>
          <form className="space-y-3" onSubmit={handleWaitlist}>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                required
                value={waitlistEmail}
                onChange={(e) => setWaitlistEmail(e.target.value)}
                placeholder="Work email (required)"
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <input
                type="email"
                required
                value={waitlistEmailConfirm}
                onChange={(e) => setWaitlistEmailConfirm(e.target.value)}
                placeholder="Confirm email (required)"
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleSendCode}
                disabled={codeStatus === 'sending' || cooldown > 0}
                className={`w-full sm:w-44 px-4 py-2 rounded-lg text-sm font-semibold border ${
                  codeStatus === 'sending' || cooldown > 0
                    ? 'bg-white/5 border-white/10 text-gray-400 cursor-not-allowed'
                    : 'bg-cyan-500 text-white border-cyan-400 hover:bg-cyan-400'
                }`}
              >
                {codeStatus === 'sending'
                  ? 'Sending...'
                  : cooldown > 0
                  ? `Resend in ${cooldown}s`
                  : codeStatus === 'sent'
                  ? 'Resend code'
                  : 'Send code'}
              </button>
              <div className="flex flex-1 gap-2">
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="Verification code"
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <button
                  type="button"
                  onClick={handleVerifyCode}
                  disabled={codeStatus === 'verifying' || !verificationCode.trim()}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                    codeStatus === 'verified'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'
                  }`}
                >
                  {codeStatus === 'verifying' ? 'Verifying...' : codeStatus === 'verified' ? 'Verified' : 'Verify'}
                </button>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                required
                value={waitlistCompany}
                onChange={(e) => setWaitlistCompany(e.target.value)}
                placeholder="Company (required)"
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <input
                type="text"
                required
                value={waitlistTitle}
                onChange={(e) => setWaitlistTitle(e.target.value)}
                placeholder="Title (required)"
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <input
              type="text"
              value={waitlistName}
              onChange={(e) => setWaitlistName(e.target.value)}
              placeholder="Name (optional)"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <label className="flex items-start gap-2 text-xs text-gray-300">
              <input
                type="checkbox"
                checked={waitlistConsent}
                onChange={(e) => setWaitlistConsent(e.target.checked)}
                className="mt-1"
              />
              <span>
                I agree to the{' '}
                <a
                  href="/beta-terms"
                  target="_blank"
                  rel="noreferrer"
                  className="underline text-cyan-300 hover:text-cyan-200"
                >
                  Beta terms and privacy policy
                </a>
                .
              </span>
            </label>
            <button
              type="submit"
              className="w-full bg-white text-black rounded-lg py-2 font-semibold hover:translate-y-[-1px] hover:shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition"
            >
              Join waitlist
            </button>
            {waitlistSubmitted && (
              <p className="text-xs text-emerald-300">Request received. We will email you with access.</p>
            )}
            {gateError && <p className="text-xs text-red-300">{gateError}</p>}
          </form>
        </div>
      </div>
    </div>
  );
};

export default BetaGate;
