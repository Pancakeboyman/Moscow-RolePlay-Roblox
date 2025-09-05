const { EmbedBuilder } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const noblox = require('noblox.js');
const path = require('path');

// --- Импорт банов и bloxlink ---
const { banUser } = require('../utils/banUser');
const { getDiscordId } = require('../utils/bloxlink');

const DB_PATH = path.resolve(__dirname, '../data/roblox_punishments.db');
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS punishments (
        userId TEXT PRIMARY KEY,
        username TEXT,
        displayName TEXT,
        thumbnail TEXT,
        points INTEGER DEFAULT 0,
        lastWarningId TEXT,
        typePoints TEXT DEFAULT '{"Warning":0,"Kick":0,"Ban":0}',
        active INTEGER DEFAULT 0
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS processed_punishments (
        warningId TEXT PRIMARY KEY
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS punishments_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT,
        username TEXT,
        displayName TEXT,
        type TEXT,
        moderator TEXT,
        reason TEXT,
        moderatedAt TEXT,
        warningId TEXT,
        active INTEGER DEFAULT 0
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS oauth2_users (
        discord_id TEXT PRIMARY KEY,
        roblox_id TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS appeal_blocked (
        discordId TEXT PRIMARY KEY
    )`);
});

function markWarningIdProcessed(warningId) {
    return new Promise((resolve, reject) => {
        db.run('INSERT OR IGNORE INTO processed_punishments (warningId) VALUES (?)', [warningId], err => {
            if (err) return reject(err);
            resolve();
        });
    });
}
function isWarningIdProcessed(warningId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT warningId FROM processed_punishments WHERE warningId = ?', [warningId], (err, row) => {
            if (err) return reject(err);
            resolve(!!row);
        });
    });
}

function markPunishmentInactive(warningId) {
    return new Promise((resolve, reject) => {
        db.run('UPDATE punishments_history SET active = 1 WHERE warningId = ?', [warningId], err => {
            if (err) return reject(err);
            resolve();
        });
    });
}

function extractWarningIdFromEmbed(embed) {
    const moderatorInfo = embed.fields?.find(f => f.name === "Moderator Information")?.value || "";
    const warningId = moderatorInfo.match(/\*\*Warning ID:\*\* `?(\d+)`?/i)?.[1]?.trim();
    return warningId || null;
}

/**
 * Поиск Discord ID по Roblox ID
 * Сначала через локальную базу oauth2_users, затем через Bloxlink API
 * @param {string|number} robloxId
 * @returns {Promise<string|null>}
 */
async function findDiscordId(robloxId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT discord_id FROM oauth2_users WHERE roblox_id = ?', [String(robloxId)], async (err, row) => {
            if (err) return reject(err);
            if (row && row.discord_id) return resolve(row.discord_id);
            // Если не найден в локальной базе, ищем через Bloxlink
            try {
                const discordId = await getDiscordId(robloxId);
                if (discordId) return resolve(discordId);
            } catch (e) {}
            resolve(null);
        });
    });
}

async function handlePunishmentEmbed(message, logger = console) {
    if (!message.embeds?.length) return;
    const embed = message.embeds[0];

    let moderatorInfo = embed.fields.find(f => f.name === "Moderator Information")?.value || "";
    let violatorInfo = embed.fields.find(f => f.name === "Violator Information")?.value || "";

    const moderator = moderatorInfo.match(/\*\*Moderator:\*\* <@(\d+)>/)?.[1] ||
        moderatorInfo.match(/\*\*Moderator:\*\* ([^\n<]+)/)?.[1]?.trim();
    const warningId = moderatorInfo.match(/\*\*Warning ID:\*\* `?(\d+)`?/i)?.[1]?.trim();
    const reason = moderatorInfo.match(/\*\*Reason:\*\* ([^\n]+)/)?.[1]?.trim();
    const moderatedAtRaw = moderatorInfo.match(/\*\*Moderated At:\*\* <t:(\d+)>/)?.[1];
    const username = violatorInfo.match(/\*\*Username:\*\* ([^\n`]+)/)?.[1]?.trim();
    const displayName = violatorInfo.match(/\*\*Display Name:\*\* ([^\n`]+)/)?.[1]?.trim() || username;
    const userIdRaw = violatorInfo.match(/\*\*User ID:\*\* `?(\d+)`?/i)?.[1]?.trim();
    const typeEn = violatorInfo.match(/\*\*Punishment Type:\*\* (\w+)/i)?.[1]?.trim();

    if (!userIdRaw || !typeEn || !username || !moderator) {
        logger.info('[DEBUG] Не удалось распарсить поля!', { userIdRaw, typeEn, username, moderator });
        return;
    }

    if (warningId && await isWarningIdProcessed(warningId)) {
        logger.info('[DEBUG] WarningId уже обработан:', warningId);
        return;
    }

    const PUNISHMENT_TYPE_RU = { Warning: "Предупреждение", Kick: "Кик", Ban: "Бан" };
    const PUNISHMENT_POINTS = { Warning: 1, Kick: 2, Ban: 4 };

    async function resolveRobloxId(nick) {
        if (/^\d+$/.test(nick)) return Number(nick);
        try {
            const id = await noblox.getIdFromUsername(nick);
            if (id && !isNaN(id)) return Number(id);
        } catch { }
        return null;
    }

    async function getRobloxThumbnail(nickOrId) {
        const userId = await resolveRobloxId(nickOrId);
        if (!userId) return { userId: null, thumbnailUrl: null };
        let thumbnailUrl = null;
        try {
            const thumbArr = await noblox.getPlayerThumbnail([userId], 48, "png", false, "headshot");
            if (thumbArr && thumbArr[0] && thumbArr[0].imageUrl) thumbnailUrl = thumbArr[0].imageUrl;
        } catch { }
        return { userId, thumbnailUrl };
    }

    async function syncUserToDb(userId, username, displayName, thumbnail, pointsToAdd, warningId, typeEn) {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM punishments WHERE userId = ?', [userId], (err, row) => {
                if (err) return reject(err);
                let newPoints = (row?.points || 0) + pointsToAdd;
                let typePoints = row?.typePoints ? JSON.parse(row.typePoints) : { Warning: 0, Kick: 0, Ban: 0 };
                typePoints[typeEn] = (typePoints[typeEn] || 0) + pointsToAdd;
                db.run(
                    'INSERT INTO punishments (userId, username, displayName, points, thumbnail, lastWarningId, typePoints, active) VALUES (?, ?, ?, ?, ?, ?, ?, 0) ' +
                    'ON CONFLICT(userId) DO UPDATE SET username=excluded.username, displayName=excluded.displayName, points=excluded.points, thumbnail=excluded.thumbnail, lastWarningId=excluded.lastWarningId, typePoints=excluded.typePoints, active=0',
                    [userId, username, displayName, newPoints, thumbnail, warningId, JSON.stringify(typePoints)],
                    err => err ? reject(err) : resolve({ newPoints, typePoints })
                );
            });
        });
    }

    // --- Получить userId через ник ---
    const { userId, thumbnailUrl } = await getRobloxThumbnail(username);
    if (!userId) {
        logger.info('[DEBUG] Не удалось найти пользователя Roblox!', { username });
        return;
    }

    // --- Всё ок, начисляем и помечаем ID ---
    const typeRu = PUNISHMENT_TYPE_RU[typeEn] || typeEn;
    const pointsAdded = PUNISHMENT_POINTS[typeEn] || 0;
    const { newPoints, typePoints } = await syncUserToDb(userId, username, displayName, thumbnailUrl, pointsAdded, warningId, typeEn);

    // Добавить запись в историю наказаний (active=0)
    let moderatedAt = 'Неизвестно';
    if (moderatedAtRaw) {
        const ts = Number(moderatedAtRaw);
        moderatedAt = `<t:${ts}:f>`;
    }
    db.run(
        'INSERT INTO punishments_history (userId, username, displayName, type, moderator, reason, moderatedAt, warningId, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)',
        [userId, username, displayName, typeEn, moderator, reason, moderatedAt, warningId]
    );

    // --- Бан пользователя в игре и апелляциях ---
    let banStatusText = '';
    if (typeEn === "Ban") {
        // Бан Roblox-пользователя в ERLC
        await banUser(userId);

        // Поиск Discord ID через локальную базу, затем через Bloxlink, если не найдено
        let discordId = null;
        try {
            discordId = await findDiscordId(userId);
            if (discordId) {
                db.run('INSERT OR IGNORE INTO appeal_blocked (discordId) VALUES (?)', [discordId]);
                banStatusText = '\nПользователь также заблокирован в апелляциях.';
            } else {
                banStatusText = '\n❗ Не удалось найти Discord ID для блокировки апелляций (нет связки в базе или Bloxlink).';
            }
        } catch (e) {
            banStatusText = '\n❗ Ошибка при попытке блокировки апелляций: ' + (e?.message || e);
            logger.error('[banUser/appeal_blocked] Ошибка:', e);
        }
    }

    const replyEmbed = new EmbedBuilder()
        .setColor(0x2B2D31)
        .setTitle('Наказание выдано')
        .addFields(
            {
                name: 'Информация о нарушителе',
                value:
                    `> **Ник:** ${username}\n`
                    + `> **Айди:** \`${userId}\`\n`
                    + `> **ID наказания:** \`${warningId || '—'}\`\n`
                    + `> **Тип наказания:** ${typeRu}\n`
                    + `> **Выдано баллов:** ${pointsAdded}\n`
                    + `> **Всего баллов:** ${newPoints}/30\n`
                    + `> **Баллов по типу (${typeRu}):** ${typePoints[typeEn] || 0}`
                    + banStatusText
            },
            {
                name: 'Модератор',
                value:
                    `> **Модератор:** <@${moderator}>\n`
                    + (reason ? `> **Причина:** ${reason}\n` : "")
                    + `> **Время модерации:** ${moderatedAt}`
            }
        )
        .setFooter({ text: newPoints >= 30 ? 'Пользователь забанен автоматически.' : 'Баллы добавлены.' });

    if (thumbnailUrl) replyEmbed.setThumbnail(thumbnailUrl);

    try {
        await message.reply({ embeds: [replyEmbed] });
        logger.info('[DEBUG] Reply отправлен!');
    } catch (e) {
        logger.error("[DEBUG] Ошибка отправки reply:", e);
    }

    // Пометить warningId как обработанный
    if (warningId) await markWarningIdProcessed(warningId);
}

module.exports = {
    handlePunishmentEmbed,
    extractWarningIdFromEmbed,
    isWarningIdProcessed,
    markPunishmentInactive,
};