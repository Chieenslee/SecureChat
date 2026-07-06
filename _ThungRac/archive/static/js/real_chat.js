/**
 * real_chat.js
 * Triển khai chat thật qua WebSocket relay: 2 tab client + 1 server ở giữa.
 */

const realState = {
    userId: "",
    peerId: "",
    keys: null,
    ws: null,
    sessions: {},
    publicKeys: {},
    lastSentMessagePacket: null,
    packetCount: 0,
    ackCount: 0,
    nackCount: 0,
    packetChain: Promise.resolve()
};

const realDom = {};
const REAL_MAX_PACKET_AGE_MS = 30000;
const SAVED_USER_ID_KEY = "secure_chat_user_id";
const SAVED_PEER_ID_KEY = "secure_chat_peer_id";

document.addEventListener("DOMContentLoaded", initRealPage);

function initRealPage() {
    bindRealDom();
    loadQueryDefaults();
    setRealStatus("Chưa kết nối");
}

function bindRealDom() {
    realDom.connectionStatus = document.getElementById("connectionStatus");
    realDom.userIdInput = document.getElementById("userIdInput");
    realDom.peerIdInput = document.getElementById("peerIdInput");
    realDom.connectBtn = document.getElementById("connectBtn");
    realDom.sendBtn = document.getElementById("sendBtn");
    realDom.clearBtn = document.getElementById("clearBtn");
    realDom.messageInput = document.getElementById("messageInput");
    realDom.localMessages = document.getElementById("localMessages");
    realDom.peerMessages = document.getElementById("peerMessages");
    realDom.serverFlow = document.getElementById("serverFlow");
    realDom.packetPreview = document.getElementById("realPacketPreview");
    realDom.packetCount = document.getElementById("packetCount");
    realDom.ackCount = document.getElementById("realAckCount");
    realDom.nackCount = document.getElementById("realNackCount");
    realDom.keyStatus = document.getElementById("keyStatus");
    realDom.meTitle = document.getElementById("meTitle");
    realDom.peerTitle = document.getElementById("peerTitle");
    realDom.meAvatar = document.getElementById("meAvatar");
    realDom.peerAvatar = document.getElementById("peerAvatar");
    realDom.loadServerLogBtn = document.getElementById("loadServerLogBtn");
    realDom.sendTamperedBtn = document.getElementById("sendTamperedBtn");
    realDom.sendBadSignatureBtn = document.getElementById("sendBadSignatureBtn");
    realDom.sendExpiredBtn = document.getElementById("sendExpiredBtn");
    realDom.replayRealBtn = document.getElementById("replayRealBtn");

    realDom.connectBtn.addEventListener("click", connectRealClient);
    realDom.sendBtn.addEventListener("click", () => sendRealMessage({}));
    realDom.clearBtn.addEventListener("click", clearRealLogs);
    realDom.userIdInput.addEventListener("input", updateTitles);
    realDom.peerIdInput.addEventListener("input", updateTitles);
    realDom.loadServerLogBtn.addEventListener("click", loadRealServerLog);
    realDom.sendTamperedBtn.addEventListener("click", () => sendRealMessage({ tamperCipher: true }));
    realDom.sendBadSignatureBtn.addEventListener("click", () => sendRealMessage({ badSignature: true }));
    realDom.sendExpiredBtn.addEventListener("click", () => sendRealMessage({ expired: true }));
    realDom.replayRealBtn.addEventListener("click", replayLastRealPacket);
}

function loadQueryDefaults() {
    const params = new URLSearchParams(window.location.search);
    const user = params.get("user");
    const peer = params.get("peer");
    const savedUser = localStorage.getItem(SAVED_USER_ID_KEY);
    const savedPeer = localStorage.getItem(SAVED_PEER_ID_KEY);

    if (user) {
        realDom.userIdInput.value = user;
    } else if (savedUser) {
        realDom.userIdInput.value = savedUser;
    }

    if (peer) {
        realDom.peerIdInput.value = peer;
    } else if (savedPeer) {
        realDom.peerIdInput.value = savedPeer;
    }

    updateTitles();
}

async function connectRealClient() {
    realState.userId = normalizeUserId(realDom.userIdInput.value);
    realState.peerId = normalizeUserId(realDom.peerIdInput.value);

    if (!realState.userId || !realState.peerId || realState.userId === realState.peerId) {
        addServerStep("Cấu hình lỗi", "ID của tôi và ID người nhận phải khác nhau, không được để trống.", "error");
        return;
    }

    localStorage.setItem(SAVED_USER_ID_KEY, realState.userId);
    localStorage.setItem(SAVED_PEER_ID_KEY, realState.peerId);
    updateTitles();
    setBusy(true);
    setRealStatus("Đang sinh RSA key...");
    addServerStep("Client init", `${realState.userId} đang sinh RSA-2048 PKCS#1 v1.5.`, "warn");

    try {
        realState.keys = await generateRSAKeyPair();
        await registerPublicKey();
        await connectWebSocket();
        realDom.sendBtn.disabled = false;
        setAttackButtons(false);
        realDom.keyStatus.textContent = "Registered";
        setRealStatus(`Online: ${realState.userId}`);
        addLocalSystem(`Đã đăng nhập/kết nối với ID ${realState.userId}.`);
        addServerStep("Public key registry", `Server đã lưu public key của ${realState.userId}.`, "success");
    } catch (error) {
        setRealStatus("Kết nối lỗi");
        addServerStep("Kết nối lỗi", error.message, "error");
    } finally {
        setBusy(false);
    }
}

async function registerPublicKey() {
    const response = await fetch("/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            user_id: realState.userId,
            public_key: realState.keys.publicKeyBundle
        })
    });

    if (!response.ok) {
        throw new Error(`Register failed: HTTP ${response.status}`);
    }
}

function connectWebSocket() {
    return new Promise((resolve, reject) => {
        if (realState.ws) {
            realState.ws.close();
        }

        const protocol = window.location.protocol === "https:" ? "wss" : "ws";
        const ws = new WebSocket(`${protocol}://${window.location.host}/ws/${realState.userId}`);
        realState.ws = ws;

        ws.onopen = () => {
            addServerStep("WebSocket", `${realState.userId} đã mở kênh tới server relay.`, "success");
            resolve();
        };

        ws.onmessage = event => {
            const packet = JSON.parse(event.data);
            realState.packetChain = realState.packetChain
                .then(() => handleIncomingPacket(packet))
                .catch(error => addServerStep("Packet error", error.message, "error"));
        };

        ws.onclose = () => {
            setRealStatus("Mất kết nối");
            realDom.sendBtn.disabled = true;
            addServerStep("WebSocket closed", `${realState.userId} đã ngắt kết nối.`, "warn");
        };

        ws.onerror = () => reject(new Error("WebSocket connection failed"));
    });
}

async function sendRealMessage(options = {}) {
    const plaintext = realDom.messageInput.value.trim();
    if (!plaintext) return;

    setBusy(true);
    try {
        await ensureSession(realState.peerId);
        const session = realState.sessions[realState.peerId];
        const sequenceNumber = ++session.sequence;
        const timestamp = options.expired ? Date.now() - 120000 : Date.now();
        const encrypted = await encryptMessage(plaintext, session.aesKey);
        const hash = await computeIntegrityHash(encrypted.iv, encrypted.cipher);
        const payload = {
            sender: realState.userId,
            recipient: realState.peerId,
            session_id: session.sessionId,
            sequence_number: sequenceNumber,
            timestamp,
            iv: encrypted.iv,
            cipher: encrypted.cipher,
            hash
        };
        const signature = await signData(buildCanonicalPayload(payload), realState.keys.signKey);

        const packet = {
            type: "message",
            ...payload,
            signature
        };

        if (options.tamperCipher) {
            packet.cipher = tamperBase64(packet.cipher);
            addServerStep("Tamper test", "Ciphertext bị sửa sau khi hash/sign, receiver phải NACK integrity.", "error");
        }

        if (options.badSignature) {
            packet.signature = tamperBase64(packet.signature);
            addServerStep("Signature test", "Chữ ký bị sửa, receiver phải NACK signature.", "error");
        }

        if (options.expired) {
            addServerStep("Expired test", "Timestamp bị đặt quá cũ, receiver phải NACK expired.", "error");
        }

        sendPacket(packet);
        realState.lastSentMessagePacket = structuredClone(packet);
        addLocalMessage("Bạn", plaintext, true);
        addServerStep("Client encrypt", "AES-256-CBC encrypt, SHA-256 hash, RSA/SHA-256 sign.", "success");
        showPacket(packet);
    } catch (error) {
        addServerStep("Gửi lỗi", error.message, "error");
    } finally {
        setBusy(false);
    }
}

function replayLastRealPacket() {
    if (!realState.lastSentMessagePacket) {
        addServerStep("Replay test", "Chưa có message packet nào để replay.", "error");
        return;
    }

    try {
        const packet = structuredClone(realState.lastSentMessagePacket);
        sendPacket(packet);
        showPacket(packet);
        addServerStep("Replay test", "Đã gửi lại packet cuối với cùng sequence_number.", "error");
    } catch (error) {
        addServerStep("Replay lỗi", error.message, "error");
    }
}

async function ensureSession(peerId) {
    if (realState.sessions[peerId]?.aesKey) return;

    const peerPublicKeys = await getPublicKeys(peerId);
    const aesKey = await generateAESKey();
    const sessionId = `sess-${crypto.randomUUID()}`;
    const timestamp = Date.now();
    const metadata = {
        sender: realState.userId,
        recipient: peerId,
        session_id: sessionId,
        timestamp
    };
    const metadataText = buildCanonicalPayload(metadata);
    const metadataSignature = await signData(metadataText, realState.keys.signKey);
    const encryptedAesKey = await encryptAESKey(await exportAESKey(aesKey), peerPublicKeys.encryptKey);

    realState.sessions[peerId] = {
        sessionId,
        aesKey,
        sequence: 0,
        receivedSequence: 0,
        peerId
    };

    const packet = {
        type: "handshake",
        sender: realState.userId,
        recipient: peerId,
        session_id: sessionId,
        timestamp,
        metadata,
        encrypted_aes_key: encryptedAesKey,
        metadata_signature: metadataSignature
    };

    sendPacket(packet);
    addServerStep("Handshake", `${realState.userId} gửi AES session key đã mã hóa RSA cho ${peerId}.`, "warn");
    showPacket(packet);
}

async function handleIncomingPacket(packet) {
    showPacket(packet);

    if (packet.type === "handshake") {
        await receiveRealHandshake(packet);
        return;
    }

    if (packet.type === "message") {
        await receiveRealMessage(packet);
        return;
    }

    if (packet.type === "ack") {
        realState.ackCount += 1;
        updateRealMetrics();
        addLocalSystem(`ACK từ ${packet.sender}: ${packet.reason || "packet hợp lệ"}.`);
        addServerStep("ACK relay", `Server chuyển ACK từ ${packet.sender} tới ${realState.userId}.`, "success");
        return;
    }

    if (packet.type === "nack" || packet.type === "error") {
        realState.nackCount += 1;
        updateRealMetrics();
        addLocalSystem(`NACK/Error: ${packet.reason || packet.message || "Không rõ lỗi"}.`);
        addServerStep("NACK relay", `Server chuyển lỗi tới ${realState.userId}.`, "error");
    }
}

async function receiveRealHandshake(packet) {
    const senderKeys = await getPublicKeys(packet.sender);
    const metadataText = buildCanonicalPayload(packet.metadata);
    const validMetadata = await verifySignature(packet.metadata_signature, metadataText, senderKeys.verifyKey);

    if (!validMetadata) {
        sendRealNack(packet.sender, packet.session_id, "Invalid metadata signature");
        return;
    }

    let rawAesKey;
    try {
        rawAesKey = await decryptAESKey(packet.encrypted_aes_key, realState.keys.decryptKey);
    } catch (error) {
        sendRealNack(packet.sender, packet.session_id, "AES key decrypt failed");
        return;
    }

    const aesKey = await importAESKey(rawAesKey);
    realState.sessions[packet.sender] = {
        sessionId: packet.session_id,
        aesKey,
        sequence: 0,
        receivedSequence: 0,
        peerId: packet.sender
    };

    addServerStep("Handshake verified", `${realState.userId} xác thực metadata và giải mã AES key.`, "success");
    sendRealAck(packet.sender, packet.session_id, "Handshake accepted", null);
}

async function receiveRealMessage(packet) {
    const session = Object.values(realState.sessions).find(item => item.sessionId === packet.session_id);
    if (!session) {
        sendRealNack(packet.sender, packet.session_id, "Unknown session");
        return;
    }

    if (Math.abs(Date.now() - packet.timestamp) > REAL_MAX_PACKET_AGE_MS) {
        sendRealNack(packet.sender, packet.session_id, "Message expired");
        return;
    }

    if (packet.sequence_number <= session.receivedSequence) {
        sendRealNack(packet.sender, packet.session_id, "Replay detected");
        return;
    }

    const computedHash = await computeIntegrityHash(packet.iv, packet.cipher);
    if (!verifyIntegrityHash(packet.hash, computedHash)) {
        sendRealNack(packet.sender, packet.session_id, "Invalid integrity hash");
        return;
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
    const signatureOk = await verifySignature(
        packet.signature,
        buildCanonicalPayload(payload),
        senderKeys.verifyKey
    );

    if (!signatureOk) {
        sendRealNack(packet.sender, packet.session_id, "Invalid message signature");
        return;
    }

    const plaintext = await decryptMessage(packet.iv, packet.cipher, session.aesKey);
    session.receivedSequence = packet.sequence_number;
    addPeerMessage(packet.sender, plaintext);
    addServerStep("Message accepted", `${realState.userId} verify hash/signature và decrypt thành công.`, "success");
    sendRealAck(packet.sender, packet.session_id, "Message accepted", packet.sequence_number);
}

async function getPublicKeys(userId) {
    if (realState.publicKeys[userId]) return realState.publicKeys[userId];

    const response = await fetch(`/public-key/${encodeURIComponent(userId)}`);
    if (!response.ok) {
        throw new Error(`Không tìm thấy public key của ${userId}. Hãy mở tab peer và bấm Kết nối client trước.`);
    }

    const data = await response.json();
    const keys = await importRecipientPublicKeys(data.public_key);
    realState.publicKeys[userId] = keys;
    return keys;
}

function sendRealAck(recipient, sessionId, reason, sequenceNumber) {
    realState.ackCount += 1;
    updateRealMetrics();
    sendPacket({
        type: "ack",
        sender: realState.userId,
        recipient,
        session_id: sessionId,
        sequence_number: sequenceNumber,
        timestamp: Date.now(),
        reason
    });
}

function sendRealNack(recipient, sessionId, reason) {
    realState.nackCount += 1;
    updateRealMetrics();
    sendPacket({
        type: "nack",
        sender: realState.userId,
        recipient,
        session_id: sessionId,
        timestamp: Date.now(),
        reason
    });
    addServerStep("NACK", reason, "error");
}

function sendPacket(packet) {
    if (!realState.ws || realState.ws.readyState !== WebSocket.OPEN) {
        throw new Error("WebSocket chưa kết nối");
    }

    realState.ws.send(JSON.stringify(packet));
    realState.packetCount += 1;
    updateRealMetrics();
    addServerStep("Server relay", `${packet.type} ${packet.sender} -> ${packet.recipient}`, "warn");
}

async function loadRealServerLog() {
    const response = await fetch("/security-events");
    const data = await response.json();
    showPacket(data);
    addServerStep("Security events", "Đã tải log server relay.", "success");
}

function showPacket(packet) {
    realDom.packetPreview.textContent = JSON.stringify(redactRealPacket(packet), null, 2);
}

function redactRealPacket(packet) {
    if (Array.isArray(packet?.events)) return packet;

    return {
        ...packet,
        encrypted_aes_key: compactReal(packet.encrypted_aes_key),
        metadata_signature: compactReal(packet.metadata_signature),
        cipher: compactReal(packet.cipher),
        signature: compactReal(packet.signature)
    };
}

function addLocalMessage(sender, text, mine) {
    addBubble(realDom.localMessages, sender, text, mine);
}

function addPeerMessage(sender, text) {
    addBubble(realDom.peerMessages, sender, text, false);
}

function addLocalSystem(text) {
    const bubble = document.createElement("div");
    bubble.className = "bubble system";
    bubble.textContent = text;
    realDom.localMessages.appendChild(bubble);
    realDom.localMessages.scrollTop = realDom.localMessages.scrollHeight;
}

function addBubble(list, sender, text, mine) {
    const bubble = document.createElement("div");
    bubble.className = `bubble${mine ? " mine" : ""}`;
    const name = document.createElement("strong");
    name.textContent = sender;
    const content = document.createElement("span");
    content.textContent = text;
    bubble.append(name, content);
    list.appendChild(bubble);
    list.scrollTop = list.scrollHeight;
}

function addServerStep(title, detail, type = "success") {
    const item = document.createElement("li");
    item.className = `flow-item ${type}`;
    const heading = document.createElement("strong");
    heading.textContent = title;
    const body = document.createElement("p");
    body.textContent = detail;
    item.append(heading, body);
    realDom.serverFlow.prepend(item);
}

function updateTitles() {
    const user = normalizeUserId(realDom.userIdInput.value) || "client";
    const peer = normalizeUserId(realDom.peerIdInput.value) || "peer";
    realDom.meTitle.textContent = user;
    realDom.peerTitle.textContent = peer;
    realDom.meAvatar.textContent = user.slice(0, 1).toUpperCase();
    realDom.peerAvatar.textContent = peer.slice(0, 1).toUpperCase();
}

function updateRealMetrics() {
    realDom.packetCount.textContent = realState.packetCount;
    realDom.ackCount.textContent = realState.ackCount;
    realDom.nackCount.textContent = realState.nackCount;
}

function setRealStatus(text) {
    realDom.connectionStatus.textContent = text;
}

function setBusy(isBusy) {
    realDom.connectBtn.disabled = isBusy;
    realDom.sendBtn.disabled = isBusy || !realState.ws || realState.ws.readyState !== WebSocket.OPEN;
    setAttackButtons(isBusy || !realState.ws || realState.ws.readyState !== WebSocket.OPEN);
}

function setAttackButtons(disabled) {
    [
        realDom.sendTamperedBtn,
        realDom.sendBadSignatureBtn,
        realDom.sendExpiredBtn,
        realDom.replayRealBtn
    ].forEach(button => {
        if (button) button.disabled = disabled;
    });
}

function clearRealLogs() {
    realDom.localMessages.textContent = "";
    realDom.peerMessages.textContent = "";
    realDom.serverFlow.textContent = "";
    realDom.packetPreview.textContent = "{}";
}

function normalizeUserId(value) {
    return value.trim().toLowerCase();
}

function compactReal(value) {
    if (!value || value.length <= 36) return value;
    return `${value.slice(0, 18)}...${value.slice(-12)}`;
}

function tamperBase64(value) {
    const chars = value.split("");
    const index = Math.max(0, Math.floor(chars.length / 2));
    chars[index] = chars[index] === "A" ? "B" : "A";
    return chars.join("");
}
