import { useState, useRef, useEffect } from 'react';

export default function Chat({ messages, onSend, onClose }) {
  const [text, setText] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
  }

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <h4>Chat</h4>
        <button className="btn-text" onClick={onClose}>✕</button>
      </div>

      <div className="chat-messages" ref={scrollRef}>
        {messages.map((msg, i) => (
          <div key={i} className="chat-msg">
            <span className="chat-user">{msg.username}</span>
            <span className="chat-text">{msg.message}</span>
          </div>
        ))}
        {messages.length === 0 && (
          <p className="chat-empty">Aucun message</p>
        )}
      </div>

      <form className="chat-input" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Message..."
          value={text}
          onChange={e => setText(e.target.value)}
          maxLength={200}
        />
        <button type="submit" disabled={!text.trim()}>➤</button>
      </form>
    </div>
  );
}
