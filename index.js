
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const ADMIN_ID = process.env.ADMIN_ID;

let list = [
  { nama: "CapCut Pro", harga: 15000, stok: ["Kode-CAP1", "Kode-CAP2"], gambar: "capcut.jpg" },
  { nama: "Netflix Premium", harga: 25000, stok: ["Akun-NET1", "Akun-NET2"], gambar: "netflix.jpg" }
];

const userSteps = {};
const pendingPayments = {}; // simpan pembayaran menunggu konfirmasi admin

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const text = `Selamat datang ${msg.from.first_name || 'User'}!`;
  const keyboard = {
    keyboard: [['Produk'], ...(chatId.toString() === ADMIN_ID ? [['/admin']] : [])],
    resize_keyboard: true
  };
  bot.sendMessage(chatId, text, { reply_markup: keyboard });
});

bot.onText(/Produk/, (msg) => {
  const chatId = msg.chat.id;
  let teks = '📦 *LIST PRODUK*\n--------------------------\n';
  list.forEach((item, i) => {
    teks += `[${i + 1}] ${item.nama.toUpperCase()} - Rp${item.harga}\n`;
  });
  const tombol = [];
  for (let i = 0; i < list.length; i += 6) {
    tombol.push(list.slice(i, i + 6).map((_, j) => {
      return { text: (i + j + 1).toString(), callback_data: `beli_${i + j}` };
    }));
  }
  bot.sendMessage(chatId, teks, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: tombol }
  });
});

bot.onText(/\/admin/, (msg) => {
  if (msg.from.id.toString() !== ADMIN_ID) return;
  const keyboard = {
    inline_keyboard: [
      [{ text: '➕ Tambah Produk', callback_data: 'admin_tambah_produk' }],
      [{ text: '📦 Lihat Semua Produk', callback_data: 'admin_lihat_produk' }]
    ]
  };
  bot.sendMessage(msg.chat.id, '🔧 *Menu Admin*', {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
});

bot.on('callback_query', async (query) => {
  const data = query.data;
  const chatId = query.message.chat.id;

  if (data.startsWith('beli_')) {
    const index = parseInt(data.split('_')[1]);
    const produk = list[index];
    if (!produk) return;
    const imgPath = path.join(__dirname, 'images', produk.gambar);
    bot.sendPhoto(chatId, imgPath, {
      caption: `📌 *Produk:* ${produk.nama}\n💰 *Harga:* Rp${produk.harga}\n\nBerapa jumlah yang ingin Anda beli?`,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '1', callback_data: `jumlah_${index}_1` },
            { text: '2', callback_data: `jumlah_${index}_2` },
            { text: '3', callback_data: `jumlah_${index}_3` }
          ]
        ]
      }
    });
  }

  if (data.startsWith('jumlah_')) {
    const [, indexStr, qtyStr] = data.split('_');
    const index = parseInt(indexStr);
    const qty = parseInt(qtyStr);
    const produk = list[index];
    const total = produk.harga * qty;
    const qrisPath = path.join(__dirname, 'images', 'qris.png');
    pendingPayments[chatId] = { index, qty };
    bot.sendPhoto(chatId, qrisPath, {
      caption: `💳 Scan QRIS untuk membayar *Rp${total}* untuk *${qty}x ${produk.nama}*`,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Saya Sudah Bayar', callback_data: `konfirmasi_admin_${chatId}` }]
        ]
      }
    });
  }

  if (data.startsWith('konfirmasi_admin_')) {
    const buyerId = parseInt(data.split('_')[2]);
    const pending = pendingPayments[buyerId];
    if (!pending) return bot.sendMessage(chatId, '❌ Tidak ada pembayaran yang perlu dikonfirmasi.');
    const produk = list[pending.index];
    bot.sendMessage(ADMIN_ID, `🧾 Konfirmasi pembayaran:

👤 User ID: ${buyerId}
📦 Produk: ${produk.nama}
💳 Jumlah: ${pending.qty}

Konfirmasi?`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Konfirmasi', callback_data: `admin_ok_${buyerId}` }],
          [{ text: '❌ Tolak', callback_data: `admin_tolak_${buyerId}` }]
        ]
      }
    });
    bot.sendMessage(buyerId, '🕒 Menunggu konfirmasi admin...');
  }

  if (data.startsWith('admin_ok_')) {
    const buyerId = parseInt(data.split('_')[2]);
    const pending = pendingPayments[buyerId];
    if (!pending) return;
    const produk = list[pending.index];
    if (produk.stok.length >= pending.qty) {
      const kirim = produk.stok.splice(0, pending.qty).join('\n');
      bot.sendMessage(buyerId, `✅ Berikut produk Anda:\n\n${kirim}`);
    } else {
      bot.sendMessage(buyerId, '❌ Stok tidak cukup.');
    }
    delete pendingPayments[buyerId];
  }

  if (data.startsWith('admin_tolak_')) {
    const buyerId = parseInt(data.split('_')[2]);
    bot.sendMessage(buyerId, '❌ Pembayaran Anda ditolak oleh admin.');
    delete pendingPayments[buyerId];
  }

  if (data === 'admin_tambah_produk') {
    userSteps[chatId] = { step: 1, temp: {} };
    bot.sendMessage(chatId, '📝 Masukkan nama produk:');
  }

  if (data === 'admin_lihat_produk') {
    let teks = '📦 *Semua Produk:*

';
    list.forEach((p, i) => {
      teks += `${i + 1}. ${p.nama} - Rp${p.harga} (Stok: ${p.stok.length})\n`;
    });
    bot.sendMessage(chatId, teks, { parse_mode: 'Markdown' });
  }
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  if (msg.photo && userSteps[chatId]?.step === 4) {
    const fileId = msg.photo[msg.photo.length - 1].file_id;
    const fileLink = await bot.getFileLink(fileId);
    const namaGambar = `produk_${Date.now()}.jpg`;
    const filepath = path.join(__dirname, 'images', namaGambar);
    const writer = fs.createWriteStream(filepath);
    const response = await axios({ url: fileLink.href, method: 'GET', responseType: 'stream' });
    response.data.pipe(writer);
    writer.on('finish', () => {
      const data = userSteps[chatId].temp;
      data.gambar = namaGambar;
      list.push(data);
      bot.sendMessage(chatId, '✅ Produk berhasil ditambahkan!');
      delete userSteps[chatId];
    });
    return;
  }

  if (!userSteps[chatId]) return;

  const stepData = userSteps[chatId];
  if (stepData.step === 1) {
    stepData.temp.nama = msg.text;
    stepData.step = 2;
    return bot.sendMessage(chatId, '💰 Masukkan harga produk:');
  }
  if (stepData.step === 2) {
    stepData.temp.harga = parseInt(msg.text);
    stepData.step = 3;
    return bot.sendMessage(chatId, '📦 Masukkan stok produk (pisahkan dengan koma):');
  }
  if (stepData.step === 3) {
    stepData.temp.stok = msg.text.split(',').map(s => s.trim());
    stepData.step = 4;
    return bot.sendMessage(chatId, '🖼 Kirim foto produk:');
  }
});
