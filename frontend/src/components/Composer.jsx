import { useRef, useState } from "react";
import { useChat } from "../state/ChatContext.jsx";
import { EmojiPickerComp } from "./EmojiPickerComp.jsx";
import { GifPicker } from "./GifPicker.jsx";
import { StickerPicker } from "./StickerPicker.jsx";
import { Image, Mic, Paperclip, Send, Smile, Sticker, Square } from 'lucide-react';

const MAX_MEDIA_BYTES = 2 * 1024 * 1024;

export function Composer() {
  const { text, setText, sendMessage } = useChat();
  const [activePicker, setActivePicker] = useState(null); // 'emoji', 'gif', 'sticker'
  const [mediaPreview, setMediaPreview] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef(null);
  const recorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const togglePicker = (picker) => {
    setActivePicker(current => current === picker ? null : picker);
  };

  const handleSendRich = async (type, content) => {
    setActivePicker(null);
    await sendMessage({ type, content });
  };

  async function handleImageFile(file) {
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > MAX_MEDIA_BYTES) {
      window.alert("Ảnh tối đa 2 MB để gửi an toàn qua gói tin mã hóa.");
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    setMediaPreview({
      type: "image",
      content: dataUrl,
      name: file.name || "clipboard-image.png",
      mime: file.type,
      size: file.size
    });
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    await handleImageFile(file);
    event.target.value = "";
  }

  async function handlePaste(event) {
    const imageItem = Array.from(event.clipboardData?.items || [])
      .find(item => item.type.startsWith("image/"));
    if (!imageItem) return;
    event.preventDefault();
    await handleImageFile(imageItem.getAsFile());
  }

  async function sendMediaPreview() {
    if (!mediaPreview || busy) return;
    setBusy(true);
    try {
      await sendMessage(mediaPreview);
      setMediaPreview(null);
    } finally {
      setBusy(false);
    }
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      window.alert("Trình duyệt hiện không hỗ trợ ghi âm.");
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      window.alert("Không thể mở micro. Hãy cấp quyền ghi âm cho trình duyệt.");
      return;
    }
    const recorder = new MediaRecorder(stream);
    audioChunksRef.current = [];
    recorderRef.current = recorder;
    recorder.ondataavailable = event => {
      if (event.data.size > 0) audioChunksRef.current.push(event.data);
    };
    recorder.onstop = async () => {
      stream.getTracks().forEach(track => track.stop());
      const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
      if (blob.size > MAX_MEDIA_BYTES) {
        window.alert("Ghi âm tối đa 2 MB để gửi an toàn qua gói tin mã hóa.");
        return;
      }
      const dataUrl = await readFileAsDataUrl(blob);
      setMediaPreview({
        type: "audio",
        content: dataUrl,
        name: "voice-message.webm",
        mime: blob.type,
        size: blob.size
      });
    };
    recorder.start();
    setIsRecording(true);
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setIsRecording(false);
  }

  return (
    <footer className="composer" style={{ position: 'relative' }}>
      {activePicker === 'emoji' && <EmojiPickerComp onEmojiClick={e => setText(current => current + e)} />}
      {activePicker === 'gif' && <GifPicker onGifClick={url => handleSendRich('gif', url)} />}
      {activePicker === 'sticker' && <StickerPicker onStickerClick={sticker => handleSendRich('sticker', sticker)} />}

      {mediaPreview && (
        <div className="media-preview">
          <div className="media-preview-body">
            {mediaPreview.type === "image" ? (
              <img src={mediaPreview.content} alt="Ảnh chuẩn bị gửi" />
            ) : (
              <audio controls src={mediaPreview.content} />
            )}
            <span>{mediaPreview.name}</span>
          </div>
          <div className="media-preview-actions">
            <button className="secondary-button" type="button" onClick={() => setMediaPreview(null)}>Hủy</button>
            <button className="primary-button compact" type="button" disabled={busy} onClick={sendMediaPreview}>
              {busy ? "Đang gửi..." : "Gửi"}
            </button>
          </div>
        </div>
      )}

      <button className={`icon-button ${activePicker === 'emoji' ? 'active' : ''}`} type="button" aria-label="Emoji" onClick={() => togglePicker('emoji')}><Smile size={20} /></button>
      <button className={`icon-button ${activePicker === 'gif' ? 'active' : ''}`} type="button" aria-label="GIF" onClick={() => togglePicker('gif')}><Image size={20} /></button>
      <button className={`icon-button ${activePicker === 'sticker' ? 'active' : ''}`} type="button" aria-label="Sticker" onClick={() => togglePicker('sticker')}><Sticker size={20} /></button>
      <button className="icon-button" type="button" aria-label="Tải ảnh lên" title="Tải ảnh lên" onClick={() => fileInputRef.current?.click()}><Paperclip size={20} /></button>
      <button
        className={`icon-button ${isRecording ? 'recording' : ''}`}
        type="button"
        aria-label={isRecording ? "Dừng ghi âm" : "Ghi âm"}
        title={isRecording ? "Dừng ghi âm" : "Ghi âm"}
        onClick={isRecording ? stopRecording : startRecording}
      >
        {isRecording ? <Square size={18} /> : <Mic size={20} />}
      </button>
      <input ref={fileInputRef} className="hidden-file-input" type="file" accept="image/*" onChange={handleFileChange} />
      <input
        value={text}
        onChange={event => setText(event.target.value)}
        onPaste={handlePaste}
        onKeyDown={event => {
          if (event.key === "Enter") sendMessage();
        }}
        placeholder="Nhập tin nhắn, Ctrl+V ảnh..."
      />
      <button className="send-button" onClick={() => sendMessage()}><Send size={20} style={{ marginLeft: '2px' }} /></button>
    </footer>
  );
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
