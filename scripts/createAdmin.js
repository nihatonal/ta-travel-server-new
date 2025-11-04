// server/scripts/createAdmin.js
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import bcrypt from "bcryptjs"; // hafif ve kolay kurulum
import Admin from "../models/Admin.js";
import path from "path";

// Bağlantı
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("MONGO_URI env bulunamadı. .env dosyanızı kontrol edin.");
  process.exit(1);
}

async function main() {
  await mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }).catch(err => {
    console.error("Mongo bağlantı hatası:", err);
    process.exit(1);
  });

  // Argümanlardan email/username/password al (örnek: --email=a@b.com --username=admin --password=secret)
  const argv = process.argv.slice(2);
  const args = {};
  argv.forEach(a => {
    const [k, v] = a.split("=");
    if (!k || !v) return;
    args[k.replace(/^--/, "")] = v;
  });

  const username = args.username || args.user || args.u;
  const email = args.email || args.e;
  const password = args.password || args.p;

  if (!username || !password || !email) {
    console.error("Kullanım: node scripts/createAdmin.js --username=admin --email=admin@example.com --password=Secret123");
    process.exit(1);
  }

  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || "12", 10);
  const passwordHash = await bcrypt.hash(password, saltRounds);

  try {
    // Eğer aynı username/email varsa güncelle veya uyar
    const existing = await Admin.findOne({ $or: [{ username }, { email }] });
    if (existing) {
      console.log("Aynı username veya email zaten var. Güncelliyor...");
      existing.passwordHash = passwordHash;
      existing.username = username;
      existing.email = email;
      await existing.save();
      console.log("Mevcut admin güncellendi:", existing.username);
    } else {
      const admin = await Admin.create({ username, email, passwordHash, role: "admin" });
      console.log("Yeni admin oluşturuldu:", admin.username);
    }
  } catch (err) {
    console.error("Kayıt hatası:", err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

main();
