require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = process.env.ADMIN_ID;

let produkList = [];
const loadProduk = () => {
  try {
    const data = fs.readFileSync('produk.json');
    produkList = JSON.parse(data);
  } catch (err) {
    produkList = [];
  }
};

const saveProduk = () => {
  fs.writeFileSync('produk.json', JSON.stringify(produkList, null, 2));
};

bot.start((ctx) => {
  const name = ctx.from.first_name;
  let teks = `👋 Hai *${name}*!

Selamat datang di *Toko Digital Kami*!
Silakan pilih produk dengan klik tombol di bawah.`;
  const buttons = [Markup.button.callback('📦 Lihat Produk', 'lihat_produk')];
  if (ctx.from.id.toString() === ADMIN_ID) {
    buttons.push(Markup.button.callback('📢 Broadcast', 'broadcast'));
    buttons.push(Markup.button.callback('➕ Tambah Produk', 'tambah_produk'));
    buttons.push(Markup.button.callback('🗑️ Hapus Produk', 'hapus_produk'));
  }
  ctx.reply(teks, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons, { columns: 1 }) });
});

bot.action('lihat_produk', (ctx) => {
  loadProduk();
  if (produkList.length === 0) {
    return ctx.reply('Belum ada produk tersedia.');
  }
  let teks = `📦 *Daftar Produk:*

`;
  produkList.forEach((p, i) => {
    teks += `*${i + 1}. ${p.nama}* - Rp${p.harga}
`;
  });
  ctx.reply(teks, { parse_mode: 'Markdown' });
});

bot.action('broadcast', async (ctx) => {
  if (ctx.from.id.toString() !== ADMIN_ID) return;
  ctx.reply('Ketik pesan yang ingin dibroadcast:');
  bot.once('text', async (ctx2) => {
    const message = ctx2.message.text;
    const users = [ctx2.from.id]; // Dummy data, seharusnya dari database user
    users.forEach(id => {
      bot.telegram.sendMessage(id, `📢 Broadcast:

${message}`);
    });
    ctx2.reply('Broadcast dikirim ke semua user.');
  });
});

bot.action('tambah_produk', async (ctx) => {
  if (ctx.from.id.toString() !== ADMIN_ID) return;
  ctx.reply('Ketik nama produk:');
  bot.once('text', (ctx2) => {
    const nama = ctx2.message.text;
    ctx2.reply('Ketik harga produk (angka):');
    bot.once('text', (ctx3) => {
      const harga = parseInt(ctx3.message.text);
      if (isNaN(harga)) return ctx3.reply('Harga tidak valid.');
      loadProduk();
      produkList.push({ nama, harga });
      saveProduk();
      ctx3.reply(`Produk *${nama}* berhasil ditambahkan.`, { parse_mode: 'Markdown' });
    });
  });
});

bot.action('hapus_produk', async (ctx) => {
  if (ctx.from.id.toString() !== ADMIN_ID) return;
  loadProduk();
  if (produkList.length === 0) return ctx.reply('Tidak ada produk.');
  let teks = 'Pilih produk yang ingin dihapus:';
  const buttons = produkList.map((p, i) => Markup.button.callback(p.nama, `hapus_${i}`));
  ctx.reply(teks, Markup.inlineKeyboard(buttons, { columns: 1 }));
});

bot.action(/hapus_(\d+)/, (ctx) => {
  if (ctx.from.id.toString() !== ADMIN_ID) return;
  const index = parseInt(ctx.match[1]);
  loadProduk();
  const removed = produkList.splice(index, 1);
  saveProduk();
  ctx.reply(`Produk *${removed[0].nama}* berhasil dihapus.`, { parse_mode: 'Markdown' });
});

bot.launch();
