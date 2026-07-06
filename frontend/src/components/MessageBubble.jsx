import { useState } from "react";
import { Download, X } from "lucide-react";

export function MessageBubble({ message, isGroup }) {
  const [lightbox, setLightbox] = useState(null);
  const className = message.system ? "message-bubble system" : message.mine ? "message-bubble mine" : "message-bubble";

  let content;
  if (message.parsed?.type === "gif") {
    content = (
      <button className="message-media-button" type="button" onClick={() => setLightbox({ src: message.parsed.content, name: "GIF" })}>
        <img className="message-media" src={message.parsed.content} alt="GIF" />
      </button>
    );
  } else if (message.parsed?.type === "sticker") {
    const sticker = typeof message.parsed.content === "object" ? message.parsed.content : { value: message.parsed.content };
    content = <span className="message-sticker" title={sticker.label || "Sticker"}>{sticker.value}</span>;
  } else if (message.parsed?.type === "image") {
    const imageName = message.parsed.name || "Ảnh đã gửi";
    content = (
      <figure className="message-attachment">
        <button className="message-media-button" type="button" onClick={() => setLightbox({ src: message.parsed.content, name: imageName })}>
          <img className="message-media" src={message.parsed.content} alt={imageName} />
        </button>
        {message.parsed.name && <figcaption>{message.parsed.name}</figcaption>}
      </figure>
    );
  } else if (message.parsed?.type === "audio") {
    content = (
      <div className="message-audio">
        <audio controls src={message.parsed.content} />
        <span>{message.parsed.name || "Tin nhắn thoại"}</span>
      </div>
    );
  } else {
    if (!message.text || message.text.trim() === "") return null;
    content = <span>{message.text}</span>;
  }

  return (
    <>
      <div className={className}>
        {isGroup && !message.mine && !message.system && (
          <div style={{ fontSize: '11px', color: '#a0a0a0', marginBottom: '2px', fontWeight: 'bold' }}>
            {message.senderId}
          </div>
        )}
        {content}
        {!message.system && <time>{formatTime(message.at)}</time>}
      </div>

      {lightbox && (
        <div className="image-lightbox" role="dialog" aria-modal="true" aria-label="Xem ảnh phóng to" onClick={() => setLightbox(null)}>
          <div className="image-lightbox-toolbar" onClick={event => event.stopPropagation()}>
            <span>{lightbox.name}</span>
            <a className="icon-button" href={lightbox.src} download={lightbox.name} title="Tải ảnh">
              <Download size={20} />
            </a>
            <button className="icon-button" type="button" onClick={() => setLightbox(null)} title="Đóng">
              <X size={22} />
            </button>
          </div>
          <img src={lightbox.src} alt={lightbox.name} onClick={event => event.stopPropagation()} />
        </div>
      )}
    </>
  );
}

function formatTime(value) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value || Date.now()));
}
