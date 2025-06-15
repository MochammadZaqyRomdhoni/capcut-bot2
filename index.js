
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const ADMIN_ID = 7006736189;
const pendingOrders = new Map();

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
        ? [['Tambah Produk', 'Hapus Produk'], ['Stok'], ['Broadcast']]
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

// Broadcast
bot.onText(/Broadcast/i, (msg) => {
  if (msg.from.id !== ADMIN_ID) return;
  bot.sendMessage(msg.chat.id, 'Ketik pesan yang ingin dibroadcast ke semua user:');
  bot.once('message', (m) => {
    // Simulasi: Broadcast ke admin sendiri saja (replace sesuai DB user)
    bot.sendMessage(ADMIN_ID, '📢 Broadcast:\n\n' + m.text);
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

  if (data.startsWith('qty_')) {
    const jumlah = parseInt(data.split('_')[1]);
    const order = pendingOrders.get(query.from.id);
    if (!order || order.stage !== 'menunggu_jumlah') return;

    const produk = loadProduk()[order.index];
    const total = produk.harga * jumlah;
    bot.sendMessage(query.from.id, `💳 Scan QRIS untuk membayar Rp${total} untuk ${jumlah}x ${produk.nama}`);
    pendingOrders.delete(query.from.id);
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
  const chatId = msg.chat.id;
  const list = loadProduk();
  if (list.length === 0) return bot.sendMessage(chatId, '📦 Belum ada produk.');

  let teks = `📦 LIST PRODUK\n------------------------\n`;
  list.forEach((p, i) => {
    teks += `[${i + 1}] ${p.nama.toUpperCase()} - Rp${p.harga}\n`;
  });

  const rows = [];
  for (let i = 0; i < list.length; i += 6) {
    const row = [];
    for (let j = i; j < i + 6 && j < list.length; j++) {
      row.push({ text: String(j + 1) });
    }
    rows.push(row);
  }

  bot.sendMessage(chatId, teks, {
    reply_markup: {
      keyboard: rows.concat([[{ text: 'Menu' }]]),
      resize_keyboard: true,
      one_time_keyboard: true,
    }
  });

  pendingOrders.set(msg.from.id, { stage: 'menunggu_pilihan' });
});

bot.on('message', (msg) => {
  const text = msg.text;
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  const state = pendingOrders.get(userId);
  if (!state || state.stage !== 'menunggu_pilihan') return;

  const pilih = parseInt(text);
  const list = loadProduk();
  if (isNaN(pilih) || pilih < 1 || pilih > list.length) {
    return bot.sendMessage(chatId, '❌ Nomor tidak valid. Silakan pilih sesuai daftar produk.');
  }

  const produk = list[pilih - 1];
  if (!produk) return bot.sendMessage(chatId, '❌ Produk tidak ditemukan.');

  pendingOrders.set(userId, { stage: 'menunggu_jumlah', index: pilih - 1 });

  bot.sendMessage(chatId, `📌 Produk: ${produk.nama}\nBerapa jumlah yang ingin Anda beli?`, {
    reply_markup: {
      inline_keyboard: [[
        { text: '1', callback_data: 'qty_1' },
        { text: '2', callback_data: 'qty_2' },
        { text: '3', callback_data: 'qty_3' }
      ]]
    }
  });
});

console.log('🤖 Bot aktif!');
