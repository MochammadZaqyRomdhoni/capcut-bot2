const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const ADMIN_ID = '7006736189';
const DB_FILE = './db.json';

function loadData() {
  if (!fs.existsSync(DB_FILE)) return [];
  const raw = fs.readFileSync(DB_FILE);
  return JSON.parse(raw);
}

function saveData(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

bot.onText(/\/start/, (msg) => {
  if (msg.from.id.toString() !== ADMIN_ID) return;
  bot.sendMessage(msg.chat.id, 'Selamat datang admin! Gunakan /tambahproduk, /stok, /hapusproduk, atau /editproduk');
});

bot.onText(/\/tambahproduk (.+)/, (msg, match) => {
  if (msg.from.id.toString() !== ADMIN_ID) return;
  const [nama, harga, stok] = match[1].split('|').map(x => x.trim());
  if (!nama || !harga || !stok) return bot.sendMessage(msg.chat.id, 'Format salah. Gunakan /tambahproduk Nama | Harga | Stok');
  const data = loadData();
  data.push({ nama, harga, stok });
  saveData(data);
  bot.sendMessage(msg.chat.id, `✅ Produk "${nama}" ditambahkan.`);
});

bot.onText(/\/stok/, (msg) => {
  if (msg.from.id.toString() !== ADMIN_ID) return;
  const data = loadData();
  if (!data.length) return bot.sendMessage(msg.chat.id, '📦 Belum ada produk.');
  const teks = data.map((p, i) => `*${i + 1}. ${p.nama}*
Harga: ${p.harga}
Stok: ${p.stok}`).join('

');
  bot.sendMessage(msg.chat.id, teks, { parse_mode: 'Markdown' });
});

bot.onText(/\/hapusproduk (.+)/, (msg, match) => {
  if (msg.from.id.toString() !== ADMIN_ID) return;
  const nama = match[1].trim();
  let data = loadData();
  const awal = data.length;
  data = data.filter(p => p.nama.toLowerCase() !== nama.toLowerCase());
  if (data.length === awal) return bot.sendMessage(msg.chat.id, '❌ Produk tidak ditemukan.');
  saveData(data);
  bot.sendMessage(msg.chat.id, `🗑️ Produk "${nama}" dihapus.`);
});

bot.onText(/\/editproduk (.+)/, (msg, match) => {
  if (msg.from.id.toString() !== ADMIN_ID) return;
  const [namaLama, namaBaru, harga, stok] = match[1].split('|').map(x => x.trim());
  if (!namaLama || !namaBaru || !harga || !stok) return bot.sendMessage(msg.chat.id, 'Format salah. Gunakan /editproduk NamaLama | NamaBaru | Harga | Stok');
  const data = loadData();
  const idx = data.findIndex(p => p.nama.toLowerCase() === namaLama.toLowerCase());
  if (idx === -1) return bot.sendMessage(msg.chat.id, '❌ Produk tidak ditemukan.');
  data[idx] = { nama: namaBaru, harga, stok };
  saveData(data);
  bot.sendMessage(msg.chat.id, `✏️ Produk "${namaLama}" berhasil diedit.`);
});
