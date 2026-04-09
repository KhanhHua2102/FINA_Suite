interface DebateRoundResult {
  majority_view: string;
  counter_argument: string;
  verdict: string;
  reasoning: string;
}

export interface DebateRound {
  ticker: string;
  round: number;
  result: DebateRoundResult;
}

interface DebateTimelineProps {
  rounds: DebateRound[];
}

export function DebateTimeline({ rounds }: DebateTimelineProps) {
  if (!rounds || rounds.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: '#71717a' }}>
        Debate Rounds
      </p>
      <div className="relative pl-4" style={{ borderLeft: '2px solid #eab308' }}>
        <div className="space-y-4">
          {rounds.map((round, i) => (
            <div key={i} className="relative">
              {/* Round dot */}
              <div
                className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: '#eab308', border: '2px solid #18181b' }}
              />

              <div
                className="rounded-xl p-3 space-y-2"
                style={{ background: '#09090b', border: '1px solid #27272a' }}
              >
                {/* Round header */}
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: '#27272a', color: '#eab308' }}
                  >
                    Round {round.round}
                  </span>
                  <span className="text-xs font-mono" style={{ color: '#71717a' }}>
                    {round.ticker}
                  </span>
                </div>

                {/* Majority view */}
                {round.result.majority_view && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: '#52525b' }}>
                      Majority view
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: '#a1a1aa' }}>
                      {round.result.majority_view}
                    </p>
                  </div>
                )}

                {/* Counter argument */}
                {round.result.counter_argument && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: '#52525b' }}>
                      Counter argument
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: '#a1a1aa' }}>
                      {round.result.counter_argument}
                    </p>
                  </div>
                )}

                {/* Verdict */}
                {round.result.verdict && (
                  <div
                    className="rounded-lg px-3 py-2"
                    style={{ background: '#18181b', border: '1px solid #27272a' }}
                  >
                    <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: '#52525b' }}>
                      Verdict
                    </p>
                    <p className="text-xs font-medium leading-relaxed" style={{ color: '#ECEDEE' }}>
                      {round.result.verdict}
                    </p>
                  </div>
                )}

                {/* Reasoning */}
                {round.result.reasoning && (
                  <p className="text-xs leading-relaxed italic" style={{ color: '#52525b' }}>
                    {round.result.reasoning}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
