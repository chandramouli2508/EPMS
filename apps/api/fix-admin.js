const argon2 = require('argon2');
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  console.log('Fixing admin:', email);
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  const result = await prisma.employee.update({
    where: { email },
    data: { passwordHash: hash, status: 'ACTIVE', mustChangePassword: true },
  });
  console.log('Done. email:', result.email, 'status:', result.status, 'mustChangePassword:', result.mustChangePassword);
  await prisma.disconnect();
}
fix().catch(e => { console.error(e); process.exit(1); });
