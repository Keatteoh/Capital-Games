import { useCallback, useEffect, useState } from 'react';
import SwipeCard from './components/SwipeCard.jsx';
import {
  GOALS,
  DECISIONS,
  EVENTS,
  houseCard,
  reassessCard,
  makeHouse,
  rentalCard,
  makeRental,
  EVICTION_MONTHS,
  timeBreakdown,
  timePreview,
  healthPreview,
  committedHoursPerWeek,
  scheduleText,
  STARTING_DEBT,
  DEBT_HEALTH_LOSS_PER_WEEK,
  isIncomeStream,
  LOW_HEALTH,
  STAT_META,
  WEEKDAYS,
  dayOfWeek,
  isUnderSlept,
  freeHours,
  sleepPenalty,
  HOURS_PER_DAY,
  SLEEP_HOURS,
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

// A number that rises and fades over a meter after a choice, e.g. "-3h" or "+2".
function Float({ float }) {
  if (!float?.text) return null;
  return <span key={float.key} className={`float ${float.tone}`} aria-hidden="true">{float.text}</span>;
}

// A stat with a 10-segment bar, used along the bottom. `preview` is the change the
// choice being considered would make: those segments blink.
function Meter({ label, value, display, max, tone, preview, float }) {
  const per = max / 10;
  const on = Math.round(Math.max(0, Math.min(1, value / max)) * 10);
  const change = preview ? Math.max(1, Math.round(Math.abs(preview) / per)) : 0;
  const cls = (i) => {
    if (preview < 0 && i < on && i >= on - change) return 'on cost';
    if (preview > 0 && i >= on && i < on + change) return 'gain';
    return i < on ? 'on' : '';
  };
  return (
    <div className={`meter ${tone ? `meter-${tone}` : ''}`}>
      <Float float={float} />
      {preview ? <span className={`meter-tip ${preview < 0 ? 'neg' : 'pos'}`}>{preview > 0 ? '+' : ''}{preview} {label.toLowerCase()}</span> : null}
      <div className="meter-row">
        <span>{label}</span>
        <b className="num">{display}</b>
      </div>
      <div className="seg" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => <i key={i} className={cls(i)} />)}
      </div>
    </div>
  );
}

// Today as 24 one-hour cells: essentials, job, plans, free time, then the last
// 8 hours for sleep. Hours that spill into the sleep zone turn red. A choice
// being considered blinks the hours it would take (or free up).
function DayBar({ stats, preview, float }) {
  const { essentials, job, commit, free } = timeBreakdown(stats);
  const used = Math.min(HOURS_PER_DAY, essentials + job + commit);
  const awake = HOURS_PER_DAY - SLEEP_HOURS; // where the sleep zone starts
  const change = preview ? -preview.hours : 0; // + takes hours, - frees them
  const after = Math.max(essentials, Math.min(HOURS_PER_DAY, used + change));
  const cls = (i) => {
    let c = i < essentials ? 'ess' : i < essentials + job ? 'job' : i < used ? 'commit' : i < awake ? 'free' : 'sleep';
    if (i < used && i >= awake) c += ' hazard';
    if (change > 0 && i >= used && i < after) c = `cost${i >= awake ? ' hazard' : ''}`;
    if (change < 0 && i >= after && i < used) c += ' gain';
    return c;
  };
  const freeAfter = preview ? free + preview.today : free;
  const short = free < SLEEP_HOURS;
  return (
    <div className={`daybar ${short ? 'daybar-bad' : ''}`}>
      <Float float={float} />
      {preview ? (
        <span className={`meter-tip ${preview.hours < 0 ? 'neg' : 'pos'}`}>
          {preview.text}
          {freeAfter < SLEEP_HOURS && preview.today < 0 ? ` → ${Math.max(0, freeAfter)}h sleep, -${sleepPenalty(freeAfter)} health` : ''}
        </span>
      ) : null}
      <div className="meter-row">
        <span>Daytime: {WEEKDAYS[dayOfWeek(stats.day)]}</span>
        <b className="num">
          {short ? `⚠️ ${Math.max(0, free)}h left for sleep · -${sleepPenalty(free)} health` : `${free}h available`}
        </b>
      </div>
      <div className="day-seg" aria-hidden="true">
        {Array.from({ length: HOURS_PER_DAY }, (_, i) => <i key={i} className={cls(i)} />)}
      </div>
      <div className="time-key" aria-hidden="true">
        <span className="k-ess">essentials {essentials}h</span>
        {job > 0 && <span className="k-job">job {job}h</span>}
        {commit > 0 && <span className="k-commit">plans {commit}h</span>}
        <span className="k-free">free</span>
        <span className="k-sleep">sleep {SLEEP_HOURS}h</span>
      </div>
    </div>
  );
}

// Short on sleep today: how many hours you'll get and what it costs.
function SleepBar({ free }) {
  const sleep = Math.max(0, free);
  return (
    <div className="debt sleepbar" role="alert">
      <div className="debt-top">
        <span>😴 Short on sleep: {sleep}h of {SLEEP_HOURS}h tonight</span>
        <b>-{sleepPenalty(free)} health, -1 social</b>
      </div>
      <div className="debt-track"><i style={{ width: `${((SLEEP_HOURS - sleep) / SLEEP_HOURS) * 100}%` }} /></div>
    </div>
  );
}

// Floating numbers for the meters after a turn.
function turnFloats(before, after, choice, turn) {
  const f = (d, unit = '') => (d ? { text: `${d > 0 ? '+' : ''}${d}${unit}`, tone: d > 0 ? 'pos' : 'neg', key: turn } : null);
  const weekly = Math.round((committedHoursPerWeek(after) - committedHoursPerWeek(before)) * 10) / 10;
  const busy = choice.busy ?? 0;
  const parts = [];
  if (busy) parts.push(`${busy > 0 ? '-' : '+'}${Math.abs(busy)}h today`);
  if (weekly) parts.push(`${weekly > 0 ? '-' : '+'}${Math.abs(weekly)}h/wk`);
  return {
    health: f(Math.round(after.health) - Math.round(before.health)),
    social: f(after.social - before.social),
    skills: f(after.skills - before.skills),
    time: parts.length ? { text: parts.join(' '), tone: busy > 0 || weekly > 0 ? 'neg' : 'pos', key: turn } : null,
  };
}

// Behind on rent: how close you are to eviction.
function RentBar({ rental }) {
  return (
    <div className="debt rent" role="alert">
      <div className="debt-top">
        <span>🏚️ Behind on rent: {rental.behind} of {EVICTION_MONTHS} months</span>
        <b>Eviction: -40 health</b>
      </div>
      <div className="debt-track"><i style={{ width: `${(rental.behind / EVICTION_MONTHS) * 100}%` }} /></div>
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
          <h2>Hello you</h2>
          <p className="muted">Age {character.age}</p>
        </div>
      </div>

      <h3>You start with</h3>
      <ul className="intro-list">
        <li>
          <span>
            Living with
            <small className="intro-note">{stats.household.single ? `A single parent can't give you an allowance, and ${stats.household.parent === 'Mom' ? 'she' : 'he'} may need help with bills` : 'They give you a small allowance until you move out'}</small>
          </span>
          <b>{stats.household.label}</b>
        </li>
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
        <li>
          <span>
            Social
            <small className="intro-note">Better odds in social and job situations, and less likely to be laid off. Can drop below zero</small>
          </span>
          <b className="num">{stats.social}</b>
        </li>
        <li>
          <span>
            Skills
            <small className="intro-note">Unlocks higher-paying jobs and one-off gigs, and raises your pay</small>
          </span>
          <b className="num">{stats.skills}</b>
        </li>
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
  // Dev only: add ?stress to the URL to see the busiest screen (debt, overcommitted,
  // outcome toast showing) for layout testing.
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('stress')) {
    game.status = 'playing';
    Object.assign(stats, { wealth: -19, health: 40, day: 8 });
    stats.flows.push({ id: 999, label: 'Supermarket job', kind: 'job', stat: 'wealth', amount: 150, every: 'weekly',
      weekday: 4, activeFrom: 1, hours: 5, startDay: 5, endDay: null, chance: null, commitmentId: null, tag: null });
    stats.commitments.push({ id: 'gym', label: 'Gym', image: '🏋️', hours: 3, weekdays: [0] });
    game.last = {
      outcome: 'You joined the gym and recognise a few regulars already.',
      ledger: { 'Allowance from parents': 3, 'Cost of living': -20, 'Gym membership': -20 },
      goalMsg: '',
      healthDelta: -15,
      healthCauses: ['😴 Short on sleep', '💳 In debt'],
      floats: {
        time: { text: '-3h/wk', tone: 'neg', key: 1 },
        health: { text: '-15', tone: 'neg', key: 1 },
        social: { text: '+1', tone: 'pos', key: 1 },
      },
    };
  }
  // Dev only: ?card=<id> starts on that card, e.g. ?card=party.
  const forced = import.meta.env.DEV && new URLSearchParams(window.location.search).get('card');
  if (forced) game.status = 'playing';
  if (forced === 'house') game.card = houseCard(makeHouse());
  else if (forced === 'rental') game.card = rentalCard(makeRental());
  else if (forced === 'evicted') {
    stats.housingPrompt = 'evicted';
    game.card = drawCard(stats);
  }
  else if (forced === 'reassess') game.card = reassessCard({ id: 'guitar', label: 'Guitar', image: '🎸', hours: 3, weekdays: [1], keepPrompt: 'Keep up the guitar lessons?' });
  else if (forced) {
    const c = [...DECISIONS, ...EVENTS].find((x) => x.id === forced);
    if (c) game.card = c.build ? { ...c, ...c.build(stats, Math.random) } : c;
  }
  return game;
}

export default function App() {
  const [game, setGame] = useState(newGame);
  const [showFlows, setShowFlows] = useState(false);
  const [showToast, setShowToast] = useState(true); // only renders once there's a `last`
  const [showHint, setShowHint] = useState(false);
  const [preview, setPreview] = useState(null); // 'left' | 'right' while a choice is being considered
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
        floats: turnFloats(stats, result.stats, card[side], game.turn + 1),
      },
      status: result.gameOver ? 'lost' : allDone ? 'won' : !nextCard ? 'out' : 'playing',
      lostTo: result.gameOver,
    });
    setShowToast(true);
    setPreview(null);
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
  const considered = playing && preview ? card[preview] : null;
  const timePrev = considered ? timePreview(stats, card, considered) : null;
  const healthPrev = considered ? Math.round(healthPreview(stats, card, considered)) : 0;
  const floats = last?.floats ?? {};

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
            <h3>Home</h3>
            <p className="muted">
              {stats.house
                ? `${stats.house.image} Your ${stats.house.type.toLowerCase()}`
                : stats.rental
                  ? `${stats.rental.image} ${stats.rental.type}${stats.rental.roommate ? ' (with a roommate)' : ''}`
                  : stats.lodging?.kind === 'couch'
                    ? `🛋️ On ${stats.lodging.host}'s couch`
                    : stats.lodging?.kind === 'shelter'
                      ? '🏚️ At a shelter'
                      : `🏠 Living with ${stats.household.single ? stats.household.parent : 'your parents'}`}
            </p>
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
            {stats.items.length > 0 && (
              <>
                <h3>Collection</h3>
                <ul>
                  {stats.items.map((it) => (
                    <li key={it.id}>
                      <span>{it.image} {it.label}</span>
                      <span className="pos">~{money(it.value)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {stats.commitments.length > 0 && (
              <>
                <h3>Commitments</h3>
                <ul>
                  {stats.commitments.map((c) => (
                    <li key={c.id}>
                      <span>{c.image} {c.label}</span>
                      <span className="neg">{c.hours}h {scheduleText(c)}</span>
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
          {underSlept && <SleepBar free={freeHours(stats)} />}
          {inDebt && <DebtBar wealth={stats.wealth} />}
          {stats.rental?.behind > 0 && <RentBar rental={stats.rental} />}
          {goal && (
            <button type="button" className="quest" onClick={() => setShowHint((v) => !v)}>
              <span className="quest-badge">Quest {GOALS.indexOf(goal) + 1}/{GOALS.length}</span>
              <span className="quest-title">{goal.title}</span>
              {goal.progress && <span className="quest-progress num">{goal.progress(stats)}</span>}
              {underSlept ? (
                <span className="quest-sleep">😴 Short on sleep{lowHealth ? ' · health low' : ''}</span>
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
            <SwipeCard key={game.turn} decision={card} stats={stats} onChoose={choose} onPreview={setPreview} />
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
                {last?.healthCauses?.length ? last.healthCauses.join(' + ') : stats.wealth < 0 ? 'Debt stress' : 'Overcommitting'}{' '}
                wore your health down to 0 on day {stats.day}.
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
        <DayBar stats={stats} preview={timePrev} float={floats.time} />
        <Meter label="Social" value={stats.social} display={STAT_META.social.format(stats.social)} max={10}
          tone={stats.social < 0 ? 'bad' : null} float={floats.social} />
        <Meter label="Skills" value={stats.skills} display={STAT_META.skills.format(stats.skills)} max={10} float={floats.skills} />
        <Meter
          label="Health"
          value={stats.health}
          display={STAT_META.health.format(stats.health)}
          max={100}
          tone={lowHealth ? 'bad' : underSlept ? 'warn' : null}
          preview={healthPrev}
          float={floats.health}
        />
      </footer>
    </div>
  );
}
