require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const ADMIN_ID = process.env.ADMIN_ID;

let users = new Set(); // untuk broadcast
let list = /* Muat dari produk.json atau bisa start hardcoded */;
const userSteps = {};
const pendingPayments = {};

function loadProduk() {
  try { return JSON.parse(fs.readFileSync('produk.json')); }
  catch { return []; }
}
function saveProduk(data) {
  fs.writeFileSync('produk.json', JSON.stringify(data, null, 2));
}
list = loadProduk();

// /start
bot.onText(/\/start/, msg => {
  users.add(msg.chat.id);
  const isAdmin = msg.from.id.toString() === ADMIN_ID;
  const keyboard = {
    keyboard: isAdmin
      ? [['🛒 Produk','📢 Broadcast'], ['➕ Tambah Produk','📦 Lihat Stok']]
      : [['🛒 Produk']],
    resize_keyboard: true
  };
  bot.sendMessage(msg.chat.id, `Halo, ${msg.from.first_name}!`, { reply_markup: keyboard });
});

// Broadcast
bot.onText(/📢 Broadcast/, msg => {
  if (msg.from.id.toString() !== ADMIN_ID) return;
  bot.sendMessage(msg.chat.id,'Ketik pesan untuk broadcast:');
  userSteps[msg.chat.id] = { step: 'bcast' };
});
bot.on('message', msg => {
  const step = userSteps[msg.chat.id];
  if (step && step.step === 'bcast') {
    delete userSteps[msg.chat.id];
    users.forEach(u => bot.sendMessage(u, `📢 Broadcast Admin:\n\n${msg.text}`));
    bot.sendMessage(msg.chat.id, '✅ Broadcast terkirim.');
  }
});

// Tambah produk
bot.onText(/➕ Tambah Produk/, msg => {
  if (msg.from.id.toString() !== ADMIN_ID) return;
  userSteps[msg.chat.id] = { step: 1, temp: {} };
  bot.sendMessage(msg.chat.id, '📝 Nama produk:');
});
bot.on('photo', async msg => {
  const step = userSteps[msg.chat.id];
  if (!step || step.step !== 4) return;
  const fileId = msg.photo.pop().file_id;
  const url = await bot.getFileLink(fileId);
  const gambar = `produk_${Date.now()}.jpg`;
  const dest = path.join(__dirname,'images',gambar);
  (await axios({url, responseType:'stream'})).data.pipe(fs.createWriteStream(dest))
    .on('finish', () => {
      const p = step.temp;
      p.gambar = gambar;
      list.push(p);
      saveProduk(list);
      bot.sendMessage(msg.chat.id, '✅ Produk berhasil ditambahkan!');
      delete userSteps[msg.chat.id];
    });
});
bot.on('message', msg => {
  const step = userSteps[msg.chat.id];
  if (!step) return;
  if (step.step === 1) { step.temp.nama = msg.text; step.step=2; return bot.sendMessage(msg.chat.id,'💰 Harga produk (angka):'); }
  if (step.step === 2) { step.temp.harga = parseInt(msg.text); step.step=3; return bot.sendMessage(msg.chat.id,'📦 Stok (pisahkan koma):'); }
  if (step.step === 3) { step.temp.stok = msg.text.split(',').map(s=>s.trim()); step.step=4; return bot.sendMessage(msg.chat.id,'🖼 Kirim foto produk:'); }
});

// Lihat stok/admin
bot.onText(/📦 Lihat Stok/, msg => {
  if (msg.from.id.toString() !== ADMIN_ID) return;
  const teks = list.map((p,i)=>`${i+1}. ${p.nama} – Rp${p.harga} (stok: ${p.stok.length})`).join('\n') || '– Belum ada produk.';
  bot.sendMessage(msg.chat.id, `📦 Stok Produk:\n${teks}`);
});

// Produk
bot.onText(/🛒 Produk/, msg => {
  const teks = list.map((p,i)=>`[${i+1}] ${p.nama} – Rp${p.harga}`).join('\n');
  const rows = []; for(let i=0;i<list.length;i+=3) rows.push(list.slice(i,i+3).map((_,j)=>({text:String(i+j+1),callback_data:`beli_${i+j}`})));
  bot.sendMessage(msg.chat.id, `📦 Daftar Produk:\n${teks}`, { reply_markup:{inline_keyboard:rows} });
});

// Callback handler
bot.on('callback_query', async q => {
  const data = q.data, cid = q.message.chat.id, uid = q.from.id;
  if (data.startsWith('beli_')) {
    const idx = +data.split('_')[1]; const p=list[idx];
    const img = path.join(__dirname,'images',p.gambar);
    return bot.sendPhoto(cid, fs.createReadStream(img), {
      caption:`📌 ${p.nama}\n💰 Rp${p.harga}\n\nJumlah?`, reply_markup:{inline_keyboard:[[{text:'1',callback_data:`jumlah_${idx}_1`},{text:'2',callback_data:`jumlah_${idx}_2`},{text:'3',callback_data:`jumlah_${idx}_3`}]]}
    });
  }
  if (data.startsWith('jumlah_')) {
    const [_,idx,qty] = data.split('_'); const p=list[idx];
    const total = p.harga * qty;
    pendingPayments[uid] = { idx, qty };
    return bot.sendPhoto(cid, fs.createReadStream(path.join(__dirname,'images','qris.png')), {
      caption:`💳 Rp${total} untuk ${qty}x ${p.nama}\nKlik👇`, reply_markup:{inline_keyboard:[[{text:'✅ Saya Sudah Bayar',callback_data:`konf_${uid}`}]]}
    });
  }
  if (data.startsWith('konf_')) {
    const userId = +data.split('_')[1];
    const pay = pendingPayments[userId];
    if (!pay) return bot.answerCallbackQuery(q.id,'⚠️ tidak ada pembayaran');
    const p = list[pay.idx];
    return bot.sendMessage(ADMIN_ID,
      `🧾 Klaim bayar:\nUser: @${q.from.username||q.from.first_name}\nProduk: ${p.nama}\nQty: ${pay.qty}`,
      { reply_markup:{inline_keyboard:[[{text:'✅ Kirim',callback_data:`ok_${userId}`},{text:'❌ Tolak',callback_data:`no_${userId}`}]]}
    });
  }
  if (data.startsWith('ok_')) {
    const userId = +data.split('_')[1], pay = pendingPayments[userId], p=list[pay.idx];
    const kode = p.stok.splice(0,pay.qty).join('\n') || '– Stok habis';
    saveProduk(list);
    bot.sendMessage(userId, `✅ Berikut produk Anda:\n${kode}`);
    delete pendingPayments[userId];
  }
  if (data.startsWith('no_')) {
    const userId = +data.split('_')[1];
    bot.sendMessage(userId, '❌ Pembayaran ditolak');
    delete pendingPayments[userId];
  }
  bot.answerCallbackQuery(q.id);
});
