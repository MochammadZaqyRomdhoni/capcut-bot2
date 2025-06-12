require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const adminId = process.env.ADMIN_ID;

let produk = [];

function simpanData() {
  fs.writeFileSync('produk.json', JSON.stringify(produk, null, 2));
}

function muatData() {
  if (fs.existsSync('produk.json')) {
    produk = JSON.parse(fs.readFileSync('produk.json'));
  }
}
muatData();

bot.onText(/\/(start|menu)/, (msg) => {
  if (msg.chat.id.toString() !== adminId) return;
  bot.sendMessage(msg.chat.id, 'Selamat datang! Gunakan /tambahproduk, /stok, /editproduk, /hapusproduk.');
});

bot.onText(/\/tambahproduk (.+)/, (msg, match) => {
  if (msg.chat.id.toString() !== adminId) return;
  const [nama, harga, stok] = match[1].split('|').map(x => x.trim());
  if (!nama || !harga || !stok) return bot.sendMessage(msg.chat.id, 'Format salah. Contoh:
/tambahproduk Nama | Harga | Stok');
  produk.push({ nama, harga, stok });
  simpanData();
  bot.sendMessage(msg.chat.id, `✅ Produk "${nama}" ditambahkan.`);
});

bot.onText(/\/stok/, (msg) => {
  if (msg.chat.id.toString() !== adminId) return;
  if (produk.length === 0) return bot.sendMessage(msg.chat.id, 'Belum ada produk.');
  const msgProduk = produk.map(p => `Nama: ${p.nama}
Harga: ${p.harga}
Stok: ${p.stok}`).join('\n\n');
  bot.sendMessage(msg.chat.id, '*Stok Produk:*

' + msgProduk, { parse_mode: 'Markdown' });
});

bot.onText(/\/hapusproduk (.+)/, (msg, match) => {
  if (msg.chat.id.toString() !== adminId) return;
  const nama = match[1].trim();
  const index = produk.findIndex(p => p.nama.toLowerCase() === nama.toLowerCase());
  if (index === -1) return bot.sendMessage(msg.chat.id, `❌ Produk "${nama}" tidak ditemukan.`);
  produk.splice(index, 1);
  simpanData();
  bot.sendMessage(msg.chat.id, `🗑️ Produk "${nama}" dihapus.`);
});

bot.onText(/\/editproduk (.+)/, (msg, match) => {
  if (msg.chat.id.toString() !== adminId) return;
  const [namaLama, namaBaru, harga, stok] = match[1].split('|').map(x => x.trim());
  const idx = produk.findIndex(p => p.nama.toLowerCase() === namaLama.toLowerCase());
  if (idx === -1) return bot.sendMessage(msg.chat.id, '❌ Produk tidak ditemukan.');
  produk[idx] = { nama: namaBaru, harga, stok };
  simpanData();
  bot.sendMessage(msg.chat.id, `✏️ Produk "${namaLama}" diupdate jadi "${namaBaru}".`);
});
