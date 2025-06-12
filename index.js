require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const ADMIN_ID = process.env.ADMIN_ID;

let produkList = [];

function simpanProduk() {
  fs.writeFileSync('produk.json', JSON.stringify(produkList, null, 2));
}

function muatProduk() {
  try {
    const data = fs.readFileSync('produk.json');
    produkList = JSON.parse(data);
  } catch (e) {
    produkList = [];
  }
}

muatProduk();

// Mulai
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const isAdmin = String(chatId) === ADMIN_ID;

  const buttons = [
    [{ text: '📦 Lihat Produk', callback_data: 'lihat_produk' }]
  ];

  if (isAdmin) {
    buttons.push([{ text: '➕ Tambah Produk', callback_data: 'tambah_produk' }]);
  }

  bot.sendMessage(chatId, 'Selamat datang! Pilih menu di bawah:', {
    reply_markup: {
      inline_keyboard: buttons
    }
  });
});

// Aksi ketika klik tombol
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const isAdmin = String(chatId) === ADMIN_ID;

  if (data === 'lihat_produk') {
    if (produkList.length === 0) {
      return bot.sendMessage(chatId, 'Belum ada produk.');
    }

    let teks = '📦 Daftar Produk:

';
    produkList.forEach((p, i) => {
      teks += `${i + 1}. ${p.nama} - Rp${p.harga} (${p.stok} stok)
`;
    });

    return bot.sendMessage(chatId, teks);
  }

  if (data === 'tambah_produk') {
    if (!isAdmin) return bot.sendMessage(chatId, '❌ Anda tidak punya akses.');

    bot.sendMessage(chatId, `Kirim produk dengan format:
Nama | Harga | Stok
Contoh:
Produk A | 10000 | 5`);

    bot.once('message', (msg) => {
      const text = msg.text;
      const [nama, harga, stok] = text.split('|').map(t => t.trim());

      if (!nama || !harga || !stok) {
        return bot.sendMessage(chatId, '❌ Format salah. Coba lagi.');
      }

      produkList.push({ nama, harga, stok });
      simpanProduk();
      bot.sendMessage(chatId, '✅ Produk berhasil ditambahkan.');
    });
  }
});
