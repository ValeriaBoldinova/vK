import { useEffect, useState, useRef } from 'react';

export default function Timer({ deadline, timeLimit, onExpire }) {
  const [remaining, setRemaining] = useState(timeLimit);
  const expiredRef = useRef(false);

  useEffect(() => {
    expiredRef.current = false;
    const tick = () => {
      const left = Math.max(0, (deadline - Date.now()) / 1000);
      setRemaining(left);
      if (left <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpire?.();
      }
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [deadline, onExpire]);

  const pct = timeLimit > 0 ? remaining / timeLimit : 0;
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  const color = pct > 0.5 ? '#4ade80' : pct > 0.25 ? '#facc15' : '#f87171';

  return (
    <div className="timer-ring" title={`${Math.ceil(remaining)}s`}>
      <svg width="64" height="64" viewBox="0 0 64 64" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="4" />
        <circle
          cx="32" cy="32" r={r} fill="none"
          stroke={color} strokeWidth="4"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray .2s linear, stroke .5s' }}
        />
      </svg>
      <div className="timer-text" style={{ color }}>{Math.ceil(remaining)}</div>
    </div>
  );
}
