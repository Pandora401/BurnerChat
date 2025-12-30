import React, { useState, KeyboardEvent } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend }) => {
  const [text, setText] = useState('');

  const handleSend = () => {
    if (text.trim()) {
      onSend(text);
      setText('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex gap-2">
      <span className="text-[#00ff41] font-bold self-center animate-pulse">{'>'}</span>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="ENTER_DATA_HERE..."
        className="flex-1 bg-black/50 border border-[#003b00] focus:border-[#00ff41] text-[#00ff41] text-sm px-4 py-2 min-h-[40px] max-h-[100px] resize-none font-mono outline-none"
        rows={1}
      />
      <button
        onClick={handleSend}
        disabled={!text.trim()}
        className="hacker-btn !py-2 !px-6 flex-shrink-0"
      >
        SEND
      </button>
    </div>
  );
};

export default ChatInput;
