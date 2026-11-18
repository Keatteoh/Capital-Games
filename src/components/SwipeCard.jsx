import { useEffect, useRef, useState } from 'react';
import { STAT_META, formatDelta, formatFlow, jobChance } from '../decisions.js';

const SWIPE_THRESHOLD = 90; // px of drag needed to commit a choice
const DRAG_START = 8;       // px of movement before a touch counts as a drag (vs a tap)

function Effects({ choice, stats }) {
  const apply = choice.apply;
  const days = choice.days;
  return (
    <ul className="effects">
      {apply && (
        <li className="chance">
          🎲 {Math.round(jobChance(apply, stats) * 100)}% · {formatFlow(apply.job)}
        </li>
      )}
      {days && <li className="effect-note">⏳ {days} days</li>}
      {(choice.recurring ?? []).map((flow) => (
        <li key={flow.label} className={flow.amount >= 0 ? 'pos' : 'neg'}>
          {formatFlow(flow)}
        </li>
      ))}
      {Object.entries(choice.effects ?? {}).map(([key, delta]) => (
        <li key={key} className={delta >= 0 ? 'pos' : 'neg'}>
          {formatDelta(key, delta)} {key === 'wealth' ? 'once' : STAT_META[key]?.label.toLowerCase()}
        </li>
      ))}
    </ul>
  );
}

export default function SwipeCard({ decision, stats, onChoose }) {
  const [dx, setDx] = useState(0);
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

  // A press only becomes a drag after moving a few px, so taps on the
  // choice buttons still register as clicks.
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
  const isImageUrl = /[./]/.test(decision.image);

  return (
    <div
      className={`card ${dragging ? 'dragging' : ''} ${decision.event ? 'card-event' : ''}`}
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

      <div className="card-image">
        {decision.event && <span className="event-badge">⚡ Surprise!</span>}
        {isImageUrl ? (
          <img src={decision.image} alt="" draggable="false" />
        ) : (
          <span className="emoji" aria-hidden="true">{decision.image}</span>
        )}
      </div>
      <p className="card-prompt">{decision.prompt}</p>

      <div className="choices">
        {['left', 'right'].map((side) => (
          <button
            key={side}
            type="button"
            className={`choice choice-${side} ${activeSide === side ? 'active' : ''}`}
            onClick={() => !dragging && commit(side)}
          >
            <span className="choice-label">
              {side === 'left' ? `← ${decision.left.label}` : `${decision.right.label} →`}
            </span>
            <Effects choice={decision[side]} stats={stats} />
          </button>
        ))}
      </div>
    </div>
  );
}
