const MEDALS = ['🥇', '🥈', '🥉'];
const TOP_CLASS = ['top1', 'top2', 'top3'];

export default function Leaderboard({ leaderboard, highlightId }) {
  return (
    <div className="leaderboard">
      {leaderboard.map((entry, i) => (
        <div
          key={entry.id}
          className={`lb-row ${TOP_CLASS[i] || ''}`}
          style={highlightId === entry.id ? { borderColor: '#0077ff', background: 'rgba(0,119,255,.2)' } : {}}
        >
          <span className="lb-rank">{MEDALS[i] || `#${i + 1}`}</span>
          <span className="lb-name">{entry.name}{highlightId === entry.id ? ' (вы)' : ''}</span>
          <span className="lb-score">{entry.total_score} pts</span>
          {entry.correct_count !== undefined && (
            <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,.5)', marginLeft: 8 }}>
              ✓ {entry.correct_count}
            </span>
          )}
        </div>
      ))}
      {leaderboard.length === 0 && (
        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,.5)', padding: '20px' }}>
          Нет участников
        </p>
      )}
    </div>
  );
}
