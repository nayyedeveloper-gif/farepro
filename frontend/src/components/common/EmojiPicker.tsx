import React from 'react';
import { XIcon } from '../icons/Icons';
import '../../styles/emoji-picker.css';

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
}

const EMOJI_CATEGORIES: Record<string, { icon: string; emojis: string[] }> = {
  Smileys: {
    icon: '😀',
    emojis: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐'],
  },
  Gestures: {
    icon: '👍',
    emojis: ['👋', '🤚', '🖐', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏'],
  },
  Animals: {
    icon: '🐱',
    emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🦂', '🐢', '🐍', '🦎', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈'],
  },
  Food: {
    icon: '🍕',
    emojis: ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙', '🧆', '🌮', '🌯', '🥗', '🍜', '🍝', '🍣', '🍱', '🍛', '🍲', '🍦', '🍩', '🍪', '🎂', '🍰', '🧁', '🍫', '🍬', '🍭', '☕', '🍵', '🧋', '🍺', '🍻', '🥂', '🍷'],
  },
  Activities: {
    icon: '⚽',
    emojis: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🏓', '🏸', '🏒', '🏑', '🏏', '⛳', '🏹', '🎣', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸', '🥌', '🎿', '🏂', '🏋️', '🤼', '🤸', '🤺', '⛹️', '🤾', '🏌️', '🏇', '🧘', '🎯', '🎮', '🕹️', '🎲', '🧩', '🎸', '🎹', '🥁', '🎤', '🎧', '🎬', '🎨'],
  },
  Objects: {
    icon: '💡',
    emojis: ['⌚', '📱', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🕹️', '💽', '💾', '💿', '📀', '📷', '📸', '📹', '🎥', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🧭', '⏱️', '⏲️', '⏰', '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯️', '🧯', '💸', '💵', '💴', '💶', '💷', '💰', '💳', '💎', '🔑', '🗝️', '🔨', '🛠️', '🧲', '🔫', '🛡️', '📦', '📫', '📬', '📭', '📮'],
  },
  Symbols: {
    icon: '❤️',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💯', '💢', '💥', '💫', '💦', '💨', '🕳️', '💣', '💬', '👁️‍🗨️', '🗨️', '🗯️', '💭', '💤', '💮', '♨️', '💈', '🛑', '⭐', '🌟', '✨', '⚡', '☄️', '🔥', '🌈', '☀️', '🌤️', '⛅', '🌙', '⭐', '✅', '❌', '❓', '❗', '‼️', '⁉️', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣'],
  },
};

const EmojiPicker: React.FC<EmojiPickerProps> = ({ onEmojiSelect, onClose }) => {
  const [selectedCategory, setSelectedCategory] = React.useState('Smileys');
  const category = EMOJI_CATEGORIES[selectedCategory];

  return (
    <div className="emoji-picker" role="dialog" aria-label="Emoji picker">
      <div className="emoji-picker-header">
        <div className="emoji-picker-tabs">
          {Object.entries(EMOJI_CATEGORIES).map(([name, data]) => (
            <button
              key={name}
              type="button"
              className={`emoji-tab ${selectedCategory === name ? 'active' : ''}`}
              onClick={() => setSelectedCategory(name)}
              title={name}
              aria-label={name}
            >
              {data.icon}
            </button>
          ))}
        </div>
        <button type="button" className="emoji-close" onClick={onClose} aria-label="Close">
          <XIcon size={16} />
        </button>
      </div>
      <div className="emoji-picker-body">
        <div className="emoji-category-label">{selectedCategory}</div>
        <div className="emoji-grid">
          {category.emojis.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="emoji-item"
              onClick={() => {
                onEmojiSelect(emoji);
                onClose();
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EmojiPicker;
