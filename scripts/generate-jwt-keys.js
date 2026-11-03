const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../.env');

if (!fs.existsSync(envPath)) {
  console.error('.env file not found at ' + envPath);
  process.exit(1);
}

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem',
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem',
  },
});

const privBase64 = Buffer.from(privateKey).toString('base64');
const pubBase64 = Buffer.from(publicKey).toString('base64');

let envContent = fs.readFileSync(envPath, 'utf8');

if (envContent.includes('JWT_PRIVATE_KEY_BASE64=')) {
  envContent = envContent.replace(/JWT_PRIVATE_KEY_BASE64=.*/g, `JWT_PRIVATE_KEY_BASE64="${privBase64}"`);
} else {
  envContent += `\nJWT_PRIVATE_KEY_BASE64="${privBase64}"`;
}

if (envContent.includes('JWT_PUBLIC_KEY_BASE64=')) {
  envContent = envContent.replace(/JWT_PUBLIC_KEY_BASE64=.*/g, `JWT_PUBLIC_KEY_BASE64="${pubBase64}"`);
} else {
  envContent += `\nJWT_PUBLIC_KEY_BASE64="${pubBase64}"`;
}

fs.writeFileSync(envPath, envContent, 'utf8');
console.log('Successfully generated RSA-2048 keypair and updated .env (keys stored as base64).');