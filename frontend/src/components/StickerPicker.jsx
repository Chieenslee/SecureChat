const STICKERS = [
  { id: "happy", label: "Vui", value: "😄" },
  { id: "love", label: "Yêu thích", value: "😍" },
  { id: "ok", label: "OK", value: "👌" },
  { id: "fire", label: "Tuyệt", value: "🔥" },
  { id: "cry", label: "Buồn", value: "🥲" },
  { id: "party", label: "Ăn mừng", value: "🥳" },
  { id: "thinking", label: "Suy nghĩ", value: "🤔" },
  { id: "secure", label: "Bảo mật", value: "🔐" }
];

export function StickerPicker({ onStickerClick }) {
  return (
    <div className="picker-container sticker-picker">
      <div className="sticker-grid">
        {STICKERS.map(sticker => (
          <button
            key={sticker.id}
            className="sticker-option"
            type="button"
            title={sticker.label}
            onClick={() => onStickerClick(sticker)}
          >
            <span>{sticker.value}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
