
require('dotenv').config();
const { Client, GatewayIntentBits, Partials, MessageActionRow, MessageButton, MessageEmbed } = require('discord.js');
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

const prefix = "!";
const fs = require('fs');

// Data holders for simple systems
let tickets = new Map(); // userId -> channelId
let reminders = new Map(); // userId -> array of reminders
let points = new Map(); // userId -> points
let dailyTasks = [
    "سجل دخولك اليومي",
    "شارك في دردشة القبيلة",
    "ساعد عضو جديد",
    "شارك في حدث القبيلة",
];

// On ready
client.once('ready', () => {
    console.log(`بوت القبيلة المَقْوُدة سستم شغال على ${client.user.tag}`);
    client.user.setActivity('سيرفر القبيلة المَقْوُدة');
});

// Helper to get or init points
function getPoints(userId) {
    if(!points.has(userId)) points.set(userId, 0);
    return points.get(userId);
}

// Helper to add points
function addPoints(userId, amount) {
    let current = getPoints(userId);
    points.set(userId, current + amount);
}

// Basic command handler
client.on('messageCreate', async message => {
    if(message.author.bot) return;
    if(!message.content.startsWith(prefix)) return;
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    // !ping
    if(cmd === 'ping') {
        return message.channel.send('البوت شغال تمام ✅');
    }

    // !مساعدة
    if(cmd === 'مساعدة') {
        const helpEmbed = new MessageEmbed()
        .setTitle('قائمة الأوامر لبوت القبيلة المَقْوُدة')
        .setDescription(`
**الأوامر الإدارية:**
!طرد @العضو - لطرد عضو
!باند @العضو - حظر عضو
!مسح رقم - لمسح رسائل
!رول @العضو اسم_الرتبة - لإعطاء رتبة
!منع @العضو - لكتم
!فك @العضو - لفك الكتم
!قفل - لقفل الروم
!فتح - لفتح الروم

**أوامر القبيلة:**
!انضم - طلب انضمام
!بلاغ نص - للإبلاغ عن خائن
!الشيخ - لعرض اسم الشيخ
!مهامي - المهام اليومية
!طقوس - مواعيد الطقوس
!ميثاق - ميثاق الشرف

**أنظمة أخرى:**
!تذكرة - فتح تذكرة دعم
!قفل_تذكرة - إغلاق التذكرة
!تذكير وقت نص_التذكير - ضبط تذكير
!نقاط - عرض نقاطك
!متجر - عرض المتجر
!اشتري رقم_الصنف - شراء من المتجر
!لعبه - لعب لعبة تخمين رقم
`)
        .setColor('#0099ff')
        message.channel.send({embeds: [helpEmbed]});
        return;
    }

    // ========== أوامر إدارية =========
    if(cmd === 'طرد') {
        if(!message.member.permissions.has('KickMembers')) return message.reply('ما عندك صلاحية الطرد!');
        let member = message.mentions.members.first();
        if(!member) return message.reply('رجاءً عين عضو');
        if(!member.kickable) return message.reply('ما أقدر أطرد هذا العضو');
        member.kick().then(() => message.channel.send(`تم طرد ${member.user.tag}`))
        .catch(err => message.reply('خطأ في الطرد'));
        return;
    }

    if(cmd === 'باند') {
        if(!message.member.permissions.has('BanMembers')) return message.reply('ما عندك صلاحية الحظر!');
        let member = message.mentions.members.first();
        if(!member) return message.reply('رجاءً عين عضو');
        if(!member.bannable) return message.reply('ما أقدر أحظر هذا العضو');
        member.ban().then(() => message.channel.send(`تم حظر ${member.user.tag}`))
        .catch(err => message.reply('خطأ في الحظر'));
        return;
    }

    if(cmd === 'مسح') {
        if(!message.member.permissions.has('ManageMessages')) return message.reply('ما عندك صلاحية مسح الرسائل!');
        let num = parseInt(args[0]);
        if(!num || num < 1 || num > 100) return message.reply('حدد رقم بين 1 و 100');
        message.channel.bulkDelete(num, true)
        .then(() => message.channel.send(`تم مسح ${num} رسالة`).then(msg => setTimeout(() => msg.delete(), 3000)))
        .catch(() => message.reply('خطأ في المسح'));
        return;
    }

    if(cmd === 'رول') {
        if(!message.member.permissions.has('ManageRoles')) return message.reply('ما عندك صلاحية إعطاء الرتب!');
        let member = message.mentions.members.first();
        if(!member) return message.reply('عين عضو');
        let roleName = args.slice(1).join(' ');
        if(!roleName) return message.reply('اكتب اسم الرتبة');
        let role = message.guild.roles.cache.find(r => r.name === roleName);
        if(!role) return message.reply('الرتبة مش موجودة');
        member.roles.add(role).then(() => message.channel.send(`تم إعطاء رتبة ${roleName} لـ ${member.user.tag}`))
        .catch(() => message.reply('خطأ في إعطاء الرتبة'));
        return;
    }

    if(cmd === 'منع') {
        if(!message.member.permissions.has('MuteMembers')) return message.reply('ما عندك صلاحية كتم!');
        let member = message.mentions.members.first();
        if(!member) return message.reply('عين عضو');
        let muteRole = message.guild.roles.cache.find(r => r.name === "Muted");
        if(!muteRole) {
            try {
                muteRole = await message.guild.roles.create({name: "Muted", permissions: []});
                message.guild.channels.cache.forEach(async (channel) => {
                    await channel.permissionOverwrites.edit(muteRole, {
                        SendMessages: false,
                        AddReactions: false,
                    });
                });
            } catch(e) {
                return message.reply('خطأ في إنشاء رتبة الميوت');
            }
        }
        member.roles.add(muteRole).then(() => message.channel.send(`تم كتم ${member.user.tag}`))
        .catch(() => message.reply('خطأ في كتم العضو'));
        return;
    }

    if(cmd === 'فك') {
        if(!message.member.permissions.has('MuteMembers')) return message.reply('ما عندك صلاحية فك الكتم!');
        let member = message.mentions.members.first();
        if(!member) return message.reply('عين عضو');
        let muteRole = message.guild.roles.cache.find(r => r.name === "Muted");
        if(!muteRole) return message.reply('ما فيه رتبة ميوت');
        member.roles.remove(muteRole).then(() => message.channel.send(`تم فك الكتم عن ${member.user.tag}`))
        .catch(() => message.reply('خطأ في فك الكتم'));
        return;
    }

    if(cmd === 'قفل') {
        if(!message.member.permissions.has('ManageChannels')) return message.reply('ما عندك صلاحية قفل الروم!');
        message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false }).then(() => {
            message.channel.send('تم قفل الروم');
        }).catch(() => message.reply('خطأ في قفل الروم'));
        return;
    }

    if(cmd === 'فتح') {
        if(!message.member.permissions.has('ManageChannels')) return message.reply('ما عندك صلاحية فتح الروم!');
        message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: true }).then(() => {
            message.channel.send('تم فتح الروم');
        }).catch(() => message.reply('خطأ في فتح الروم'));
        return;
    }

    // ========== أوامر القبيلة ===========
    if(cmd === 'انضم') {
        message.channel.send(`${message.author}, طلب انضمامك للقبيلة تم استلامه!`);
        addPoints(message.author.id, 5); // نقاط مكافأة
        return;
    }

    if(cmd === 'بلاغ') {
        const report = args.join(' ');
        if(!report) return message.reply('اكتب نص البلاغ');
        message.channel.send(`${message.author}, تم استلام بلاغك: ${report}`);
        addPoints(message.author.id, 10);
        return;
    }

    if(cmd === 'الشيخ') {
        message.channel.send('الشيخ الحالي: شيخ القبيلة العظيم');
        return;
    }

    if(cmd === 'مهامي') {
        let tasks = dailyTasks.map((task, i) => `${i+1}. ${task}`).join('
');
        message.channel.send(`مهامك اليومية:
${tasks}`);
        addPoints(message.author.id, 3);
        return;
    }

    if(cmd === 'طقوس') {
        message.channel.send('موعد الطقوس القادمة: الجمعة الساعة 8 مساءً');
        return;
    }

    if(cmd === 'ميثاق') {
        message.channel.send('ميثاق الشرف: الاحترام، التعاون، الولاء للقبيلة');
        return;
    }

    // ========== نظام التذاكر ==========
    if(cmd === 'تذكرة') {
        if(tickets.has(message.author.id)) return message.reply('لديك تذكرة مفتوحة بالفعل!');
        let ticketChannel = await message.guild.channels.create(`ticket-${message.author.username}`, {
            type: 'GUILD_TEXT',
            permissionOverwrites: [
                { id: message.guild.id, deny: ['VIEW_CHANNEL'] },
                { id: message.author.id, allow: ['VIEW_CHANNEL', 'SEND_MESSAGES'] },
                { id: client.user.id, allow: ['VIEW_CHANNEL', 'SEND_MESSAGES'] }
            ]
        });
        tickets.set(message.author.id, ticketChannel.id);
        message.channel.send(`تم فتح تذكرتك: ${ticketChannel}`);
        return;
    }

    if(cmd === 'قفل_تذكرة') {
        if(!tickets.has(message.author.id)) return message.reply('ليس لديك تذكرة مفتوحة!');
        let channelId = tickets.get(message.author.id);
        let ticketChannel = message.guild.channels.cache.get(channelId);
        if(ticketChannel) {
            ticketChannel.delete().catch(() => {});
        }
        tickets.delete(message.author.id);
        message.channel.send('تم إغلاق تذكرتك');
        return;
    }

    // ========== نظام التذكير ==========
    if(cmd === 'تذكير') {
        let time = args[0];
        let text = args.slice(1).join(' ');
        if(!time || !text) return message.reply('الرجاء كتابة الوقت والنص');
        // حفظ التذكير بشكل مبسط (بدون جدولة حقيقية)
        if(!reminders.has(message.author.id)) reminders.set(message.author.id, []);
        reminders.get(message.author.id).push({time, text});
        message.channel.send(`تم ضبط تذكير بعد ${time} دقائق: ${text}`);
        return;
    }

    if(cmd === 'نقاط') {
        let pts = getPoints(message.author.id);
        message.channel.send(`${message.author} لديك ${pts} نقطة`);
        return;
    }

    // ========== نظام المتجر ==========
    const shopItems = {
        1: {name: "رتبة مميزة", price: 50},
        2: {name: "مشاركة مميزة", price: 30},
        3: {name: "لقب خاص", price: 70}
    };

    if(cmd === 'متجر') {
        let shopList = Object.entries(shopItems).map(([id, item]) => `${id}. ${item.name} - ${item.price} نقاط`).join('
');
        message.channel.send(`متجر القبيلة:
${shopList}`);
        return;
    }

    if(cmd === 'اشتري') {
        let itemId = args[0];
        if(!itemId || !shopItems[itemId]) return message.reply('حدد رقم صنف صحيح');
        let userPoints = getPoints(message.author.id);
        let item = shopItems[itemId];
        if(userPoints < item.price) return message.reply('نقاطك غير كافية');
        addPoints(message.author.id, -item.price);
        message.channel.send(`${message.author} اشتريت ${item.name} بنجاح!`);
        return;
    }

    // ========== نظام الألعاب ==========
    if(cmd === 'لعبه') {
        let number = Math.floor(Math.random() * 10) + 1;
        message.channel.send(`${message.author} خمن رقم بين 1 و 10، اكتب رقم الآن!`);
        const filter = m => m.author.id === message.author.id;
        const collector = message.channel.createMessageCollector({ filter, time: 15000, max: 1 });
        collector.on('collect', m => {
            if(m.content === number.toString()) {
                message.channel.send('مبروك! أنت فزت! 🎉');
                addPoints(message.author.id, 20);
            } else {
                message.channel.send(`خطأ! الرقم الصحيح هو ${number}`);
            }
        });
        return;
    }

    // ========== ردود كنباد ذكية ==========
    const smartReplies = {
        'سلام': 'وعليكم السلام ورحمة الله وبركاته!',
        'مرحبا': 'أهلا وسهلا بك في سيرفر القبيلة!',
        'كيف الحال': 'الحمد لله، وأنت؟',
        'شكرا': 'العفو، نحن هنا لمساعدتك!'
    };

    if(smartReplies[cmd]) {
        return message.channel.send(smartReplies[cmd]);
    }
});

// Login bot
client.login(process.env.TOKEN);
