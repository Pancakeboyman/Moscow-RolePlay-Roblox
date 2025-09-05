const { Client, GatewayIntentBits, Collection, REST, Routes, ActivityType, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');
const winston = require('winston');
const { BOTTOKEN, GUILD_ID } = require('./apikeys');
const { initDatabase, getSubscribersDb, getVipDb } = require('./utils/database');
const { autoLockAllCars, syncLockedCars } = require('./cogs/autoLockCars');
const { setupGlobalErrorHandler } = require('./utils/globalErrorHandler');

// --- ЛОГГЕР --- //
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`)
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'data/bot.log' })
    ]
});

// --- ПАПКИ ДАННЫХ --- //
["data", "data/transcripts"].forEach(folder => {
    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
        logger.info(`📁 Папка '${folder}' создана или уже существует`);
    }
});

// --- ИНИЦИАЛИЗАЦИЯ БД --- //
initDatabase();
const db = getSubscribersDb();
const vipDb = typeof getVipDb === 'function' ? getVipDb() : undefined;
logger.info('💾 База данных subscribers.db инициализирована' + (vipDb ? ' и vip.db' : ''));

// --- ЛОГИКА АВТОЛОКА --- //
if (vipDb) {
    syncLockedCars(db, vipDb, logger);
} else {
    logger.warn('⚠️ vipDb не инициализирован! syncLockedCars будет работать только с основной БД.');
    syncLockedCars(db, undefined, logger);
}

// --- КЛИЕНТ DISCORD --- //
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ]
});

setupGlobalErrorHandler(client, logger);

// --- КОМАНДЫ --- //
client.commands = new Collection();
const commandsData = [];
const cogsPath = path.join(__dirname, 'cogs');

fs.readdirSync(cogsPath).forEach(file => {
    if (file.endsWith('.js')) {
        const cog = require(`./cogs/${file}`);
        if (cog.data && cog.execute) {
            client.commands.set(cog.data.name, cog);
            commandsData.push(cog.data.toJSON ? cog.data.toJSON() : cog.data);
            logger.info(`✅ SLASH-команда загружена: ${file}`);
        }
        if (typeof cog.setup === 'function') {
            cog.setup(client, logger);
            logger.info(`⚙️ Инициализирован cog: ${file}`);
        }
    }
});

// --- СТАТУС --- //
const statusMessages = [
    { name: "Moscow RolePlay Roblox", type: ActivityType.Watching }
];
let statusIndex = 0;
function changeStatus() {
    const next = statusMessages[statusIndex];
    client.user.setActivity(next.name, { type: next.type });
    logger.info(`👀 Статус обновлён: ${next.name}`);
    statusIndex = (statusIndex + 1) % statusMessages.length;
}

// --- ОБРАБОТКА EMBED НАКАЗАНИЯ + ФУНКЦИИ ДЛЯ РЕТРОСКАНА --- //
const { handlePunishmentEmbed, extractWarningIdFromEmbed, isWarningIdProcessed } = require('./cogs/handlePunishmentEmbed');
const PUNISHMENT_CHANNEL_ID = '1331390930821058591';

// --- Параметр: дата и время, с которых начинать обработку (по Москве) --- //
const SCAN_START_MOSCOW = "2025-09-05T17:00:00"; // <-- Указать дату и время старта (МСК)! Меняй только тут.

// --- READY --- //
client.once(Events.ClientReady, async () => {
    setInterval(() => { if (client.user) changeStatus(); }, 5 * 60 * 1000);
    changeStatus();

    logger.info(`🚀 Бот ${client.user.tag} запущен и готов!`);
    logger.info(`🌐 Подключено к ${client.guilds.cache.size} серверам`);

    // --- Ретросканирование embed-ов наказаний ---
    try {
        const punishmentChannel = await client.channels.fetch(PUNISHMENT_CHANNEL_ID);
        if (punishmentChannel && punishmentChannel.isTextBased?.()) {
            const moscowDate = new Date(SCAN_START_MOSCOW + "+03:00");
            logger.info(`[RetroScan] Использую дату запуска системы (МСК): ${SCAN_START_MOSCOW} => UTC: ${moscowDate.toISOString()}`);

            let lastId = undefined;
            let fetchedTotal = 0, handledCount = 0, skippedCount = 0;
            let breakLoop = false;
            while (!breakLoop) {
                const messages = await punishmentChannel.messages.fetch({ limit: 100, before: lastId }).catch(() => null);
                if (!messages || messages.size === 0) break;
                for (const message of messages.values()) {
                    fetchedTotal++;
                    if (message.createdAt < moscowDate) {
                        breakLoop = true;
                        break;
                    }
                    if (message.embeds?.length > 0 && message.embeds[0].title === "Punishment Issued") {
                        const warningId = extractWarningIdFromEmbed(message.embeds[0]);
                        if (!warningId) continue;
                        const alreadyProcessed = await isWarningIdProcessed(warningId);
                        if (!alreadyProcessed) {
                            try {
                                await handlePunishmentEmbed(message, logger);
                                handledCount++;
                            } catch (e) {
                                logger.error("[RetroScan] Ошибка обработки embed:", e);
                            }
                        } else {
                            skippedCount++;
                        }
                    }
                }
                lastId = messages.last()?.id;
                if (!lastId) break;
            }
            logger.info(`[RetroScan] Сканирование embed завершено. Всего просмотрено: ${fetchedTotal}, обработано новых: ${handledCount}, пропущено: ${skippedCount}`);
        } else {
            logger.warn(`[RetroScan] Не удалось получить канал наказаний!`);
        }
    } catch (e) {
        logger.error(`[RetroScan] Ошибка при сканировании канала: ${e}`);
    }

    // --- Синхронизация SLASH-команд ---
    try {
        const rest = new REST({ version: '10' }).setToken(BOTTOKEN);
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commandsData }
        );
        logger.info("🔁 Slash-команды синхронизированы глобально.");
        commandsData.forEach(cmd => logger.info(`✅ Зарегистрирована команда: /${cmd.name}`));
    } catch (e) {
        logger.error(`❌ Ошибка синхронизации: ${e}`);
    }

    // --- Мониторинг ERLC ---
    const monitorErlc = require('./utils/monitorErlc');
    let hourlyViolations = 0;
    let lastHourlyLog = Date.now();

    setInterval(async () => {
        try {
            const result = await monitorErlc(client);
            if (result && typeof result.violations === 'number') {
                hourlyViolations += result.violations;
            }
        } catch (e) {}
        if (Date.now() - lastHourlyLog > 3600000) {
            logger.info(`[ERLC] За последний час нарушений: ${hourlyViolations}`);
            hourlyViolations = 0;
            lastHourlyLog = Date.now();
        }
    }, 15000);
});

// --- КУЛДАУНЫ ДЛЯ КОМАНД --- //
const lastUsed = new Map();
const COMMAND_COOLDOWN = 1500;

// --- ОБРАБОТКА ИНТЕРАКЦИЙ (команды, кнопки, селекты, модалки, автокомплит) --- //
client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isChatInputCommand()) {
        const now = Date.now();
        const userId = interaction.user.id;
        if (lastUsed.has(userId) && now - lastUsed.get(userId) < COMMAND_COOLDOWN) {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: `⏳ Подожди чуть-чуть перед следующей командой!`, flags: 64 });
            }
            return;
        }
        lastUsed.set(userId, now);

        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction, { db, vipDb, logger, client });
        } catch (error) {
            logger.error(`Ошибка SLASH-команды: ${error}`);
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: `❌ Ошибка: ${error.message}`, flags: 64 });
                }
            } catch (e) {}
        }
        return;
    }

    if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);
        if (command && typeof command.autocomplete === 'function') {
            try {
                await command.autocomplete(interaction, { db, vipDb, logger, client });
            } catch (e) {
                logger.error(`Ошибка autocomplete: ${e}`);
            }
        }
        return;
    }

    if (interaction.isModalSubmit()) {
        let handled = false;
        for (const cog of client.commands.values()) {
            if (typeof cog.handleModal === 'function') {
                try {
                    const result = await cog.handleModal(interaction, { db, vipDb, logger, client });
                    if (result === true) {
                        handled = true;
                        break;
                    }
                } catch (error) {
                    logger.error(`Ошибка в handleModal: ${error}`);
                    try {
                        if (!interaction.replied && !interaction.deferred) {
                            await interaction.reply({ content: `❌ Ошибка при отправке формы: ${error.message}`, flags: 64 });
                        }
                    } catch {}
                    handled = true;
                    break;
                }
            }
        }
        if (!handled) {
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: '❌ Неизвестная форма! Возможно, она была удалена или устарела.', flags: 64 });
                }
            } catch (e) {
                logger.error(`Ошибка при отправке фоллбека для неизвестной формы: ${e}`);
            }
        }
        return;
    }

    if (interaction.isButton()) {
        let handled = false;
        for (const cog of client.commands.values()) {
            if (typeof cog.onInteraction === 'function') {
                try {
                    const result = await cog.onInteraction(interaction, { db, vipDb, logger, client });
                    if (result === true) {
                        handled = true;
                        break;
                    }
                } catch (error) {
                    logger.error(`Ошибка в onInteraction: ${error}`);
                }
            }
        }
        if (!handled) {
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: '❌ Неизвестная кнопка! Возможно, она устарела или была удалена.', flags: 64 });
                }
            } catch (e) {
                logger.error(`Ошибка при отправке фоллбека для неизвестной кнопки: ${e}`);
            }
        }
        return;
    }

    if (interaction.isStringSelectMenu()) {
        let handled = false;
        for (const cog of client.commands.values()) {
            if (typeof cog.onInteraction === 'function') {
                try {
                    const result = await cog.onInteraction(interaction, { db, vipDb, logger, client });
                    if (result === true) {
                        handled = true;
                        break;
                    }
                } catch (error) {
                    logger.error(`Ошибка в onInteraction (select menu): ${error}`);
                }
            }
        }
        if (!handled) {
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: '❌ Неизвестное меню! Возможно, оно было удалено или устарело.', flags: 64 });
                }
            } catch (e) {
                logger.error(`Ошибка при отправке фоллбека для неизвестного меню: ${e}`);
            }
        }
        return;
    }
});

// === Обработка префиксной команды mrblx!erlc игроки ===
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    const content = message.content.toLowerCase().trim();

    if (content.startsWith('mrblx!erlc игроки')) {
        const cog = client.commands.get('erlc');
        if (cog && typeof cog.messageRun === 'function') {
            const args = content.split(' ').slice(1);
            await cog.messageRun(message, args, { db, vipDb, logger, client });
        }
    }
});

// === ОБРАБОТКА EMBED НАКАЗАНИЯ ===
client.on('messageCreate', async (message) => {
    if (message.channel.id === PUNISHMENT_CHANNEL_ID && message.embeds?.length > 0) {
        logger.info('Punishment embed найден');
    }

    if (
        message.channel.id === PUNISHMENT_CHANNEL_ID &&
        message.embeds?.length > 0 &&
        message.embeds[0].title === 'Punishment Issued'
    ) {
        logger.info('Обработка embed наказания!');
        try {
            await handlePunishmentEmbed(message, logger);
        } catch (e) {
            logger.error(`Ошибка обработки embed наказания: ${e}`);
        }
    }
});

client.login(BOTTOKEN);