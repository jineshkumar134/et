// src/pages/NewInvestigation.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { runInvestigation, addCaseToSession } from '../api/investigationApi';
import { formatApiError } from '../api/client';
import { Search, Info } from 'lucide-react';

const DEMO_WALLET = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

export default function NewInvestigation() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    walletAddress: DEMO_WALLET,
    chain: 'ETHEREUM',
    maxDepth: 3,
    maxTransactions: 10,
    timeWindowHours: 168,
    investigatorId: 'LEA-001',
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null); // always a string

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // Backend expects walletAddress (not suspectWallet), chain in UPPERCASE
      const payload = {
        walletAddress:   form.walletAddress.trim(),
        chain:           form.chain.toUpperCase(),
        maxDepth:        Number(form.maxDepth),
        maxTransactions: Number(form.maxTransactions),
        timeWindowHours: Number(form.timeWindowHours),
        investigatorId:  form.investigatorId,
      };

      // Response is flat: { success, caseId, status, topCandidate, candidates, ... }
      const result = await runInvestigation(payload);

      if (!result.caseId) {
        throw new Error('Backend did not return a case ID. Please try again.');
      }

      // Save to session so Dashboard and Cases list can show it
      addCaseToSession(result.caseId, {
        status:       result.status,
        topCandidate: result.topCandidate,
        suspect:      result.suspect,
        createdAt:    result.provenance?.generatedAt || new Date().toISOString(),
      });

      navigate(`/cases/${result.caseId}`);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    'w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-blue-500 transition-colors';
  const labelCls = 'block text-xs text-[#8b949e] mb-1 font-medium';

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#e6edf3]">New Investigation</h1>
        <p className="text-sm text-[#8b949e] mt-1">
          Enter a wallet address to begin blockchain tracing &amp; VASP attribution.
        </p>
      </div>

      {/* Demo info */}
      <div className="flex gap-3 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-sm text-blue-300">
        <Info className="h-5 w-5 shrink-0 mt-0.5" />
        <div>
          <strong>Demo Mode</strong> — uses synthetic blockchain data. The pre-filled wallet
          ({DEMO_WALLET.slice(0, 14)}…) produces a full investigation with 2 hops, 80% continuity.
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-[#30363d] bg-[#161b22] p-6 space-y-5">
        <div>
          <label className={labelCls}>Suspect Wallet Address *</label>
          <input
            name="walletAddress"
            value={form.walletAddress}
            onChange={handleChange}
            placeholder="0x..."
            required
            className={inputCls + ' font-mono'}
          />
        </div>

        <div>
          <label className={labelCls}>Blockchain</label>
          <select name="chain" value={form.chain} onChange={handleChange} className={inputCls}>
            <option value="ETHEREUM">Ethereum</option>
            <option value="ETH">ETH</option>
            <option value="BITCOIN">Bitcoin</option>
            <option value="BTC">BTC</option>
          </select>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Max Depth</label>
            <input type="number" name="maxDepth" min={1} max={10} value={form.maxDepth} onChange={handleChange} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Max Txns</label>
            <input type="number" name="maxTransactions" min={1} max={1000} value={form.maxTransactions} onChange={handleChange} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Time Window (hrs)</label>
            <input type="number" name="timeWindowHours" min={1} value={form.timeWindowHours} onChange={handleChange} className={inputCls} />
          </div>
        </div>

        <div>
          <label className={labelCls}>Investigator ID</label>
          <input name="investigatorId" value={form.investigatorId} onChange={handleChange} className={inputCls} />
        </div>

        {/* Error — always a string, never renders [object Object] */}
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
            ⚠ {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          {loading ? 'Running investigation…' : 'Run Investigation'}
        </button>
      </form>
    </div>
  );
}
