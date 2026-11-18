import { useEffect, useRef, useState } from 'react';
import { STAT_META, formatDelta, formatFlow } from '../decisions.js';

const SWIPE_THRESHOLD = 90; // px of drag needed to commit a choice

function Effects({ choice }) {
  return (
    <ul className="effects">
      {(choice.recurring ?? []).map((flow) => (
        <li key={flow.label} className={flow.amount >= 0 ? 'pos' : 'neg'}>
          {formatFlow(flow)} <span className="effect-note">{flow.label.toLowerCase()}</span>
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

export default function SwipeCard({ decision, onChoose }) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState(null); // 'left' | 'right' | null
  const start = useRef(null);

  // Reset when a new card arrives.
  useEffect(() => {
    setDx(0);
    setLeaving(null);
  }, [decision.id]);

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

  const onPointerDown = (e) => {
    if (leaving) return;
    start.current = e.clientX;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!dragging) return;
    setDx(e.clientX - start.current);
  };
  const onPointerUp = () => {
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
    <div className="card-area">
      <div
        className={`card ${dragging ? 'dragging' : ''}`}
        style={{ transform: `translateX(${dx}px) rotate(${dx / 18}deg)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="stamp stamp-left"
          style={{ opacity: activeSide === 'left' ? progress : 0 }}
        >
          {decision.left.label}
        </div>
        <div
          className="stamp stamp-right"
          style={{ opacity: activeSide === 'right' ? progress : 0 }}
        >
          {decision.right.label}
        </div>

        <div className="card-image">
          {isImageUrl ? (
            <img src={decision.image} alt="" draggable="false" />
          ) : (
            <span className="emoji" aria-hidden="true">{decision.image}</span>
          )}
        </div>
        <p className="card-prompt">{decision.prompt}</p>

        <div className="choices">
          <div className={`choice choice-left ${activeSide === 'left' ? 'active' : ''}`}>
            <span className="choice-label">← {decision.left.label}</span>
            <Effects choice={decision.left} />
          </div>
          <div className={`choice choice-right ${activeSide === 'right' ? 'active' : ''}`}>
            <span className="choice-label">{decision.right.label} →</span>
            <Effects choice={decision.right} />
          </div>
        </div>
      </div>

      <div className="buttons">
        <button className="btn btn-left" onClick={() => commit('left')}>
          {decision.left.label}
        </button>
        <button className="btn btn-right" onClick={() => commit('right')}>
          {decision.right.label}
        </button>
      </div>
    </div>
  );
}
