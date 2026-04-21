import { useEffect, useRef } from 'react';

const EVENT_ICONS = {
  'hand-start': '🎴',
  'action': '🎯',
  'timeout': '⏰',
  'game-over': '🏆'
};

const ACTION_LABELS = {
  fold: 'se couche',
  check: 'check',
  call: 'suit',
  raise: 'relance',
  allin: 'fait tapis'
};

export default function EventLog({ events }) {
  const ref = useRef(null);

  useEffect(() => {
    ref.current?.scrollTo(0, ref.current.scrollHeight);
  }, [events]);

  const recentEvents = events.slice(-8);

  return (
    <div className="event-log" ref={ref}>
      {recentEvents.map(event => (
        <div key={event.id} className="event-item">
          <span className="event-icon">{EVENT_ICONS[event.type] || '📌'}</span>
          <span className="event-text">
            {event.type === 'action'
              ? `${event.username} ${ACTION_LABELS[event.action] || event.action}${event.amount ? ` (${event.amount})` : ''}`
              : event.type === 'hand-start'
              ? `Main #${event.handNumber}`
              : event.message || ''
            }
          </span>
        </div>
      ))}
    </div>
  );
}
