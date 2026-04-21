const SUIT_SYMBOLS = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠'
};

const SUIT_COLORS = {
  hearts: '#ef4444',
  diamonds: '#ef4444',
  clubs: '#111827',
  spades: '#111827'
};

export default function PokerCard({ card, size = 'md', delay = 0, faceDown = false }) {
  if (!card || faceDown) {
    return (
      <div className={`poker-card card-back card-${size}`} style={{ animationDelay: `${delay}ms` }}>
        <div className="card-back-pattern">
          <span>🃏</span>
        </div>
      </div>
    );
  }

  const color = SUIT_COLORS[card.suit];
  const symbol = SUIT_SYMBOLS[card.suit];
  const isFace = ['J', 'Q', 'K', 'A'].includes(card.rank);

  return (
    <div
      className={`poker-card card-front card-${size} ${isFace ? 'card-face' : ''}`}
      style={{ animationDelay: `${delay}ms`, '--card-color': color }}
    >
      <div className="card-corner card-corner-tl">
        <span className="card-rank">{card.rank}</span>
        <span className="card-suit">{symbol}</span>
      </div>
      <div className="card-center">
        <span className="card-center-suit">{symbol}</span>
      </div>
      <div className="card-corner card-corner-br">
        <span className="card-rank">{card.rank}</span>
        <span className="card-suit">{symbol}</span>
      </div>
    </div>
  );
}
