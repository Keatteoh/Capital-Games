import { useCallback, useEffect, useState } from 'react';
import SwipeCard from './components/SwipeCard.jsx';
import {
  GOALS,
  GAME_OVER_AT,
  LOW_HEALTH,
  STAT_META,
  isUnderSlept,
  createInitialStats,
  currentGoal,
  drawCard,
  applyChoice,
  weeklyNet,
  formatFlow,
  money,
} from './decisions.js';

const TOAST_MS = 3200;

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

// What happened last turn. Floats over the card so it never pushes the layout around.
function Toast({ last, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, TOAST_MS);
    return () => clearTimeout(t);
  }, [last, onClose]);

  return (
    <button type="button" className="toast" onClick={onClose} aria-live="polite">
      {last.goalMsg && <p className="goal-msg">{last.goalMsg}</p>}
      <p>{last.outcome}</p>
      <Ledger ledger={last.ledger} />
      {last.healthDelta < 0 && <p className="health-msg">😴 Under-slept: health {last.healthDelta}</p>}
    </button>
  );
}

function newGame() {
  const stats = createInitialStats();
  const game = { stats, card: drawCard(stats), turn: 0, last: null, status: 'playing', lostTo: null };
  // Dev only: add ?stress to the URL to see the busiest screen (debt, under-slept,
  // outcome toast showing) for layout testing.
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('stress')) {
    Object.assign(stats, { wealth: -19, spareTime: 4, health: 40, day: 8 });
    game.last = {
      outcome: 'You joined the gym and recognise a few regulars already.',
      ledger: { 'Allowance from parents': 3, 'Cost of living': -20, 'Gym membership': -20 },
      goalMsg: '',
      healthDelta: -10,
    };
  }
  return game;
}

export default function App() {
  const [game, setGame] = useState(newGame);
  const [showFlows, setShowFlows] = useState(false);
  const [showToast, setShowToast] = useState(true); // only renders once there's a `last`
  const [showHint, setShowHint] = useState(false);
  const { stats, card, last, status } = game;
  const hideToast = useCallback(() => setShowToast(false), []);

  const choose = (side) => {
    const result = applyChoice(stats, card, side);
    const goalMsg = result.newGoals.map((g) => `🎯 Goal complete: ${g.title}!`).join(' ');
    const allDone = result.stats.goalsDone.length >= GOALS.length;
    const nextCard = drawCard(result.stats, card.id);
    setGame({
      stats: result.stats,
      card: nextCard,
      turn: game.turn + 1,
      last: { outcome: result.outcome, ledger: result.ledger, goalMsg, healthDelta: result.healthDelta },
      status: result.gameOver ? 'lost' : allDone ? 'won' : !nextCard ? 'out' : 'playing',
      lostTo: result.gameOver,
    });
    setShowToast(true);
  };

  const restart = () => {
    setGame(newGame());
    setShowFlows(false);
    setShowToast(false);
  };

  const net = weeklyNet(stats.flows);
  const goal = currentGoal(stats);
  const inDebt = stats.wealth < 0;
  const underSlept = isUnderSlept(stats);
  const lowHealth = stats.health < LOW_HEALTH;
  const playing = status === 'playing';

  return (
    <div className="app">
      <header className="hud hud-top">
        <Stat label="Time" value={`Day ${stats.day}`} sub={`Week ${Math.ceil(stats.day / 7)}`} />
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

        {showFlows && (
          <div className="flows" onClick={() => setShowFlows(false)}>
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
                      {f.scheduled ? (
                        <small> · due day {f.startDay}</small>
                      ) : (
                        f.endDay && <small> · ends day {f.endDay}</small>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </header>

      {playing && (
        <div className="status-strip">
          {goal && (
            <button type="button" className="goal" onClick={() => setShowHint((v) => !v)}>
              <span className="goal-step">🎯 {GOALS.indexOf(goal) + 1}/{GOALS.length}</span>
              <strong>{goal.title}</strong>
              <span className="goal-more">{showHint ? '▴' : 'ⓘ'}</span>
              {showHint && <span className="goal-hint">{goal.hint}</span>}
            </button>
          )}
          {(inDebt || underSlept) && (
            <div className="pills" role="alert">
              {inDebt && <span className="pill pill-debt">⚠️ In debt · out at {money(GAME_OVER_AT)}</span>}
              {underSlept && (
                <span className="pill pill-sleep">
                  😴 Under-slept · health {lowHealth ? 'low' : 'dropping'}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <main className="stage">
        {playing ? (
          <>
            <SwipeCard key={game.turn} decision={card} stats={stats} onChoose={choose} />
            {last && showToast && <Toast last={last} onClose={hideToast} />}
          </>
        ) : (
          <div className={`summary summary-${status}`}>
            <h2>
              {status === 'lost' && (game.lostTo === 'health' ? '🥵 Burned out' : '💸 Game over')}
              {status === 'won' && '🏆 You made it!'}
              {status === 'out' && 'No more decisions (for now)'}
            </h2>
            {status === 'lost' && game.lostTo === 'debt' && (
              <p>Your debt hit {money(stats.wealth)} on day {stats.day}.</p>
            )}
            {status === 'lost' && game.lostTo === 'health' && (
              <p>Weeks without enough sleep wore your health down to 0 on day {stats.day}.</p>
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
        <Stat label="Social" value={STAT_META.social.format(stats.social)} align="center" />
        <Stat label="Skills" value={STAT_META.skills.format(stats.skills)} align="center" />
        <Stat
          label="Health"
          value={STAT_META.health.format(stats.health)}
          align="center"
          tone={lowHealth ? 'bad' : underSlept ? 'warn' : null}
        />
        <Stat
          label="Spare"
          value={STAT_META.spareTime.format(stats.spareTime)}
          align="center"
          tone={underSlept ? 'bad' : null}
        />
      </footer>
    </div>
  );
}
