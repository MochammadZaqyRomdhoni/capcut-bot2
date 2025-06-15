require('dotenv').config();
const fs = require('fs');
const { Telegraf, Markup } = require('telegraf');
const bot = new Telegraf(process.env.BOT_TOKEN);

const ADMIN_ID = process.env.ADMIN_ID;
let produk = require('./produk.json');
let users = new Set();
let pembelian = {};

function simpanProduk() {
  fs.writeFileSync('./produk.json', JSON.stringify(produk, null, 2));
}

function formatProdukList() {
  if (produk.length === 0) return '📦 *Belum ada produk.*';
  let teks = '📦 *Daftar Produk:*

';
  produk.forEach((p, i) => {
    teks += `*${i + 1}. ${p.nama}*\nHarga: Rp${p.harga}\nStok: ${p.stok.length}\n\n`;
  });
  return teks;
}

bot.start((ctx) => {
  users.add(ctx.chat.id);
  ctx.reply(`Selamat datang di bot toko digital! Gunakan menu di bawah untuk mulai.`, Markup.keyboard([['🛒 Lihat Produk']]).resize());
});

bot.hears('🛒 Lihat Produk', async (ctx) => {
  if (produk.length === 0) return ctx.reply('Belum ada produk tersedia.');
  const buttons = produk.map((p, i) => [Markup.button.callback(`${i + 1}. ${p.nama}`, `pilih_${i}`)]);
  ctx.reply('Silakan pilih produk:', Markup.inlineKeyboard(buttons));
});

produk.forEach((p, i) => {
  bot.action(`pilih_${i}`, async (ctx) => {
    const produkDipilih = produk[i];
    if (!produkDipilih) return ctx.reply('Produk tidak ditemukan.');
    const foto = produkDipilih.foto ? { source: produkDipilih.foto } : 'qris.jpg';
    pembelian[ctx.from.id] = { index: i };
    await ctx.replyWithPhoto(foto, {
      caption: `🛍 *${produkDipilih.nama}*
💰 Harga: Rp${produkDipilih.harga}
📦 Stok: ${produkDipilih.stok.length}`,
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('Beli Sekarang', `beli_${i}`)]
      ])
    });
  });
});

bot.action(/beli_(\d+)/, async (ctx) => {
  const i = parseInt(ctx.match[1]);
  const p = produk[i];
  if (!p || p.stok.length === 0) return ctx.reply('Stok produk ini habis.');
  pembelian[ctx.from.id] = { index: i };
  await ctx.replyWithPhoto({ source: 'qris.jpg' }, {
    caption: '📲 Silakan bayar via QRIS, lalu kirim bukti transfer.',
    ...Markup.forceReply()
  });
});

bot.on('message', async (ctx) => {
  if (!pembelian[ctx.from.id]) return;
  const { index } = pembelian[ctx.from.id];
  const p = produk[index];
  if (!p) return ctx.reply('Produk tidak ditemukan.');

  const userID = ctx.from.id;
  const adminID = ADMIN_ID;

  await ctx.reply('🕵️‍♂️ Bukti pembayaran dikirim ke admin untuk diverifikasi.');
  bot.telegram.sendMessage(adminID, `💳 *Verifikasi Pembayaran*
Dari: @${ctx.from.username || ctx.from.first_name}
Produk: ${p.nama}

Kirim /verifikasi_${userID}_${index} untuk kirim produk ke user.`, { parse_mode: 'Markdown' });
  if (ctx.message.photo) {
    const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    bot.telegram.sendPhoto(adminID, fileId);
  } else {
    bot.telegram.sendMessage(adminID, ctx.message.text);
  }
});

bot.command(/verifikasi_(\d+)_(\d+)/, async (ctx) => {
  if (ctx.from.id != ADMIN_ID) return;
  const [_, userId, index] = ctx.match;
  const i = parseInt(index);
  const id = parseInt(userId);
  const p = produk[i];
  if (!p || p.stok.length === 0) return ctx.reply('Stok kosong.');
  const kode = p.stok.shift();
  simpanProduk();
  bot.telegram.sendMessage(id, `✅ Pembayaran terverifikasi!
Berikut produk kamu:

${kode}`);
  ctx.reply('Produk berhasil dikirim ke user.');
});

// === FITUR ADMIN ===
bot.command('tambahproduk', (ctx) => {
  if (ctx.from.id != ADMIN_ID) return;
  ctx.reply('Kirim nama produk:', Markup.forceReply());
  pembelian[ctx.from.id] = { tahap: 'nama' };
});

bot.on('text', (ctx) => {
  const state = pembelian[ctx.from.id];
  if (!state || ctx.chat.type !== 'private') return;

  if (state.tahap === 'nama') {
    state.nama = ctx.message.text;
    state.tahap = 'harga';
    return ctx.reply('Kirim harga produk (angka saja):', Markup.forceReply());
  }

  if (state.tahap === 'harga') {
    state.harga = parseInt(ctx.message.text);
    state.tahap = 'stok';
    return ctx.reply('Kirim stok produk (pisahkan dengan garis baru tiap item):', Markup.forceReply());
  }

  if (state.tahap === 'stok') {
    state.stok = ctx.message.text.split('\n');
    state.tahap = 'foto';
    return ctx.reply('Silakan kirim foto produk ini:');
  }
});

bot.on('photo', async (ctx) => {
  const state = pembelian[ctx.from.id];
  if (!state || state.tahap !== 'foto') return;
  const fileId = ctx.message.photo.pop().file_id;
  const fileLink = await ctx.telegram.getFileLink(fileId);
  const filename = `foto_${Date.now()}.jpg`;
  const dest = fs.createWriteStream(filename);
  const res = await fetch(fileLink.href);
  res.body.pipe(dest);
  dest.on('finish', () => {
    produk.push({ nama: state.nama, harga: state.harga, stok: state.stok, foto: filename });
    simpanProduk();
    ctx.reply('✅ Produk berhasil ditambahkan.');
    delete pembelian[ctx.from.id];
  });
});

bot.command('hapusproduk', (ctx) => {
  if (ctx.from.id != ADMIN_ID) return;
  if (produk.length === 0) return ctx.reply('Tidak ada produk.');
  const list = produk.map((p, i) => `${i + 1}. ${p.nama}`).join('\n');
  ctx.reply(`Ketik nomor produk yang ingin dihapus:\n\n${list}`, Markup.forceReply());
  pembelian[ctx.from.id] = { tahap: 'hapus' };
});

bot.on('text', (ctx) => {
  const state = pembelian[ctx.from.id];
  if (!state || state.tahap !== 'hapus') return;
  const i = parseInt(ctx.message.text) - 1;
  if (produk[i]) {
    const nama = produk[i].nama;
    produk.splice(i, 1);
    simpanProduk();
    ctx.reply(`✅ Produk "${nama}" telah dihapus.`);
  } else {
    ctx.reply('❌ Nomor tidak valid.');
  }
  delete pembelian[ctx.from.id];
});

bot.command('broadcast', (ctx) => {
  if (ctx.from.id != ADMIN_ID) return;
  ctx.reply('Ketik pesan yang ingin dibroadcast ke semua user:', Markup.forceReply());
  pembelian[ctx.from.id] = { tahap: 'broadcast' };
});

bot.on('text', (ctx) => {
  const state = pembelian[ctx.from.id];
  if (!state || state.tahap !== 'broadcast') return;
  users.forEach((id) => {
    bot.telegram.sendMessage(id, `📢 Broadcast:
${ctx.message.text}`);
  });
  ctx.reply('✅ Pesan broadcast dikirim.');
  delete pembelian[ctx.from.id];
});

bot.launch();
console.log('Bot aktif...');
