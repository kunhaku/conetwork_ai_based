import React, { useEffect, useMemo, useState } from 'react';
import { NavBar } from './components/landing/NavBar';
import { ClusterGraph3D } from './components/landing/ClusterGraph3D';
import { HeroOverlay } from './components/landing/HeroOverlay';
import DemoBox from './components/landing/DemoBox';

const pipeline = [
  { title: 'Evidence Intake', desc: 'Collect recent news, IR/press, SEC, Wiki; keep reachable URLs only.' },
  { title: 'Signal Extraction', desc: 'Extract nodes and links strictly from cited sources; every edge is clickable.' },
  { title: 'Cross-Validation', desc: 'Deduplicate and keep 10-20 highest-signal relationships.' },
  { title: 'Financial & Qualitative', desc: 'Ticker/price/cap plus growth profile, themes, risk notes.' },
  { title: 'Briefing & Actions', desc: 'Key players, hidden bets, risks, and next steps in an executive brief.' },
];

const flowSteps = [
  { title: 'Curated sources', desc: 'Recent news, IR/SEC, Wiki; reachable URLs only.' },
  { title: 'Validated relationships', desc: 'Edges derived strictly from cited sources.' },
  { title: 'Quantified context', desc: 'Ticker/price/cap plus growth, themes, risks.' },
  { title: 'Executive output', desc: 'Key players, hidden bets, risks, next steps.' },
];

const reportBlocks = [
  { title: 'Executive Overview', desc: 'Theme narrative synthesized from the live graph.' },
  { title: 'Key / Secondary Players', desc: 'Critical nodes plus second-tier beneficiaries with rationale.' },
  { title: 'Risk Nodes', desc: 'Single-point failures, regulation, or supply chain fragility.' },
  { title: 'Next Actions', desc: 'Monitor, deep dives, and follow-up crawl tasks.' },
];

export const LandingPage: React.FC = () => {
  const WAITLIST_ENDPOINT = import.meta.env.VITE_WAITLIST_ENDPOINT as string | undefined;
  const WAITLIST_SEND_CODE_ENDPOINT = import.meta.env.VITE_WAITLIST_SEND_CODE_ENDPOINT as string | undefined;
  const WAITLIST_VERIFY_CODE_ENDPOINT = import.meta.env.VITE_WAITLIST_VERIFY_CODE_ENDPOINT as string | undefined;
  const [showGate, setShowGate] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
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

  const validCodes = useMemo(() => ['BETA2025', 'NEXUSBETA'], []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const handleEnterApp = () => {
    setShowGate(true);
  };

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

  const handleValidate = () => {
    if (validCodes.includes(inviteCode.trim())) {
      localStorage.setItem('beta_access', '1');
      window.location.href = '/app';
    } else {
      setGateError('Invite code not valid or expired. Please verify or join the waitlist.');
    }
  };

  const handleSendCode = () => {
    setGateError('');
    if (!emailsValid()) return;
    if (!WAITLIST_SEND_CODE_ENDPOINT) {
      setGateError('Waitlist send-code API not configured (missing VITE_WAITLIST_SEND_CODE_ENDPOINT).');
      return;
    }
    setCodeStatus('sending');
    fetch(WAITLIST_SEND_CODE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    setCodeStatus('verifying');
    fetch(WAITLIST_VERIFY_CODE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    fetch(WAITLIST_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
          setGateError('');
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
    <main className="relative w-full min-h-screen bg-gray-950 overflow-hidden text-white">
      <NavBar />
      <ClusterGraph3D />
      <HeroOverlay />

      <section id="pipeline" className="relative z-10 bg-gray-950/80 backdrop-blur-xl border-t border-white/5 py-16 px-6 md:px-12">
        <div className="max-w-6xl mx-auto flex items-start justify-between gap-10">
          <div className="max-w-xl space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Evidence-first research flow</p>
            <h2 className="text-3xl font-bold">From intent to investment-ready brief</h2>
            <div className="mt-4 space-y-3">
              {flowSteps.map((step, idx) => (
                <div key={step.title} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full border border-cyan-400 text-cyan-200 text-xs font-semibold flex items-center justify-center mt-0.5">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="text-sm text-white font-semibold">{step.title}</p>
                    <p className="text-sm text-gray-400">{step.desc}</p>
                  </div>
                </div>
              ))}
              <p className="text-sm text-gray-400 pt-1 border-t border-white/10 mt-2">
                No source, no link; every relationship carries a reachable URL.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 max-w-2xl">
            {pipeline.map((item) => (
              <div
                key={item.title}
                className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-cyan-500/30 hover:bg-white/10 transition-all"
              >
                <p className="text-sm font-semibold mb-1">{item.title}</p>
                <p className="text-xs text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="demo"
        className="relative z-10 bg-gray-950/90 backdrop-blur-xl border-t border-white/5 py-16 px-6 md:px-12"
      >
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-8 items-stretch">
          <div className="md:w-3/4">
            <div className="h-full rounded-2xl border border-white/10 bg-white/5 p-6 shadow-inner shadow-cyan-500/10 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Live demo dock</p>
                  <h3 className="text-2xl font-bold">Show the product in action</h3>
                </div>
                <span className="text-[10px] text-emerald-300 border border-emerald-300/40 rounded-full px-3 py-1 bg-emerald-500/10">Demo</span>
              </div>
              <div className="flex-1 min-h-[320px] rounded-xl border border-white/10 bg-black/40 p-4 text-gray-100 text-sm">
                <DemoBox />
              </div>
            </div>
          </div>
          <div className="md:w-1/4 space-y-4">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
              <p className="text-sm font-semibold mb-1">Graph interactions</p>
              <p className="text-xs text-gray-400">Role/relationship filtering, hover focus, PNG/JSON export.</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
              <p className="text-sm font-semibold mb-1">Auto-complete intent</p>
              <p className="text-xs text-gray-400">Missing topic or seeds are inferred by Agent T for quick starts.</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
              <p className="text-sm font-semibold mb-1">Persist & recall</p>
              <p className="text-xs text-gray-400">Graphs are upserted via the DB API for memory and reuse.</p>
            </div>
          </div>
        </div>
      </section>

      <section
        id="report"
        className="relative z-10 bg-gray-950/85 backdrop-blur-xl border-t border-white/5 py-16 px-6 md:px-12"
      >
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Agent R Report</p>
              <h3 className="text-3xl font-bold">From graph to strategy</h3>
              <p className="text-sm text-gray-400 mt-2">
                A concise narrative ready for research memos and investment huddles.
              </p>
            </div>
            <a
              onClick={handleEnterApp}
              className="px-4 py-2 rounded-full border border-white/20 text-xs font-semibold tracking-wider hover:bg-white/10 transition-colors"
            >
              Open Graph App
            </a>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reportBlocks.map((item) => (
              <div
                key={item.title}
                className="p-5 rounded-2xl bg-white/5 border border-white/5 hover:border-cyan-500/30 hover:bg-white/10 transition-all"
              >
                <p className="text-base font-semibold mb-1">{item.title}</p>
                <p className="text-sm text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="relative z-10 py-12 text-center text-gray-600 text-sm border-t border-white/5 bg-gray-950/90">
        <p>&copy; {new Date().getFullYear()} NexusGraph AI. All rights reserved.</p>
      </footer>

      {showGate && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-gray-900/90 border border-white/10 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Beta Access</p>
                <h3 className="text-xl font-bold text-white mt-1">Enter invite code or join the waitlist</h3>
              </div>
              <button className="text-gray-400 hover:text-white" onClick={() => setShowGate(false)}>Close</button>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-gray-400">Invite code</label>
              <div className="flex gap-2">
                <input
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="Enter invite code"
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <button
                  onClick={handleValidate}
                  className="px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm font-semibold hover:bg-cyan-400 transition"
                >
                  Enter app
                </button>
              </div>
            </div>

            <div className="border-t border-white/10 pt-4">
              <p className="text-sm text-gray-300 mb-2">No invite code? Join the waitlist and we will notify you when we open up.</p>
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
                  <p className="text-xs text-emerald-300">Request submitted; we will notify you when Beta opens.</p>
                )}
                {gateError && (
                  <p className="text-xs text-red-300">{gateError}</p>
                )}
              </form>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default LandingPage;
