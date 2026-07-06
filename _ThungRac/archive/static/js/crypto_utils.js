/**
 * crypto_utils.js
 * Module xử lý mật mã phía client.
 * RSA dùng node-forge để bám sát đề tài: RSA-2048 PKCS#1 v1.5 + SHA-256.
 * AES-CBC và SHA-256 dùng Web Crypto API của trình duyệt.
 */

const RSA_BITS = 2048;

// ────────────────────────────────────────────────────────────────
// 1. RSA-2048 PKCS#1 v1.5 + SHA-256
// ────────────────────────────────────────────────────────────────

async function generateRSAKeyPair() {
    ensureForgeLoaded();

    // Sinh RSA-2048 bằng forge để dùng được PKCS#1 v1.5 trong browser.
    const keyPair = await new Promise((resolve, reject) => {
        forge.pki.rsa.generateKeyPair(
            { bits: RSA_BITS, e: 0x10001, workers: 0 },
            (err, pair) => err ? reject(err) : resolve(pair)
        );
    });

    const publicKeyPem = forge.pki.publicKeyToPem(keyPair.publicKey);

    return {
        encryptKey: keyPair.publicKey,
        decryptKey: keyPair.privateKey,
        signKey: keyPair.privateKey,
        verifyKey: keyPair.publicKey,
        publicKeyBundle: publicKeyPem
    };
}

async function importRecipientPublicKeys(bundleText) {
    ensureForgeLoaded();

    // Hỗ trợ cả PEM mới và bundle JSON cũ nếu còn public key đã đăng ký từ bản trước.
    let publicKeyText = bundleText;
    if (bundleText.trim().startsWith("{")) {
        const bundle = JSON.parse(bundleText);
        if (bundle.pem) {
            publicKeyText = bundle.pem;
        } else {
            throw new Error("Unsupported legacy RSA key bundle");
        }
    }

    const publicKey = forge.pki.publicKeyFromPem(publicKeyText);
    return {
        encryptKey: publicKey,
        verifyKey: publicKey
    };
}

async function encryptAESKey(rawAESKey, recipientEncryptKey) {
    const rawBytes = arrayBufferToBinaryString(rawAESKey);
    const encryptedBytes = recipientEncryptKey.encrypt(rawBytes, "RSAES-PKCS1-V1_5");
    return forge.util.encode64(encryptedBytes);
}

async function decryptAESKey(encryptedAESKeyB64, myDecryptKey) {
    const encryptedBytes = forge.util.decode64(encryptedAESKeyB64);
    const rawBytes = myDecryptKey.decrypt(encryptedBytes, "RSAES-PKCS1-V1_5");
    return binaryStringToArrayBuffer(rawBytes);
}

async function signData(data, signKey) {
    const md = forge.md.sha256.create();
    md.update(data, "utf8");
    return forge.util.encode64(signKey.sign(md));
}

async function verifySignature(signatureB64, data, verifyKey) {
    try {
        const md = forge.md.sha256.create();
        md.update(data, "utf8");
        const signatureBytes = forge.util.decode64(signatureB64);
        return verifyKey.verify(md.digest().bytes(), signatureBytes);
    } catch (error) {
        return false;
    }
}

// ────────────────────────────────────────────────────────────────
// 2. AES-256-CBC
// ────────────────────────────────────────────────────────────────

async function generateAESKey() {
    return await crypto.subtle.generateKey(
        { name: "AES-CBC", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
}

async function exportAESKey(aesKey) {
    return await crypto.subtle.exportKey("raw", aesKey);
}

async function importAESKey(rawKey) {
    return await crypto.subtle.importKey(
        "raw",
        rawKey,
        { name: "AES-CBC" },
        false,
        ["encrypt", "decrypt"]
    );
}

async function encryptMessage(plaintext, aesKey) {
    const iv = crypto.getRandomValues(new Uint8Array(16));
    const plaintextBuffer = new TextEncoder().encode(plaintext);

    const cipherBuffer = await crypto.subtle.encrypt(
        { name: "AES-CBC", iv },
        aesKey,
        plaintextBuffer
    );

    return {
        iv: arrayBufferToBase64(iv.buffer),
        cipher: arrayBufferToBase64(cipherBuffer)
    };
}

async function decryptMessage(ivB64, cipherB64, aesKey) {
    const plaintextBuffer = await crypto.subtle.decrypt(
        { name: "AES-CBC", iv: base64ToArrayBuffer(ivB64) },
        aesKey,
        base64ToArrayBuffer(cipherB64)
    );

    return new TextDecoder().decode(plaintextBuffer);
}

// ────────────────────────────────────────────────────────────────
// 3. SHA-256 integrity
// ────────────────────────────────────────────────────────────────

async function computeIntegrityHash(ivB64, cipherB64) {
    const ivBytes = new Uint8Array(base64ToArrayBuffer(ivB64));
    const cipherBytes = new Uint8Array(base64ToArrayBuffer(cipherB64));
    const combined = new Uint8Array(ivBytes.length + cipherBytes.length);

    combined.set(ivBytes, 0);
    combined.set(cipherBytes, ivBytes.length);

    const hashBuffer = await crypto.subtle.digest("SHA-256", combined);
    return arrayBufferToHex(hashBuffer);
}

function verifyIntegrityHash(receivedHash, computedHash) {
    if (!receivedHash || !computedHash || receivedHash.length !== computedHash.length) {
        return false;
    }

    // So sánh gần constant-time cho chuỗi hex.
    let diff = 0;
    for (let i = 0; i < receivedHash.length; i++) {
        diff |= receivedHash.charCodeAt(i) ^ computedHash.charCodeAt(i);
    }
    return diff === 0;
}

// ────────────────────────────────────────────────────────────────
// 4. Utility
// ────────────────────────────────────────────────────────────────

function buildCanonicalPayload(fields) {
    return JSON.stringify(fields);
}

function ensureForgeLoaded() {
    if (!window.forge) {
        throw new Error("node-forge is required for RSA PKCS#1 v1.5");
    }
}

function arrayBufferToBase64(buffer) {
    return window.btoa(arrayBufferToBinaryString(buffer));
}

function base64ToArrayBuffer(base64) {
    return binaryStringToArrayBuffer(window.atob(base64));
}

function arrayBufferToHex(buffer) {
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes)
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");
}

function arrayBufferToBinaryString(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    bytes.forEach(byte => {
        binary += String.fromCharCode(byte);
    });
    return binary;
}

function binaryStringToArrayBuffer(binary) {
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}
