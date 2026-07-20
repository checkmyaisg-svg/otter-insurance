import type { IntelligenceView } from '@/lib/data/intelligence';
import { MessageDraft } from '@/components/whatsapp/MessageDraft';

/**
 * AI RELATIONSHIP INTELLIGENCE — the first thing on every client profile.
 * Renders the deterministic engine's report. Every number and claim on this
 * panel traces to client data; the "why" is always one glance away.
 * Mobile-first: single column, stacks cleanly; two-column only ≥sm.
 */

const RISK_STYLE: Record<string, { label: string; cls: string }> = {
  none: { label: 'No renewal risk', cls: 'bg-white/[0.06] text-muted-foreground' },
  low: { label: 'Low risk', cls: 'bg-primary/10 text-primary' },
  medium: { label: 'Medium risk', cls: 'bg-warning/10 text-warning' },
  high: { label: 'High risk', cls: 'bg-destructive/10 text-destructive' },
};

const CONF: Record<string, string> = {
  high: 'text-primary',
  medium: 'text-warning',
  low: 'text-faint',
};

function Bar({ score }: { score: number }) {
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full rounded-full ${score >= 70 ? 'bg-primary' : score >= 40 ? 'bg-warning' : 'bg-destructive'}`}
        style={{ width: `${score}%` }}
      />
    </div>
  );
}

export function IntelligencePanel({ view, clientId, clientName }: { view: IntelligenceView; clientId: string; clientName: string }) {
  const { report: r, suggestedMessage } = view;
  const risk = RISK_STYLE[r.risk.level] ?? RISK_STYLE.none!;

  return (
    <section
      className="ds-enter rounded-xl bg-card p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_2px_8px_rgba(0,0,0,0.35)]"
      aria-label="Relationship intelligence"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-faint">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
          Relationship intelligence
        </h2>
        <span className={`inline-flex h-[18px] items-center rounded px-1.5 text-[11px] font-medium ${risk.cls}`}>
          {risk.label}{r.risk.level !== 'none' ? ` · ${r.risk.score}` : ''}
        </span>
      </div>

      {/* Executive summary */}
      <div className="space-y-1">
        {r.summary.map((line, i) => (
          <p key={i} className="text-[13.5px] leading-5 text-foreground">{line}</p>
        ))}
      </div>

      {/* Next best action */}
      <div className="mt-4 rounded-lg bg-primary/[0.07] p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Next best action</p>
        <p className="mt-1 text-[13.5px] font-medium leading-5">{r.nextAction.text}</p>
        <ul className="mt-1.5 space-y-0.5">
          {r.nextAction.reasons.map((reason, i) => (
            <li key={i} className="text-[12.5px] leading-4 text-muted-foreground">· {reason}</li>
          ))}
        </ul>
        {suggestedMessage.phone ? (
          <div className="mt-2 flex items-center gap-1 text-[12.5px] text-muted-foreground">
            <span>Suggested message ready</span>
            <MessageDraft
              clientId={clientId}
              clientName={clientName}
              policyId={suggestedMessage.policyId}
              phone={suggestedMessage.phone}
              message={suggestedMessage.text}
              compact
            />
          </div>
        ) : null}
      </div>

      {/* Alerts */}
      {r.alerts.length > 0 ? (
        <ul className="mt-4 space-y-1">
          {r.alerts.map((a, i) => (
            <li key={i} className="flex items-center gap-2 text-[13px]">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${a.severity === 'urgent' ? 'bg-destructive' : 'bg-warning'}`} aria-hidden />
              <span className={a.severity === 'urgent' ? 'text-foreground' : 'text-muted-foreground'}>{a.text}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Relationship health */}
        <div>
          <div className="flex items-baseline justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">Relationship health</p>
            <p className="text-[17px] font-semibold tabular-nums leading-6 tracking-tight">{r.health.overall}<span className="text-[12px] font-normal text-faint">/100</span></p>
          </div>
          <div className="mt-2 space-y-2">
            {r.health.components.map((c) => (
              <div key={c.key}>
                <div className="mb-0.5 flex items-baseline justify-between">
                  <span className="text-[12.5px] text-muted-foreground">{c.label}</span>
                  <span className="text-[12px] tabular-nums text-faint">{c.score}</span>
                </div>
                <Bar score={c.score} />
                <p className="mt-0.5 text-[11.5px] leading-4 text-faint">{c.basis}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Opportunities + renewal value */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">Opportunities</p>
          {r.opportunities.length === 0 ? (
            <p className="mt-2 text-[13px] text-muted-foreground">No coverage gaps detected from current records.</p>
          ) : (
            <ul className="mt-2 space-y-2.5">
              {r.opportunities.map((o) => (
                <li key={o.key}>
                  <p className="text-[13px] font-medium leading-4">
                    {o.title}{' '}
                    <span className={`text-[11px] font-normal uppercase tracking-wide ${CONF[o.confidence]}`}>{o.confidence}</span>
                  </p>
                  <p className="mt-0.5 text-[12px] leading-4 text-muted-foreground">{o.reasoning}</p>
                  <p className="mt-0.5 text-[11.5px] leading-4 text-faint">{o.revenueBasis}</p>
                </li>
              ))}
            </ul>
          )}
          {r.renewalValue > 0 ? (
            <div className="mt-3 border-t !border-white/[0.06] pt-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">Renewal value at stake</p>
              <p className="mt-0.5 text-[17px] font-semibold tabular-nums leading-6 tracking-tight">
                S${r.renewalValue.toLocaleString('en-SG', { maximumFractionDigits: 0 })}
              </p>
              <p className="text-[11.5px] leading-4 text-faint">{r.renewalValueBasis}</p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
