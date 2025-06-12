// index.js
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const ADMIN_ID = 7006736189;
let produkList = [];

// /start
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Selamat datang! Gunakan /stok untuk melihat produk.');
});

// /admin
bot.onText(/\/admin/, (msg) => {
  if (msg.from.id !== ADMIN_ID) {
    return bot.sendMessage(msg.chat.id, '❌ Anda tidak punya akses ke perintah ini.');
  }

  bot.sendMessage(msg.chat.id, '✅ Panel admin dibuka.', {
    reply_markup: {
      keyboard: [['/tambahproduk', '/hapusproduk'], ['/stok']],
      resize_keyboard: true,
    },
  });
});

// /tambahproduk nama,harga,stok
bot.onText(/\/tambahproduk (.+)/, (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return;

  const [nama, harga, stok] = match[1].split(',');
  if (!nama || !harga || !stok) {
    return bot.sendMessage(msg.chat.id, 'Format salah. Contoh:\n/tambahproduk Buku,10000,5');
  }

  produkList.push({ nama, harga, stok });
  bot.sendMessage(msg.chat.id, `✅ Produk "${nama}" ditambahkan.`);
});

// /hapusproduk nama
bot.onText(/\/hapusproduk (.+)/, (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return;

  const nama = match[1].trim();
  const index = produkList.findIndex(p => p.nama === nama);
  if (index === -1) return bot.sendMessage(msg.chat.id, '❌ Produk tidak ditemukan.');

  produkList.splice(index, 1);
  bot.sendMessage(msg.chat.id, `🗑️ Produk "${nama}" dihapus.`);
});

// /stok
bot.onText(/\/stok/, (msg) => {
  const isAdmin = msg.from.id === ADMIN_ID;

  if (produkList.length === 0) {
    return bot.sendMessage(msg.chat.id, '📦 Belum ada produk.');
  }

  produkList.forEach((p, i) => {
    const teks = isAdmin
      ? `📌 ${p.nama} - Rp${p.harga} - Stok: ${p.stok}`
      : `📌 ${p.nama} - Rp${p.harga}`;

    bot.sendMessage(msg.chat.id, teks, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: `🛒 Beli ${p.nama}`, callback_data: `beli_${i}` }
          ]
        ]
      }
    });
  });
});

// QRIS placeholder (simulasi)
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data.startsWith('beli_')) {
    const index = parseInt(data.split('_')[1]);
    const produk = produkList[index];

    if (!produk) {
      return bot.sendMessage(chatId, '❌ Produk tidak ditemukan.');
    }

    bot.sendPhoto(chatId, 'https://i.ibb.co/yfgYz5B/qris-contoh.jpg', {
      caption: `💳 Silakan scan QRIS berikut untuk membeli:

📌 Produk: ${produk.nama}
💰 Harga: Rp${produk.harga}`,
    });
  }

  bot.answerCallbackQuery(query.id);
});
