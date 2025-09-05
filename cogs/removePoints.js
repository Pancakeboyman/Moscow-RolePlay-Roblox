const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const noblox = require('noblox.js');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const path = require('path');

const popularDefaults = [
    "Roblox", "Builderman", "Shedletsky", "Stickmasterluke", "Asimo3089", "Loleris", "Badcc", "ScriptOn", "berezaa", "Quenty", "TheDevKing", "EvilArtist", "ReeseMcBlox", "CloneTrooper1019", "Tarabyte", "Noob", "EpicMinigames", "Polyhex", "Froast", "Gusmanak", "Rakion99"
];

const ALLOWED_ROLES = ['1331342900205850686', '1368561596921548900'];

const DB_PATH = path.resolve(__dirname, '../data/roblox_punishments.db');
const db = new sqlite3.Database(DB_PATH);

const PUNISHMENT_POINTS = { Warning: 1, Kick: 2, Ban: 4 };
const PUNISHMENT_TYPE_RU = {
    Warning: "Предупреждение",
    Kick: "Кик",
    Ban: "Бан",
};

function hasAllowedRole(interaction) {
    return interaction.member.roles.cache.some(role => ALLOWED_ROLES.includes(role.id));
}

function normalizeUserId(val) {
    // Строка, без .0 на конце
    if (typeof val === 'number') return String(val);
    if (typeof val === 'string') return val.replace(/\.0$/, '');
    return '';
}

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

async function getPointsOfType(userId, typeEn) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM punishments WHERE userId = ?', [userId], (err, row) => {
            if (err || !row) return resolve(0);
            try {
                const typePoints = row.typePoints ? JSON.parse(row.typePoints) : {};
                resolve(typePoints[typeEn] || 0);
            } catch {
                resolve(0);
            }
        });
    });
}

async function getHistoryByWarningId(warningId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM punishments_history WHERE warningId = ?', [warningId], (err, row) => {
            if (err || !row) return resolve(null);
            resolve(row);
        });
    });
}

async function removePointsFromDb(userId, typeEn, pointsToSub, warningId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM punishments WHERE userId = ?', [userId], (err, row) => {
            if (err || !row) return reject(err);
            let newPoints = row?.points || 0;
            let typePoints = row?.typePoints ? JSON.parse(row.typePoints) : {};
            let currentTypePoints = typePoints[typeEn] || 0;

            if (currentTypePoints < pointsToSub) pointsToSub = currentTypePoints;
            typePoints[typeEn] = Math.max(0, currentTypePoints - pointsToSub);
            newPoints = Math.max(0, newPoints - pointsToSub);

            let updateQuery, updateParams;
            if (newPoints === 0 && Object.values(typePoints).every(x => x === 0)) {
                updateQuery = 'UPDATE punishments SET points = ?, typePoints = ?, active = 1 WHERE userId = ?';
                updateParams = [newPoints, JSON.stringify(typePoints), userId];
            } else {
                updateQuery = 'UPDATE punishments SET points = ?, typePoints = ? WHERE userId = ?';
                updateParams = [newPoints, JSON.stringify(typePoints), userId];
            }

            db.run(
                updateQuery,
                updateParams,
                err => {
                    if (err) return reject(err);
                    db.run(
                        'UPDATE punishments_history SET active = 1 WHERE warningId = ?',
                        [warningId],
                        err2 => err2 ? reject(err2) : resolve({ newPoints, typePoints })
                    );
                }
            );
        });
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('снять')
        .setDescription('Снять баллы у игрока Roblox')
        .addSubcommand(sub =>
            sub
                .setName('баллы')
                .setDescription('Снять баллы по типу и ID предупреждения')
                .addStringOption(option =>
                    option
                        .setName('ник')
                        .setDescription('Roblox ник или ID')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addStringOption(option =>
                    option
                        .setName('тип')
                        .setDescription('Тип наказания')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Предупреждение', value: 'Warning' },
                            { name: 'Кик', value: 'Kick' },
                            { name: 'Бан', value: 'Ban' }
                        )
                )
                .addStringOption(option =>
                    option
                        .setName('id_наказания')
                        .setDescription('ID наказания (warningId)')
                        .setRequired(true)
                )
        ),
    async execute(interaction) {
        if (!hasAllowedRole(interaction)) {
            return await interaction.reply({ 
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xff0000)
                        .setTitle('Ошибка')
                        .setDescription('⛔ Нет прав на выполнение этой команды!')
                ], 
                flags: 64
            });
        }
        const subcommand = interaction.options.getSubcommand();
        if (subcommand !== 'баллы') {
            return await interaction.reply({ 
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xff0000)
                        .setTitle('Ошибка')
                        .setDescription('❌ Неизвестная команда!')
                ],
                flags: 64
            });
        }

        const nick = interaction.options.getString('ник');
        const typeEn = interaction.options.getString('тип');
        const warningId = interaction.options.getString('id_наказания');
        await interaction.deferReply();

        const { userId, thumbnailUrl } = await getRobloxThumbnail(nick);

        if (!userId) {
            return await interaction.editReply({
                embeds: [
                    new EmbedBuilder().setColor(0xff0000).setTitle('Ошибка').setDescription('Не удалось найти пользователя Roblox!')
                ],
                flags: 64
            });
        }

        // --- Исправление: сравниваем userId как строки без .0 ---
        const userIdNorm = normalizeUserId(userId);
        const historyRow = await getHistoryByWarningId(warningId);
        if (!historyRow) {
            return await interaction.editReply({
                embeds: [
                    new EmbedBuilder().setColor(0xff0000).setTitle('Ошибка')
                        .setDescription('Не найдено активного наказания с таким ID предупреждения, ником и типом. Проверьте данные.')
                ],
                flags: 64
            });
        }
        // Тут тоже нормализуем userId из базы
        const historyRowUserIdNorm = normalizeUserId(historyRow.userId);

        if (historyRowUserIdNorm !== userIdNorm) {
            return await interaction.editReply({
                embeds: [
                    new EmbedBuilder().setColor(0xff0000).setTitle('Ошибка')
                        .setDescription('ID пользователя в истории не совпадает с этим ником. Проверьте правильность ника/ID.')
                ],
                flags: 64
            });
        }
        if (historyRow.type !== typeEn) {
            return await interaction.editReply({
                embeds: [
                    new EmbedBuilder().setColor(0xff0000).setTitle('Ошибка')
                        .setDescription('Тип наказания не совпадает с типом в истории.')
                ],
                flags: 64
            });
        }
        if (Number(historyRow.active) !== 0) {
            return await interaction.editReply({
                embeds: [
                    new EmbedBuilder().setColor(0xff0000).setTitle('Ошибка')
                        .setDescription('Данное наказание уже снято ранее.')
                ],
                flags: 64
            });
        }

        const typePoints = await getPointsOfType(userId, typeEn);
        if (!typePoints || typePoints <= 0) {
            return await interaction.editReply({
                embeds: [
                    new EmbedBuilder().setColor(0xff9900).setTitle('Нет баллов по выбранному наказанию')
                        .setDescription(`У пользователя нет баллов за наказание "${PUNISHMENT_TYPE_RU[typeEn] || typeEn}".`)
                ],
                flags: 64
            });
        }

        const pointsToSub = Math.min(PUNISHMENT_POINTS[typeEn], typePoints);
        await removePointsFromDb(userId, typeEn, pointsToSub, warningId);

        const embed = new EmbedBuilder()
            .setColor(0x2B2D31)
            .setTitle('Баллы сняты')
            .setDescription(`Баллы за ${PUNISHMENT_TYPE_RU[typeEn] || typeEn} успешно сняты!`)
            .addFields({
                name: 'Информация о нарушителе',
                value:
                    `> **Ник:** ${nick}\n`
                    + `> **Айди:** \`${userIdNorm}\`\n`
                    + `> **ID предупреждения:** \`${warningId}\`\n`
                    + `> **Тип снятого наказания:** ${PUNISHMENT_TYPE_RU[typeEn] || typeEn}\n`
                    + `> **Снято баллов:** ${pointsToSub}`
            });

        if (thumbnailUrl) embed.setThumbnail(thumbnailUrl);
        await interaction.editReply({ embeds: [embed], flags: 64 });
    },

    async autocomplete(interaction) {
        const value = interaction.options.getFocused();
        let results = [];
        
        if (!value || value.length < 1) {
            results = popularDefaults.slice(0, 20).map(nick => ({
                name: nick,
                value: nick
            }));
            await interaction.respond(results);
            return;
        }

        try {
            const url = `https://apis.roblox.com/search-api/omni-search?verticalType=user&searchQuery=${encodeURIComponent(value)}&pageToken=&globalSessionId=8fefd242-5667-42e3-9735-e2044c15b567&sessionId=8fefd242-5667-42e3-9735-e2044c15b567`;
            const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
            const data = await res.json();
            const items = (data?.searchResults?.[0]?.contents || []);
            results = items.slice(0, 20).map(u => ({
                name: `${u.displayName} (@${u.username})`,
                value: u.username
            }));
        } catch (e) {
            results = popularDefaults.slice(0, 20).map(nick => ({
                name: nick,
                value: nick
            }));
        }
        await interaction.respond(results);
    }
};
