import { useState, useMemo } from 'react';

export default function ActionBar({ actions, currentBet, myBet, myChips, minRaise, onAction }) {
  const toCall = currentBet - myBet;
  const [raiseAmount, setRaiseAmount] = useState(minRaise);
  const [showRaise, setShowRaise] = useState(false);

  const maxRaise = myChips - toCall;
  const presets = useMemo(() => {
    const pot = currentBet * 2; // approximate
    return [
      { label: 'Min', value: minRaise },
      { label: '2×', value: minRaise * 2 },
      { label: '½ Pot', value: Math.floor(pot / 2) },
      { label: 'Pot', value: pot },
    ].filter(p => p.value <= maxRaise && p.value >= minRaise);
  }, [minRaise, maxRaise, currentBet]);

  async function handleAction(action, amount) {
    await onAction(action, amount);
    setShowRaise(false);
  }

  return (
    <div className="action-bar">
      {showRaise ? (
        <div className="raise-panel">
          <div className="raise-header">
            <span>Relancer</span>
            <button className="btn-text" onClick={() => setShowRaise(false)}>✕</button>
          </div>

          <div className="raise-presets">
            {presets.map(p => (
              <button
                key={p.label}
                className={`preset-btn ${raiseAmount === p.value ? 'active' : ''}`}
                onClick={() => setRaiseAmount(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="raise-slider-group">
            <input
              type="range"
              min={minRaise}
              max={maxRaise}
              value={raiseAmount}
              onChange={e => setRaiseAmount(parseInt(e.target.value))}
              className="raise-slider"
            />
            <div className="raise-value">
              <input
                type="number"
                value={raiseAmount}
                onChange={e => {
                  const v = parseInt(e.target.value) || minRaise;
                  setRaiseAmount(Math.max(minRaise, Math.min(maxRaise, v)));
                }}
                className="raise-number"
              />
            </div>
          </div>

          <button
            className="btn btn-accent btn-block"
            onClick={() => handleAction('raise', raiseAmount)}
          >
            Relancer {raiseAmount} 🪙
          </button>
        </div>
      ) : (
        <div className="action-buttons">
          {actions.includes('fold') && (
            <button className="action-btn btn-fold" onClick={() => handleAction('fold')}>
              <span className="action-label">Coucher</span>
            </button>
          )}

          {actions.includes('check') && (
            <button className="action-btn btn-check" onClick={() => handleAction('check')}>
              <span className="action-label">Checker</span>
            </button>
          )}

          {actions.includes('call') && (
            <button className="action-btn btn-call" onClick={() => handleAction('call')}>
              <span className="action-label">Suivre</span>
              <span className="action-amount">{toCall}</span>
            </button>
          )}

          {actions.includes('raise') && (
            <button className="action-btn btn-raise" onClick={() => setShowRaise(true)}>
              <span className="action-label">Relancer</span>
            </button>
          )}

          {actions.includes('allin') && (
            <button className="action-btn btn-allin" onClick={() => handleAction('allin')}>
              <span className="action-label">Tapis</span>
              <span className="action-amount">{myChips}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
