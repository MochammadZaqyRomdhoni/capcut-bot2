require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const ADMIN_ID = process.env.ADMIN_ID;
const produkFile = './produk.json';
const userFile = './users.json';

let produkList = fs.existsSync(produkFile) ? JSON.parse(fs.readFileSync(produkFile)) : [];
let userList = fs.existsSync(userFile) ? JSON.parse(fs.readFileSync(userFile)) : [];

// 🔄 Simpan ke file
const saveProduk = () => fs.writeFileSync(produkFile, JSON.stringify(produkList, null, 2));
const saveUsers = () => fs.writeFileSync(userFile, JSON.stringify(userList, null, 2));

// 🧾 Command /start
bot.onText(/\/start/, (msg) => {
  const id = msg.chat.id;
  if (!userList.includes(id)) {
    userList.push(id);
    saveUsers();
  }
  bot.sendMessage(id, `👋 Selamat datang, ${msg.from.first_name || 'User'}!`, {
    reply_markup: {
      keyboard: [['🛍 Produk']],
      resize_keyboard: true
    }
  });
});

// 📦 Tampilkan produk
bot.onText(/Produk/, (msg) => {
  const id = msg.chat.id;
  if (produkList.length === 0) return bot.sendMessage(id, '❌ Belum ada produk.');
  let teks = '📦 *LIST PRODUK*\n--------------------------\n';
  produkList.forEach((p, i) => teks += `[${i + 1}] ${p.nama} - Rp${p.harga}\n`);
  const tombol = [];
  for (let i = 0; i < produkList.length; i += 3) {
    tombol.push(produkList.slice(i, i + 3).map((_, j) => {
      return { text: (i + j + 1).toString(), callback_data: `beli_${i + j}` };
    }));
  }
  bot.sendMessage(id, teks, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: tombol }
  });
});

// 📸 Saat user pilih produk
bot.on('callback_query', async (query) => {
  const data = query.data;
  const id = query.message.chat.id;

  // 🛒 User pilih produk
  if (data.startsWith('beli_')) {
    const i = parseInt(data.split('_')[1]);
    const p = produkList[i];
    if (!p) return;

    const img = path.join(__dirname, 'images', p.gambar || '');
    if (!fs.existsSync(img)) return bot.sendMessage(id, '❌ Gambar tidak ditemukan.');

    return bot.sendPhoto(id, img, {
      caption: `📌 *${p.nama}*\n💰 Harga: Rp${p.harga}\n\nPilih jumlah beli:`,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '1', callback_data: `qty_${i}_1` },
          { text: '2', callback_data: `qty_${i}_2` },
          { text: '3', callback_data: `qty_${i}_3` }
        ]]
      }
    });
  }

  // 💰 User pilih jumlah beli
  if (data.startsWith('qty_')) {
    const [, i, qty] = data.split('_');
    const p = produkList[parseInt(i)];
    const total = p.harga * parseInt(qty);
    const qr = path.join(__dirname, 'images', 'qris.png');

    return bot.sendPhoto(id, qr, {
      caption: `🧾 Total Bayar: *Rp${total}*\n🛍 Produk: ${qty}x ${p.nama}\n\nKlik tombol di bawah jika sudah membayar.`,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Saya Sudah Bayar', callback_data: `konfirmasi_${i}_${query.from.id}_${qty}` }]
        ]
      }
    });
  }

  // ✅ User klik "sudah bayar", verifikasi admin
  if (data.startsWith('konfirmasi_')) {
    const [, i, uid, qty] = data.split('_');
    const p = produkList[parseInt(i)];
    const info = `🛒 *Verifikasi Pembelian*\n\n👤 User ID: ${uid}\n📦 Produk: ${p.nama}\n📦 Jumlah: ${qty}`;
    return bot.sendMessage(ADMIN_ID, info, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Kirim Produk', callback_data: `kirim_${i}_${uid}_${qty}` }]
        ]
      }
    });
  }

  // 📤 Admin verifikasi kirim produk
  if (data.startsWith('kirim_')) {
    const [, i, uid, qty] = data.split('_');
    const p = produkList[parseInt(i)];
    const jumlah = parseInt(qty);

    if (p.stok.length < jumlah) {
      return bot.sendMessage(ADMIN_ID, '❌ Stok tidak cukup.');
    }

    const stokDikirim = p.stok.splice(0, jumlah);
    saveProduk();
    return bot.sendMessage(uid, `✅ Berikut produk Anda:\n\n${stokDikirim.join('\n')}`);
  }

  // ➕ Admin tambah produk
  if (data === 'tambah_produk') {
    return bot.sendMessage(ADMIN_ID, '📝 Kirim format:\n`Nama | Harga | stok1,stok2 | nama_gambar.jpg`', { parse_mode: 'Markdown' });
  }

  // 📢 Admin broadcast
  if (data === 'broadcast') {
    return bot.sendMessage(ADMIN_ID, '📨 Ketik pesan yang ingin dibroadcast ke semua user:');
  }
});

// 📝 Tambah produk via text
bot.on('message', (msg) => {
  if (msg.chat.id != ADMIN_ID || !msg.text || msg.text.startsWith('/')) return;

  // Broadcast ke semua user
  if (msg.text.startsWith('📨')) return;

  if (msg.text.includes('|')) {
    const [nama, harga, stokStr, gambar] = msg.text.split('|').map(s => s.trim());
    const stok = stokStr.split(',').map(s => s.trim());
    produkList.push({ nama, harga: parseInt(harga), stok, gambar });
    saveProduk();
    return bot.sendMessage(ADMIN_ID, '✅ Produk berhasil ditambahkan!');
  }

  // Broadcast manual
  userList.forEach(uid => {
    bot.sendMessage(uid, `📢 *Broadcast dari Admin:*\n\n${msg.text}`, { parse_mode: 'Markdown' });
  });
  bot.sendMessage(ADMIN_ID, '✅ Broadcast terkirim ke semua user!');
});

// 🔧 Menu Admin
bot.onText(/\/admin/, (msg) => {
  if (msg.chat.id != ADMIN_ID) return;
  bot.sendMessage(ADMIN_ID, '🛠 Menu Admin:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '➕ Tambah Produk', callback_data: 'tambah_produk' }],
        [{ text: '📢 Broadcast ke Semua User', callback_data: 'broadcast' }]
      ]
    }
  });
});
