const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

const TOKEN = '7487677709:AAE8IZDZV58U7EZVlEIH2RZfZexhEuPbnxY';
const ADMIN_ID = '7006736189';
const bot = new TelegramBot(TOKEN, { polling: true });

const dbFile = 'produk.json';
if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, '[]');

function loadProduk() {
  return JSON.parse(fs.readFileSync(dbFile));
}

function saveProduk(data) {
  fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
}

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Selamat datang di bot admin produk.');
});

bot.onText(/\/tambahproduk (.+)/, (msg, match) => {
  if (msg.from.id.toString() !== ADMIN_ID) return;
  const [nama, harga, stok] = match[1].split('|');
  if (!nama || !harga || !stok) {
    return bot.sendMessage(msg.chat.id, `Format salah. Contoh:\n/tambahproduk nama|harga|stok`);
  }
  const data = loadProduk();
  data.push({ nama, harga, stok });
  saveProduk(data);
  bot.sendMessage(msg.chat.id, 'Produk berhasil ditambahkan.');
});

bot.onText(/\/stok/, (msg) => {
  if (msg.from.id.toString() !== ADMIN_ID) return;
  const data = loadProduk();
  if (data.length === 0) {
    return bot.sendMessage(msg.chat.id, 'Belum ada produk.');
  }
  const list = data.map((p, i) => (
    `${i + 1}. ${p.nama}\nHarga: ${p.harga}\nStok: ${p.stok}`
  )).join('\n\n');
  bot.sendMessage(msg.chat.id, `Daftar Produk:\n\n${list}`);
});

bot.onText(/\/hapusproduk (\d+)/, (msg, match) => {
  if (msg.from.id.toString() !== ADMIN_ID) return;
  const index = parseInt(match[1]) - 1;
  const data = loadProduk();
  if (index < 0 || index >= data.length) {
    return bot.sendMessage(msg.chat.id, 'Index produk tidak valid.');
  }
  data.splice(index, 1);
  saveProduk(data);
  bot.sendMessage(msg.chat.id, 'Produk berhasil dihapus.');
});

bot.onText(/\/editproduk (\d+)\|(.+)/, (msg, match) => {
  if (msg.from.id.toString() !== ADMIN_ID) return;
  const index = parseInt(match[1]) - 1;
  const [nama, harga, stok] = match[2].split('|');
  const data = loadProduk();
  if (index < 0 || index >= data.length || !nama || !harga || !stok) {
    return bot.sendMessage(msg.chat.id, `Format salah. Contoh:\n/editproduk 1|namabaru|hargabaru|stokbaru`);
  }
  data[index] = { nama, harga, stok };
  saveProduk(data);
  bot.sendMessage(msg.chat.id, 'Produk berhasil diedit.');
});

console.log('Bot jalan di port 8080');
