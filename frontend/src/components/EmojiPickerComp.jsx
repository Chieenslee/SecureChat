import React from 'react';
import EmojiPicker from 'emoji-picker-react';

export function EmojiPickerComp({ onEmojiClick }) {
  return (
    <div className="picker-container" style={{ position: 'absolute', bottom: '60px', left: '10px', zIndex: 100 }}>
      <EmojiPicker onEmojiClick={(emojiData) => onEmojiClick(emojiData.emoji)} />
    </div>
  );
}
