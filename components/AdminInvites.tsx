import React, { useEffect, useMemo, useState } from 'react';
import {
  clearAdminSecret,
  getStoredAdminSecret,
  listInvites,
  listWaitlist,
  revokeInvite,
  sendBetaInvite,
  storeAdminSecret,
} from '../services/inviteAdminApi';

interface WaitlistRow {
  email: string;
  name?: string | null;
  company?: string | null;
  title?: string | null;
  created_at: string;
}

interface InviteRow {
  email: string;
  code: string;
  used_count: number;
  max_uses: number;
  expires_at: string | null;
  is_revoked: boolean;
  created_at: string;
  updated_at: string;
}

const toInputDateTime = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 16);
};

const AdminInvites: React.FC = () => {
  const [adminSecret, setAdminSecret] = useState('');
  const [secretInput, setSecretInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [waitlist, setWaitlist] = useState<WaitlistRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loadingWaitlist, setLoadingWaitlist] = useState(false);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [form, setForm] = useState<{ email: string; name: string; maxUses: number; expiresAt: string }>({
    email: '',
    name: '',
    maxUses: 1,
    expiresAt: '',
  });

  const hasSecret = useMemo(() => Boolean(adminSecret), [adminSecret]);

  useEffect(() => {
    const stored = getStoredAdminSecret();
    if (stored) {
      setAdminSecret(stored);
      setSecretInput(stored);
      refreshAll(stored);
    }
  }, []);

  const refreshWaitlist = async (secret = adminSecret) => {
    if (!secret) return;
    setLoadingWaitlist(true);
    const res = await listWaitlist(secret);
    if (res.ok) {
      setWaitlist(res.data || []);
      setAuthError('');
    } else {
      setAuthError(res.detail || res.error || 'Failed to load waitlist');
    }
    setLoadingWaitlist(false);
  };

  const refreshInvites = async (secret = adminSecret) => {
    if (!secret) return;
    setLoadingInvites(true);
    const res = await listInvites(secret);
    if (res.ok) {
      setInvites(res.data || []);
      setAuthError('');
    } else {
      setAuthError(res.detail || res.error || 'Failed to load invites');
    }
    setLoadingInvites(false);
  };

  const refreshAll = async (secret = adminSecret) => {
    await Promise.all([refreshWaitlist(secret), refreshInvites(secret)]);
  };

  const handleSecretSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretInput.trim()) {
      setAuthError('Please enter ADMIN_SECRET.');
      return;
    }
    storeAdminSecret(secretInput.trim());
    setAdminSecret(secretInput.trim());
    setAuthError('');
    await refreshAll(secretInput.trim());
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('');
    setError('');
    if (!form.email.trim()) {
      setError('Email is required.');
      return;
    }
    const expiresAtIso = form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined;
    const res = await sendBetaInvite(
      {
        email: form.email.trim().toLowerCase(),
        name: form.name.trim() || undefined,
        maxUses: form.maxUses || 1,
        expiresAt: expiresAtIso,
      },
      adminSecret,
    );
    if (!res.ok) {
      setError(`${res.error}${res.detail ? `: ${res.detail}` : ''}`);
      return;
    }
    setStatus(`Invite sent to ${form.email.trim().toLowerCase()}`);
    setError('');
    await refreshInvites(adminSecret);
  };

  const handleResend = async (invite: InviteRow) => {
    setStatus('');
    setError('');
    const res = await sendBetaInvite(
      {
        email: invite.email,
        name: '',
        maxUses: invite.max_uses,
        expiresAt: invite.expires_at || undefined,
      },
      adminSecret,
    );
    if (!res.ok) {
      setError(`${res.error}${res.detail ? `: ${res.detail}` : ''}`);
      return;
    }
    setStatus(`Invite regenerated for ${invite.email}`);
    await refreshInvites(adminSecret);
  };

  const handleRevoke = async (email: string) => {
    setStatus('');
    setError('');
    const res = await revokeInvite({ email }, adminSecret);
    if (!res.ok) {
      setError(`${res.error}${res.detail ? `: ${res.detail}` : ''}`);
      return;
    }
    setStatus(`Revoked invite for ${email}`);
    await refreshInvites(adminSecret);
  };

  const handleSelectWaitlist = (row: WaitlistRow) => {
    setForm((f) => ({
      ...f,
      email: row.email,
      name: row.name || '',
      maxUses: 1,
    }));
  };

  const handleClearSecret = () => {
    clearAdminSecret();
    setAdminSecret('');
    setSecretInput('');
    setWaitlist([]);
    setInvites([]);
    setStatus('');
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#050b15] via-[#0b1324] to-[#020617] text-gray-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Admin</p>
          <h1 className="text-3xl font-bold text-white">Beta Invites Console</h1>
          <p className="text-sm text-gray-400">Manage waitlist, generate invites, and audit usage.</p>
        </header>

        <section className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Admin secret</p>
              <p className="text-xs text-gray-400">
                Provide ADMIN_SECRET to call protected Edge Functions. Stored locally only.
              </p>
            </div>
            <form className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto" onSubmit={handleSecretSubmit}>
              <input
                type="password"
                value={secretInput}
                onChange={(e) => setSecretInput(e.target.value)}
                placeholder="ADMIN_SECRET"
                className="w-full sm:w-72 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-500 text-black rounded-lg text-sm font-semibold hover:bg-cyan-400 transition"
                >
                  Save
                </button>
                {hasSecret && (
                  <button
                    type="button"
                    onClick={handleClearSecret}
                    className="px-4 py-2 bg-white/5 text-white rounded-lg text-sm font-semibold border border-white/10 hover:bg-white/10 transition"
                  >
                    Clear
                  </button>
                )}
              </div>
            </form>
          </div>
          {authError && <p className="text-xs text-red-300">Auth error: {authError}</p>}
          {status && <p className="text-xs text-emerald-300">{status}</p>}
          {error && <p className="text-xs text-red-300">Error: {error}</p>}
        </section>

        {hasSecret && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <section className="lg:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Waitlist</p>
                  <h2 className="text-xl font-semibold text-white">Requests</h2>
                </div>
                <button
                  onClick={() => refreshWaitlist()}
                  className="text-xs px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition"
                >
                  Refresh
                </button>
              </div>
              <div className="overflow-auto rounded-lg border border-white/5">
                <table className="min-w-full text-sm">
                  <thead className="bg-white/5 text-gray-300">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">Email</th>
                      <th className="text-left px-3 py-2 font-semibold">Name</th>
                      <th className="text-left px-3 py-2 font-semibold">Company</th>
                      <th className="text-left px-3 py-2 font-semibold">Title</th>
                      <th className="text-left px-3 py-2 font-semibold">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingWaitlist && (
                      <tr>
                        <td colSpan={5} className="px-3 py-3 text-center text-gray-400">
                          Loading waitlist...
                        </td>
                      </tr>
                    )}
                    {!loadingWaitlist && waitlist.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-3 text-center text-gray-500">
                          No waitlist requests yet.
                        </td>
                      </tr>
                    )}
                    {waitlist.map((row) => (
                      <tr
                        key={row.email}
                        className="border-t border-white/5 hover:bg-white/5 cursor-pointer"
                        onClick={() => handleSelectWaitlist(row)}
                        title="Click to fill invite form"
                      >
                        <td className="px-3 py-2">{row.email}</td>
                        <td className="px-3 py-2">{row.name || '-'}</td>
                        <td className="px-3 py-2">{row.company || '-'}</td>
                        <td className="px-3 py-2">{row.title || '-'}</td>
                        <td className="px-3 py-2 text-xs text-gray-400">
                          {new Date(row.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Invite</p>
                  <h2 className="text-xl font-semibold text-white">Generate & Send</h2>
                </div>
                <button
                  onClick={() => refreshInvites()}
                  className="text-xs px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition"
                >
                  Reload Invites
                </button>
              </div>
              <form className="space-y-3" onSubmit={handleSendInvite}>
                <div className="space-y-1">
                  <label className="text-xs text-gray-400">Email (required)</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-400">Name (optional)</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs text-gray-400">Max uses</label>
                    <input
                      type="number"
                      min={1}
                      value={form.maxUses}
                      onChange={(e) => setForm((f) => ({ ...f, maxUses: Number(e.target.value) || 1 }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-xs text-gray-400">Expires at (optional)</label>
                    <input
                      type="datetime-local"
                      value={form.expiresAt}
                      onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full bg-cyan-500 text-black rounded-lg py-2 font-semibold hover:bg-cyan-400 transition"
                >
                  Generate & Send
                </button>
              </form>
            </section>
          </div>
        )}

        {hasSecret && (
          <section className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Invites</p>
                <h2 className="text-xl font-semibold text-white">Active codes</h2>
              </div>
              <button
                onClick={() => refreshInvites()}
                className="text-xs px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition"
              >
                Refresh
              </button>
            </div>
            <div className="overflow-auto rounded-lg border border-white/5">
              <table className="min-w-full text-sm">
                <thead className="bg-white/5 text-gray-300">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Email</th>
                    <th className="text-left px-3 py-2 font-semibold">Code</th>
                    <th className="text-left px-3 py-2 font-semibold">Usage</th>
                    <th className="text-left px-3 py-2 font-semibold">Expires</th>
                    <th className="text-left px-3 py-2 font-semibold">Status</th>
                    <th className="text-left px-3 py-2 font-semibold">Updated</th>
                    <th className="text-left px-3 py-2 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingInvites && (
                    <tr>
                      <td colSpan={7} className="px-3 py-3 text-center text-gray-400">
                        Loading invites...
                      </td>
                    </tr>
                  )}
                  {!loadingInvites && invites.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-3 text-center text-gray-500">
                        No invites yet.
                      </td>
                    </tr>
                  )}
                  {invites.map((row) => (
                    <tr key={row.email} className="border-t border-white/5">
                      <td className="px-3 py-2">{row.email}</td>
                      <td className="px-3 py-2 font-mono text-sm">{row.code}</td>
                      <td className="px-3 py-2">
                        {row.used_count} / {row.max_uses}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-400">
                        {row.expires_at ? new Date(row.expires_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-3 py-2">
                        {row.is_revoked ? (
                          <span className="text-red-300 text-xs font-semibold">Revoked</span>
                        ) : row.used_count >= row.max_uses ? (
                          <span className="text-yellow-200 text-xs font-semibold">Limit reached</span>
                        ) : (
                          <span className="text-emerald-300 text-xs font-semibold">Active</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-400">
                        {new Date(row.updated_at || row.created_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setForm({
                                email: row.email,
                                name: '',
                                maxUses: row.max_uses,
                                expiresAt: toInputDateTime(row.expires_at),
                              });
                              handleResend(row);
                            }}
                            className="text-xs px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition"
                          >
                            Resend
                          </button>
                          <button
                            onClick={() => handleRevoke(row.email)}
                            className="text-xs px-3 py-1.5 rounded-lg border border-red-400/50 text-red-200 hover:bg-red-500/10 transition"
                            disabled={row.is_revoked}
                          >
                            Revoke
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default AdminInvites;
