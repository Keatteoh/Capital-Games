import { useCallback, useEffect, useState } from 'react';
import SwipeCard from './components/SwipeCard.jsx';
import {
  GOALS,
  DECISIONS,
  EVENTS,
  houseCard,
  reassessCard,
  makeHouse,
  STARTING_DEBT,
  DEBT_HEALTH_LOSS_PER_WEEK,
  isIncomeStream,
  LOW_HEALTH,
  STAT_META,
  WEEKDAYS,
  dayOfWeek,
  isUnderSlept,
  createInitialStats,
  currentGoal,
  drawCard,
  applyChoice,
  weeklyNet,
  formatFlow,
  formatDelta,
  money,
} from './decisions.js';

const TOAST_MS = 3200;

// One cell of the scoreboard at the top.
function Cell({ label, value, onClick, tone }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} className={`cell ${tone ? `cell-${tone}` : ''}`} onClick={onClick}>
      <span className="cell-label">{label}</span>
      <span className="cell-value num">{value}</span>
    </Tag>
  );
}

// A stat with a 10-segment bar, used along the bottom.
function Meter({ label, value, display, max, tone }) {
  const on = Math.round(Math.max(0, Math.min(1, value / max)) * 10);
  return (
    <div className={`meter ${tone ? `meter-${tone}` : ''}`}>
      <div className="meter-row">
        <span>{label}</span>
        <b className="num">{display}</b>
      </div>
      <div className="seg" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => <i key={i} className={i < on ? 'on' : ''} />)}
      </div>
    </div>
  );
}

// How much debt is left. Every week in debt costs health.
function DebtBar({ wealth }) {
  const pct = Math.min(100, (Math.abs(wealth) / Math.abs(STARTING_DEBT)) * 100);
  return (
    <div className="debt" role="alert">
      <div className="debt-top">
        <span>💳 In debt: {money(wealth)}</span>
        <b>-{DEBT_HEALTH_LOSS_PER_WEEK} health/wk</b>
      </div>
      <div className="debt-track" aria-label={`Debt ${money(wealth)}`}>
        <i style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// Stat changes from commitments this turn, e.g. "Book club +1 social".
function Gains({ gains }) {
  const rows = Object.entries(gains ?? {}).flatMap(([label, stats]) =>
    Object.entries(stats).filter(([, v]) => v !== 0).map(([stat, v]) => ({ label, stat, v })));
  if (rows.length === 0) return null;
  return (
    <ul className="ledger">
      {rows.map(({ label, stat, v }) => (
        <li key={`${label}-${stat}`} className={v >= 0 ? 'pos' : 'neg'}>
          {label} {formatDelta(stat, v)} {STAT_META[stat].label.toLowerCase()}
        </li>
      ))}
    </ul>
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
      <Gains gains={last.gains} />
      {last.healthDelta < 0 && (
        <p className="health-msg">{last.healthCauses.join(' · ')}: health {last.healthDelta}</p>
      )}
    </button>
  );
}

// The start screen: who you are, what you start with, and the goals.
function Intro({ stats, onStart }) {
  const { character } = stats;
  const net = weeklyNet(stats.flows);
  return (
    <div className="summary intro">
      <div className="intro-who">
        <span className="intro-emoji" role="img" aria-label={`A ${character.age}-year-old ${character.gender}`}>
          {character.emoji}
        </span>
        <div>
          <h2>New game</h2>
          <p className="muted">Age {character.age}</p>
        </div>
      </div>

      <h3>You start with</h3>
      <ul className="intro-list">
        <li><span>Debt</span><b className="num neg">{money(stats.wealth)}</b></li>
        {stats.flows.map((f) => (
          <li key={f.id}>
            <span>{f.label}</span>
            <b className={`num ${f.amount >= 0 ? 'pos' : 'neg'}`}>{formatFlow(f)}</b>
          </li>
        ))}
        {!stats.flows.some((f) => f.amount > 0) && (
          <li><span>Allowance from parents</span><b className="num muted">None</b></li>
        )}
        <li className="intro-total">
          <span>Weekly income</span>
          <b className={`num ${net >= 0 ? 'pos' : 'neg'}`}>{net >= 0 ? '+' : ''}{money(net)}/wk</b>
        </li>
        <li><span>Social</span><b className="num">{stats.social}</b></li>
        <li><span>Skills</span><b className="num">{stats.skills}</b></li>
      </ul>

      <h3>Goals</h3>
      <ol className="intro-goals">
        {GOALS.map((g) => (
          <li key={g.id}>
            <b>{g.title}</b>
            <span className="muted">{g.hint}</span>
          </li>
        ))}
      </ol>

      <button type="button" className="btn btn-primary" onClick={onStart}>Start</button>
    </div>
  );
}

function newGame() {
  const stats = createInitialStats();
  const game = { stats, card: drawCard(stats), turn: 0, last: null, status: 'intro', lostTo: null };
  // Dev only: add ?stress to the URL to see the busiest screen (debt, under-slept,
  // outcome toast showing) for layout testing.
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('stress')) {
    game.status = 'playing';
    Object.assign(stats, { wealth: -19, spareTime: 4, health: 40, day: 8 });
    game.last = {
      outcome: 'You joined the gym and recognise a few regulars already.',
      ledger: { 'Allowance from parents': 3, 'Cost of living': -20, 'Gym membership': -20 },
      goalMsg: '',
      healthDelta: -15,
      healthCauses: ['😴 Under-slept', '💳 In debt'],
    };
  }
  // Dev only: ?card=<id> starts on that card, e.g. ?card=party.
  const forced = import.meta.env.DEV && new URLSearchParams(window.location.search).get('card');
  if (forced) game.status = 'playing';
  if (forced === 'house') game.card = houseCard(makeHouse());
  else if (forced === 'reassess') game.card = reassessCard({ id: 'guitar', label: 'Guitar', image: '🎸', hours: 3, keepPrompt: 'Keep up the guitar lessons?' });
  else if (forced) game.card = [...DECISIONS, ...EVENTS].find((c) => c.id === forced) ?? game.card;
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
      last: {
        outcome: result.outcome,
        ledger: result.ledger,
        gains: result.gains,
        goalMsg,
        healthDelta: result.healthDelta,
        healthCauses: result.healthCauses,
      },
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
  const start = () => setGame((g) => ({ ...g, status: 'playing' }));

  return (
    <div className="app">
      <header className="board">
        <Cell label={`Day · ${WEEKDAYS[dayOfWeek(stats.day)]}`} value={String(stats.day).padStart(2, '0')} />
        <Cell
          label="Income ▾"
          value={`${net >= 0 ? '+' : ''}${money(net)}/wk`}
          tone={net < 0 ? 'bad' : null}
          onClick={() => setShowFlows((v) => !v)}
        />
        <Cell label="Wealth" value={STAT_META.wealth.format(stats.wealth)} tone={inDebt ? 'bad' : null} />

        {showFlows && (
          <div className="flows" onClick={() => setShowFlows(false)}>
            <h3>Recurring</h3>
            {stats.flows.length === 0 ? (
              <p className="muted">No regular income or expenses.</p>
            ) : (
              <ul>
                {stats.flows.map((f) => (
                  <li key={f.id}>
                    <span>{isIncomeStream(f) && '💼 '}{f.label}</span>
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
            {stats.commitments.length > 0 && (
              <>
                <h3>Commitments</h3>
                <ul>
                  {stats.commitments.map((c) => (
                    <li key={c.id}>
                      <span>{c.image} {c.label}</span>
                      <span className="neg">-{c.hours}h spare</span>
                    </li>
                  ))}
                </ul>
                {stats.nextTherapy != null && stats.commitments.some((c) => c.id === 'therapy') && (
                  <p className="muted">Next therapy session: day {stats.nextTherapy}</p>
                )}
              </>
            )}
          </div>
        )}
      </header>

      {playing && (
        <div className="status-strip">
          {inDebt && <DebtBar wealth={stats.wealth} />}
          {goal && (
            <button type="button" className="quest" onClick={() => setShowHint((v) => !v)}>
              <span className="quest-badge">Quest {GOALS.indexOf(goal) + 1}/{GOALS.length}</span>
              <span className="quest-title">{goal.title}</span>
              {goal.progress && <span className="quest-progress num">{goal.progress(stats)}</span>}
              {underSlept ? (
                <span className="quest-sleep" role="alert">😴 Under-slept{lowHealth ? ' · health low' : ''}</span>
              ) : (
                <span className="quest-more">{showHint ? '▴' : 'ⓘ'}</span>
              )}
              {showHint && <span className="quest-hint">{goal.hint}</span>}
            </button>
          )}
        </div>
      )}

      <main className="stage">
        {status === 'intro' ? (
          <Intro stats={stats} onStart={start} />
        ) : playing ? (
          <>
            <SwipeCard key={game.turn} decision={card} stats={stats} onChoose={choose} />
            {last && showToast && <Toast last={last} onClose={hideToast} />}
          </>
        ) : (
          <div className={`summary summary-${status}`}>
            <h2>
              {status === 'lost' && '🥵 Burned out'}
              {status === 'won' && '🏆 You made it!'}
              {status === 'out' && 'No more decisions (for now)'}
            </h2>
            {status === 'lost' && (
              <p>
                {stats.wealth < 0 ? 'Debt stress' : 'Weeks without enough sleep'} wore your health down to 0 on day{' '}
                {stats.day}.
              </p>
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

      <footer className="vitals">
        <Meter label="Social" value={stats.social} display={STAT_META.social.format(stats.social)} max={10} />
        <Meter label="Skills" value={stats.skills} display={STAT_META.skills.format(stats.skills)} max={10} />
        <Meter
          label="Health"
          value={stats.health}
          display={STAT_META.health.format(stats.health)}
          max={100}
          tone={lowHealth ? 'bad' : underSlept ? 'warn' : null}
        />
        <Meter
          label="Spare"
          value={stats.spareTime}
          display={STAT_META.spareTime.format(stats.spareTime)}
          max={24}
          tone={underSlept ? 'bad' : null}
        />
      </footer>
    </div>
  );
}
