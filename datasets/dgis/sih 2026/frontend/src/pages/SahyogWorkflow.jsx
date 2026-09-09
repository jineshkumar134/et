// src/pages/SahyogWorkflow.jsx
// SAHYOG Sandbox Workflow
//
// Backend required fields:
//   POST /sahyog/investigations  →
//     { requestId (string), walletAddress, chain, priority, requestedScope? }
//   POST /sahyog/actions         →
//     { requestId, caseId, actionType, lawfulBasis (string), justification (string) }
//     NOTE: backend requires topCandidate.vasp !== null — in synthetic demo mode the
//           vasp field is null (no VASP DB match), so action prep returns NO_VASP_CANDIDATE.
//           The workflow is still demonstrated fully; the error is clearly labelled.
//   POST /sahyog/actions/:id/submit → (no body)
//
// All backend response shapes:
//   investigations → { success, data: { requestId, caseId, status, integration, attribution, dataProvenance } }
//   actions        → { success, data: { actionId, ... } } | { success:false, error: {...} }
//   submit         → { success, data: { actionId, status:"SUBMITTED", mode:"SANDBOX", externalSubmission:false } }

import { useState } from 'react';
import { createSahyogInvestigation, createSahyogAction, submitSahyogAction } from '../api/sahyogApi';
import { formatApiError } from '../api/client';
import { Shield, AlertTriangle, CheckCircle2, Send, Info, XCircle } from 'lucide-react';

const DEMO_WALLET  = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

function genReqId() {
  return 'SAHYOG-REQ-' + Date.now();
}

function StepIndicator({ num, title, active, done, failed }) {
  return (
    <div className={`flex items-center gap-3 ${failed ? 'text-red-400' : done ? 'text-green-400' : active ? 'text-blue-400' : 'text-[#484f58]'}`}>
      <span className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold shrink-0 ${
        failed ? 'border-red-500   bg-red-500/20'
        : done  ? 'border-green-500 bg-green-500/20'
        : active ? 'border-blue-500  bg-blue-500/20'
        :          'border-[#30363d] bg-[#1c2230]'
      }`}>
        {failed ? '✗' : done ? '✓' : num}
      </span>
      <span className="text-sm font-medium">{title}</span>
    </div>
  );
}

function JsonPanel({ label, data }) {
  return (
    <div className="rounded-xl border border-[#30363d] bg-[#0d1117] overflow-hidden">
      <div className="px-4 py-2 border-b border-[#30363d] text-xs text-[#8b949e] font-medium">{label}</div>
      <pre className="p-4 text-xs text-[#8b949e] overflow-auto max-h-56 leading-relaxed">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

function ActionBtn({ children, onClick, loading, icon, variant = 'primary' }) {
  const cls = variant === 'secondary'
    ? 'border border-[#30363d] text-[#8b949e] hover:text-[#e6edf3] bg-transparent'
    : 'bg-blue-600 text-white hover:bg-blue-500';
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed transition-colors ${cls}`}
    >
      {loading
        ? <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
        : icon}
      {children}
    </button>
  );
}

export default function SahyogWorkflow() {
  const [requestId,  setRequestId]  = useState(genReqId);
  const [walletAddr, setWalletAddr] = useState(DEMO_WALLET);
  const [chain,      setChain]      = useState('ETHEREUM');
  const [actionType, setActionType] = useState('DISCLOSURE_REQUEST');
  const [lawfulBasis, setLawfulBasis] = useState('IT_ACT_2000_SECTION_69');
  const [justification, setJustification] = useState('Suspected crypto money laundering under PMLA investigation.');

  // step: 0=idle, 1=intake ok, 2=action ok, 3=submitted, 'action_failed'=action failed (known NO_VASP)
  const [step,         setStep]         = useState(0);
  const [intakeResult, setIntakeResult] = useState(null);
  const [actionResult, setActionResult] = useState(null);
  const [submitResult, setSubmitResult] = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null); // always string

  const run = (fn) => async () => {
    setLoading(true);
    setError(null);
    try { await fn(); }
    catch (e) { setError(formatApiError(e)); }
    finally { setLoading(false); }
  };

  const runIntake = run(async () => {
    const res = await createSahyogInvestigation({
      requestId:      requestId.trim(),
      walletAddress:  walletAddr.trim(),
      chain:          chain,
      priority:       'HIGH',
      requestedScope: { maxDepth: 3, maxTransactions: 10, timeWindowHours: 168 },
    });
    setIntakeResult(res);
    setStep(1);
  });

  const runAction = run(async () => {
    const data = intakeResult?.data || intakeResult || {};
    const rid  = data?.requestId || requestId;
    const cid  = data?.caseId;
    if (!cid) throw new Error('No caseId from intake. Cannot prepare action.');

    try {
      const res = await createSahyogAction({
        requestId:     rid,
        caseId:        cid,
        actionType:    actionType,
        lawfulBasis:   lawfulBasis,
        justification: justification,
      });
      setActionResult(res);
      setStep(2);
    } catch (e) {
      setActionResult({ _error: formatApiError(e), _code: e.code });
      setStep('action_failed');
      throw e;
    }
  });

  const runSubmit = run(async () => {
    const data     = actionResult?.data || actionResult || {};
    const actionId = data?.actionId;
    if (!actionId) throw new Error('No actionId from action prep. Cannot submit.');
    const res = await submitSahyogAction(actionId);
    setSubmitResult(res);
    setStep(3);
  });

  const reset = () => {
    setStep(0);
    setIntakeResult(null);
    setActionResult(null);
    setSubmitResult(null);
    setError(null);
    setRequestId(genReqId());
  };

  const inputCls = 'w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-[#e6edf3] focus:outline-none focus:border-blue-500 transition-colors font-mono';
  const textareaCls = 'w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-[#e6edf3] focus:outline-none focus:border-blue-500 transition-colors resize-none';
  const labelCls = 'block text-xs text-[#8b949e] mb-1 font-medium';

  const submitData = submitResult?.data || submitResult || {};
  const intakeData = intakeResult?.data || intakeResult || {};

  const actionFailed = step === 'action_failed';

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#e6edf3]">SAHYOG Sandbox Workflow</h1>
        <p className="text-sm text-[#8b949e] mt-1">
          Simulate lawful disclosure / freezing requests — no real government or VASP systems contacted.
        </p>
      </div>

      {/* Sandbox badge */}
      <div className="flex gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-300">
        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
        <div>
          <strong>SANDBOX MODE</strong> — All submissions are simulated.
          <span className="mx-2">·</span>
          <code className="text-yellow-200">productionConnected: false</code>
          <span className="mx-2">·</span>
          <code className="text-yellow-200">externalSubmission: false</code>
        </div>
      </div>

      {/* Progress indicators */}
      <div className="flex gap-6 flex-wrap">
        <StepIndicator num={1} title="SAHYOG Intake"     active={step === 0}             done={step >= 1 || actionFailed} />
        <StepIndicator num={2} title="Lawful Action"      active={step === 1}             done={step >= 2} failed={actionFailed} />
        <StepIndicator num={3} title="Sandbox Submission" active={step === 2}             done={step >= 3} />
      </div>

      {/* Form */}
      <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-5 space-y-4">
        <div>
          <label className={labelCls}>Request ID (unique per submission)</label>
          <input value={requestId} onChange={(e) => setRequestId(e.target.value)}
            className={inputCls} disabled={step !== 0} />
        </div>
        <div>
          <label className={labelCls}>Wallet Address</label>
          <input value={walletAddr} onChange={(e) => setWalletAddr(e.target.value)}
            className={inputCls} disabled={step !== 0} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Chain</label>
            <select value={chain} onChange={(e) => setChain(e.target.value)}
              className={textareaCls + ' h-[38px]'} disabled={step !== 0}>
              <option value="ETHEREUM">ETHEREUM</option>
              <option value="BITCOIN">BITCOIN</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Action Type</label>
            <select value={actionType} onChange={(e) => setActionType(e.target.value)}
              className={textareaCls + ' h-[38px]'} disabled={step !== 1 && !actionFailed}>
              <option value="DISCLOSURE_REQUEST">DISCLOSURE_REQUEST</option>
              <option value="FREEZING_REQUEST">FREEZING_REQUEST</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Lawful Basis</label>
          <input value={lawfulBasis} onChange={(e) => setLawfulBasis(e.target.value)}
            className={inputCls} disabled={step !== 1 && !actionFailed} />
        </div>
        <div>
          <label className={labelCls}>Justification</label>
          <textarea value={justification} onChange={(e) => setJustification(e.target.value)}
            rows={2} className={textareaCls} disabled={step !== 1 && !actionFailed} />
        </div>

        {/* Intake result info */}
        {step >= 1 && intakeData.caseId && (
          <div className="flex gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-300">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              Case: <code className="text-blue-200">{intakeData.caseId}</code>
              <span className="mx-2">·</span>
              Status: <code className="text-blue-200">{intakeData.status}</code>
              <span className="mx-2">·</span>
              Mode: <code className="text-yellow-300">{intakeData.integration?.mode || 'SANDBOX'}</code>
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 flex-wrap">
        {step === 0 && (
          <ActionBtn onClick={runIntake} loading={loading} icon={<Shield className="h-4 w-4" />}>
            Step 1 · Submit SAHYOG Intake
          </ActionBtn>
        )}
        {step === 1 && (
          <ActionBtn onClick={runAction} loading={loading} icon={<Shield className="h-4 w-4" />}>
            Step 2 · Prepare Lawful Action
          </ActionBtn>
        )}
        {step === 2 && (
          <ActionBtn onClick={runSubmit} loading={loading} icon={<Send className="h-4 w-4" />}>
            Step 3 · Submit to Sandbox
          </ActionBtn>
        )}
        {step !== 0 && (
          <ActionBtn onClick={reset} loading={false} variant="secondary">
            Reset Workflow
          </ActionBtn>
        )}
      </div>

      {/* General error */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          ⚠ {error}
        </div>
      )}

      {/* Known demo limitation warning for NO_VASP_CANDIDATE */}
      {actionFailed && (
        <div className="flex gap-3 rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
          <XCircle className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
          <div className="text-sm text-orange-300 space-y-1">
            <p className="font-semibold">Action prep blocked — NO_VASP_CANDIDATE (expected in demo)</p>
            <p className="text-orange-200/80 text-xs leading-relaxed">
              The backend requires a matched VASP record (<code>topCandidate.vasp ≠ null</code>) before
              allowing a lawful action. In the synthetic demo, the destination address
              (<code>0x1111…</code>) has no matching VASP entry in the intelligence database,
              so the guard correctly blocks the action.
              In a real deployment with a populated VASP database, this step would succeed.
            </p>
            <p className="text-orange-200/80 text-xs">
              The intake step (Step 1) completed successfully — demonstrating the SAHYOG intake pipeline.
            </p>
          </div>
        </div>
      )}

      {/* Final success */}
      {step === 3 && (
        <div className="flex items-start gap-3 rounded-xl border border-green-500/30 bg-green-500/10 p-4">
          <CheckCircle2 className="h-5 w-5 text-green-400 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="font-semibold text-green-300">Sandbox submission acknowledged</p>
            {submitData.sandboxAcknowledgement && (
              <p className="text-xs text-[#8b949e]">{submitData.sandboxAcknowledgement}</p>
            )}
            <div className="flex flex-wrap gap-4 text-xs text-[#8b949e] mt-2">
              <span>Mode: <code className="text-yellow-400">{submitData.mode || 'SANDBOX'}</code></span>
              <span>External: <code className="text-green-400">{String(submitData.externalSubmission ?? false)}</code></span>
              <span>Status: <code className="text-green-400">{submitData.status || 'SUBMITTED'}</code></span>
            </div>
          </div>
        </div>
      )}

      {/* JSON response panels */}
      <div className="space-y-3">
        {intakeResult && <JsonPanel label="① SAHYOG Intake Response" data={intakeResult} />}
        {actionResult && <JsonPanel label="② Lawful Action Response"  data={actionResult} />}
        {submitResult && <JsonPanel label="③ Sandbox Submit Response" data={submitResult} />}
      </div>
    </div>
  );
}
