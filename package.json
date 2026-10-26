const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const readline = require("readline");
const cron = require("node-cron");
const axios = require("axios");

// تحديد رقم المالك والمسؤول الوحيد للبوت
const OWNER_JID = "249118626501@s.whatsapp.net";

// حالة البوت (مفعل للجميع أو معطل أو للمالك فقط)
let botMode = "public"; // الخيارات: 'public' (الجميع), 'private' (المالك فقط), 'off' (متوقف)

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

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

    // توليد كود الاقتران الفوري
    if (!sock.authState.creds.registered) {
        console.log("\n==========================================");
        const phoneNumber = await question("أدخل رقم هاتف الشريحة الخاصة بالبوت (مع المفتاح الدولي بدون +): ");
        const pairingCode = await sock.requestPairingCode(phoneNumber.trim());
        console.log("==========================================");
        console.log(`>>> كود الاقتران الخاص بك هو: [ ${pairingCode} ] <<<`);
        console.log("افتح واتساب > الأجهزة المرتبطة > الربط برقم الهاتف، وأدخل الكود فوراً.");
        console.log("==========================================\n");
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('✅ تم تشغيل البوت بنجاح تام وهو جاهز الآن!');
        }
    });

    // معالجة الرسائل الواردة
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.participant || msg.key.remoteJid;
        const from = msg.key.remoteJid;
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
        const isOwner = sender.replace(/[^0-9]/g, '') === "249118626501";
        const isGroup = from.endsWith('@g.us');

        // ==========================================
        // 1. لوحة تحكم المسؤول (أوامر خاصة برقمك فقط)
        // ==========================================
        if (isOwner) {
            if (text === ".تفعيل") {
                botMode = "public";
                return await sock.sendMessage(from, { text: "✅ تم تفعيل البوت لجميع المستخدمين." });
            }
            if (text === ".تعطيل") {
                botMode = "off";
                return await sock.sendMessage(from, { text: "🛑 تم إيقاف ردود البوت مؤقتاً." });
            }
            if (text === ".خاص") {
                botMode = "private";
                return await sock.sendMessage(from, { text: "🔒 تم قصر استخدام البوت عليك فقط." });
            }
            if (text === ".اوامري") {
                const adminMenu = `👑 أهلاً بك يا أدمن:\n\n` +
                    `🔹 .تفعيل (تشغيل الرد للكل)\n` +
                    `🔹 .تعطيل (إيقاف الرد تماماً)\n` +
                    `🔹 .خاص (الرد عليك وحدك)\n` +
                    `🔹 .طرد (في القروب لطرد العضو)\n` +
                    `🔹 .ترقية (لرفع العضو مشرف)\n` +
                    `🔹 .تنزيل (لسحب الإشراف)`;
                return await sock.sendMessage(from, { text: adminMenu });
            }
        }

        // فحص وضع التشغيل
        if (botMode === "off") return;
        if (botMode === "private" && !isOwner) return;

        // ==========================================
        // 2. نظام حماية المجموعات (حذف الروابط)
        // ==========================================
        if (isGroup && text.match(/(https?:\/\/|chat\.whatsapp\.com)/i) && !isOwner) {
            // حذف رسالة الرابط
            await sock.sendMessage(from, { delete: msg.key });
            return await sock.sendMessage(from, { text: "⚠️ ممنوع نشر الروابط في هذه المجموعة!" });
        }

        // ==========================================
        // 3. أوامر المصحف والأذكار والتفسير
        // ==========================================
        const pageNum = parseInt(text);

        // إرسال صورة صفحة المصحف إذا أرسل المستخدم رقماً بين 1 و 604
        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= 604) {
            // رابط مباشر سريع يجلب الصفحة بدقة عالية بدون استهلاك مساحة السيرفر
            const pageUrl = `https://raw.githubusercontent.com/Govar-dev/Quran-Pages/main/${pageNum}.png`;
            return await sock.sendMessage(from, { 
                image: { url: pageUrl }, 
                caption: `📖 صفحة رقم: ${pageNum} (مصحف التجويد)` 
            });
        }

        // إرسال التفسير أو الآية (مثال: أرسل "سورة البقرة:255")
        if (text.startsWith("اية ") || text.startsWith("تفسير ")) {
            const query = text.replace(/^(اية|تفسير)\s+/, '');
            try {
                // جلب الآية والتفسير من واجهة سحابية مفتوحة
                const res = await axios.get(`https://api.alquran.cloud/v1/ayah/${encodeURIComponent(query)}/ar.alafasy`);
                if (res.data && res.data.data) {
                    const ayah = res.data.data;
                    const responseText = `✨ قوله تعالى:\n\n"${ayah.text}"\n\n📌 سورة: ${ayah.surah.name} | رقم الآية: ${ayah.numberInSurah}`;
                    return await sock.sendMessage(from, { text: responseText });
                }
            } catch (e) {
                return await sock.sendMessage(from, { text: "لم أتمكن من العثور على الآية، اكتب مثلاً: اية 255" });
            }
        }

        // قائمة المساعدة العامة
        if (text === "اوامر" || text === "مساعدة" || text === ".اوامر") {
            const menu = `🕌 مرحباً بك في البوت الديني:\n\n` +
                `1️⃣ أرسل أي رقم من (1 إلى 604) لعرض صورة الصفحة من مصحف التجويد.\n` +
                `2️⃣ أرسل "اية" متبوعة برقم الآية للبحث عنها.\n` +
                `3️⃣ أرسل "اذكار" لعرض أذكار اليوم.`;
            return await sock.sendMessage(from, { text: menu });
        }
    });

    // ==========================================
    // 4. جدولة أذكار الصباح والمساء التلقائية
    // ==========================================
    // أذكار الصباح: الساعة 6:30 صباحاً
    cron.schedule('30 6 * * *', async () => {
        const morningMsg = "🌅 *أذكار الصباح بارك الله في يومكم:*\n\n«أَصْبَحْنَا وَأَصْبَحَ المُلْكُ لِلَّهِ، وَالحَمْدُ لِلَّهِ، لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ...»";
        // إرسال تنبيه للمالك أن البوت أتم الإرسال الصباحي
        await sock.sendMessage(OWNER_JID, { text: morningMsg });
    });

    // أذكار المساء: الساعة 5:30 مساءً
    cron.schedule('30 17 * * *', async () => {
        const eveningMsg = "🌆 *أذكار المساء حفظكم الله:*\n\n«أَمْسَيْنَا وَأَمْسَى المُلْكُ لِلَّهِ، وَالحَمْدُ لِلَّهِ، لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ...»";
        await sock.sendMessage(OWNER_JID, { text: eveningMsg });
    });
}

startBot();
