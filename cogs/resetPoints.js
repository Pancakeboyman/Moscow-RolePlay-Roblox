const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const noblox = require('noblox.js');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const popularDefaults = [
    "Roblox", "Builderman", "Shedletsky", "Stickmasterluke", "Asimo3089", "Loleris", "Badcc", "ScriptOn", "berezaa", "Quenty", "TheDevKing", "EvilArtist", "ReeseMcBlox", "CloneTrooper1019", "Tarabyte", "Noob", "EpicMinigames", "Polyhex", "Froast", "Gusmanak", "Rakion99"
];

const ALLOWED_ROLES = ['1331342900205850686'];

const path = require('path');
const DB_PATH = path.resolve(__dirname, '../data/roblox_punishments.db');
const db = new sqlite3.Database(DB_PATH);

function hasAllowedRole(interaction) {
    return interaction.member.roles.cache.some(role => ALLOWED_ROLES.includes(role.id));
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

async function getPoints(userId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT points FROM punishments WHERE userId = ?', [userId], (err, row) => {
            if (err || !row) return resolve(0);
            resolve(row.points || 0);
        });
    });
}

async function resetPointsDb(userId) {
    return new Promise((resolve, reject) => {
        db.run(
            'UPDATE punishments SET points = 0, typePoints = ?, active = 1 WHERE userId = ?',
            [JSON.stringify({ Warning: 0, Kick: 0, Ban: 0 }), userId],
            err => {
                if (err) return reject(err);
                db.run('UPDATE punishments_history SET active = 1 WHERE userId = ?', [userId], err2 => {
                    if (err2) return reject(err2);
                    resolve(0);
                });
            }
        );
    });
}

async function getLastWarningId(userId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT lastWarningId FROM punishments WHERE userId = ?', [userId], (err, row) => {
            if (err) return resolve(null);
            resolve(row?.lastWarningId || null);
        });
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('сбросить')
        .setDescription('Сбросить баллы у игрока Roblox')
        .addSubcommand(sub =>
            sub
                .setName('баллы')
                .setDescription('Сбросить баллы (снимает все наказания)')
                .addStringOption(option =>
                    option
                        .setName('ник')
                        .setDescription('Roblox ник или ID')
                        .setRequired(true)
                        .setAutocomplete(true)
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

        const points = await getPoints(userId);
        if (!points || points <= 0) {
            return await interaction.editReply({
                embeds: [
                    new EmbedBuilder().setColor(0xff9900).setTitle('Нет баллов для сброса')
                        .setDescription('У пользователя нет баллов для сброса.')
                ],
                flags: 64
            });
        }

        await resetPointsDb(userId);
        const warningId = await getLastWarningId(userId);

        const embed = new EmbedBuilder()
            .setColor(0x2B2D31)
            .setTitle('Баллы сброшены')
            .setDescription('Все баллы успешно сброшены! Все наказания сняты.')
            .addFields({
                name: 'Информация о нарушителе',
                value:
                    `> **Ник:** ${nick}\n`
                    + `> **Айди:** \`${userId}\`\n`
                    + `> **ID наказания:** \`${warningId || '—'}\`\n`
                    + `> **Осталось баллов:** 0/30`
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