import { useState } from 'react';
import SwipeCard from './components/SwipeCard.jsx';
import {
  DECISIONS,
  STAT_META,
  createInitialStats,
  applyChoice,
  weeklyNet,
  formatFlow,
  money,
} from './decisions.js';

function Stat({ label, value, align = 'left', onClick, sub }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={`stat stat-${align} ${onClick ? 'stat-button' : ''}`} onClick={onClick}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </Tag>
  );
}

function Ledger({ ledger }) {
  const rows = Object.entries(ledger).filter(([, v]) => v !== 0);
  if (rows.length === 0) return null;
  return (
    <ul className="ledger">
      {rows.map(([label, amount]) => (
        <li key={label} className={amount >= 0 ? 'pos' : 'neg'}>
          {label} {amount >= 0 ? '+' : ''}{money(amount)}
        </li>
      ))}
    </ul>
  );
}

export default function App() {
  const [stats, setStats] = useState(createInitialStats);
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState([]);
  const [showFlows, setShowFlows] = useState(false);

  const decision = DECISIONS[index];
  const finished = index >= DECISIONS.length;

  const choose = (side) => {
    const choice = decision[side];
    const result = applyChoice(stats, choice, decision.days);
    setStats(result.stats);
    setHistory((h) => [
      ...h,
      { prompt: decision.prompt, label: choice.label, outcome: choice.outcome, ledger: result.ledger },
    ]);
    setIndex((i) => i + 1);
  };

  const restart = () => {
    setStats(createInitialStats());
    setIndex(0);
    setHistory([]);
    setShowFlows(false);
  };

  const last = history[history.length - 1];
  const net = weeklyNet(stats.flows);

  return (
    <div className="app">
      <header className="hud hud-top">
        <Stat label="Time" value={`Day ${stats.day}`} sub={`Week ${Math.ceil(stats.day / 7)}`} />
        <div className="stat-group">
          <Stat
            label="Income ▾"
            value={`${net >= 0 ? '+' : ''}${money(net)}/wk`}
            align="right"
            onClick={() => setShowFlows((v) => !v)}
          />
          <Stat label="Wealth" value={STAT_META.wealth.format(stats.wealth)} align="right" />
        </div>
      </header>

      {showFlows && (
        <div className="flows">
          <h3>Recurring</h3>
          {stats.flows.length === 0 ? (
            <p className="muted">No regular income or expenses.</p>
          ) : (
            <ul>
              {stats.flows.map((f) => (
                <li key={f.id}>
                  <span>{f.label}</span>
                  <span className={f.amount >= 0 ? 'pos' : 'neg'}>
                    {formatFlow(f)}
                    {f.endDay && <small> · ends day {f.endDay}</small>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <main className="stage">
        {finished ? (
          <div className="summary">
            <h2>End of the road (for now)</h2>
            <p className="muted">
              Day {stats.day} · {money(stats.wealth)} in the bank · {net >= 0 ? '+' : ''}
              {money(net)}/wk
            </p>
            <ul>
              {history.map((h, i) => (
                <li key={i}>
                  <strong>{h.label}</strong> — {h.prompt}
                </li>
              ))}
            </ul>
            <button className="btn btn-primary" onClick={restart}>Play again</button>
          </div>
        ) : (
          <>
            <div className="outcome">
              <p>{last ? last.outcome : 'Swipe to make your choice.'}</p>
              {last && <Ledger ledger={last.ledger} />}
            </div>
            <SwipeCard key={decision.id} decision={decision} onChoose={choose} />
          </>
        )}
      </main>

      <footer className="hud hud-bottom">
        <Stat label="Social" value={STAT_META.social.format(stats.social)} />
        <Stat label="Spare time" value={STAT_META.spareTime.format(stats.spareTime)} align="right" />
      </footer>
    </div>
  );
}
