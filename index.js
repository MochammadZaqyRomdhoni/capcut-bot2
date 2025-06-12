const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

require('dotenv').config();
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

const ADMIN_ID = 7006736189;
const DATA_FILE = 'produk.json';

let produk = [];
if (fs.existsSync(DATA_FILE)) {
  produk = JSON.parse(fs.readFileSync(DATA_FILE));
}

function simpanProduk() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(produk, null, 2));
}

function generateProdukList(page = 1, perPage = 15) {
  const start = (page - 1) * perPage;
  const end = start + perPage;
  const pageItems = produk.slice(start, end);
  let text = '┌── LIST PRODUK ──┐\n';
  text += `page ${page} / ${Math.ceil(produk.length / perPage)}\n`;
  pageItems.forEach((p, i) => {
    const index = start + i + 1;
    text += `[${index}] ${p.nama.toUpperCase()}\n`;
  });
  text += '└───────────────┘';
  return text;
}

function generateProdukButtons(page = 1, perPage = 15) {
  const start = (page - 1) * perPage;
  const end = start + perPage;
  const pageItems = produk.slice(start, end);
  const buttons = [];
  for (let i = 0; i < pageItems.length; i += 3) {
    buttons.push(
      pageItems.slice(i, i + 3).map((p, idx) => {
        const index = start + i + idx;
        return { text: (index + 1).toString(), callback_data: `produk_${index}` };
      })
    );
  }
  const totalPages = Math.ceil(produk.length / perPage);
  if (totalPages > 1) {
    const navRow = [];
    if (page > 1) navRow.push({ text: '⬅️', callback_data: `page_${page - 1}` });
    if (page < totalPages) navRow.push({ text: '➡️', callback_data: `page_${page + 1}` });
    buttons.push(navRow);
  }
  return { reply_markup: { inline_keyboard: buttons } };
}

bot.onText(/\\/start/, (msg) => {
  const id = msg.chat.id;
  const buttons = [
    [{ text: '📦 List Produk', callback_data: 'list_produk' }]
  ];
  if (msg.from.id === ADMIN_ID) {
    buttons.push(
      [{ text: '➕ Tambah Produk', callback_data: 'admin_tambah' }],
      [{ text: '✏️ Edit Produk', callback_data: 'admin_edit' }],
      [{ text: '❌ Hapus Produk', callback_data: 'admin_hapus' }]
    );
  }
  bot.sendMessage(id, 'Selamat datang! Silakan pilih menu:', {
    reply_markup: { inline_keyboard: buttons }
  });
});

bot.onText(/\\/stok/, (msg) => {
  let text = '*Stok Produk:*
';
  produk.forEach(p => {
    text += `- ${p.nama} — Stok: ${p.stok}, Harga: ${p.harga}
`;
  });
  bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
});

bot.on('callback_query', (q) => {
  const msg = q.message;
  const data = q.data;

  if (data === 'list_produk') {
    const text = generateProdukList(1);
    bot.editMessageText(text, {
      chat_id: msg.chat.id,
      message_id: msg.message_id,
      ...generateProdukButtons(1)
    });
  } else if (data.startsWith('page_')) {
    const page = parseInt(data.split('_')[1]);
    const text = generateProdukList(page);
    bot.editMessageText(text, {
      chat_id: msg.chat.id,
      message_id: msg.message_id,
      ...generateProdukButtons(page)
    });
  } else if (data.startsWith('produk_')) {
    const index = parseInt(data.split('_')[1]);
    const p = produk[index];
    bot.answerCallbackQuery(q.id);
    bot.sendMessage(msg.chat.id, `📦 *${p.nama}*
💰 Harga: ${p.harga}
📦 Stok: ${p.stok}`, { parse_mode: 'Markdown' });
  } else if (data === 'admin_tambah') {
    if (q.from.id !== ADMIN_ID) return bot.answerCallbackQuery(q.id, { text: 'Akses ditolak' });
    bot.sendMessage(q.message.chat.id, 'Kirim data produk dengan format:
Nama|Harga|Stok');
    bot.once('message', (m) => {
      const [nama, harga, stok] = m.text.split('|');
      if (!nama || !harga || !stok) return bot.sendMessage(m.chat.id, 'Format salah.');
      produk.push({ nama: nama.trim(), harga: harga.trim(), stok: parseInt(stok.trim()) });
      simpanProduk();
      bot.sendMessage(m.chat.id, `Produk "${nama.trim()}" ditambahkan.`);
    });
  }
});

console.log('Bot jalan di port 8080');
