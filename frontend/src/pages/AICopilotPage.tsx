import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useConfig } from '../context/ConfigContext';
import { apiClient } from '../api/client';
import {
  Send, Bot, User, Sparkles, Globe, FileText,
  Loader2, Copy, Check, RotateCcw, Activity,
  Zap, BookOpen
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
}

interface GroqStatus {
  groq_enabled: boolean;
  model: string;
  mode: string;
  note: string;
}

// ─── Quick prompt suggestions ─────────────────────────────────────────────────
const QUICK_PROMPTS = [
  { icon: '📊', label: 'Current AQI status', prompt: 'What is the current air quality status in the city?' },
  { icon: '⚖️', label: 'Enforcement actions', prompt: 'What enforcement actions should I take right now?' },
  { icon: '🏥', label: 'Health risk groups', prompt: 'Who are the most at-risk groups and what should they do?' },
  { icon: '🏭', label: 'Pollution sources', prompt: 'What are the main sources of pollution causing this AQI?' },
  { icon: '📋', label: 'GRAP provisions', prompt: 'What GRAP provisions are applicable at this AQI level?' },
  { icon: '🔬', label: 'Simulation insights', prompt: 'How can I use the digital twin to test interventions?' },
];

const TRANSLATE_LANGS = [
  { code: 'hi', name: 'Hindi' },
  { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' },
  { code: 'kn', name: 'Kannada' },
  { code: 'mr', name: 'Marathi' },
  { code: 'bn', name: 'Bengali' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'pa', name: 'Punjabi' },
];

// ─── Component ────────────────────────────────────────────────────────────────
export const AICopilotPage: React.FC = () => {
  const { config } = useConfig();
  const city = config?.city || 'bengaluru';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [groqStatus, setGroqStatus] = useState<GroqStatus | null>(null);
  const [currentAqi, setCurrentAqi] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'translate' | 'report'>('chat');

  // Translate tab state
  const [translateText, setTranslateText] = useState('');
  const [translateLang, setTranslateLang] = useState('hi');
  const [translationResult, setTranslationResult] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);

  // Report tab state
  const [reportPeriod, setReportPeriod] = useState('Last 7 Days');
  const [reportResult, setReportResult] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load Groq status and current AQI
  useEffect(() => {
    const loadStatus = async () => {
      try {
        const [statusRes, dashRes] = await Promise.allSettled([
          apiClient.get('/api/copilot/status'),
          apiClient.get(`/api/dashboard/overview?city=${city}`),
        ]);
        if (statusRes.status === 'fulfilled') setGroqStatus(statusRes.value.data);
        if (dashRes.status === 'fulfilled') {
          const d = dashRes.value.data;
          setCurrentAqi(d.avg_aqi || d.city_aqi || 156);
        }
      } catch { /* ignore */ }
    };
    loadStatus();
  }, [city]);

  // Inject welcome message
  useEffect(() => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: `Hello! I'm **ARIA** — your Air Quality Reasoning Intelligence Agent 🌿\n\nI'm monitoring **${city.charAt(0).toUpperCase() + city.slice(1)}** and ready to assist you with AQI analysis, enforcement guidance, health advisories, source attribution, and regulatory questions.\n\nWhat would you like to know?`,
        timestamp: new Date(),
      }
    ]);
  }, [city]);

  const sendMessage = useCallback(async (messageText?: string) => {
    const text = (messageText || input).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    const loadingMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const history = [...messages, userMsg]
        .filter(m => !m.isLoading)
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content }));

      const res = await apiClient.post('/api/copilot/chat', {
        messages: history,
        city,
        current_aqi: currentAqi,
      });

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: res.data.response,
        timestamp: new Date(),
      };

      setMessages(prev => prev.filter(m => !m.isLoading).concat(assistantMsg));
    } catch {
      setMessages(prev => prev.filter(m => !m.isLoading).concat({
        id: (Date.now() + 3).toString(),
        role: 'assistant',
        content: '⚠️ Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      }));
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [input, isLoading, messages, city, currentAqi]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const copyMessage = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const clearChat = () => {
    setMessages([{
      id: 'welcome-reset',
      role: 'assistant',
      content: `Chat cleared. How can I help you monitor air quality in **${city.charAt(0).toUpperCase() + city.slice(1)}**?`,
      timestamp: new Date(),
    }]);
  };

  const handleTranslate = async () => {
    if (!translateText.trim()) return;
    setIsTranslating(true);
    try {
      const res = await apiClient.post('/api/copilot/translate', {
        text: translateText,
        target_lang: translateLang,
      });
      setTranslationResult(res.data.translated);
    } catch {
      setTranslationResult('Translation failed. Please try again.');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    try {
      const res = await apiClient.post('/api/copilot/report', {
        city,
        period: reportPeriod,
        avg_aqi: currentAqi || 156,
        violations: [
          'Construction site dust suppression non-compliance (Ward 12)',
          'Industrial effluent burning near sector boundary',
          'Heavy vehicle movement during restricted hours',
          'Open waste burning observed at 3 locations',
        ],
        actions_taken: [
          'Stop-work notice issued to 7 construction sites',
          'Heavy vehicle ban enforced on Ring Road corridor',
          'Water sprinkling deployed on 12 arterial roads',
        ],
        recommendations: [
          'Activate GRAP Stage II measures city-wide',
          'Increase inspection frequency in high-AQI wards',
          'Deploy additional sensor networks in undermonitored zones',
        ],
      });
      setReportResult(res.data.report);
    } catch {
      setReportResult('Report generation failed. Please try again.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // ─── Markdown-lite renderer ─────────────────────────────────────────────────
  const renderContent = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, i) => {
      // Bold
      line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Headers
      if (line.startsWith('# ')) return <h3 key={i} className="text-[13px] font-bold text-white mt-3 mb-1" dangerouslySetInnerHTML={{ __html: line.slice(2) }} />;
      if (line.startsWith('## ')) return <h4 key={i} className="text-[12px] font-bold text-[#e5e7eb] mt-2 mb-1" dangerouslySetInnerHTML={{ __html: line.slice(3) }} />;
      // List items
      if (line.startsWith('- ') || line.match(/^\d+\. /)) {
        return <div key={i} className="flex gap-2 ml-2 text-[11px] text-[#d1d5db] leading-relaxed" dangerouslySetInnerHTML={{ __html: `<span class="text-[#6b7280] shrink-0">${line.match(/^\d+/) ? line.match(/^\d+\./)![0] : '•'}</span><span>${line.replace(/^- /, '').replace(/^\d+\. /, '')}</span>` }} />;
      }
      // Divider
      if (line === '---') return <hr key={i} className="border-[#374151] my-2" />;
      // Empty line
      if (!line.trim()) return <div key={i} className="h-1.5" />;
      return <p key={i} className="text-[11px] text-[#d1d5db] leading-relaxed" dangerouslySetInnerHTML={{ __html: line }} />;
    });
  };

  return (
    <div className="h-[calc(100vh-52px)] flex bg-[#111827] text-[#f9fafb] font-sans overflow-hidden">

      {/* ─── Left Sidebar ───────────────────────────────────────────────────── */}
      <div className="w-[260px] border-r border-[#374151] bg-[#1f2937] flex flex-col shrink-0">

        {/* Header */}
        <div className="p-4 border-b border-[#374151]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2563eb] to-[#7c3aed] flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-white">ARIA</p>
              <p className="text-[9px] text-[#6b7280]">AI Reasoning Agent</p>
            </div>
          </div>

          {/* Groq Status */}
          {groqStatus && (
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-medium ${
              groqStatus.groq_enabled
                ? 'bg-[#065f46]/30 text-[#34d399] border border-[#065f46]'
                : 'bg-[#78350f]/30 text-[#fbbf24] border border-[#78350f]'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${groqStatus.groq_enabled ? 'bg-[#34d399] animate-pulse' : 'bg-[#fbbf24]'}`} />
              {groqStatus.groq_enabled ? `Groq AI • ${groqStatus.model.split('-')[0].toUpperCase()}` : 'Demo Mode'}
            </div>
          )}

          {currentAqi && (
            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[#9ca3af]">
              <Activity className="w-3 h-3" />
              <span>{city.charAt(0).toUpperCase() + city.slice(1)} AQI: </span>
              <span className={`font-bold ${currentAqi > 200 ? 'text-[#f87171]' : currentAqi > 100 ? 'text-[#fbbf24]' : 'text-[#4ade80]'}`}>
                {Math.round(currentAqi)}
              </span>
            </div>
          )}
        </div>

        {/* Tab Nav */}
        <div className="flex border-b border-[#374151] text-[10px] font-semibold">
          {[
            { key: 'chat', label: 'Chat', icon: Bot },
            { key: 'translate', label: 'Translate', icon: Globe },
            { key: 'report', label: 'Report', icon: FileText },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`flex-1 py-2.5 flex flex-col items-center gap-0.5 transition-colors ${
                activeTab === key
                  ? 'text-[#60a5fa] border-b-2 border-[#2563eb]'
                  : 'text-[#6b7280] hover:text-[#9ca3af] border-b-2 border-transparent'
              }`}
            >
              <Icon className="w-3 h-3" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Quick Prompts (Chat tab only) */}
        {activeTab === 'chat' && (
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            <p className="text-[9px] font-bold uppercase tracking-wider text-[#6b7280] mb-2">
              Quick Actions
            </p>
            {QUICK_PROMPTS.map((p, i) => (
              <button
                key={i}
                onClick={() => sendMessage(p.prompt)}
                className="w-full text-left px-2.5 py-2 rounded text-[10px] text-[#9ca3af] hover:text-[#e5e7eb] hover:bg-[#374151]/40 transition-colors flex items-start gap-2"
              >
                <span className="shrink-0 text-[12px]">{p.icon}</span>
                <span>{p.label}</span>
              </button>
            ))}

            <div className="border-t border-[#374151] pt-3 mt-2">
              <p className="text-[9px] font-bold uppercase tracking-wider text-[#6b7280] mb-2">Tools</p>
              <button
                onClick={clearChat}
                className="w-full text-left px-2.5 py-2 rounded text-[10px] text-[#9ca3af] hover:text-[#e5e7eb] hover:bg-[#374151]/40 transition-colors flex items-center gap-2"
              >
                <RotateCcw className="w-3 h-3" />
                Clear conversation
              </button>
            </div>

            {/* Groq setup hint */}
            {groqStatus && !groqStatus.groq_enabled && (
              <div className="mt-4 p-2.5 bg-[#1e3a5f]/40 border border-[#1e3a5f] rounded text-[9px] text-[#93c5fd] leading-relaxed">
                <p className="font-bold mb-1 flex items-center gap-1">
                  <Zap className="w-3 h-3" />Enable Full AI
                </p>
                <p>Add your <code className="text-[#fbbf24]">GROQ_API_KEY</code> to <code>.env</code> to activate live Groq LLM responses.</p>
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 mt-1.5 text-[#60a5fa] hover:underline"
                >
                  Get API Key →
                </a>
              </div>
            )}
          </div>
        )}

        {/* Translate Tab Sidebar */}
        {activeTab === 'translate' && (
          <div className="flex-1 p-3 space-y-3 overflow-y-auto">
            <p className="text-[9px] font-bold uppercase tracking-wider text-[#6b7280]">
              Select Language
            </p>
            {TRANSLATE_LANGS.map(lang => (
              <button
                key={lang.code}
                onClick={() => setTranslateLang(lang.code)}
                className={`w-full text-left px-3 py-2 rounded text-[11px] transition-colors border ${
                  translateLang === lang.code
                    ? 'bg-[#2563eb]/10 border-[#2563eb]/40 text-[#93c5fd]'
                    : 'bg-transparent border-[#374151] text-[#9ca3af] hover:text-[#e5e7eb]'
                }`}
              >
                {lang.name}
              </button>
            ))}
          </div>
        )}

        {/* Report Tab Sidebar */}
        {activeTab === 'report' && (
          <div className="flex-1 p-3 space-y-3 overflow-y-auto">
            <p className="text-[9px] font-bold uppercase tracking-wider text-[#6b7280]">
              Report Period
            </p>
            {['Last 24 Hours', 'Last 7 Days', 'Last 30 Days', 'Custom'].map(p => (
              <button
                key={p}
                onClick={() => setReportPeriod(p)}
                className={`w-full text-left px-3 py-2 rounded text-[11px] border transition-colors ${
                  reportPeriod === p
                    ? 'bg-[#2563eb]/10 border-[#2563eb]/40 text-[#93c5fd]'
                    : 'bg-transparent border-[#374151] text-[#9ca3af] hover:text-[#e5e7eb]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ─── Main Content Area ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* ─── Chat Tab ──────────────────────────────────────────────────────── */}
        {activeTab === 'chat' && (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scroll">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {/* Avatar */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    msg.role === 'user'
                      ? 'bg-[#374151]'
                      : 'bg-gradient-to-br from-[#2563eb] to-[#7c3aed]'
                  }`}>
                    {msg.role === 'user'
                      ? <User className="w-3.5 h-3.5 text-[#9ca3af]" />
                      : <Bot className="w-3.5 h-3.5 text-white" />
                    }
                  </div>

                  {/* Bubble */}
                  <div className={`max-w-[75%] group relative ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                    <div className={`px-4 py-3 rounded-2xl text-[11px] leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#2563eb] text-white rounded-tr-sm'
                        : 'bg-[#1f2937] border border-[#374151] text-[#e5e7eb] rounded-tl-sm'
                    }`}>
                      {msg.isLoading ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#6b7280]" />
                          <span className="text-[#6b7280]">ARIA is thinking…</span>
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          {renderContent(msg.content)}
                        </div>
                      )}
                    </div>

                    {/* Copy button */}
                    {!msg.isLoading && msg.role === 'assistant' && (
                      <button
                        onClick={() => copyMessage(msg.id, msg.content)}
                        className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[9px] text-[#6b7280] hover:text-[#9ca3af] px-1"
                      >
                        {copiedId === msg.id
                          ? <><Check className="w-3 h-3 text-[#4ade80]" /> Copied</>
                          : <><Copy className="w-3 h-3" /> Copy</>
                        }
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="shrink-0 border-t border-[#374151] bg-[#1f2937] p-4">
              <div className="flex gap-3 items-end">
                <div className="flex-1 relative">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about AQI, enforcement actions, health risks, GRAP regulations…"
                    rows={1}
                    style={{ resize: 'none' }}
                    className="w-full bg-[#111827] border border-[#374151] focus:border-[#2563eb] rounded-xl px-4 py-3 text-[12px] text-[#e5e7eb] placeholder-[#4b5563] outline-none transition-colors leading-relaxed"
                  />
                </div>
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isLoading}
                  className="flex items-center justify-center w-10 h-10 bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors shrink-0"
                >
                  <Send className="w-4 h-4 text-white" />
                </button>
              </div>
              <p className="text-[9px] text-[#4b5563] mt-1.5 text-center">
                Press <kbd className="bg-[#374151] px-1 py-0.5 rounded text-[8px]">Enter</kbd> to send · <kbd className="bg-[#374151] px-1 py-0.5 rounded text-[8px]">Shift+Enter</kbd> for new line
              </p>
            </div>
          </>
        )}

        {/* ─── Translate Tab ──────────────────────────────────────────────────── */}
        {activeTab === 'translate' && (
          <div className="flex-1 flex flex-col overflow-hidden p-6 gap-4">
            <div className="shrink-0">
              <div className="flex items-center gap-2 mb-1">
                <Globe className="w-5 h-5 text-[#60a5fa]" />
                <h2 className="text-[16px] font-bold text-white">Multi-Language Advisory Translation</h2>
              </div>
              <p className="text-[11px] text-[#6b7280]">
                Translate health advisories and enforcement notices for regional communication using Groq AI.
              </p>
            </div>

            <div className="flex-1 flex gap-4 min-h-0">
              {/* Source text */}
              <div className="flex-1 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280]">
                    English Advisory
                  </label>
                  <button
                    onClick={() => setTranslateText(
                      `Air quality in your area is Poor (AQI: ${currentAqi ? Math.round(currentAqi) : 175}). ` +
                      'Avoid outdoor activities, especially for children and elderly. ' +
                      'Wear N95 mask if going outside. Close windows and doors to reduce indoor pollution.'
                    )}
                    className="text-[9px] text-[#60a5fa] hover:underline"
                  >
                    Use sample advisory
                  </button>
                </div>
                <textarea
                  value={translateText}
                  onChange={e => setTranslateText(e.target.value)}
                  placeholder="Enter the health advisory or enforcement notice to translate…"
                  className="flex-1 bg-[#1f2937] border border-[#374151] focus:border-[#2563eb] rounded-xl p-4 text-[12px] text-[#e5e7eb] placeholder-[#4b5563] outline-none transition-colors resize-none leading-relaxed"
                />
              </div>

              {/* Arrow + translate button */}
              <div className="flex flex-col items-center justify-center gap-3 shrink-0">
                <div className="flex flex-col items-center gap-1 text-[9px] text-[#6b7280]">
                  <span>→</span>
                  <span>{TRANSLATE_LANGS.find(l => l.code === translateLang)?.name}</span>
                </div>
                <button
                  onClick={handleTranslate}
                  disabled={!translateText.trim() || isTranslating}
                  className="flex items-center gap-1.5 bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-40 text-white text-[11px] font-semibold px-3 py-2 rounded-lg transition-colors"
                >
                  {isTranslating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                  Translate
                </button>
              </div>

              {/* Translation output */}
              <div className="flex-1 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280]">
                    {TRANSLATE_LANGS.find(l => l.code === translateLang)?.name} Translation
                  </label>
                  {translationResult && (
                    <button
                      onClick={() => navigator.clipboard.writeText(translationResult)}
                      className="text-[9px] text-[#60a5fa] hover:underline flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />Copy
                    </button>
                  )}
                </div>
                <div className="flex-1 bg-[#1f2937] border border-[#374151] rounded-xl p-4 text-[12px] text-[#e5e7eb] leading-relaxed overflow-y-auto custom-scroll">
                  {isTranslating ? (
                    <div className="flex items-center gap-2 text-[#6b7280]">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Translating via Groq AI…</span>
                    </div>
                  ) : translationResult ? (
                    <p className="leading-loose">{translationResult}</p>
                  ) : (
                    <p className="text-[#4b5563] italic">Translation will appear here…</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Report Tab ─────────────────────────────────────────────────────── */}
        {activeTab === 'report' && (
          <div className="flex-1 flex flex-col overflow-hidden p-6 gap-4">
            <div className="shrink-0 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-5 h-5 text-[#60a5fa]" />
                  <h2 className="text-[16px] font-bold text-white">Compliance Report Generator</h2>
                </div>
                <p className="text-[11px] text-[#6b7280]">
                  Generate AI-powered compliance reports for CPCB/NGT/PCB submission.
                </p>
              </div>
              <button
                onClick={handleGenerateReport}
                disabled={isGeneratingReport}
                className="flex items-center gap-2 bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-40 text-white text-[12px] font-bold px-4 py-2.5 rounded-xl transition-colors"
              >
                {isGeneratingReport
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Generating…</>
                  : <><Sparkles className="w-4 h-4" />Generate Report</>
                }
              </button>
            </div>

            {/* Config cards */}
            <div className="shrink-0 grid grid-cols-3 gap-3">
              <div className="bg-[#1f2937] border border-[#374151] rounded-xl p-3">
                <p className="text-[9px] font-bold uppercase tracking-wider text-[#6b7280] mb-1">City</p>
                <p className="text-[13px] font-bold text-white">{city.charAt(0).toUpperCase() + city.slice(1)}</p>
              </div>
              <div className="bg-[#1f2937] border border-[#374151] rounded-xl p-3">
                <p className="text-[9px] font-bold uppercase tracking-wider text-[#6b7280] mb-1">Period</p>
                <p className="text-[13px] font-bold text-white">{reportPeriod}</p>
              </div>
              <div className="bg-[#1f2937] border border-[#374151] rounded-xl p-3">
                <p className="text-[9px] font-bold uppercase tracking-wider text-[#6b7280] mb-1">Avg AQI</p>
                <p className="text-[13px] font-bold text-white">{currentAqi ? Math.round(currentAqi) : '—'}</p>
              </div>
            </div>

            {/* Report output */}
            <div className="flex-1 min-h-0 bg-[#1f2937] border border-[#374151] rounded-xl p-5 overflow-y-auto custom-scroll relative">
              {isGeneratingReport ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-[#6b7280]">
                  <Loader2 className="w-8 h-8 animate-spin text-[#2563eb]" />
                  <p className="text-[12px]">Generating compliance report via Groq AI…</p>
                </div>
              ) : reportResult ? (
                <>
                  <div className="absolute top-3 right-3 flex gap-2">
                    <button
                      onClick={() => navigator.clipboard.writeText(reportResult)}
                      className="flex items-center gap-1 text-[9px] text-[#60a5fa] hover:underline bg-[#111827]/50 px-2 py-1 rounded"
                    >
                      <Copy className="w-3 h-3" />Copy
                    </button>
                  </div>
                  <pre className="text-[11px] text-[#d1d5db] leading-relaxed whitespace-pre-wrap font-mono">
                    {reportResult}
                  </pre>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-[#4b5563]">
                  <BookOpen className="w-10 h-10 opacity-30" />
                  <div className="text-center">
                    <p className="text-[13px] font-semibold mb-1">No report generated yet</p>
                    <p className="text-[11px]">Select a reporting period and click "Generate Report"</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AICopilotPage;
