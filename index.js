const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const cron = require("node-cron");
const axios = require("axios");

// رقمك كأدمن ومسؤول للبوت
const OWNER_JID = "249118626501@s.whatsapp.net";

// ضع هنا رقم شريحة البوت التي تريد تشغيل البوت عليها (مع المفتاح الدولي بدون + وبدون مسافات)
// إذا كان نفس رقمك اتركه كما هو، أو غيّره لرقم شريحة البوت
const BOT_PHONE_NUMBER = "249118626501";

let botMode = "public";

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./session_auth');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    // توليد كود الاقتران وطباعته مباشرة في السجلات
    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                const pairingCode = await sock.requestPairingCode(BOT_PHONE_NUMBER.trim());
                console.log("\n==========================================");
                console.log(`>>> كود الاقتران الخاص بك هو: [ ${pairingCode} ] <<<`);
                console.log("==========================================\n");
            } catch (err) {
                console.error("خطأ أثناء طلب كود الاقتران:", err);
            }
        }, 3000);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('✅ تم تشغيل البوت بنجاح تام وهو جاهز الآن للعمل!');
        }
    });

    // معالجة الرسائل والأوامر
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.participant || msg.key.remoteJid;
        const from = msg.key.remoteJid;
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
        const isOwner = sender.replace(/[^0-9]/g, '') === "249118626501";
        const isGroup = from.endsWith('@g.us');

        // لوحة تحكم المسؤول
        if (isOwner) {
            if (text === ".تفعيل") {
                botMode = "public";
                return await sock.sendMessage(from, { text: "✅ تم تفعيل البوت للجميع." });
            }
            if (text === ".تعطيل") {
                botMode = "off";
                return await sock.sendMessage(from, { text: "🛑 تم إيقاف البوت." });
            }
            if (text === ".خاص") {
                botMode = "private";
                return await sock.sendMessage(from, { text: "🔒 البوت يعمل معك فقط." });
            }
            if (text === ".اوامري") {
                return await sock.sendMessage(from, { text: "👑 أوامر المسؤول:\n.تفعيل\n.تعطيل\n.خاص" });
            }
        }

        if (botMode === "off") return;
        if (botMode === "private" && !isOwner) return;

        // منع الروابط في المجموعات
        if (isGroup && text.match(/(https?:\/\/|chat\.whatsapp\.com)/i) && !isOwner) {
            await sock.sendMessage(from, { delete: msg.key });
            return await sock.sendMessage(from, { text: "⚠️ ممنوع نشر الروابط في القروب!" });
        }

        // إرسال صفحة المصحف الملون برقمها
        const pageNum = parseInt(text);
        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= 604) {
            const pageUrl = `https://raw.githubusercontent.com/Govar-dev/Quran-Pages/main/${pageNum}.png`;
            return await sock.sendMessage(from, { 
                image: { url: pageUrl }, 
                caption: `📖 صفحة رقم: ${pageNum}` 
            });
        }

        // أوامر المساعدة
        if (text === "اوامر" || text === "مساعدة" || text === ".اوامر") {
            const menu = `🕌 مرحباً بك في البوت الديني:\n\n` +
                `🔹 أرسل رقم الصفحة من (1 إلى 604) لعرض مصحف التجويد الملون.\n` +
                `🔹 أرسل أذكار لعرض الأذكار.`;
            return await sock.sendMessage(from, { text: menu });
        }
    });

    // أذكار الصباح والمساء
    cron.schedule('30 6 * * *', async () => {
        await sock.sendMessage(OWNER_JID, { text: "🌅 أذكار الصباح: أصبحنا وأصبح الملك لله والحمد لله..." });
    });

    cron.schedule('30 17 * * *', async () => {
        await sock.sendMessage(OWNER_JID, { text: "🌆 أذكار المساء: أمسينا وأمسى الملك لله والحمد لله..." });
    });
}

startBot();
