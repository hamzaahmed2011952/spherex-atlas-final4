import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Send,
  Bot,
  User,
  ShieldCheck,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  Loader2,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import {
  ObservatoryPageHeader,
  ProvenanceNotice,
} from '../ui/ObservatoryPrimitives';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  model?: string;
  isError?: boolean;
  retryable?: boolean;
}

function buildWelcomeMessage(
  language: string,
  targetName: string,
  targetCategory: string,
  spectrumTitle: string,
  fitsSummary: string
): ChatMessage {
  return {
    id: 'msg-welcome',
    sender: 'assistant',
    text:
      language === 'ar'
        ? `مرحباً بك في مساعد البحث العلمي لمنصة سفيريكس أطلس (SPHEREx ATLAS).
أنا وكيل ذكاء اصطناعي متخصص في فيزياء الفلك بالأشعة تحت الحمراء ومهمة سفيريكس.

**السياق البحثي النشط:**
- الهدف النشط: ${targetName} (${targetCategory})
- المجموعة الطيفية: ${spectrumTitle} (102 نطاق طيفي)
- ملف FITS النشط: ${fitsSummary}

ألتزم بسياسة الأمان المعرفي الصارمة، وأصنف الإجابات العلمية عبر الوسوم:
- [DIRECT OBSERVATION]: للقياسات الفيزيائية المباشرة والإحداثيات.
- [DERIVED PARAMETER]: للقيم والمعاملات المحسوبة (العمق البصري، الانزياح نحو الأحمر، الحركة الذاتية).
- [THEORETICAL MODEL]: للنماذج الفلكية والتفسيرات الكونية النظرية.
- [MISSING / UNKNOWN]: للمعلومات غير المؤكدة أو المفقودة في الأرشيف.

كيف يمكنني مساعدتك في بحثك الفلكي اليوم؟`
        : `Welcome to the SPHEREx ATLAS Scientific Research Assistant.
I am calibrated for near-infrared spectrophotometry, NASA's SPHEREx mission, and general astrophysics inquiries.

**Active Session Context:**
- Active Target: ${targetName} (${targetCategory})
- Active Spectrum: ${spectrumTitle} (102 spectral channels)
- Active FITS Product: ${fitsSummary}

Scientific statements are classified by epistemic status:
- [DIRECT OBSERVATION]: Measured coordinates, catalog values, and pixel properties.
- [DERIVED PARAMETER]: Calculated quantities (column density, optical depth, proper motion, redshift).
- [THEORETICAL MODEL]: Astrophysical models, cosmic inflation, and stellar evolution theory.
- [MISSING / UNKNOWN]: Incomplete or unavailable archive coverage.

How can I assist your investigation today?`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    model: 'gemini-4-hydrogen',
  };
}

function renderInlineFormatting(text: string): React.ReactNode[] {
  const parts = text.split(
    /(\[DIRECT OBSERVATION\]|\[DERIVED PARAMETER\]|\[THEORETICAL MODEL\]|\[MISSING \/ UNKNOWN\]|\*\*[^*]+\*\*|`[^`]+`)/g
  );

  return parts.map((chunk, i) => {
    if (chunk === '[DIRECT OBSERVATION]') {
      return (
        <span
          key={i}
          className="inline-block px-1.5 py-0.5 rounded bg-cyan-950/90 text-cyan-300 border border-cyan-700/70 font-mono font-semibold text-[10px] mx-0.5 align-middle"
        >
          [DIRECT OBSERVATION]
        </span>
      );
    }
    if (chunk === '[DERIVED PARAMETER]') {
      return (
        <span
          key={i}
          className="inline-block px-1.5 py-0.5 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-700/70 font-mono font-semibold text-[10px] mx-0.5 align-middle"
        >
          [DERIVED PARAMETER]
        </span>
      );
    }
    if (chunk === '[THEORETICAL MODEL]') {
      return (
        <span
          key={i}
          className="inline-block px-1.5 py-0.5 rounded bg-blue-950/90 text-blue-300 border border-blue-700/70 font-mono font-semibold text-[10px] mx-0.5 align-middle"
        >
          [THEORETICAL MODEL]
        </span>
      );
    }
    if (chunk === '[MISSING / UNKNOWN]') {
      return (
        <span
          key={i}
          className="inline-block px-1.5 py-0.5 rounded bg-amber-950/90 text-amber-300 border border-amber-700/70 font-mono font-semibold text-[10px] mx-0.5 align-middle"
        >
          [MISSING / UNKNOWN]
        </span>
      );
    }
    if (chunk.startsWith('**') && chunk.endsWith('**') && chunk.length > 4) {
      return (
        <strong key={i} className="font-semibold text-white">
          {chunk.slice(2, -2)}
        </strong>
      );
    }
    if (chunk.startsWith('`') && chunk.endsWith('`') && chunk.length > 2) {
      return (
        <code
          key={i}
          className="px-1.5 py-0.5 rounded bg-[#050915] border border-slate-700/80 text-cyan-300 font-mono text-[11px]"
        >
          {chunk.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={i}>{chunk}</React.Fragment>;
  });
}

function FormattedScientificMessage({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5 leading-relaxed text-[13px]" dir="auto">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1" />;
        }
        if (trimmed.startsWith('### ') || trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
          const cleanHeading = trimmed.replace(/^#{1,3}\s+/, '');
          return (
            <h4 key={idx} className="font-display font-bold text-cyan-200 text-sm pt-1">
              {renderInlineFormatting(cleanHeading)}
            </h4>
          );
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={idx} className="flex items-start gap-2 ps-1">
              <span className="text-cyan-400 mt-1 text-[10px] shrink-0">•</span>
              <div className="flex-1">{renderInlineFormatting(trimmed.slice(2))}</div>
            </div>
          );
        }
        const numberedMatch = trimmed.match(/^(\d+\.)\s+(.+)$/);
        if (numberedMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 ps-1">
              <span className="text-cyan-400 font-mono text-xs font-semibold shrink-0 mt-0.5">
                {numberedMatch[1]}
              </span>
              <div className="flex-1">{renderInlineFormatting(numberedMatch[2])}</div>
            </div>
          );
        }
        return <p key={idx}>{renderInlineFormatting(line)}</p>;
      })}
    </div>
  );
}

export const AiAssistant: React.FC = () => {
  const {
    t,
    language,
    selectedTarget,
    selectedSpectralDataset,
    activeFitsImage,
    archiveObservations,
    archiveSearchMeta,
  } = useApp();

  const fitsSummary = activeFitsImage
    ? `${activeFitsImage.name} (${activeFitsImage.naxis1}×${activeFitsImage.naxis2})`
    : language === 'ar'
    ? 'غير محمل'
    : 'None loaded';

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    buildWelcomeMessage(
      language,
      selectedTarget.name,
      selectedTarget.category,
      selectedSpectralDataset.titleEn,
      fitsSummary
    ),
  ]);

  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const [serviceStatus, setServiceStatus] = useState<{ configured: boolean; model: string } | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const inFlightRef = useRef<boolean>(false);

  const checkServiceStatus = async () => {
    try {
      const res = await fetch('/api/gemini/status');
      if (res.ok) {
        const data = await res.json();
        if (typeof data?.configured === 'boolean') {
          setServiceStatus({ configured: data.configured, model: data.model || 'gemini-4-hydrogen' });
        }
      }
    } catch {
      // ignore transient status probe failures
    }
  };

  useEffect(() => {
    checkServiceStatus();
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const copyToClipboard = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      console.warn('Clipboard write failed', e);
    }
  };

  const handleClearConversation = () => {
    if (isLoading) return;
    setLastFailedPrompt(null);
    setMessages([
      buildWelcomeMessage(
        language,
        selectedTarget.name,
        selectedTarget.category,
        selectedSpectralDataset.titleEn,
        fitsSummary
      ),
    ]);
  };

  const handleSendMessage = async (promptToSend?: string) => {
    const text = (promptToSend ?? inputPrompt).trim();
    if (!text || isLoading || inFlightRef.current) return;

    inFlightRef.current = true;
    setIsLoading(true);
    setLastFailedPrompt(null);
    if (!promptToSend) {
      setInputPrompt('');
    }

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const historyPayload = messages
      .filter((m) => m.id !== 'msg-welcome' && !m.isError)
      .map((m) => ({
        role: m.sender === 'user' ? 'user' : 'model',
        text: m.text,
      }));

    setMessages((prev) => [...prev, userMsg]);

    const context = {
      target: {
        name: selectedTarget.name,
        canonicalName: selectedTarget.canonicalName,
        category: selectedTarget.category,
        ra: selectedTarget.raHms || selectedTarget.ra,
        dec: selectedTarget.decDms || selectedTarget.dec,
        spectralType: selectedTarget.spectralType,
        keyMolecules: selectedTarget.keyMolecules,
        magnitudes: selectedTarget.apparentMagnitude,
      },
      spectralDataset: {
        title: selectedSpectralDataset.titleEn,
        category: selectedSpectralDataset.category,
        resolution: selectedSpectralDataset.resolutionPower,
        pointsCount: selectedSpectralDataset.points?.length || 0,
        wavelengthSpan: '0.75 - 5.00 microns (102 bands)',
      },
      fitsMetadata: activeFitsImage
        ? {
            name: activeFitsImage.name,
            dimensions: `${activeFitsImage.naxis1}x${activeFitsImage.naxis2}`,
            min: activeFitsImage.min,
            max: activeFitsImage.max,
            mean: activeFitsImage.mean,
            dataStatus: activeFitsImage.dataStatus,
          }
        : null,
      archiveStatus: {
        observationsCount: archiveObservations?.length || 0,
        dataStatus: archiveSearchMeta?.dataStatus || 'UNAVAILABLE DATA',
      },
    };

    try {
      const res = await fetch('/api/gemini/research-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          context,
          history: historyPayload,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      const rawBody = await res.text();
      let data: any = null;

      if (contentType.includes('application/json') || rawBody.trim().startsWith('{')) {
        try {
          data = JSON.parse(rawBody);
        } catch {
          data = null;
        }
      }

      if (!res.ok || !data?.reply) {
        const errText =
          data?.error ||
          (rawBody && !rawBody.trim().startsWith('<')
            ? rawBody.slice(0, 220)
            : `Server returned HTTP ${res.status}. Please retry.`);
        setLastFailedPrompt(text);
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            sender: 'assistant',
            text: errText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            model: data?.model || 'gemini-4-hydrogen',
            isError: true,
            retryable: data?.retryable !== false,
          },
        ]);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: 'assistant',
          text: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          model: data.model || 'gemini-4-hydrogen',
          isError: false,
        },
      ]);
    } catch (err: any) {
      setLastFailedPrompt(text);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: `Network error connecting to AI Research Assistant: ${err?.message || 'Check connection and retry.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: true,
          retryable: true,
        },
      ]);
    } finally {
      inFlightRef.current = false;
      setIsLoading(false);
    }
  };

  const researchPrompts =
    language === 'ar'
      ? [
          "ما هو نوع نجم برنارد (Barnard's Star)؟",
          'ما هي الحركة الذاتية لنجم برنارد؟',
          'اشرح خصائص الجرم WISE 0855.',
          'ما هي الأقزام البنية؟',
          'ما هو الغرض العلمي من مهمة سفيريكس (SPHEREx)؟',
          t('promptAnalyzeIce'),
          t('promptExplainWcs'),
        ]
      : [
          "What type of star is Barnard's Star?",
          "What is the proper motion of Barnard's Star?",
          'Explain the characteristics of WISE 0855.',
          'What are brown dwarfs?',
          'What is the purpose of the SPHEREx mission?',
          t('promptAnalyzeIce'),
          t('promptExplainWcs'),
        ];

  return (
    <div className="space-y-6 pb-12">
      <ObservatoryPageHeader
        kicker="SCIENTIFIC REASONING ENGINE · GEMINI 4 HYDROGEN"
        title={t('aiTitle')}
        subtitle={t('aiSubtitle')}
        metadata={[
          `Target: ${selectedTarget.name.split('/')[0]}`,
          'Epistemic Safety Policy Active',
          serviceStatus === null
            ? 'Checking Server Connection...'
            : serviceStatus.configured
            ? `${serviceStatus.model} · Connected`
            : 'Server GEMINI_API_KEY Missing',
        ]}
        actions={
          <button
            onClick={handleClearConversation}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0D162E] hover:bg-[#132042] disabled:opacity-50 text-slate-200 border border-slate-700/80 text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <Trash2 size={13} />
            <span>{t('clearChat')}</span>
          </button>
        }
      />

      {serviceStatus && !serviceStatus.configured && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-xs text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-100">
                {language === 'ar'
                  ? 'مفتاح Gemini API غير مهيأ على الخادم (GEMINI_API_KEY)'
                  : 'Server-side GEMINI_API_KEY is not configured in this environment'}
              </p>
              <p className="text-amber-200/80 mt-0.5">
                {language === 'ar'
                  ? 'أضف GEMINI_API_KEY عبر إعدادات الأسرار (Settings > Secrets في AI Studio أو Environment Variables في Vercel) دون تعديل أي ملفات.'
                  : 'Configure GEMINI_API_KEY in server secrets (AI Studio Settings > Secrets or Vercel Project Environment Variables) and click Recheck.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={checkServiceStatus}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-100 font-semibold shrink-0 transition-colors"
          >
            <RefreshCw size={13} />
            <span>{language === 'ar' ? 'إعادة الفحص' : 'Recheck Status'}</span>
          </button>
        </div>
      )}

      {/* Split Scientific Chat Console: 8-col Thread + 4-col Grounding Context */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Chat Thread */}
        <section className="lg:col-span-8 rounded-2xl cosmic-glass p-4 sm:p-5 flex flex-col h-[640px]">
          <div className="flex-1 overflow-y-auto space-y-4 pe-1">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-start gap-3 ${
                  msg.sender === 'user' ? 'flex-row-reverse' : ''
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold border ${
                    msg.sender === 'user'
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                      : msg.isError
                      ? 'bg-rose-950/80 text-rose-300 border-rose-700/70'
                      : 'bg-[#0D162E] text-cyan-300 border-slate-700'
                  }`}
                >
                  {msg.sender === 'user' ? (
                    <User size={15} />
                  ) : msg.isError ? (
                    <AlertTriangle size={15} />
                  ) : (
                    <Bot size={15} />
                  )}
                </div>

                <div
                  className={`max-w-[88%] sm:max-w-[82%] p-4 rounded-xl border ${
                    msg.sender === 'user'
                      ? 'bg-[#0D1A38] text-cyan-50 border-cyan-700/50'
                      : msg.isError
                      ? 'bg-rose-950/35 text-rose-200 border-rose-800/70'
                      : 'bg-[#060A16] text-slate-200 border-slate-800/80'
                  }`}
                >
                  {msg.sender === 'user' ? (
                    <p className="text-[13px] leading-relaxed font-medium whitespace-pre-wrap" dir="auto">
                      {msg.text}
                    </p>
                  ) : (
                    <FormattedScientificMessage text={msg.text} />
                  )}

                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-800/70 text-[10px] text-slate-500 font-mono">
                    <div className="flex items-center gap-2">
                      <span>{msg.timestamp}</span>
                      {msg.model && !msg.isError && (
                        <span className="text-cyan-300/80">{msg.model}</span>
                      )}
                    </div>

                    {msg.sender === 'assistant' && !msg.isError && (
                      <button
                        onClick={() => copyToClipboard(msg.id, msg.text)}
                        className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
                        title="Copy response"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check size={11} className="text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={11} />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#0D162E] text-cyan-300 border border-slate-700 flex items-center justify-center shrink-0">
                  <Bot size={15} />
                </div>
                <div className="p-3.5 rounded-xl bg-[#060A16] border border-slate-800 text-xs text-cyan-300 flex items-center gap-2.5 font-mono">
                  <Loader2 size={15} className="animate-spin text-cyan-400" />
                  <span>
                    {language === 'ar'
                      ? 'جاري تحليل الاستفسار العلمي عبر Gemini 4 Hydrogen...'
                      : 'Synthesizing astrophysics response via Gemini 4 Hydrogen...'}
                  </span>
                </div>
              </div>
            )}

            {lastFailedPrompt && !isLoading && (
              <div className="flex items-center justify-center pt-1">
                <button
                  onClick={() => handleSendMessage(lastFailedPrompt)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-950/70 hover:bg-rose-900/80 border border-rose-700/70 text-rose-100 text-xs font-medium transition-colors"
                >
                  <RefreshCw size={13} />
                  <span>{language === 'ar' ? 'إعادة المحاولة' : 'Retry Last Question'}</span>
                </button>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2 pt-3 mt-3 border-t border-slate-800/80"
          >
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              disabled={isLoading}
              placeholder={t('chatPlaceholder')}
              className="flex-1 bg-[#060A16] border border-slate-800 rounded-lg px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 transition-colors"
            />

            <button
              type="submit"
              disabled={isLoading || !inputPrompt.trim()}
              className="px-4 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 transition-colors shrink-0"
            >
              <Send size={14} className="rtl:rotate-180" />
              <span className="hidden sm:inline">{t('sendPrompt')}</span>
            </button>
          </form>
        </section>

        {/* Right: Context Grounding & Suggested Prompts */}
        <aside className="lg:col-span-4 space-y-4">
          {/* Active Context Telemetry */}
          <div className="p-4 rounded-2xl cosmic-glass space-y-3">
            <h2 className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
              Grounded Session Context
            </h2>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between gap-2 border-b border-slate-800/60 pb-1.5">
                <span className="text-slate-400">Target</span>
                <span className="text-white font-semibold truncate">{selectedTarget.name.split('/')[0]}</span>
              </div>
              <div className="flex justify-between gap-2 border-b border-slate-800/60 pb-1.5 tabular-nums">
                <span className="text-slate-400">Coordinates</span>
                <span className="text-cyan-300">
                  {selectedTarget.ra.toFixed(2)}°, {selectedTarget.dec.toFixed(2)}°
                </span>
              </div>
              <div className="flex justify-between gap-2 border-b border-slate-800/60 pb-1.5">
                <span className="text-slate-400">Spectrum</span>
                <span className="text-slate-200 truncate">{selectedSpectralDataset.targetName}</span>
              </div>
              <div className="flex justify-between gap-2 border-b border-slate-800/60 pb-1.5">
                <span className="text-slate-400">FITS Array</span>
                <span className="text-slate-200 truncate">{fitsSummary}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">IRSA Query</span>
                <ProvenanceNotice status={archiveSearchMeta?.dataStatus || 'UNAVAILABLE DATA'} compact />
              </div>
            </div>
          </div>

          {/* Quick Astrophysics Prompts */}
          <div className="p-4 rounded-2xl cosmic-glass space-y-2.5">
            <h3 className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Activity size={13} className="text-cyan-400" />
              <span>{t('quickQuestions')}</span>
            </h3>

            <div className="divide-y divide-slate-800/70">
              {researchPrompts.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(q)}
                  disabled={isLoading}
                  className="w-full py-2.5 text-left rtl:text-right text-xs text-slate-300 hover:text-cyan-300 disabled:opacity-50 transition-colors block"
                  title={q}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Epistemic Tag Legend */}
          <div className="p-4 rounded-2xl cosmic-glass space-y-2">
            <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-cyan-400" />
              <span>Epistemic Classification</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Every response separates direct catalog/pixel facts from derived quantities, models, and missing archive coverage.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
};
