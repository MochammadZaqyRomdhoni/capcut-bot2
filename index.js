const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const TOKEN = process.env.TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const bot = new TelegramBot(TOKEN, { polling: true });

const produkFile = './produk.json';
let produkList = [];

function loadProduk() {
  if (fs.existsSync(produkFile)) {
    produkList = JSON.parse(fs.readFileSync(produkFile));
  } else {
    produkList = [];
    fs.writeFileSync(produkFile, JSON.stringify(produkList, null, 2));
  }
}

function simpanProduk() {
  fs.writeFileSync(produkFile, JSON.stringify(produkList, null, 2));
}

loadProduk();

bot.onText(/\/start/, (msg) => {
  const id = msg.from.id;
  let teks = `👋 Selamat datang di *Capcut Bot*!\n\n`;
  teks += `Gunakan tombol di bawah untuk melihat produk.`;
  let opts = {
    parse_mode: 'Markdown',
    reply_markup: {
      keyboard: [['🛍 Lihat Produk']],
      resize_keyboard: true
    }
  };
  if (id.toString() === ADMIN_ID) {
    opts.reply_markup.keyboard.push(['➕ Tambah Produk', '📢 Broadcast']);
  }
  bot.sendMessage(id, teks, opts);
});

bot.on('message', async (msg) => {
  const id = msg.from.id;
  const text = msg.text;

  if (text === '🛍 Lihat Produk') {
    if (produkList.length === 0) return bot.sendMessage(id, 'Belum ada produk tersedia.');
    let teks = `📦 *Semua Produk:*\n\n`;
    produkList.forEach((p, i) => {
      teks += `${i + 1}. *${p.nama}* - Rp${p.harga}\n`;
    });
    bot.sendMessage(id, teks, { parse_mode: 'Markdown' });
  }

  if (text === '➕ Tambah Produk' && id.toString() === ADMIN_ID) {
    bot.sendMessage(id, 'Kirim nama produk baru:');
    bot.once('message', (msg2) => {
      const nama = msg2.text;
      bot.sendMessage(id, 'Kirim harga produk (angka saja):');
      bot.once('message', (msg3) => {
        const harga = parseInt(msg3.text);
        if (isNaN(harga)) return bot.sendMessage(id, 'Harga tidak valid!');
        produkList.push({ nama, harga });
        simpanProduk();
        bot.sendMessage(id, `Produk *${nama}* berhasil ditambahkan.`, { parse_mode: 'Markdown' });
      });
    });
  }

  if (text === '📢 Broadcast' && id.toString() === ADMIN_ID) {
    bot.sendMessage(id, 'Ketik pesan broadcast yang ingin dikirim ke semua user:');
    bot.once('message', (msg2) => {
      const pesan = msg2.text;
      // Simulasi kirim ke user yang sudah pernah start
      bot.sendMessage(id, '📨 Pesan broadcast dikirim ke semua user (simulasi).');
    });
  }
});
