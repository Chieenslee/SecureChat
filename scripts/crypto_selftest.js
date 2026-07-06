/**
 * Crypto Self-Test & Benchmark
 *
 * Kiểm tra toàn bộ luồng mật mã đang dùng trong ứng dụng:
 *   RSA-2048 PKCS#1 v1.5 (node-forge)  +  AES-256-CBC & SHA-256 (Web Crypto)
 *
 * Chạy:  npm run test:crypto
 *        hoặc  node scripts/crypto_selftest.js
 */

const forge = require("node-forge");
const { webcrypto } = require("crypto");

// Cung cấp các biến toàn cục của trình duyệt để secureCrypto.js có thể hoạt động trong Node.js
globalThis.crypto = webcrypto;
globalThis.window = { btoa: v => Buffer.from(v, "binary").toString("base64"),
                      atob: v => Buffer.from(v, "base64").toString("binary") };

// Viết lại các hàm tương tự từ frontend/src/secureCrypto.js
// để có thể chạy chúng trong Node.js mà không cần bundler.

const RSA_BITS = 2048;

async function generateRSAKeyPair() {
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
    publicKeyBundle: forge.pki.publicKeyToPem(keyPair.publicKey),
  };
}

function arrayBufferToBinaryString(buffer) {
  let binary = "";
  new Uint8Array(buffer).forEach(b => { binary += String.fromCharCode(b); });
  return binary;
}

function binaryStringToArrayBuffer(binary) {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function arrayBufferToBase64(buffer) {
  return globalThis.window.btoa(arrayBufferToBinaryString(buffer));
}

function base64ToArrayBuffer(base64) {
  return binaryStringToArrayBuffer(globalThis.window.atob(base64));
}

function arrayBufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function encryptAESKey(rawAESKey, recipientEncryptKey) {
  const rawBytes = arrayBufferToBinaryString(rawAESKey);
  const encrypted = recipientEncryptKey.encrypt(rawBytes, "RSAES-PKCS1-V1_5");
  return forge.util.encode64(encrypted);
}

async function decryptAESKey(encryptedB64, myDecryptKey) {
  const raw = myDecryptKey.decrypt(forge.util.decode64(encryptedB64), "RSAES-PKCS1-V1_5");
  return binaryStringToArrayBuffer(raw);
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
    return verifyKey.verify(md.digest().bytes(), forge.util.decode64(signatureB64));
  } catch {
    return false;
  }
}

async function generateAESKey() {
  return webcrypto.subtle.generateKey({ name: "AES-CBC", length: 256 }, true, ["encrypt", "decrypt"]);
}

async function exportAESKey(key) {
  return webcrypto.subtle.exportKey("raw", key);
}

async function importAESKey(rawKey) {
  return webcrypto.subtle.importKey("raw", rawKey, { name: "AES-CBC" }, false, ["encrypt", "decrypt"]);
}

async function encryptMessage(plaintext, aesKey) {
  const iv = webcrypto.getRandomValues(new Uint8Array(16));
  const buf = new TextEncoder().encode(plaintext);
  const cipher = await webcrypto.subtle.encrypt({ name: "AES-CBC", iv }, aesKey, buf);
  return { iv: arrayBufferToBase64(iv.buffer), cipher: arrayBufferToBase64(cipher) };
}

async function decryptMessage(ivB64, cipherB64, aesKey) {
  const plain = await webcrypto.subtle.decrypt(
    { name: "AES-CBC", iv: base64ToArrayBuffer(ivB64) },
    aesKey,
    base64ToArrayBuffer(cipherB64)
  );
  return new TextDecoder().decode(plain);
}

async function computeIntegrityHash(ivB64, cipherB64) {
  const ivBytes = new Uint8Array(base64ToArrayBuffer(ivB64));
  const cipherBytes = new Uint8Array(base64ToArrayBuffer(cipherB64));
  const combined = new Uint8Array(ivBytes.length + cipherBytes.length);
  combined.set(ivBytes, 0);
  combined.set(cipherBytes, ivBytes.length);
  const hashBuf = await webcrypto.subtle.digest("SHA-256", combined);
  return arrayBufferToHex(hashBuf);
}

function verifyIntegrityHash(received, computed) {
  if (!received || !computed || received.length !== computed.length) return false;
  let diff = 0;
  for (let i = 0; i < received.length; i++) {
    diff |= received.charCodeAt(i) ^ computed.charCodeAt(i);
  }
  return diff === 0;
}

// Trình chạy kiểm thử (Test runner)

function timeMs(start) {
  return (performance.now() - start).toFixed(2);
}

async function runTests() {
  const benchmarks = {};

  // 1. Tạo cặp khóa RSA
  console.log("\n1. Tạo cặp khóa RSA-2048");
  let t0 = performance.now();
  const senderKeys = await generateRSAKeyPair();
  benchmarks.rsa_keygen_sender = timeMs(t0);

  t0 = performance.now();
  const receiverKeys = await generateRSAKeyPair();
  benchmarks.rsa_keygen_receiver = timeMs(t0);
  console.log(`  Sender RSA keygen:   ${benchmarks.rsa_keygen_sender} ms`);
  console.log(`  Receiver RSA keygen: ${benchmarks.rsa_keygen_receiver} ms`);

  // 2. Tạo khóa AES
  console.log("\n2. Tạo khóa AES-256");
  t0 = performance.now();
  const aesKey = await generateAESKey();
  benchmarks.aes_keygen = timeMs(t0);
  console.log(`  AES-256 keygen: ${benchmarks.aes_keygen} ms`);

  // 3. Trao đổi khóa AES (mã hóa/giải mã khóa AES bằng RSA)
  console.log("\n3. Trao đổi khóa AES bằng RSA PKCS#1 v1.5");
  const rawAesKey = await exportAESKey(aesKey);

  t0 = performance.now();
  const encryptedAesKey = await encryptAESKey(rawAesKey, receiverKeys.encryptKey);
  benchmarks.rsa_encrypt_key = timeMs(t0);

  t0 = performance.now();
  const decryptedRawAesKey = await decryptAESKey(encryptedAesKey, receiverKeys.decryptKey);
  benchmarks.rsa_decrypt_key = timeMs(t0);

  const importedAesKey = await importAESKey(decryptedRawAesKey);
  console.log(`  RSA encrypt AES key: ${benchmarks.rsa_encrypt_key} ms`);
  console.log(`  RSA decrypt AES key: ${benchmarks.rsa_decrypt_key} ms`);

  // Xác minh khóa AES sau khi gửi và nhận
  const originalBytes = new Uint8Array(rawAesKey);
  const decryptedBytes = new Uint8Array(decryptedRawAesKey);
  let keyMatch = originalBytes.length === decryptedBytes.length;
  for (let i = 0; i < originalBytes.length; i++) {
    if (originalBytes[i] !== decryptedBytes[i]) keyMatch = false;
  }
  assert(keyMatch, "AES key round-trip qua RSA phải khớp");
  console.log("  ✓ AES key round-trip thành công");

  // 4. Test nhiều kích thước tin nhắn
  const testMessages = [
    { label: "128 B", text: "A".repeat(128) },
    { label: "1 KB", text: "B".repeat(1024) },
    { label: "10 KB", text: "C".repeat(10240) },
  ];

  for (const msg of testMessages) {
    console.log(`\n4. Mã hóa/Giải mã tin nhắn ${msg.label}`);

    // Mã hóa
    t0 = performance.now();
    const encrypted = await encryptMessage(msg.text, aesKey);
    const encTime = timeMs(t0);

    // Tính hash toàn vẹn SHA-256
    t0 = performance.now();
    const hash = await computeIntegrityHash(encrypted.iv, encrypted.cipher);
    const hashTime = timeMs(t0);

    // Ký bằng RSA
    const payload = JSON.stringify({
      iv: encrypted.iv, cipher: encrypted.cipher, hash,
    });
    t0 = performance.now();
    const signature = await signData(payload, senderKeys.signKey);
    const signTime = timeMs(t0);

    // Xác minh chữ ký RSA
    t0 = performance.now();
    const sigOk = await verifySignature(signature, payload, senderKeys.verifyKey);
    const verifyTime = timeMs(t0);

    // Giải mã
    t0 = performance.now();
    const plaintext = await decryptMessage(encrypted.iv, encrypted.cipher, importedAesKey);
    const decTime = timeMs(t0);

    // Xác minh hash
    const recomputedHash = await computeIntegrityHash(encrypted.iv, encrypted.cipher);
    const hashOk = verifyIntegrityHash(hash, recomputedHash);

    assert(sigOk, `Chữ ký RSA phải hợp lệ (${msg.label})`);
    assert(hashOk, `Hash SHA-256 phải khớp (${msg.label})`);
    assert(plaintext === msg.text, `Giải mã phải khôi phục plaintext (${msg.label})`);
    assert(hash.length === 64, `SHA-256 hash phải dài 64 hex chars (${msg.label})`);

    console.log(`  AES encrypt: ${encTime} ms`);
    console.log(`  SHA-256:     ${hashTime} ms`);
    console.log(`  RSA sign:    ${signTime} ms`);
    console.log(`  RSA verify:  ${verifyTime} ms`);
    console.log(`  AES decrypt: ${decTime} ms`);
    console.log(`  ✓ Tất cả kiểm tra đều thành công`);

    benchmarks[`enc_${msg.label}`] = encTime;
    benchmarks[`hash_${msg.label}`] = hashTime;
    benchmarks[`sign_${msg.label}`] = signTime;
    benchmarks[`verify_${msg.label}`] = verifyTime;
    benchmarks[`dec_${msg.label}`] = decTime;
  }

  // 5. Kiểm tra tấn công: sửa ciphertext làm hash không khớp
  console.log("\n5. Kiểm tra phát hiện sửa đổi ciphertext");
  const enc2 = await encryptMessage("test tamper detection", aesKey);
  const goodHash = await computeIntegrityHash(enc2.iv, enc2.cipher);

  // Giả mạo ciphertext
  const tamperedCipher = enc2.cipher.slice(0, -4) + "XXXX";
  const badHash = await computeIntegrityHash(enc2.iv, tamperedCipher);
  assert(!verifyIntegrityHash(goodHash, badHash), "Hash phải mismatch khi cipher bị sửa");
  console.log("  ✓ Phát hiện sửa đổi ciphertext thành công");

  // 6. Kiểm tra tấn công: chữ ký không hợp lệ
  console.log("\n6. Kiểm tra phát hiện chữ ký sai");
  const badSig = await signData("different data", senderKeys.signKey);
  const badSigOk = await verifySignature(badSig, "original data", senderKeys.verifyKey);
  assert(!badSigOk, "Chữ ký sai phải bị từ chối");
  console.log("  ✓ Phát hiện chữ ký sai thành công");

  // 7. So sánh hash với thời gian không đổi (Constant-time)
  console.log("\n7. So sánh hash với thời gian không đổi");
  assert(verifyIntegrityHash("abcd", "abcd"), "Hash giống phải match");
  assert(!verifyIntegrityHash("abcd", "abce"), "Hash khác phải mismatch");
  assert(!verifyIntegrityHash("abcd", "abc"), "Độ dài khác phải mismatch");
  assert(!verifyIntegrityHash("", ""), "Chuỗi rỗng phải mismatch");
  assert(!verifyIntegrityHash(null, "abc"), "null phải mismatch");
  console.log("  ✓ Constant-time comparison hoạt động đúng");

  // Tổng kết
  console.log("\nKết quả kiểm tra mật mã: TẤT CẢ KIỂM TRA THÀNH CÔNG ✓");
  console.log("\nThống kê thời gian thực thi (đơn vị: ms):");
  console.log(JSON.stringify(benchmarks, null, 2));

  // In bảng kết quả để dễ dàng đưa vào báo cáo
  console.log("\nBảng thống kê hiệu năng (Markdown):");
  console.log("| Kích thước | Trao đổi khóa | Mã hóa AES | SHA-256 | Ký số RSA | Xác minh RSA | Giải mã AES |");
  console.log("| --- | --- | --- | --- | --- | --- | --- |");
  for (const msg of testMessages) {
    console.log(`| ${msg.label} | ${benchmarks.rsa_encrypt_key} ms | ${benchmarks[`enc_${msg.label}`]} ms | ${benchmarks[`hash_${msg.label}`]} ms | ${benchmarks[`sign_${msg.label}`]} ms | ${benchmarks[`verify_${msg.label}`]} ms | ${benchmarks[`dec_${msg.label}`]} ms |`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

runTests().catch(error => {
  console.error("\n❌ TEST FAILED:", error.message);
  process.exit(1);
});
