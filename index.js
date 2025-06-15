require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const ADMIN_ID = process.env.ADMIN_ID;

let list = JSON.parse(fs.readFileSync('./produk.json'));

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, `Selamat datang ${msg.from.first_name || 'User'}!`, {
    reply_markup: {
      keyboard: [['Produk'], ['📢 Broadcast']],
      resize_keyboard: true
    }
  });
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

bot.on('callback_query', (query) => {
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
        inline_keyboard: [[
          { text: '1', callback_data: `jumlah_${index}_1` },
          { text: '2', callback_data: `jumlah_${index}_2` },
          { text: '3', callback_data: `jumlah_${index}_3` }
        ]]
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
    bot.sendPhoto(chatId, qrisPath, {
      caption: `💳 Scan QRIS untuk membayar *Rp${total}* untuk *${qty}x ${produk.nama}*`,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ Saya Sudah Bayar', callback_data: `konfirmasi_${index}_${query.from.id}_${qty}` }
        ]]
      }
    });
  }

  if (data.startsWith('konfirmasi_')) {
    const [, indexStr, userIdStr, qtyStr] = data.split('_');
    const index = parseInt(indexStr);
    const qty = parseInt(qtyStr);
    const produk = list[index];

    if (produk.stok.length >= qty) {
      const kirim = produk.stok.slice(0, qty).join('\n');
      bot.sendMessage(ADMIN_ID, `User ${userIdStr} telah membayar. Kirimkan produk?`, {
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Kirim Produk', callback_data: `kirim_${index}_${userIdStr}_${qty}` }
          ]]
        }
      });
    } else {
      bot.sendMessage(chatId, '❌ Stok tidak cukup.');
    }
  }

  if (data.startsWith('kirim_')) {
    const [, indexStr, userIdStr, qtyStr] = data.split('_');
    const index = parseInt(indexStr);
    const userId = parseInt(userIdStr);
    const qty = parseInt(qtyStr);
    const produk = list[index];

    const kirim = produk.stok.splice(0, qty).join('\n');
    bot.sendMessage(userId, `✅ Berikut produk Anda:\n\n${kirim}`);
    fs.writeFileSync('./produk.json', JSON.stringify(list, null, 2));
  }
});

bot.onText(/📢 Broadcast/, (msg) => {
  if (msg.from.id.toString() !== ADMIN_ID) return;
  bot.sendMessage(msg.chat.id, 'Ketik pesan broadcast yang ingin dikirim:');
  bot.once('message', (res) => {
    if (res.chat.id === msg.chat.id) {
      bot.getUpdates().then(updates => {
        const users = [...new Set(updates.map(u => u.message?.chat.id).filter(Boolean))];
        users.forEach(id => {
          bot.sendMessage(id, `📢 *Broadcast:*
${res.text}`, { parse_mode: 'Markdown' });
        });
      });
    }
  });
});
