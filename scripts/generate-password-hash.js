// パスワードのハッシュを生成するスクリプト
// 使用方法: node scripts/generate-password-hash.js [パスワード]

const bcrypt = require('bcryptjs');

const password = process.argv[2] || 'SuperAdmin123!';

bcrypt.hash(password, 10, (err, hash) => {
  if (err) {
    console.error('エラー:', err);
    process.exit(1);
  }
  console.log('パスワード:', password);
  console.log('ハッシュ:', hash);
  console.log('\nSQLで使用する場合:');
  console.log(`'${hash}'`);
});

