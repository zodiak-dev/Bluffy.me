import React, { useState } from 'react';
import PokerCard from './PokerCard';
import { useSocket } from '../context/SocketContext';

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1rem'
  },
  modal: {
    backgroundColor: 'var(--bg-glass)',
    backdropFilter: 'blur(15px)',
    border: '1px solid var(--border-accent)',
    borderRadius: 'var(--radius-xl)',
    padding: '2rem 1.5rem',
    width: '100%',
    maxWidth: '400px',
    textAlign: 'center',
    boxShadow: 'var(--shadow-lg)'
  },
  title: {
    fontFamily: 'var(--font-heading)',
    fontSize: '1.4rem',
    marginBottom: '0.5rem',
    color: '#fff'
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
    marginBottom: '1.5rem'
  },
  cardsContainer: {
    display: 'flex',
    justifyContent: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap',
    marginBottom: '1rem'
  },
  cardWrapper: {
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  commSection: {
    marginBottom: '1.5rem',
    padding: '0.75rem',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid rgba(255,255,255,0.05)'
  },
  commLabel: {
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--text-muted)',
    marginBottom: '0.75rem',
    display: 'block'
  }
};

export default function DiscardSelector({ holeCards, communityCards }) {
  const { socket } = useSocket();
  const [selectedCards, setSelectedCards] = useState([]);

  const toggleCard = (card) => {
    const isSelected = selectedCards.some(c => c.rank === card.rank && c.suit === card.suit);
    if (isSelected) {
      setSelectedCards(selectedCards.filter(c => !(c.rank === card.rank && c.suit === card.suit)));
    } else if (selectedCards.length < 2) {
      setSelectedCards([...selectedCards, card]);
    }
  };

  const confirmDiscard = () => {
    if (selectedCards.length === 2) {
      // The requirement is to KEEP 2 cards and DISCARD the others.
      socket.emit('discard-cards', selectedCards);
    }
  };

  return (
    <div className="discard-overlay" style={styles.overlay}>
      <div className="discard-modal" style={styles.modal}>
        <h3 style={styles.title}>Phase de Défausse</h3>
        <p style={styles.subtitle}>Sélectionnez les <strong>2 cartes que vous voulez conserver</strong>.</p>

        {communityCards && communityCards.length > 0 && (
          <div style={styles.commSection}>
            <span style={styles.commLabel}>Cartes sur la table (Le Flop)</span>
            <div style={{ ...styles.cardsContainer, marginBottom: 0 }}>
              {communityCards.map((c, i) => (
                <PokerCard key={i} card={c} size="sm" />
              ))}
            </div>
          </div>
        )}
        
        <div style={styles.cardsContainer}>
          {holeCards?.map((c, i) => {
            const isSelected = selectedCards.some(sc => sc.rank === c.rank && sc.suit === c.suit);
            return (
              <div 
                key={i} 
                onClick={() => toggleCard(c)}
                style={{
                  ...styles.cardWrapper,
                  opacity: selectedCards.length === 2 && !isSelected ? 0.5 : 1,
                  transform: isSelected ? 'translateY(-10px)' : 'none',
                  boxShadow: isSelected ? '0 0 15px var(--accent)' : 'none',
                  borderRadius: 'var(--radius-sm)'
                }}
              >
                <PokerCard card={c} size="md" />
              </div>
            );
          })}
        </div>

        <button 
          className="btn btn-accent btn-block" 
          disabled={selectedCards.length !== 2}
          onClick={confirmDiscard}
          style={{ marginTop: '1rem' }}
        >
          Confirmer ({selectedCards.length}/2)
        </button>
      </div>
    </div>
  );
}
