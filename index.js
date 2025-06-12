
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const ADMIN_ID = '7006736189';
const DATA_FILE = 'produk.json';

function loadProduk() {
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE));
    } catch (e) {
        return [];
    }
}

function saveProduk(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const isAdmin = String(msg.from.id) === ADMIN_ID;

    const options = {
        reply_markup: {
            inline_keyboard: isAdmin ? [
                [{ text: '➕ Tambah Produk', callback_data: 'tambah_produk' }],
                [{ text: '📦 Lihat Stok', callback_data: 'lihat_stok' }]
            ] : [
                [{ text: '📦 Lihat Produk', callback_data: 'lihat_produk' }]
            ]
        }
    };

    bot.sendMessage(chatId, `Selamat datang ${isAdmin ? 'Admin' : 'User'}!`, options);
});

bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const fromId = query.from.id;
    const data = query.data;
    const isAdmin = String(fromId) === ADMIN_ID;

    if (data === 'tambah_produk' && isAdmin) {
        bot.sendMessage(chatId, `Kirim produk dengan format:
nama|harga|stok`);
        bot.once('message', (msg) => {
            const [nama, harga, stok] = msg.text.split('|');
            if (!nama || !harga || !stok) {
                return bot.sendMessage(chatId, 'Format salah. Gunakan: nama|harga|stok');
            }
            const produk = loadProduk();
            produk.push({ nama, harga: Number(harga), stok: Number(stok) });
            saveProduk(produk);
            bot.sendMessage(chatId, 'Produk berhasil ditambahkan!');
        });
    } else if (data === 'lihat_stok' && isAdmin) {
        const produk = loadProduk();
        if (produk.length === 0) return bot.sendMessage(chatId, 'Belum ada produk.');
        let teks = `📦 Stok Produk:

`;
        produk.forEach((p, i) => {
            teks += `${i + 1}. ${p.nama} - Rp${p.harga} (Stok: ${p.stok})
`;
        });
        bot.sendMessage(chatId, teks);
    } else if (data === 'lihat_produk') {
        const produk = loadProduk();
        if (produk.length === 0) return bot.sendMessage(chatId, 'Belum ada produk.');
        let teks = `📦 Daftar Produk:

`;
        produk.forEach((p, i) => {
            teks += `${i + 1}. ${p.nama} - Rp${p.harga}
`;
        });
        bot.sendMessage(chatId, teks);
    } else {
        bot.sendMessage(chatId, 'Akses ditolak atau perintah tidak dikenal.');
    }

    bot.answerCallbackQuery(query.id);
});

console.log("Bot aktif!");
