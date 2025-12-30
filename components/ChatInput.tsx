import React, { useState, KeyboardEvent } from 'react';

interface ChatInputProps {
  onSend: (message: string, file?: { name: string, type: string, size: number, data: string }) => void;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend }) => {
  const [text, setText] = useState('');
  const [selectedFile, setSelectedFile] = useState<{ name: string, type: string, size: number, data: string } | null>(null);

  const handleSend = () => {
    if (text.trim() || selectedFile) {
      onSend(text, selectedFile || undefined);
      setText('');
      setSelectedFile(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('FILE_SIZE_EXCEEDS_5MB_LIMIT');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setSelectedFile({
            name: file.name,
            type: file.type,
            size: file.size,
            data: event.target.result as string
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="space-y-2">
      {selectedFile && (
        <div className="text-[10px] text-[#00ff41]/80 flex items-center justify-between border border-[#003b00] px-2 py-1 bg-[#003b00]/20">
          <span className="truncate max-w-[200px]">ATTACHED: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)}KB)</span>
          <button onClick={() => setSelectedFile(null)} className="hover:text-red-500 font-bold ml-2">[X]</button>
        </div>
      )}
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
        <div className="flex flex-col gap-1">
          <label className="hacker-btn !py-1 !px-3 flex-shrink-0 cursor-pointer text-center text-[10px]">
            UPLOAD
            <input type="file" className="hidden" onChange={handleFileChange} />
          </label>
          <button
            onClick={handleSend}
            disabled={!text.trim() && !selectedFile}
            className="hacker-btn !py-2 !px-6 flex-shrink-0"
          >
            SEND
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInput;
