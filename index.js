
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const ADMIN_ID = 7006736189;

// Load & Simpan Produk
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

// Start
bot.onText(/\/start/, (msg) => {
  const isAdmin = msg.from.id === ADMIN_ID;
  bot.sendMessage(msg.chat.id, `Selamat datang ${isAdmin ? 'Admin' : 'User'}!`, {
    reply_markup: {
      keyboard: isAdmin
        ? [['Tambah Produk', 'Hapus Produk'], ['Stok']]
        : [['Produk']],
      resize_keyboard: true,
    },
  });
});

// Tambah Produk
bot.onText(/tambah produk|Tambah Produk/i, (msg) => {
  if (msg.from.id !== ADMIN_ID) return;
  bot.sendMessage(msg.chat.id, 'Ketik dengan format:\nNama,Harga,KODE1,KODE2,...');
  bot.once('message', (m) => {
    const [nama, harga, ...stok] = m.text.split(',');
    if (!nama || !harga || stok.length === 0) {
      return bot.sendMessage(m.chat.id, 'Format salah. Contoh:\nNetflix,25000,KODE1,KODE2');
    }
    const list = loadProduk();
    list.push({ nama: nama.trim(), harga: parseInt(harga), stok: stok.map(s => s.trim()) });
    saveProduk(list);
    bot.sendMessage(m.chat.id, `✅ Produk "${nama}" ditambahkan (${stok.length} stok).`);
  });
});

// Hapus Produk
bot.onText(/hapus produk|Hapus Produk/i, (msg) => {
  if (msg.from.id !== ADMIN_ID) return;
  const list = loadProduk();
  if (list.length === 0) return bot.sendMessage(msg.chat.id, '📦 Belum ada produk.');
  const options = {
    reply_markup: {
      inline_keyboard: list.map((p, i) => [{ text: p.nama, callback_data: 'hapus_' + i }])
    }
  };
  bot.sendMessage(msg.chat.id, 'Pilih produk yang ingin dihapus:', options);
});

// Handle callback query
bot.on('callback_query', (query) => {
  const data = query.data;
  const chatId = query.message.chat.id;
  const list = loadProduk();

  if (data.startsWith('hapus_')) {
    const index = parseInt(data.split('_')[1]);
    const hapus = list.splice(index, 1);
    saveProduk(list);
    return bot.editMessageText(`🗑️ Produk "${hapus[0].nama}" dihapus.`, {
      chat_id: chatId,
      message_id: query.message.message_id,
    });
  }

  // Beli
  if (data.startsWith('beli_')) {
    const index = parseInt(data.split('_')[1]);
    const produk = list[index];
    if (!produk) return bot.sendMessage(chatId, '❌ Produk tidak ditemukan.');

    const qrisPath = path.resolve(__dirname, 'images (2).png');
    bot.sendPhoto(chatId, qrisPath, {
      caption: `💳 Scan QRIS untuk membayar:\n\n📌 Produk: ${produk.nama}\n💰 Harga: Rp${produk.harga}`,
      reply_markup: {
        inline_keyboard: [[{ text: '✅ Saya Sudah Bayar', callback_data: 'konfirmasi_' + index + '_' + query.from.id }]]
      }
    });
  }

  // Konfirmasi: Kirim notifikasi ke admin untuk verifikasi
  if (data.startsWith('konfirmasi_')) {
    const [, indexStr, userIdStr] = data.split('_');
    const index = parseInt(indexStr);
    const userId = parseInt(userIdStr);
    const produk = list[index];
    if (!produk) return bot.sendMessage(chatId, '❌ Produk tidak ditemukan.');

    const confirmText = `📥 User [${query.from.first_name}](tg://user?id=${userId}) mengklaim pembayaran:\n\n📦 Produk: ${produk.nama}\n💰 Harga: Rp${produk.harga}`;
    bot.sendMessage(ADMIN_ID, confirmText, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Kirim Produk', callback_data: 'approve_' + index + '_' + userId },
            { text: '❌ Tolak', callback_data: 'reject_' + userId }
          ]
        ]
      }
    });
    bot.sendMessage(userId, '⏳ Menunggu verifikasi pembayaran dari admin...');
  }

  // Admin menyetujui kirim produk
  if (data.startsWith('approve_')) {
    const [, indexStr, userIdStr] = data.split('_');
    const index = parseInt(indexStr);
    const userId = parseInt(userIdStr);
    const produk = list[index];
    if (!produk || produk.stok.length === 0) {
      return bot.sendMessage(ADMIN_ID, '❌ Stok habis atau produk tidak ditemukan.');
    }
    const kode = produk.stok.shift();
    saveProduk(list);
    bot.sendMessage(userId, `✅ Pembayaran diterima!\n\n🔑 Produk Anda:\n\n${kode}`);
    bot.sendMessage(ADMIN_ID, '✅ Produk dikirim ke pembeli.');
  }

  // Admin menolak
  if (data.startsWith('reject_')) {
    const userId = parseInt(data.split('_')[1]);
    bot.sendMessage(userId, '❌ Pembayaran ditolak oleh admin.');
    bot.sendMessage(ADMIN_ID, '❌ Pembayaran ditolak.');
  }

  bot.answerCallbackQuery(query.id);
});

// Lihat Stok
bot.onText(/Stok/i, (msg) => {
  const list = loadProduk();
  if (list.length === 0) return bot.sendMessage(msg.chat.id, '📦 Belum ada produk.');
  let teks = '📦 Stok Produk:\n\n';
  list.forEach((p, i) => {
    teks += `[${i + 1}] ${p.nama} - Rp${p.harga} (Stok: ${p.stok.length})\n`;
  });
  bot.sendMessage(msg.chat.id, teks);
});

// Tampilkan Produk
bot.onText(/Produk/i, (msg) => {
  const list = loadProduk();
  if (list.length === 0) return bot.sendMessage(msg.chat.id, '📦 Belum ada produk.');
  const buttons = list.map((p, i) => [{ text: `${p.nama} - Rp${p.harga}`, callback_data: 'beli_' + i }]);
  bot.sendMessage(msg.chat.id, '🛒 Pilih produk yang ingin dibeli:', {
    reply_markup: { inline_keyboard: buttons }
  });
});

console.log('🤖 Bot aktif!');
