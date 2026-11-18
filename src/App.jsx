import { useState } from 'react';
import SwipeCard from './components/SwipeCard.jsx';
import {
  GOALS,
  GAME_OVER_AT,
  STAT_META,
  createInitialStats,
  currentGoal,
  drawCard,
  applyChoice,
  weeklyNet,
  formatFlow,
  money,
} from './decisions.js';

function Stat({ label, value, align = 'left', onClick, sub, tone }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      className={`stat stat-${align} ${onClick ? 'stat-button' : ''} ${tone ? `stat-${tone}` : ''}`}
      onClick={onClick}
    >
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

function newGame() {
  const stats = createInitialStats();
  return { stats, card: drawCard(stats), turn: 0, last: null, status: 'playing' };
}

export default function App() {
  const [game, setGame] = useState(newGame);
  const [showFlows, setShowFlows] = useState(false);
  const { stats, card, last, status } = game;

  const choose = (side) => {
    const result = applyChoice(stats, card, side);
    const goalMsg = result.newGoals.map((g) => `🎯 Goal complete: ${g.title}!`).join(' ');
    const allDone = result.stats.goalsDone.length >= GOALS.length;
    const nextCard = drawCard(result.stats, card.id);
    setGame({
      stats: result.stats,
      card: nextCard,
      turn: game.turn + 1,
      last: { outcome: result.outcome, ledger: result.ledger, goalMsg },
      status: result.gameOver ? 'lost' : allDone ? 'won' : !nextCard ? 'out' : 'playing',
    });
  };

  const restart = () => {
    setGame(newGame());
    setShowFlows(false);
  };

  const net = weeklyNet(stats.flows);
  const goal = currentGoal(stats);
  const inDebt = stats.wealth < 0;

  return (
    <div className="app">
      <header className="hud hud-top">
        <Stat label="Time" value={`Day ${stats.day}`} sub={`Week ${Math.ceil(stats.day / 7)}`} />
        <div className="stat-group">
          <Stat
            label="Income ▾"
            value={`${net >= 0 ? '+' : ''}${money(net)}/wk`}
            align="right"
            tone={net < 0 ? 'bad' : null}
            onClick={() => setShowFlows((v) => !v)}
          />
          <Stat
            label="Wealth"
            value={STAT_META.wealth.format(stats.wealth)}
            align="right"
            tone={inDebt ? 'bad' : null}
          />
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

      {status === 'playing' && goal && (
        <div className="goal">
          <span className="goal-step">
            Goal {GOALS.indexOf(goal) + 1}/{GOALS.length}
          </span>
          <strong>{goal.title}</strong>
          <span className="goal-hint">{goal.hint}</span>
        </div>
      )}

      {status === 'playing' && inDebt && (
        <div className="warning" role="alert">
          ⚠️ You're in debt. If your wealth reaches {money(GAME_OVER_AT)}, it's game over.
        </div>
      )}

      <main className="stage">
        {status === 'playing' ? (
          <>
            <div className="outcome">
              {last?.goalMsg && <p className="goal-msg">{last.goalMsg}</p>}
              <p>{last ? last.outcome : 'Swipe to make your choice.'}</p>
              {last && <Ledger ledger={last.ledger} />}
            </div>
            <SwipeCard key={game.turn} decision={card} stats={stats} onChoose={choose} />
          </>
        ) : (
          <div className={`summary summary-${status}`}>
            <h2>
              {status === 'lost' && '💸 Game over'}
              {status === 'won' && '🏆 You made it!'}
              {status === 'out' && 'No more decisions (for now)'}
            </h2>
            {status === 'lost' && (
              <p>Your debt hit {money(stats.wealth)} on day {stats.day}.</p>
            )}
            {last && <p className="muted">{last.outcome}</p>}
            <ul>
              {GOALS.map((g) => (
                <li key={g.id}>
                  {stats.goalsDone.includes(g.id) ? '✅' : '⬜️'} {g.title}
                </li>
              ))}
            </ul>
            <p className="muted">
              Day {stats.day} · {money(stats.wealth)} · {net >= 0 ? '+' : ''}
              {money(net)}/wk · skills {stats.skills}
            </p>
            <button className="btn btn-primary" onClick={restart}>Play again</button>
          </div>
        )}
      </main>

      <footer className="hud hud-bottom">
        <Stat label="Social" value={STAT_META.social.format(stats.social)} />
        <Stat label="Skills" value={STAT_META.skills.format(stats.skills)} align="center" />
        <Stat label="Spare time" value={STAT_META.spareTime.format(stats.spareTime)} align="right" />
      </footer>
    </div>
  );
}
