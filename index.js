
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const ADMIN_ID = 7006736189;
let produkList = [];

function loadProduk() {
  try {
    return JSON.parse(fs.readFileSync('produk.json'));
  } catch {
    return [];
  }
}

function saveProduk(list) {
  fs.writeFileSync('produk.json', JSON.stringify(list, null, 2));
}

bot.onText(/\/start/, (msg) => {
  const isAdmin = msg.from.id === ADMIN_ID;
  bot.sendMessage(msg.chat.id, `Selamat datang ${isAdmin ? 'Admin' : 'User'}!`, {
    reply_markup: {
      keyboard: isAdmin
        ? [['/tambahproduk', '/hapusproduk'], ['/stok']]
        : [['/produk']],
      resize_keyboard: true,
    },
  });
});

bot.onText(/\/admin/, (msg) => {
  if (msg.from.id !== ADMIN_ID) return;
  bot.sendMessage(msg.chat.id, '✅ Panel admin dibuka.');
});

bot.onText(/\/tambahproduk (.+)/, (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return;
  const [nama, harga, ...stok] = match[1].split(',');
  if (!nama || !harga || stok.length === 0) {
    return bot.sendMessage(msg.chat.id, 'Format salah. Contoh:\n/tambahproduk Buku,10000,KODE1,KODE2');
  }
  const list = loadProduk();
  list.push({ nama: nama.trim(), harga: parseInt(harga), stok: stok.map(s => s.trim()) });
  saveProduk(list);
  bot.sendMessage(msg.chat.id, `✅ Produk "${nama}" ditambahkan dengan ${stok.length} stok.`);
});

bot.onText(/\/hapusproduk (.+)/, (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return;
  const nama = match[1].trim();
  const list = loadProduk();
  const index = list.findIndex(p => p.nama === nama);
  if (index === -1) return bot.sendMessage(msg.chat.id, '❌ Produk tidak ditemukan.');
  list.splice(index, 1);
  saveProduk(list);
  bot.sendMessage(msg.chat.id, `🗑️ Produk "${nama}" dihapus.`);
});

bot.onText(/\/stok/, (msg) => {
  const list = loadProduk();
  if (list.length === 0) return bot.sendMessage(msg.chat.id, '📦 Belum ada produk.');
  let teks = '📦 Stok Produk:\n\n';
  list.forEach((p, i) => {
    teks += `[${i + 1}] ${p.nama} - Rp${p.harga} (Stok: ${p.stok.length})\n`;
  });
  bot.sendMessage(msg.chat.id, teks);
});

bot.onText(/\/produk/, (msg) => {
  const list = loadProduk();
  if (list.length === 0) return bot.sendMessage(msg.chat.id, '📦 Belum ada produk.');
  let teks = '🛒 Pilih produk yang ingin dibeli:\n\n';
  const buttons = list.map((p, i) => [{ text: `${p.nama} - Rp${p.harga}`, callback_data: 'beli_' + i }]);
  bot.sendMessage(msg.chat.id, teks, {
    reply_markup: { inline_keyboard: buttons }
  });
});

bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data.startsWith('beli_')) {
    const index = parseInt(data.split('_')[1]);
    const list = loadProduk();
    const produk = list[index];
    if (!produk) return bot.sendMessage(chatId, '❌ Produk tidak ditemukan.');

    bot.sendPhoto(chatId, 'https://i.ibb.co/yfgYz5B/qris-contoh.jpg', {
      caption: `💳 Scan QRIS untuk membayar:\n\n📌 Produk: ${produk.nama}\n💰 Harga: Rp${produk.harga}`,
      reply_markup: {
        inline_keyboard: [[{ text: '✅ Saya Sudah Bayar', callback_data: 'konfirmasi_' + index }]]
      }
    });
  }

  if (data.startsWith('konfirmasi_')) {
    const index = parseInt(data.split('_')[1]);
    const list = loadProduk();
    const produk = list[index];
    if (!produk || produk.stok.length === 0) {
      return bot.sendMessage(chatId, '❌ Stok kosong atau produk tidak ditemukan.');
    }
    const kode = produk.stok.shift();
    saveProduk(list);
    bot.sendMessage(chatId, `✅ Pembayaran diterima! Berikut produk Anda:\n\n🔑 ${kode}`);
  }

  bot.answerCallbackQuery(query.id);
});

console.log("🤖 Bot aktif!");
