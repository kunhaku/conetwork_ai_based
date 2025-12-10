import React, { useState } from 'react';

interface BetaGateProps {
  onUnlock: () => void;
  validCodes: string[];
}

const BetaGate: React.FC<BetaGateProps> = ({ onUnlock, validCodes }) => {
  const WAITLIST_ENDPOINT = import.meta.env.VITE_WAITLIST_ENDPOINT as string | undefined;
  const [inviteCode, setInviteCode] = useState('');
  const [gateError, setGateError] = useState('');
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistName, setWaitlistName] = useState('');
  const [waitlistConsent, setWaitlistConsent] = useState(false);
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);

  const handleValidate = () => {
    if (validCodes.includes(inviteCode.trim())) {
      localStorage.setItem('beta_access', '1');
      onUnlock();
      window.location.href = '/app';
    } else {
      setGateError('Invalid invite code. Please double-check or join the waitlist.');
    }
  };

  const handleWaitlist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistConsent || !waitlistEmail.trim()) {
      setGateError('Please enter your email and accept the terms.');
      return;
    }
    if (!WAITLIST_ENDPOINT) {
      setGateError('Waitlist API not configured (missing VITE_WAITLIST_ENDPOINT).');
      return;
    }
    setGateError('');
    fetch(WAITLIST_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: waitlistEmail,
        name: waitlistName,
        consent: waitlistConsent,
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
              className="px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm font-semibold hover:bg-cyan-400 transition"
            >
              Enter App
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
                placeholder="Email (required)"
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <input
                type="text"
                value={waitlistName}
                onChange={(e) => setWaitlistName(e.target.value)}
                placeholder="Name (optional)"
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
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
