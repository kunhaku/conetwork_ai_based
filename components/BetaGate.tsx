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
      setGateError('邀請碼無效或尚未開通，請確認或申請加入等待名單。');
    }
  };

  const handleWaitlist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistConsent || !waitlistEmail.trim()) {
      setGateError('請填寫 Email 並勾選同意條款。');
      return;
    }
    if (!WAITLIST_ENDPOINT) {
      setGateError('系統未設定等待名單 API（缺少 VITE_WAITLIST_ENDPOINT）。');
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
    }).then(async (resp) => {
      if (resp.ok) {
        setWaitlistSubmitted(true);
      } else if (resp.status === 409) {
        setGateError('此 Email 已在等待名單。');
      } else {
        const text = await resp.text();
        setGateError(text || '提交失敗，請稍後再試。');
      }
    }).catch(() => {
      setGateError('無法連線等待名單 API，請稍後再試。');
    });
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#050b15] via-[#0b1324] to-[#020617] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-gray-900/90 border border-white/10 rounded-2xl shadow-2xl p-6 space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Beta Access</p>
          <h3 className="text-xl font-bold text-white mt-1">輸入邀請碼或申請等待名單</h3>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-gray-400">邀請碼</label>
          <div className="flex gap-2">
            <input
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="輸入邀請碼"
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <button
              type="button"
              onClick={handleValidate}
              className="px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm font-semibold hover:bg-cyan-400 transition"
            >
              進入 App
            </button>
          </div>
        </div>

        <div className="border-t border-white/10 pt-4">
          <p className="text-sm text-gray-300 mb-2">沒有邀請碼？加入等待名單，我們將依序開通。</p>
          <form className="space-y-3" onSubmit={handleWaitlist}>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                required
                value={waitlistEmail}
                onChange={(e) => setWaitlistEmail(e.target.value)}
                placeholder="Email（必填）"
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <input
                type="text"
                value={waitlistName}
                onChange={(e) => setWaitlistName(e.target.value)}
                placeholder="稱呼（選填）"
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
              <span>我同意 Beta 條款與隱私政策</span>
            </label>
            <button
              type="submit"
              className="w-full bg-white text-black rounded-lg py-2 font-semibold hover:translate-y-[-1px] hover:shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition"
            >
              加入等待名單
            </button>
            {waitlistSubmitted && (
              <p className="text-xs text-emerald-300">已收到申請，我們會依序開通 Beta。</p>
            )}
            {gateError && (
              <p className="text-xs text-red-300">{gateError}</p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default BetaGate;
