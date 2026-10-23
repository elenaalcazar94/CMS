/* Uso: npm run create-admin -- email@dominio.com "Nombre" contraseña */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const [email, name, password] = process.argv.slice(2);
if (!email || !password || password.length < 8) {
  console.error('Uso: npm run create-admin -- email@dominio.com "Nombre" contraseña(min. 8)');
  process.exit(1);
}
const db = new PrismaClient();
const passwordHash = await bcrypt.hash(password, 12);
const user = await db.user.upsert({
  where: { email: email.toLowerCase() },
  create: { email: email.toLowerCase(), name: name || email, passwordHash, role: "SUPERADMIN" },
  update: { passwordHash, role: "SUPERADMIN", active: true },
});
console.log(`Superadministrador listo: ${user.email}`);
await db.$disconnect();
