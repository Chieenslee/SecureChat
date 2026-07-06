import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  buildCanonicalPayload,
  computeIntegrityHash,
  decryptAESKey,
  decryptMessage,
  encryptAESKey,
  encryptMessage,
  exportAESKey,
  exportPrivateKeyPem,
  generateAESKey,
  generateRSAKeyPair,
  importAESKey,
  importOwnKeyPair,
  importRecipientPublicKeys,
  signData,
  verifyIntegrityHash,
  verifySignature
} from "../secureCrypto.js";
import { apiGet, apiPatch, apiPost, apiDelete, readApiError } from "../services/api.js";

const TOKEN_KEY = "secure_chat_token";
const USER_KEY = "secure_chat_user";
const MAX_PACKET_AGE_MS = 30000;
const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const [token, setToken] = useState(sessionStorage.getItem(TOKEN_KEY) || "");
  const storedUser = readStoredUser();
  const [user, setUser] = useState(storedUser);
  const [keys, setKeys] = useState(null);
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [activeFriend, setActiveFriend] = useState(null);
  const [messages, setMessages] = useState(() => {
    const u = readStoredUser();
    if (u?.username) {
      try { return JSON.parse(localStorage.getItem(`secure_chat_history_${u.username}`) || "{}"); }
      catch { return {}; }
    }
    return {};
  });
  const [status, setStatus] = useState("offline");
  const [friendId, setFriendId] = useState("");
  const [text, setText] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ username: "", password: "" });
  const [notice, setNotice] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [adminLogOpen, setAdminLogOpen] = useState(false);
  const [profileForm, setProfileForm] = useState(profileToForm(storedUser || {}));
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  const [friendPreview, setFriendPreview] = useState(null);
  const wsRef = useRef(null);
  const sessionsRef = useRef({});
  const publicKeysRef = useRef({});
  const handlePacketRef = useRef();

  useEffect(() => {
    handlePacketRef.current = handlePacket;
  });

  useEffect(() => {
    if (user?.username) {
      localStorage.setItem(`secure_chat_history_${user.username}`, JSON.stringify(messages));
    }
  }, [messages, user?.username]);

  useEffect(() => {
    if (!token || !user) return;
    let isSubscribed = true;

    async function init() {
      try {
        const rsaKeys = await getOrCreateStoredKeys(user.username);
        if (!isSubscribed) return;
        setKeys(rsaKeys);
        
        refreshLists(token);
        connectSocket(token);
      } catch (e) {
        console.error("Failed to init keys:", e);
      }
    }
    
    init();
    
    const intervalId = window.setInterval(() => {
      refreshLists(token).catch(() => {});
    }, 3000);
    return () => {
      isSubscribed = false;
      window.clearInterval(intervalId);
      wsRef.current?.close();
    };
  }, [token, user?.chat_id]);

  async function refreshLists(authToken = token) {
    const [friendsData, requestsData] = await Promise.all([
      apiGet("/api/friends", authToken),
      apiGet("/api/friend-requests", authToken)
    ]);
    setFriends(friendsData.friends);
    setRequests(requestsData.requests);
    setActiveFriend(current => current || friendsData.friends[0] || null);
  }

  async function submitAuth(event) {
    event.preventDefault();
    setNotice("");
    setStatus("generating RSA keys");
    try {
      const rsaKeys = await getOrCreateStoredKeys(authForm.username);
      const endpoint = authMode === "login" ? "/api/login" : "/api/register";
      const data = await apiPost(endpoint, {
        username: authForm.username,
        password: authForm.password,
        public_key: rsaKeys.publicKeyBundle
      });
      setKeys(rsaKeys);
      setToken(data.access_token);
      setUser(data.user);
      setProfileForm(profileToForm(data.user));
      sessionStorage.setItem(TOKEN_KEY, data.access_token);
      sessionStorage.setItem(USER_KEY, JSON.stringify(data.user));
      
      let loadedMessages = {};
      try {
        const hist = localStorage.getItem(`secure_chat_history_${data.user.username}`);
        if (hist) loadedMessages = JSON.parse(hist);
      } catch (e) {}
      setMessages(loadedMessages);
      
      setStatus("online");
    } catch (error) {
      setStatus("auth error");
      setNotice(readApiError(error));
    }
  }

  function logout() {
    wsRef.current?.close();
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    setToken("");
    setUser(null);
    setKeys(null);
    setFriends([]);
    setRequests([]);
    setActiveFriend(null);
    setMessages({});
    setStatus("offline");
  }

  function connectSocket(authToken) {
    wsRef.current?.close();
    const defaultWsUrl = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`;
    const wsUrl = import.meta.env.VITE_WS_URL || defaultWsUrl;
    const ws = new WebSocket(`${wsUrl}?token=${encodeURIComponent(authToken)}`);
    wsRef.current = ws;
    ws.onopen = () => setStatus("online");
    ws.onclose = () => setStatus("offline");
    ws.onerror = () => setStatus("socket error");
    ws.onmessage = event => {
      const packet = JSON.parse(event.data);
      if (handlePacketRef.current) {
        handlePacketRef.current(packet).catch(error => {
          console.error("Packet error:", error);
        });
      }
    };
  }

  async function sendFriendRequest() {
    const cleaned = friendId.trim();
    if (!/^#[0-9]{8}$/.test(cleaned)) {
      setNotice("Chat ID phải có dạng #12345678.");
      return;
    }
    try {
      const result = await apiPost("/api/friend-requests", { chat_id: cleaned }, token);
      setFriendId("");
      setNotice(result.status === "accepted" ? "Đã kết bạn." : "Đã gửi lời mời kết bạn.");
      await refreshLists();
    } catch (error) {
      setNotice(readApiError(error));
    }
  }

  async function searchFriend() {
    const cleaned = friendId.trim();
    if (!/^#[0-9]{8}$/.test(cleaned)) {
      setNotice("Chat ID phải có dạng #12345678.");
      setFriendPreview(null);
      return;
    }
    try {
      const data = await apiGet(`/api/users/search?chat_id=${encodeURIComponent(cleaned)}`, token);
      setFriendPreview(data.user);
      setNotice("");
    } catch (error) {
      setFriendPreview(null);
      setNotice(readApiError(error));
    }
  }

  async function acceptRequest(requestId) {
    try {
      await apiPost("/api/friend-requests/accept", { request_id: requestId }, token);
      setNotice("Đã chấp nhận lời mời.");
      await refreshLists();
    } catch (error) {
      setNotice(readApiError(error));
    }
  }

  async function rejectRequest(requestId) {
    try {
      await apiPost("/api/friend-requests/reject", { request_id: requestId }, token);
      setNotice("Đã từ chối lời mời.");
      await refreshLists();
    } catch (error) {
      setNotice(readApiError(error));
    }
  }

  async function removeFriend(friendId) {
    try {
      await apiDelete(`/api/friends/${encodeURIComponent(friendId)}`, token);
      setFriends(prev => prev.filter(f => f.chat_id !== friendId));
      if (activeFriend?.chat_id === friendId) {
        setActiveFriend(null);
      }
      setNotice("Đã xóa kết bạn.");
    } catch (error) {
      setNotice(readApiError(error));
    }
  }

  async function updateProfile(event) {
    event.preventDefault();
    try {
      const data = await apiPatch("/api/me", profileForm, token);
      setUser(data.user);
      sessionStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setProfileOpen(false);
      setNotice("Đã cập nhật hồ sơ.");
    } catch (error) {
      setNotice(readApiError(error));
    }
  }

  async function sendMessage(overridePayload = null) {
    if (!activeFriend) return;
    let payloadObj;
    if (overridePayload) {
      payloadObj = overridePayload;
    } else {
      const plaintext = text.trim();
      if (!plaintext) return;
      payloadObj = { type: "text", content: plaintext };
    }

    await ensureSession(activeFriend);
    const session = sessionsRef.current[activeFriend.chat_id];
    const sequenceNumber = ++session.sequence;
    const timestamp = Date.now();
    const payloadStr = JSON.stringify(payloadObj);
    const encrypted = await encryptMessage(payloadStr, session.aesKey);
    const hash = await computeIntegrityHash(encrypted.iv, encrypted.cipher);
    const payload = {
      sender: user.chat_id,
      recipient: activeFriend.chat_id,
      session_id: session.sessionId,
      sequence_number: sequenceNumber,
      timestamp,
      iv: encrypted.iv,
      cipher: encrypted.cipher,
      hash
    };
    const signature = await signData(buildCanonicalPayload(payload), keys.signKey);
    sendPacket({ type: "message", ...payload, signature });
    addChatMessage(activeFriend.chat_id, {
      mine: true,
      parsed: payloadObj,
      text: payloadObj.type === "text" ? payloadObj.content : "",
      at: timestamp,
      senderId: user.chat_id
    });
    if (!overridePayload) setText("");
  }

  async function ensureSession(friend) {
    if (friend.chat_id.startsWith("group:")) {
      if (sessionsRef.current[friend.chat_id]?.aesKey) return;
      const groupId = friend.chat_id.split(":")[1];
      const data = await apiGet(`/api/groups/${groupId}`, token);
      const rawAesKey = await decryptAESKey(data.encrypted_key, keys.decryptKey);
      sessionsRef.current[friend.chat_id] = {
        sessionId: `group-sess-${groupId}`,
        aesKey: await importAESKey(rawAesKey),
        sequence: 0,
        receivedSequence: 0
      };
      return;
    }

    if (sessionsRef.current[friend.chat_id]?.aesKey) return;
    const peerKeys = await getPublicKeys(friend.chat_id);
    const aesKey = await generateAESKey();
    const sessionId = `sess-${crypto.randomUUID()}`;
    const timestamp = Date.now();
    const metadata = {
      sender: user.chat_id,
      recipient: friend.chat_id,
      session_id: sessionId,
      timestamp
    };
    const metadataSignature = await signData(buildCanonicalPayload(metadata), keys.signKey);
    const encryptedAesKey = await encryptAESKey(await exportAESKey(aesKey), peerKeys.encryptKey);
    sessionsRef.current[friend.chat_id] = { sessionId, aesKey, sequence: 0, receivedSequence: 0 };
    sendPacket({
      type: "handshake",
      sender: user.chat_id,
      recipient: friend.chat_id,
      session_id: sessionId,
      timestamp,
      metadata,
      metadata_signature: metadataSignature,
      encrypted_aes_key: encryptedAesKey
    });
  }

  async function handlePacket(packet) {
    if (packet.type === "handshake") return receiveHandshake(packet);
    if (packet.type === "message") return receiveMessage(packet);
    if (packet.type === "ack") return addSystemMessage(packet.sender, packet.reason || "ACK");
    if (packet.type === "nack" || packet.type === "error") {
      return addSystemMessage(packet.sender || activeFriend?.chat_id, packet.reason || packet.message || "NACK");
    }
  }

  async function receiveHandshake(packet) {
    const senderKeys = await getPublicKeys(packet.sender);
    const metadataOk = await verifySignature(
      packet.metadata_signature,
      buildCanonicalPayload(packet.metadata),
      senderKeys.verifyKey
    );
    if (!metadataOk) return sendNack(packet.sender, packet.session_id, "Invalid metadata signature");
    const rawAesKey = await decryptAESKey(packet.encrypted_aes_key, keys.decryptKey);
    sessionsRef.current[packet.sender] = {
      sessionId: packet.session_id,
      aesKey: await importAESKey(rawAesKey),
      sequence: 0,
      receivedSequence: 0
    };
    sendAck(packet.sender, packet.session_id, "Handshake accepted");
  }

  async function receiveMessage(packet) {
    let session = Object.values(sessionsRef.current).find(item => item.sessionId === packet.session_id);
    if (!session && packet.recipient.startsWith("group:")) {
      const groupId = packet.recipient.split(":")[1];
      try {
        const data = await apiGet(`/api/groups/${groupId}`, token);
        const rawAesKey = await decryptAESKey(data.encrypted_key, keys.decryptKey);
        session = {
          sessionId: `group-sess-${groupId}`,
          aesKey: await importAESKey(rawAesKey),
          sequence: 0,
          receivedSequence: 0
        };
        sessionsRef.current[packet.recipient] = session;
      } catch (e) {
        return sendNack(packet.sender, packet.session_id, "Could not load group key");
      }
    }
    if (!session) return sendNack(packet.sender, packet.session_id, "Unknown session");
    if (Math.abs(Date.now() - packet.timestamp) > MAX_PACKET_AGE_MS) {
      return sendNack(packet.sender, packet.session_id, "Message expired");
    }
    if (packet.sequence_number <= session.receivedSequence) {
      return sendNack(packet.sender, packet.session_id, "Replay detected");
    }
    const computedHash = await computeIntegrityHash(packet.iv, packet.cipher);
    if (!verifyIntegrityHash(packet.hash, computedHash)) {
      return sendNack(packet.sender, packet.session_id, "Invalid integrity hash");
    }
    const senderKeys = await getPublicKeys(packet.sender);
    const payload = {
      sender: packet.sender,
      recipient: packet.recipient,
      session_id: packet.session_id,
      sequence_number: packet.sequence_number,
      timestamp: packet.timestamp,
      iv: packet.iv,
      cipher: packet.cipher,
      hash: packet.hash
    };
    const signatureOk = await verifySignature(packet.signature, buildCanonicalPayload(payload), senderKeys.verifyKey);
    if (!signatureOk) return sendNack(packet.sender, packet.session_id, "Invalid message signature");
    const plaintext = await decryptMessage(packet.iv, packet.cipher, session.aesKey);
    let parsed;
    try {
      parsed = JSON.parse(plaintext);
      if (!parsed.type || !parsed.content) throw new Error("Invalid format");
    } catch {
      parsed = { type: "text", content: plaintext };
    }
    session.receivedSequence = packet.sequence_number;
    const chatKey = packet.recipient.startsWith("group:") ? packet.recipient : packet.sender;
    addChatMessage(chatKey, {
      mine: false,
      parsed,
      text: parsed.type === "text" ? parsed.content : "",
      at: packet.timestamp,
      senderId: packet.sender
    });
    sendAck(packet.sender, packet.session_id, "Message accepted");
  }

  async function getPublicKeys(chatId) {
    if (publicKeysRef.current[chatId]) return publicKeysRef.current[chatId];
    const data = await apiGet(`/api/public-key/${encodeURIComponent(chatId)}`, token);
    const imported = await importRecipientPublicKeys(data.public_key);
    const value = { ...imported, publicKeyBundle: data.public_key };
    publicKeysRef.current[chatId] = value;
    return value;
  }

  function sendAck(recipient, sessionId, reason) {
    sendPacket({ type: "ack", sender: user.chat_id, recipient, session_id: sessionId, timestamp: Date.now(), reason });
  }

  function sendNack(recipient, sessionId, reason) {
    sendPacket({ type: "nack", sender: user.chat_id, recipient, session_id: sessionId, timestamp: Date.now(), reason });
  }

  function sendPacket(packet) {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket chưa kết nối.");
    }
    wsRef.current.send(JSON.stringify(packet));
  }

  function addChatMessage(chatId, message) {
    setMessages(current => ({ ...current, [chatId]: [...(current[chatId] || []), message] }));
  }

  function addSystemMessage(chatId, message) {
    if (!chatId) return;
    setMessages(current => {
      const chatMsgs = current[chatId] || [];
      const lastMsg = chatMsgs[chatMsgs.length - 1];
      if (lastMsg && lastMsg.system && lastMsg.text === message) {
        return current; // Ngăn chặn hiển thị liên tục cùng một thông báo hệ thống
      }
      return { ...current, [chatId]: [...chatMsgs, { system: true, text: message, at: Date.now() }] };
    });
  }

  const activeMessages = useMemo(() => messages[activeFriend?.chat_id] || [], [messages, activeFriend]);

  const value = {
    token,
    user,
    keys,
    friends,
    requests,
    activeFriend,
    activeMessages,
    status,
    friendId,
    text,
    authMode,
    authForm,
    notice,
    profileOpen,
    adminLogOpen,
    profileForm,
    friendPreview,
    setActiveFriend,
    setFriendId,
    setText,
    setAuthMode,
    setAuthForm,
    setProfileOpen,
    setAdminLogOpen,
    setProfileForm,
    groupModalOpen,
    setGroupModalOpen,
    groupInfoOpen,
    setGroupInfoOpen,
    submitAuth,
    logout,
    searchFriend,
    sendFriendRequest,
    acceptRequest,
    rejectRequest,
    removeFriend,
    updateProfile,
    sendMessage,
    getPublicKeys,
    addSystemMessage
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) throw new Error("useChat must be used within ChatProvider");
  return context;
}

async function getOrCreateStoredKeys(username) {
  const keyName = `secure_chat_private_key_${username.trim().toLowerCase()}`;
  const storedPem = localStorage.getItem(keyName);
  if (storedPem) return importOwnKeyPair(storedPem);
  const generated = await generateRSAKeyPair();
  localStorage.setItem(keyName, exportPrivateKeyPem(generated));
  return generated;
}

function readStoredUser() {
  try {
    return JSON.parse(sessionStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

function profileToForm(user) {
  return {
    display_name: user.display_name || user.username || "",
    bio: user.bio || "",
    avatar_color: user.avatar_color || "#2aabee"
  };
}
