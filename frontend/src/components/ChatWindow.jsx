import { useEffect, useRef } from "react";
import { Composer } from "./Composer.jsx";
import { MessageBubble } from "./MessageBubble.jsx";
import { useChat } from "../state/ChatContext.jsx";
import { ChevronLeft, Search, Menu, MessageSquare, UserMinus } from 'lucide-react';

export function ChatWindow() {
  const { activeFriend, activeMessages, setActiveFriend, setGroupInfoOpen, friends, removeFriend } = useChat();
  const bottomRef = useRef(null);
  
  const isGroup = activeFriend?.chat_id?.startsWith("group:");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages.length, activeFriend?.chat_id]);

  if (!activeFriend) {
    return (
      <section className="telegram-chat empty">
        <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
          <div className="empty-icon" style={{ marginBottom: '16px' }}><MessageSquare size={64} opacity={0.5} /></div>
          <h1>Chọn một cuộc trò chuyện</h1>
          <p>Kết bạn bằng Chat ID để bắt đầu gửi tin nhắn mã hóa.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="telegram-chat">
      <header className="chat-topbar" style={{ cursor: isGroup ? 'pointer' : 'default' }} onClick={() => isGroup && setGroupInfoOpen(true)}>
        <button className="icon-button mobile-back" aria-label="Quay lại" onClick={(e) => { e.stopPropagation(); setActiveFriend(null); }}><ChevronLeft size={24} /></button>
        <div className="avatar" style={{ background: activeFriend.avatar_color, width: 40, height: 40, fontSize: 16 }}>
          {(activeFriend.display_name || activeFriend.username || activeFriend.name || "?").slice(0, 1).toUpperCase()}
        </div>
        <div>
          <h1>{activeFriend.display_name || activeFriend.username}</h1>
          <span>{activeFriend.chat_id} · Mã hóa E2EE đang bật</span>
        </div>
        <div className="chat-actions" style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          {!isGroup && (
            <button 
              className="icon-button" 
              style={{ color: '#ef4444', marginRight: '4px' }} 
              aria-label="Xóa bạn" 
              title="Xóa kết bạn"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Bạn có chắc muốn xóa kết bạn với ${activeFriend.display_name || activeFriend.username}?`)) {
                  removeFriend(activeFriend.chat_id);
                }
              }}
            >
              <UserMinus size={20} />
            </button>
          )}
          <button className="icon-button" aria-label="Tìm kiếm" title="Tìm kiếm"><Search size={20} /></button>
          <button className="icon-button" aria-label="Thêm" title="Thêm"><Menu size={20} /></button>
        </div>
      </header>

      <div className="message-timeline">
        {activeMessages.map((message, index) => {
          let senderName = message.senderId;
          if (isGroup && !message.mine && !message.system) {
            const friend = friends.find(f => f.chat_id === message.senderId);
            if (friend) senderName = friend.display_name || friend.username;
          }
          return <MessageBubble key={`${message.at}-${index}`} message={{...message, senderName}} isGroup={isGroup} />
        })}
        <div ref={bottomRef} />
      </div>

      <Composer />
    </section>
  );
}
