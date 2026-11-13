import React from 'react';
import { ScientificDataStatus } from '../../types/astronomy';

interface ObservatoryPageHeaderProps {
  kicker?: string;
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  metadata?: string[];
}

export const ObservatoryPageHeader: React.FC<ObservatoryPageHeaderProps> = ({
  kicker,
  title,
  subtitle,
  actions,
  metadata,
}) => {
  return (
    <header className="pb-5 border-b border-cyan-500/20 flex flex-col lg:flex-row lg:items-end justify-between gap-4 relative">
      <div className="min-w-0 max-w-3xl">
        {kicker && (
          <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.16em] text-cyan-300 font-semibold mb-1.5">
            <span className="w-4 h-[1px] bg-cyan-400/70" aria-hidden="true" />
            <span>{kicker}</span>
          </div>
        )}
        <h1 className="font-display text-2xl sm:text-[28px] font-bold text-white tracking-tight leading-tight text-balance">
          {title}
        </h1>
        <p className="text-xs sm:text-[13px] text-slate-300/85 mt-1.5 leading-relaxed max-w-2xl">
          {subtitle}
        </p>
        {metadata && metadata.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-300">
            {metadata.map((item, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded bg-[#0A1328]/80 border border-slate-700/70 text-slate-300"
              >
                {item}
              </span>
            ))}
          </div>
        )}
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
};

interface MetricReadoutProps {
  label: string;
  value: string | number;
  unit?: string;
  footnote?: string;
  accent?: 'cyan' | 'emerald' | 'amber' | 'neutral';
}

export const MetricReadout: React.FC<MetricReadoutProps> = ({
  label,
  value,
  unit,
  footnote,
  accent = 'neutral',
}) => {
  const accentText =
    accent === 'cyan'
      ? 'text-cyan-300'
      : accent === 'emerald'
      ? 'text-emerald-300'
      : accent === 'amber'
      ? 'text-amber-300'
      : 'text-white';

  return (
    <div className="p-4 sm:p-5 rounded-xl cosmic-glass relative overflow-hidden flex flex-col justify-between">
      <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/35 to-transparent pointer-events-none" />
      <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
        {label}
      </span>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className={`text-2xl sm:text-[26px] font-mono font-semibold tabular-nums tracking-tight ${accentText}`}>
          {value}
        </span>
        {unit && (
          <span className="text-xs font-mono text-slate-400 uppercase">{unit}</span>
        )}
      </div>
      {footnote && (
        <span className="mt-2 text-[11px] text-slate-400 truncate">
          {footnote}
        </span>
      )}
    </div>
  );
};

export const ProvenanceNotice: React.FC<{
  status: ScientificDataStatus | string;
  compact?: boolean;
}> = ({ status, compact = false }) => {
  const normalized = String(status).toUpperCase();
  const isReal = normalized.includes('REAL');
  const isExternal = normalized.includes('EXTERNAL');
  const isUnavailable = normalized.includes('UNAVAILABLE');

  const toneClass = isReal
    ? 'text-emerald-300 border-emerald-500/35 bg-emerald-950/35'
    : isExternal
    ? 'text-sky-300 border-sky-500/35 bg-sky-950/35'
    : isUnavailable
    ? 'text-slate-300 border-slate-700 bg-slate-900/70'
    : 'text-amber-300 border-amber-500/35 bg-amber-950/35';

  return (
    <span
      className={`inline-flex items-center font-mono font-semibold border rounded-md whitespace-nowrap ${
        compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
      } ${toneClass}`}
    >
      {status}
    </span>
  );
};

interface DeepSpaceImageFrameProps {
  src: string;
  alt: string;
  caption?: string;
  kicker?: string;
  className?: string;
  fallbackIcon?: React.ReactNode;
}

export const DeepSpaceImageFrame: React.FC<DeepSpaceImageFrameProps> = ({
  src,
  alt,
  caption,
  kicker,
  className = '',
  fallbackIcon,
}) => {
  const [failed, setFailed] = React.useState(false);

  return (
    <figure className={`relative overflow-hidden rounded-xl border border-slate-800/90 bg-[#040712] ${className}`}>
      {!failed ? (
        <img
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover block"
        />
      ) : (
        <div className="w-full h-full min-h-[220px] flex flex-col items-center justify-center bg-gradient-to-br from-[#070D1F] via-[#050914] to-[#0B1530] p-6 text-center">
          {fallbackIcon}
          <span className="mt-2 text-xs font-mono text-slate-400">{alt}</span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#040711]/90 via-[#040711]/25 to-transparent pointer-events-none" />
      {(kicker || caption) && (
        <figcaption className="absolute inset-x-0 bottom-0 p-4 pointer-events-none">
          {kicker && (
            <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-cyan-300/90 font-semibold">
              {kicker}
            </div>
          )}
          {caption && (
            <div className="text-xs text-slate-200 mt-0.5 leading-snug">
              {caption}
            </div>
          )}
        </figcaption>
      )}
    </figure>
  );
};
