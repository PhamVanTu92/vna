#!/usr/bin/env node
/**
 * Tạo license key (JWT signed bằng RSA private key) cho khách hàng.
 *
 * Usage:
 *   node generate-license.js \
 *     --customer-id   "vna-nrt-001"                   \
 *     --customer-name "Vietnam Airlines NRT Branch"   \
 *     --expires       "2027-12-31"                    \
 *     --max-users     50
 */
const jwt  = require('jsonwebtoken');
const fs   = require('fs');
const path = require('path');

// Parse --key value arguments
function parseArgs() {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      args[key] = argv[i + 1];
      i++;
    }
  }
  return args;
}

const args = parseArgs();

if (!args.customerId || !args.customerName || !args.expires || !args.maxUsers) {
  console.error('Usage:');
  console.error('  node generate-license.js \\');
  console.error('    --customer-id   "vna-nrt-001" \\');
  console.error('    --customer-name "Vietnam Airlines NRT Branch" \\');
  console.error('    --expires       "2027-12-31" \\');
  console.error('    --max-users     50');
  process.exit(1);
}

const privatePath = path.join(__dirname, 'vendor-private.pem');
if (!fs.existsSync(privatePath)) {
  console.error('❌  vendor-private.pem không tìm thấy!');
  console.error('    Chạy: node setup-keys.js trước.');
  process.exit(1);
}

const privateKey = fs.readFileSync(privatePath);
const maxUsers   = parseInt(args.maxUsers, 10);

if (isNaN(maxUsers) || maxUsers < 1) {
  console.error('❌  --max-users phải là số nguyên dương.');
  process.exit(1);
}

// Set expiry to end-of-day
const expiresAt = new Date(args.expires);
expiresAt.setHours(23, 59, 59, 999);

if (isNaN(expiresAt.getTime())) {
  console.error('❌  --expires không hợp lệ. Dùng định dạng: YYYY-MM-DD');
  process.exit(1);
}

if (expiresAt <= new Date()) {
  console.error('❌  Ngày hết hạn đã qua. Vui lòng nhập ngày trong tương lai.');
  process.exit(1);
}

const daysRemaining = Math.floor((expiresAt - Date.now()) / 86400000);

const payload = {
  iss:          'VNA-Accountant-License',
  sub:          args.customerId,
  customerName: args.customerName,
  maxUsers,
  product:      'vna-accountant-v1'
};

const ttlSeconds = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
const token = jwt.sign(payload, privateKey, {
  algorithm: 'RS256',
  expiresIn: ttlSeconds
});

// Log to history file
const historyPath = path.join(__dirname, 'license-history.jsonl');
const record = {
  issuedAt:     new Date().toISOString(),
  customerId:   args.customerId,
  customerName: args.customerName,
  expiresAt:    expiresAt.toISOString(),
  maxUsers,
  tokenPreview: token.slice(0, 40) + '...'
};
fs.appendFileSync(historyPath, JSON.stringify(record) + '\n');

console.log('\n' + '✓  License Key đã tạo'.padEnd(60, ' '));
console.log('='.repeat(70));
console.log(token);
console.log('='.repeat(70));
console.log('\nTóm tắt:');
console.log(`  Customer ID:   ${args.customerId}`);
console.log(`  Tên KH:        ${args.customerName}`);
console.log(`  Hết hạn:       ${expiresAt.toLocaleDateString('vi-VN')} (${daysRemaining} ngày nữa)`);
console.log(`  Số user tối đa: ${maxUsers}`);
console.log('\nGửi key trên cho khách hàng.');
console.log('Khách hàng kích hoạt tại: Trang chủ → Nhập License Key\n');
