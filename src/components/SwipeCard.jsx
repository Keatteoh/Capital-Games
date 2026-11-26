import { useEffect, useRef, useState } from 'react';
import { STAT_META, money, commitmentDays, overcommitPreview, HEALTH_LOSS_PER_OVERCOMMITTED_DAY, WEEKDAYS, PAYDAY, dayOfWeek, formatDelta, formatFlow, jobChance, jobPay, choiceChance, resolve, netAfterRental, EVICTION_MONTHS } from '../decisions.js';

const SWIPE_THRESHOLD = 90; // px of drag needed to commit a choice
const DRAG_START = 8;       // px of movement before a touch counts as a drag (vs a tap)

const statName = (key) => STAT_META[key]?.label.toLowerCase();

function Effects({ choice, stats, card, side }) {
  const { apply, check, commit } = choice;
  const effects = resolve(choice.effects, stats) ?? {};
  const pay = resolve(choice.pay, stats);
  const over = overcommitPreview(stats, card, choice);
  const pct = (p) => `${Math.round(p * 100)}%`;
  return (
    <ul className="effects">
      {over.days > 0 && (
        <li className="warn">😴 Overcommits {over.days} day{over.days > 1 ? 's' : ''}: -{HEALTH_LOSS_PER_OVERCOMMITTED_DAY * over.days} health</li>
      )}
      {over.ongoing && <li className="warn">😴 Overcommits that day every week</li>}
      {card.rental && side === 'left' ? (() => {
        const net = netAfterRental(stats, card.rental);
        return net < 0
          ? <li className="warn">📉 Net {money(net)}/wk after rent: you'd fall behind ({EVICTION_MONTHS} months = eviction)</li>
          : <li className="pos">📈 Net +{money(net)}/wk after rent</li>;
      })() : null}
      {apply && (
        <li className="pos">
          🎲 {pct(jobChance(apply, stats))} → {formatFlow({ weekday: PAYDAY, ...apply.job, amount: jobPay(apply.job, stats) })}
        </li>
      )}
      {apply?.job.hours && <li>🕘 {apply.job.hours}h a day, Mon–Fri</li>}
      {apply?.job.skillPay && <li>💪 Pay scales with skills</li>}
      {check && (
        <li className="pos">
          {check.rare ? '✨' : '🎲'} {pct(choiceChance(choice, stats))} {check.label ?? (check.stat ? `${statName(check.stat)} check` : 'chance')}
        </li>
      )}
      {choice.days && <li>⏳ {choice.days} days</li>}
      {choice.busy > 0 && (
        <li className="neg">🕘 {choice.busy}h {(choice.days ?? 1) > 1 ? 'a day while it lasts' : 'of today'}</li>
      )}
      {choice.busy < 0 && <li className="pos">🕘 +{-choice.busy}h today</li>}
      {choice.note && <li className="neg">{choice.note}</li>}
      {choice.pauseIncome && <li className="neg">⏸️ No income for 1 week</li>}
      {pay && (
        <li className="pos">
          +{money(pay.min)}{pay.max !== pay.min && `–${money(pay.max)}`} once
        </li>
      )}
      {choice.item && <li className="pos">{choice.item.image} Keep: worth ~{money(choice.item.value)}, may rise</li>}
      {(choice.recurring ?? []).map((flow) => (
        <li key={flow.label} className={flow.amount >= 0 ? 'pos' : 'neg'}>
          {formatFlow(flow)}
        </li>
      ))}
      {Object.entries(effects).map(([key, delta]) => (
        <li key={key} className={delta >= 0 ? 'pos' : 'neg'}>
          {formatDelta(key, delta)} {key === 'wealth' ? 'once' : statName(key)}
        </li>
      ))}
      {commit && (
        <>
          <li className="neg">
            🗓️ {commit.hours}h every {commitmentDays(commit, stats).map((d) => WEEKDAYS[d]).join(', ')}
          </li>
          {commit.cost && <li className="neg">{formatFlow(commit.cost)}</li>}
          {(commit.gains ?? []).map((g) => (
            <li key={`${g.stat}-${g.every}`} className="pos">
              {formatFlow(g)}
              {g.afterDays > 30 && ` after ${g.afterDays / 30} mos`}
            </li>
          ))}
        </>
      )}
    </ul>
  );
}

function cardKind(decision) {
  if (decision.kicker) return decision.kicker;
  if (decision.event) return '⚡ Surprise!';
  if (decision.left.apply) return 'Job offer';
  if (decision.left.check?.stat) return `🎲 ${STAT_META[decision.left.check.stat].label} check`;
  return 'Decision';
}

export default function SwipeCard({ decision, stats, onChoose, onPreview }) {
  const [dx, setDx] = useState(0);
  const [hover, setHover] = useState(null); // choice under the mouse or keyboard focus
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState(null); // 'left' | 'right' | null
  const pointer = useRef(null); // { id, x } while a finger/mouse is down

  const commit = (side) => {
    if (leaving) return;
    setLeaving(side);
    setDx(side === 'left' ? -window.innerWidth : window.innerWidth);
    setTimeout(() => onChoose(side), 250);
  };

  // Keyboard support for desktop testing.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') commit('left');
      if (e.key === 'ArrowRight') commit('right');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // A press only becomes a drag after moving a few px.
  const onPointerDown = (e) => {
    if (leaving) return;
    pointer.current = { id: e.pointerId, x: e.clientX };
  };
  const onPointerMove = (e) => {
    if (!pointer.current) return;
    const moved = e.clientX - pointer.current.x;
    if (!dragging) {
      if (Math.abs(moved) < DRAG_START) return;
      setDragging(true);
      e.currentTarget.setPointerCapture(pointer.current.id);
    }
    setDx(moved);
  };
  const onPointerUp = () => {
    pointer.current = null;
    if (!dragging) return;
    setDragging(false);
    if (dx <= -SWIPE_THRESHOLD) commit('left');
    else if (dx >= SWIPE_THRESHOLD) commit('right');
    else setDx(0);
  };

  const progress = Math.min(Math.abs(dx) / SWIPE_THRESHOLD, 1);
  const activeSide = dx < -10 ? 'left' : dx > 10 ? 'right' : null;
  // Tell the meters which choice is being considered, so they can preview its cost.
  const considering = activeSide ?? hover;
  useEffect(() => { onPreview?.(considering); }, [considering, onPreview]);
  useEffect(() => () => onPreview?.(null), [onPreview]);

  const isImageUrl = /[./]/.test(decision.image);
  const chance = decision.left.check?.rare ? null : choiceChance(decision.left, stats);
  const check = decision.left.check;

  return (
    <>
      <div className="card-slot">
        <article
          className={`card ${dragging ? 'dragging' : ''} ${decision.event ? 'card-event' : ''} ${decision.queued || decision.therapy || decision.housing ? 'card-reassess' : ''}`}
          style={{ transform: `translateX(${dx}px) rotate(${dx / 18}deg)` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="stamp stamp-left" style={{ opacity: activeSide === 'left' ? progress : 0 }}>
            {decision.left.label}
          </div>
          <div className="stamp stamp-right" style={{ opacity: activeSide === 'right' ? progress : 0 }}>
            {decision.right.label}
          </div>

          <div className="card-head">
            <span>{cardKind(decision)}</span>
            <span>{WEEKDAYS[dayOfWeek(stats.day)]} · Week {Math.ceil(stats.day / 7)}</span>
          </div>
          <div className="card-image">
            {decision.details ? (
              <div className="listing">
                <span className="listing-emoji" aria-hidden="true">{decision.image}</span>
                <dl className="specs">
                  {decision.details.map(([k, v]) => (
                    <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
                  ))}
                </dl>
              </div>
            ) : isImageUrl ? (
              <img src={decision.image} alt="" draggable="false" />
            ) : (
              <span className="emoji" aria-hidden="true">{decision.image}</span>
            )}
            {chance != null && (
              <div className="dice" aria-label={`${Math.round(chance * 100)}% chance`}>
                <b>{Math.round(chance * 100)}%</b>
                <small>{check?.stat ? STAT_META[check.stat].label : 'Chance'}</small>
              </div>
            )}
          </div>
          <h1 className={`card-prompt ${chance != null ? 'has-dice' : ''}`}>{decision.prompt}</h1>
        </article>
      </div>

      <div className="split">
        {['left', 'right'].map((side) => (
          <button
            key={side}
            type="button"
            className={`choice choice-${side} ${activeSide === side ? 'active' : ''}`}
            onClick={() => !dragging && commit(side)}
            onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(side)}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(side)}
            onBlur={() => setHover(null)}
          >
            <strong>
              {side === 'left' ? `← ${decision.left.label}` : `${decision.right.label} →`}
            </strong>
            <Effects choice={decision[side]} stats={stats} card={decision} side={side} />
          </button>
        ))}
      </div>
    </>
  );
}
