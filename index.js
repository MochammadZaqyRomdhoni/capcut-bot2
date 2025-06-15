require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const ADMIN_ID = process.env.ADMIN_ID;

let produk = require('./produk.json');
let pembelian = {};

bot.onText(/\/start/, (msg) => {
  const isAdmin = msg.from.id.toString() === ADMIN_ID;
  const keyboard = [['Produk']];
  if (isAdmin) keyboard.push(['➕ Tambah Produk', '📢 Broadcast']);
  bot.sendMessage(msg.chat.id, `Selamat datang, ${msg.from.first_name || 'User'}!`, {
    reply_markup: { keyboard, resize_keyboard: true }
  });
});

bot.on('message', (msg) => {
  if (msg.text === 'Produk') tampilkanProduk(msg.chat.id);
  if (msg.text === '➕ Tambah Produk' && msg.from.id.toString() === ADMIN_ID) {
    bot.sendMessage(msg.chat.id, 'Ketik nama produk:');
    pembelian[msg.chat.id] = { step: 'nama' };
  }
  if (msg.text === '📢 Broadcast' && msg.from.id.toString() === ADMIN_ID) {
    bot.sendMessage(msg.chat.id, 'Ketik pesan broadcast:');
    pembelian[msg.chat.id] = { step: 'broadcast' };
  }
});

bot.on('photo', (msg) => {
  const state = pembelian[msg.chat.id];
  if (!state || state.step !== 'gambar') return;
  const fileId = msg.photo.pop().file_id;
  state.gambar = fileId;
  bot.sendMessage(msg.chat.id, 'Ketik harga produk:');
  state.step = 'harga';
});

bot.on('text', (msg) => {
  const state = pembelian[msg.chat.id];
  if (!state) return;

  if (state.step === 'nama') {
    state.nama = msg.text;
    bot.sendMessage(msg.chat.id, 'Silakan kirim gambar produk (upload gambar):');
    state.step = 'gambar';
  } else if (state.step === 'harga') {
    state.harga = parseInt(msg.text);
    bot.sendMessage(msg.chat.id, 'Ketik stok produk, pisahkan dengan koma (misal: kode1,kode2):');
    state.step = 'stok';
  } else if (state.step === 'stok') {
    state.stok = msg.text.split(',').map(s => s.trim());
    produk.push({
      nama: state.nama,
      harga: state.harga,
      stok: state.stok,
      gambar: state.gambar
    });
    fs.writeFileSync('produk.json', JSON.stringify(produk, null, 2));
    bot.sendMessage(msg.chat.id, '✅ Produk berhasil ditambahkan.');
    delete pembelian[msg.chat.id];
  } else if (state.step === 'broadcast') {
    broadcast(msg.text, msg.chat.id);
    delete pembelian[msg.chat.id];
  }
});

function tampilkanProduk(chatId) {
  let teks = '📦 *Semua Produk:*

';
  produk.forEach((p, i) => {
    teks += `🔢 ${i + 1}. *${p.nama}* - Rp${p.harga}
`;
  });
  const tombol = [];
  for (let i = 0; i < produk.length; i += 3) {
    tombol.push(produk.slice(i, i + 3).map((_, j) => ({
      text: `${i + j + 1}`, callback_data: `beli_${i + j}`
    })));
  }
  bot.sendMessage(chatId, teks, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: tombol }
  });
}

bot.on('callback_query', async (query) => {
  const data = query.data;
  const chatId = query.message.chat.id;
  if (data.startsWith('beli_')) {
    const index = parseInt(data.split('_')[1]);
    const p = produk[index];
    if (!p) return;
    const foto = p.gambar;
    bot.sendPhoto(chatId, foto, {
      caption: `📌 *${p.nama}*
💰 Rp${p.harga}

Pilih jumlah:`,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[1, 2, 3].map(n => ({
          text: n.toString(),
          callback_data: `qty_${index}_${n}`
        }))]
      }
    });
  } else if (data.startsWith('qty_')) {
    const [, index, qty] = data.split('_');
    const total = produk[index].harga * parseInt(qty);
    bot.sendMessage(chatId, `💳 Total Rp${total}
Silakan scan QRIS lalu klik tombol di bawah:`,
      {
        reply_markup: {
          inline_keyboard: [[{
            text: '✅ Saya Sudah Bayar',
            callback_data: `konfirmasi_${index}_${qty}_${chatId}`
          }]]
        }
      });
  } else if (data.startsWith('konfirmasi_')) {
    const [, index, qty, userId] = data.split('_');
    const p = produk[index];
    if (p.stok.length < qty) return bot.sendMessage(chatId, '❌ Stok tidak cukup.');
    const kirim = p.stok.splice(0, qty).join('
');
    fs.writeFileSync('produk.json', JSON.stringify(produk, null, 2));
    bot.sendMessage(ADMIN_ID, `💰 User ID ${userId} ingin membeli:
${qty}x ${p.nama}

Ketik /kirim_${userId}_${index}_${qty} untuk verifikasi.`);
    bot.sendMessage(userId, '🕒 Menunggu verifikasi admin...');
  }
});

bot.onText(/\/kirim_(\d+)_(\d+)_(\d+)/, (msg, match) => {
  if (msg.from.id.toString() !== ADMIN_ID) return;
  const [_, userId, index, qty] = match;
  const p = produk[parseInt(index)];
  const items = p.stok.splice(0, parseInt(qty)).join('\n');
  fs.writeFileSync('produk.json', JSON.stringify(produk, null, 2));
  bot.sendMessage(userId, `✅ Berikut produk Anda:

${items}`);
  bot.sendMessage(msg.chat.id, '✅ Produk telah dikirim ke pembeli.');
});

function broadcast(text, fromId) {
  bot.getUpdates().then((updates) => {
    const userIds = new Set();
    updates.forEach(update => {
      if (update.message) userIds.add(update.message.chat.id);
      if (update.callback_query) userIds.add(update.callback_query.from.id);
    });
    userIds.forEach(uid => {
      if (uid.toString() !== ADMIN_ID) {
        bot.sendMessage(uid, `📢 *Pesan dari Admin:*

${text}`, { parse_mode: 'Markdown' });
      }
    });
    bot.sendMessage(fromId, '✅ Broadcast terkirim ke semua user.');
  });
}
