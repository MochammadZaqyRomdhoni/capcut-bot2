
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

require('dotenv').config();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

const ADMIN_ID = process.env.ADMIN_ID || '7006736189'; // Telegram ID admin

let produk = [];

// Load data produk dari file (jika ada)
if (fs.existsSync('produk.json')) {
  produk = JSON.parse(fs.readFileSync('produk.json'));
}

// Simpan data produk ke file
function simpanProduk() {
  fs.writeFileSync('produk.json', JSON.stringify(produk, null, 2));
}

// Fungsi untuk memeriksa admin
function isAdmin(id) {
  return String(id) === String(ADMIN_ID);
}

// Command /start
bot.onText(/\/start/, (msg) => {
  const opts = {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Lihat Produk', callback_data: 'lihat_produk' }],
        ...(isAdmin(msg.from.id)
          ? [[{ text: 'Tambah Produk', callback_data: 'tambah_produk' }]]
          : [])
      ]
    }
  };
  bot.sendMessage(msg.chat.id, `Selamat datang, ${msg.from.first_name}!`, opts);
});

// Handler button callback
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;

  if (query.data === 'lihat_produk') {
    if (produk.length === 0) {
      return bot.sendMessage(chatId, 'Belum ada produk.');
    }
    const teks = produk.map((p, i) => `${i + 1}. ${p.nama} - Rp${p.harga} (Stok: ${p.stok})`).join('\n');
    bot.sendMessage(chatId, teks);
  }

  if (query.data === 'tambah_produk') {
    if (!isAdmin(userId)) return bot.sendMessage(chatId, 'Akses ditolak.');
    bot.sendMessage(chatId, 'Kirim produk dengan format:
nama|harga|stok');
    bot.once('message', (msg) => {
      const [nama, harga, stok] = msg.text.split('|');
      if (!nama || !harga || !stok) return bot.sendMessage(chatId, 'Format salah.');
      produk.push({ nama, harga, stok: parseInt(stok) });
      simpanProduk();
      bot.sendMessage(chatId, `Produk ${nama} ditambahkan.`);
    });
  }

  bot.answerCallbackQuery(query.id);
});
