#!/usr/bin/env node
/**
 * Tạo RSA 2048-bit key pair cho hệ thống license.
 * Chạy 1 LẦN DUY NHẤT. Lưu private key ở nơi an toàn.
 *
 * Usage: node setup-keys.js
 */
const { generateKeyPairSync } = require('crypto');
const fs = require('fs');
const path = require('path');

const privatePath = path.join(__dirname, 'vendor-private.pem');
const publicPath  = path.join(__dirname, 'vendor-public.pem');

if (fs.existsSync(privatePath)) {
  console.error('❌  vendor-private.pem đã tồn tại!');
  console.error('    Xóa file cũ thủ công nếu muốn tạo lại (sẽ làm mất hiệu lực các key cũ đã cấp).');
  process.exit(1);
}

console.log('Đang tạo RSA 2048-bit key pair...\n');

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki',   format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

fs.writeFileSync(privatePath, privateKey, { mode: 0o600 });
fs.writeFileSync(publicPath,  publicKey);

console.log('✓  Key pair đã tạo:');
console.log(`   Private: tools/vendor-private.pem  ← GIỮ BÍ MẬT, không commit git`);
console.log(`   Public:  tools/vendor-public.pem   ← Nhúng vào backend\n`);
console.log('Bước tiếp theo:');
console.log('  Public key đã được tự động nhúng nếu bạn chạy script qua npm run setup-keys.');
console.log('  Hoặc copy nội dung vendor-public.pem vào server/src/license/vendorPublicKey.ts\n');
console.log('='.repeat(60));
console.log('PUBLIC KEY (dùng để nhúng vào backend):');
console.log('='.repeat(60));
console.log(publicKey);
