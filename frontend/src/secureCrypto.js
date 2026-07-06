import forge from "node-forge";

const RSA_BITS = 2048;

export async function generateRSAKeyPair() {
  const keyPair = await new Promise((resolve, reject) => {
    forge.pki.rsa.generateKeyPair(
      { bits: RSA_BITS, e: 0x10001, workers: 0 },
      (err, pair) => (err ? reject(err) : resolve(pair))
    );
  });

  return {
    encryptKey: keyPair.publicKey,
    decryptKey: keyPair.privateKey,
    signKey: keyPair.privateKey,
    verifyKey: keyPair.publicKey,
    publicKeyBundle: forge.pki.publicKeyToPem(keyPair.publicKey)
  };
}

export async function importOwnKeyPair(privateKeyPem) {
  const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
  const publicKey = forge.pki.rsa.setPublicKey(privateKey.n, privateKey.e);
  return {
    encryptKey: publicKey,
    decryptKey: privateKey,
    signKey: privateKey,
    verifyKey: publicKey,
    publicKeyBundle: forge.pki.publicKeyToPem(publicKey),
    privateKeyPem
  };
}

export function exportPrivateKeyPem(keyPair) {
  return forge.pki.privateKeyToPem(keyPair.decryptKey);
}

export async function importRecipientPublicKeys(publicKeyPem) {
  const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
  return { encryptKey: publicKey, verifyKey: publicKey };
}

export async function encryptAESKey(rawAESKey, recipientEncryptKey) {
  const rawBytes = arrayBufferToBinaryString(rawAESKey);
  const encryptedBytes = recipientEncryptKey.encrypt(rawBytes, "RSAES-PKCS1-V1_5");
  return forge.util.encode64(encryptedBytes);
}

export async function decryptAESKey(encryptedAESKeyB64, myDecryptKey) {
  const encryptedBytes = forge.util.decode64(encryptedAESKeyB64);
  const rawBytes = myDecryptKey.decrypt(encryptedBytes, "RSAES-PKCS1-V1_5");
  return binaryStringToArrayBuffer(rawBytes);
}

export async function signData(data, signKey) {
  const md = forge.md.sha256.create();
  md.update(data, "utf8");
  return forge.util.encode64(signKey.sign(md));
}

export async function verifySignature(signatureB64, data, verifyKey) {
  try {
    const md = forge.md.sha256.create();
    md.update(data, "utf8");
    return verifyKey.verify(md.digest().bytes(), forge.util.decode64(signatureB64));
  } catch {
    return false;
  }
}

export async function generateAESKey() {
  return crypto.subtle.generateKey({ name: "AES-CBC", length: 256 }, true, ["encrypt", "decrypt"]);
}

export async function exportAESKey(aesKey) {
  return crypto.subtle.exportKey("raw", aesKey);
}

export async function importAESKey(rawKey) {
  return crypto.subtle.importKey("raw", rawKey, { name: "AES-CBC" }, false, ["encrypt", "decrypt"]);
}

export async function encryptMessage(plaintext, aesKey) {
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const plaintextBuffer = new TextEncoder().encode(plaintext);
  const cipherBuffer = await crypto.subtle.encrypt({ name: "AES-CBC", iv }, aesKey, plaintextBuffer);
  return {
    iv: arrayBufferToBase64(iv.buffer),
    cipher: arrayBufferToBase64(cipherBuffer)
  };
}

export async function decryptMessage(ivB64, cipherB64, aesKey) {
  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: "AES-CBC", iv: base64ToArrayBuffer(ivB64) },
    aesKey,
    base64ToArrayBuffer(cipherB64)
  );
  return new TextDecoder().decode(plaintextBuffer);
}

export async function computeIntegrityHash(ivB64, cipherB64) {
  const ivBytes = new Uint8Array(base64ToArrayBuffer(ivB64));
  const cipherBytes = new Uint8Array(base64ToArrayBuffer(cipherB64));
  const combined = new Uint8Array(ivBytes.length + cipherBytes.length);
  combined.set(ivBytes, 0);
  combined.set(cipherBytes, ivBytes.length);
  const hashBuffer = await crypto.subtle.digest("SHA-256", combined);
  return arrayBufferToHex(hashBuffer);
}

export function verifyIntegrityHash(receivedHash, computedHash) {
  if (!receivedHash || !computedHash || receivedHash.length !== computedHash.length) return false;
  let diff = 0;
  for (let index = 0; index < receivedHash.length; index += 1) {
    diff |= receivedHash.charCodeAt(index) ^ computedHash.charCodeAt(index);
  }
  return diff === 0;
}

export async function generateGroupKey() {
  return generateAESKey();
}

export async function encryptGroupKeyForMembers(aesKey, membersPublicKeysMap) {
  const rawAESKey = await exportAESKey(aesKey);
  const encryptedKeys = {};
  for (const [chatId, pubPem] of Object.entries(membersPublicKeysMap)) {
    if (pubPem) {
      const pubKey = forge.pki.publicKeyFromPem(pubPem);
      encryptedKeys[chatId] = await encryptAESKey(rawAESKey, pubKey);
    }
  }
  return encryptedKeys;
}

export function buildCanonicalPayload(fields) {
  return JSON.stringify(fields);
}

function arrayBufferToBase64(buffer) {
  return window.btoa(arrayBufferToBinaryString(buffer));
}

function base64ToArrayBuffer(base64) {
  return binaryStringToArrayBuffer(window.atob(base64));
}

function arrayBufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

function arrayBufferToBinaryString(buffer) {
  let binary = "";
  new Uint8Array(buffer).forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return binary;
}

function binaryStringToArrayBuffer(binary) {
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}
