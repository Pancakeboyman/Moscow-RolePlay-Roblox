const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const noblox = require('noblox.js');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const DB_PATH = path.resolve(__dirname, '../data/roblox_punishments.db');
const db = new sqlite3.Database(DB_PATH);

const PUNISHMENT_TYPE_RU = { Warning: "Предупреждение", Kick: "Кик", Ban: "Бан" };
const PUNISHMENT_POINTS = { Warning: 1, Kick: 2, Ban: 4 };

const popularDefaults = [
    "Roblox","Builderman","Shedletsky","Stickmasterluke","Asimo3089","Loleris","Badcc","ScriptOn","berezaa","Quenty","TheDevKing","EvilArtist","ReeseMcBlox","CloneTrooper1019","Tarabyte","Noob","EpicMinigames","Polyhex","Froast","Gusmanak","Rakion99"
];

function logObject(logger, context, obj) {
    if (logger) {
        try {
            logger.error(`[LOG] ${context}: ${JSON.stringify(obj, null, 2)}`);
        } catch (e) {
            logger.error(`[LOG] ${context}: [unserializable object]`);
        }
    }
}

async function resolveRobloxId(nick, logger) {
    logObject(logger, 'resolveRobloxId: entry', { nick });
    if (!nick) return null;
    if (/^\d+$/.test(nick)) return Number(nick);
    try {
        const id = await noblox.getIdFromUsername(nick);
        logObject(logger, 'resolveRobloxId: getIdFromUsername', { nick, id });
        if (id && !isNaN(id)) return Number(id);
    } catch (err) {
        logObject(logger, 'resolveRobloxId error', { nick, err });
    }
    return null;
}

async function getActivePunishmentsHistoryAndPoints(userId, logger) {
    logObject(logger, 'getActivePunishmentsHistoryAndPoints: entry', { userId });
    return new Promise((resolve, reject) => {
        db.all(
            'SELECT * FROM punishments_history WHERE userId = ? AND active = 0 ORDER BY id DESC',
            [userId],
            (err, rows) => {
                logObject(logger, 'getActivePunishmentsHistoryAndPoints: db.all callback', { userId, err, rows });
                if (err || !rows) {
                    logObject(logger, 'getActivePunishmentsHistoryAndPoints DB error', { userId, err });
                    return resolve({ punishments: [], points: 0 });
                }
                let points = 0;
                for (const row of rows) {
                    points += PUNISHMENT_POINTS[row.type] || 0;
                }
                logObject(logger, 'getActivePunishmentsHistoryAndPoints DB rows', { userId, rows, points });
                resolve({ punishments: rows, points });
            }
        );
    });
}

async function getThumbnailUrl(userId, logger) {
    logObject(logger, 'getThumbnailUrl: entry', { userId });
    try {
        const thumbArr = await noblox.getPlayerThumbnail([userId], 48, "png", false, "headshot");
        logObject(logger, 'getThumbnailUrl: thumbArr', { userId, thumbArr });
        if (thumbArr && thumbArr[0] && thumbArr[0].imageUrl) return thumbArr[0].imageUrl;
    } catch (err) {
        logObject(logger, 'getThumbnailUrl error', { userId, err });
    }
    return "";
}

function buildProfileEmbed(state) {
    logObject(state.logger, 'buildProfileEmbed', state);
    let embed = new EmbedBuilder()
        .setColor(0x2B2D31)
        .setTitle(`${state.robloxUsername}`)
        .addFields(
            {
                name: "Информация",
                value:
                    `> **Ник:** ${state.robloxUsername}\n`
                    + `> **Отображаемое имя:** ${state.robloxDisplayName}\n`
                    + `> **ID:** \`${state.userId}\`\n`
                    + `> **Количество друзей:** ${state.friendCount}\n`
                    + (state.createdAtUnix ? `> **Дата создания:** <t:${state.createdAtUnix}:f>\n` : "")
                    + `> **Количество групп:** ${state.groupCount}`
            },
            {
                name: "Баллы",
                value: state.points > 0 ? `> **Текущие баллы:** ${state.points}/30` : "> Баллов нет."
            }
        )
        .setAuthor({ name: state.authorName, iconURL: state.authorAvatar });
    if (state.thumbnailUrl) embed.setThumbnail(state.thumbnailUrl);
    return embed;
}

function buildPunishmentsEmbed(state, punishPage, logger) {
    logObject(logger, 'buildPunishmentsEmbed call', { punishPage, totalPages: state.totalPages, punishments: state.punishments, menuId: state.menuId });
    let embed = new EmbedBuilder()
        .setColor(0x2B2D31)
        .setTitle(state.robloxUsername)
        .setAuthor({ name: state.authorName, iconURL: state.authorAvatar });
    if (state.thumbnailUrl) embed.setThumbnail(state.thumbnailUrl);

    for (const field of punishmentFieldsForPage(state.punishments, punishPage, state.pageSize, logger)) {
        embed.addFields(field);
    }
    return embed;
}

function punishmentFieldsForPage(punishments, punishPage, pageSize, logger) {
    const start = (punishPage - 1) * pageSize;
    const pagePunishments = punishments.slice(start, start + pageSize);
    logObject(logger, 'punishmentFieldsForPage', { punishPage, pageSize, start, end: start + pageSize, total: punishments.length, pagePunishments });
    return pagePunishments.map(p => {
        const typeRu = PUNISHMENT_TYPE_RU[p.type] || p.type;
        const points = PUNISHMENT_POINTS[p.type] || 0;
        return {
            name: typeRu,
            value:
                `> **Модератор:** <@${p.moderator}>\n`
                + `> **Причина:** ${p.reason}\n`
                + `> **Время:** ${p.moderatedAt}\n`
                + `> **ID предупреждения:** \`${p.warningId}\`\n`
                + `> **Выдано баллов:** ${points}`,
            inline: false
        };
    });
}

function buildPageButtons(page, totalPages, logger) {
    logObject(logger, 'buildPageButtons', { page, totalPages });
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('page_left')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('<:MRP_ArrowLeft:1412877220942188606>'),
        new ButtonBuilder()
            .setCustomId('page_menu')
            .setStyle(ButtonStyle.Secondary)
            .setLabel(`${page}`)
            .setDisabled(false),
        new ButtonBuilder()
            .setCustomId('page_right')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('<:MRP_ArrowRight:1412877222737350656>')
    );
}

function buildPageSelect(totalPages, page, logger, menuId) {
    logObject(logger, 'buildPageSelect', { totalPages, page, menuId });
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(menuId)
            .setPlaceholder('Выберите страницу')
            .addOptions(
                Array.from({ length: totalPages }).map((_, idx) => ({
                    label: `Страница ${idx + 1}`,
                    value: `${idx + 1}`,
                    default: (idx + 1) === page
                }))
            )
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('поиск')
        .setDescription('Поиск пользователя ROBLOX по нику или ID.')
        .addStringOption(option =>
            option.setName('ник')
                .setDescription('ROBLOX ник или ID')
                .setRequired(true)
                .setAutocomplete(true)
        ),
    async execute(interaction, { logger }) {
        logObject(logger, 'execute: start', { interactionId: interaction.id, user: interaction.user.id });
        await interaction.deferReply();

        let robloxValue = interaction.options.getString('ник');
        logObject(logger, 'execute: robloxValue', { robloxValue });
        let userId = null, username = null, displayName = null;
        try {
            if (robloxValue.startsWith('{')) {
                const obj = JSON.parse(robloxValue);
                username = obj.username;
                displayName = obj.displayName;
                userId = await resolveRobloxId(username, logger);
                if (!userId && displayName) userId = await resolveRobloxId(displayName, logger);
            } else {
                userId = await resolveRobloxId(robloxValue, logger);
            }
        } catch (err) {
            logObject(logger, 'execute: resolveRobloxId error', { robloxValue, err });
            userId = await resolveRobloxId(robloxValue, logger);
        }

        logObject(logger, 'execute: userId resolved', { userId, username, displayName });

        if (!userId) {
            logObject(logger, 'execute: userId not found', { robloxValue });
            return await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x2B2D31)
                        .setTitle('Ошибка')
                        .setDescription("> Не удалось найти ROBLOX-пользователя по данному запросу.")
                ]
            });
        }

        let robloxUser = null;
        try {
            robloxUser = await noblox.getUserInfo(userId);
            logObject(logger, 'execute: getUserInfo', { userId, robloxUser });
        } catch (e) {
            logObject(logger, 'execute: getUserInfo error', { userId, e });
            robloxUser = null;
        }
        if (!robloxUser) {
            logObject(logger, 'execute: robloxUser not found', { userId });
            return await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x2B2D31)
                        .setTitle('Ошибка')
                        .setDescription("> Не удалось получить информацию о пользователе ROBLOX.")
                ]
            });
        }

        const thumbnailUrl = await getThumbnailUrl(userId, logger);
        logObject(logger, 'execute: thumbnailUrl', { userId, thumbnailUrl });

        let friendCount = "—";
        try {
            friendCount = await noblox.getFriendCount(userId);
            logObject(logger, 'execute: getFriendCount', { userId, friendCount });
            if (friendCount === undefined || friendCount === null) friendCount = "—";
        } catch (err) {
            logObject(logger, 'execute: getFriendCount error', { userId, err });
        }
        let groupCount = "—";
        try {
            const groups = await noblox.getGroups(userId);
            groupCount = Array.isArray(groups) ? groups.length : "—";
            logObject(logger, 'execute: getGroups', { userId, groupCount });
        } catch (err) {
            logObject(logger, 'execute: getGroups error', { userId, err });
        }
        let createdAtUnix = null;
        if (robloxUser.created) {
            createdAtUnix = Math.floor(new Date(robloxUser.created).getTime() / 1000);
        }

        const robloxUsername = robloxUser.name || username || "—";
        const robloxDisplayName = robloxUser.displayName || displayName || "—";

        const authorName = interaction.user.username;
        const authorAvatar = interaction.user.displayAvatarURL();

        const { punishments, points: historyPoints } = await getActivePunishmentsHistoryAndPoints(userId, logger);

        const pageSize = 3;
        const punishmentPages = Math.ceil(punishments.length / pageSize);
        const totalPages = 1 + punishmentPages;

        logObject(logger, 'execute: before reply', { userId, robloxUsername, robloxDisplayName, punishments, historyPoints, pageSize, totalPages });

        const menuId = `page_select_${interaction.id}_${Date.now()}`;
        const state = {
            robloxUsername,
            robloxDisplayName,
            userId,
            thumbnailUrl,
            friendCount,
            groupCount,
            createdAtUnix,
            points: historyPoints,
            authorName,
            authorAvatar,
            punishments,
            pageSize,
            totalPages,
            menuId,
            authorInteractionUserId: interaction.user.id,
            logger,
            mainMessageId: null // добавляем для хранения id основного сообщения
        };

        if (!punishments.length) {
            logObject(logger, 'execute: no punishments', { userId, robloxUsername });
            state.points = 0;
            return await interaction.editReply({
                embeds: [buildProfileEmbed(state)],
                components: []
            });
        }

        if (!global.searchStates) global.searchStates = new Map();
        if (!global.searchStatesByMenuId) global.searchStatesByMenuId = new Map();
        global.searchStates.set(interaction.id, state);
        global.searchStatesByMenuId.set(menuId, state);

        const buttons = totalPages > 1 ? [buildPageButtons(1, totalPages, logger)] : [];
        // Сохраняем id основного сообщения поиска!
        const sentMsg = await interaction.editReply({
            embeds: [buildProfileEmbed(state)],
            components: buttons
        });
        state.mainMessageId = sentMsg.id;
        logObject(logger, 'execute: editReply complete', { interactionId: interaction.id, mainMessageId: sentMsg.id });
    },

    async onInteraction(interaction, { logger }) {
        logObject(logger, 'onInteraction: entry', {
            isButton: interaction.isButton(),
            isStringSelectMenu: interaction.isStringSelectMenu(),
            customId: interaction.customId,
            interactionId: interaction.id,
            messageInteractionId: interaction.message?.interaction?.id,
            userId: interaction.user.id
        });

        let state = null;
        const originalId = interaction.message?.interaction?.id;
        if (originalId && global.searchStates) {
            state = global.searchStates.get(originalId);
            logObject(logger, 'onInteraction: state by message.interaction.id', { originalId, found: !!state });
        }
        if (!state && global.searchStatesByMenuId) {
            state = global.searchStatesByMenuId.get(interaction.customId);
            logObject(logger, 'onInteraction: state by menuId', { customId: interaction.customId, found: !!state });
        }

        if (!state) {
            logObject(logger, 'onInteraction: no state found', { originalId, customId: interaction.customId });
            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xff0000)
                        .setTitle('Ошибка')
                        .setDescription('❌ Неизвестное меню! Возможно, оно было удалено или устарело.')
                ],
                flags: 64
            });
            return true;
        }

        logObject(logger, 'onInteraction: state found', { menuId: state.menuId });

        // --- Проверка пользователя для всех интеракций! ---
        const isAuthor = state.authorInteractionUserId && state.authorInteractionUserId === interaction.user.id;
        if (!isAuthor) {
            logObject(logger, 'onInteraction: wrong user', { userId: interaction.user.id, expected: state.authorInteractionUserId });
            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xff0000)
                        .setTitle('Нет доступа')
                        .setDescription('❌ У вас нет прав листать страницы этого поиска.')
                ],
                flags: 64
            });
            return true;
        }

        let page = 1;
        const totalPages = state.totalPages;

        if (!state.punishments.length) {
            logObject(logger, 'onInteraction: no punishments', { userId: state.userId });
            await interaction.update({
                embeds: [buildProfileEmbed(state)],
                components: []
            });
            return true;
        }

        if (interaction.isButton()) {
            const label = interaction.message.components[0].components[1].label;
            page = parseInt(label) || 1;
            logObject(logger, 'onInteraction: before page change', { label, page, customId: interaction.customId, totalPages });

            if (interaction.customId === 'page_left') {
                page = (page - 1 < 1) ? totalPages : page - 1;
            } else if (interaction.customId === 'page_right') {
                page = (page + 1 > totalPages) ? 1 : page + 1;
            } else if (interaction.customId === 'page_menu') {
                logObject(logger, 'onInteraction: page_menu', { menuId: state.menuId, page, totalPages });
                let selectRow = buildPageSelect(totalPages, page, logger, state.menuId);
                await interaction.reply({ content: "Выберите страницу:", components: [selectRow], ephemeral: true });
                logObject(logger, 'onInteraction: reply to page_menu', { selectRow, ephemeral: true });
                return true;
            }

            logObject(logger, 'onInteraction: after page change', { page, totalPages });
            let showEmbed;
            if (page === 1) {
                showEmbed = buildProfileEmbed(state);
            } else {
                showEmbed = buildPunishmentsEmbed(state, page - 1, logger);
            }
            const buttons = totalPages > 1 ? [buildPageButtons(page, totalPages, logger)] : [];
            await interaction.update({
                embeds: [showEmbed],
                components: buttons
            });
            logObject(logger, 'onInteraction: update after page change', { page, buttons });
            return true;
        } else if (interaction.isStringSelectMenu()) {
            logObject(logger, 'onInteraction: StringSelectMenu', {
                customId: interaction.customId,
                menuId: state.menuId,
                values: interaction.values
            });

            if (interaction.customId === state.menuId) {
                page = Number(interaction.values[0]);
                logObject(logger, 'onInteraction: page_select', { page, totalPages, mainMessageId: state.mainMessageId });
                let showEmbed = page === 1
                    ? buildProfileEmbed(state)
                    : buildPunishmentsEmbed(state, page - 1, logger);
                const buttons = totalPages > 1 ? [buildPageButtons(page, totalPages, logger)] : [];
                try {
                    const mainMsg = await interaction.channel.messages.fetch(state.mainMessageId);
                    await mainMsg.edit({
                        embeds: [showEmbed],
                        components: buttons
                    });
                    logObject(logger, 'onInteraction: mainMsg.edit after page_select', { page, buttons });
                } catch (e) {
                    logObject(logger, 'onInteraction: mainMsg.edit error', { e });
                }
                // Сначала обязательно отвечаем интеракции (пусть даже пусто), затем удаляем
                await interaction.update({ content: '\u200b', components: [] });
                try {
                    await interaction.deleteReply();
                    logObject(logger, 'onInteraction: ephemeral select menu deleted');
                } catch (e) {
                    logObject(logger, 'onInteraction: deleteReply error', { e });
                }
                return true;
            } else {
                logObject(logger, 'onInteraction: unknown menuId', { customId: interaction.customId, expected: state.menuId });
                await interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xff0000)
                            .setTitle('Ошибка')
                            .setDescription('❌ Неизвестное меню! Возможно, оно было удалено или устарело.')
                    ],
                    flags: 64
                });
                return true;
            }
        }
        logObject(logger, 'onInteraction: finished', {});
        return false;
    },

    async autocomplete(interaction, { logger }) {
        logObject(logger, 'autocomplete: entry', { value: interaction.options.getFocused() });
        const value = interaction.options.getFocused();
        let results = [];

        if (!value || value.length < 1) {
            results = popularDefaults.slice(0, 20).map(nick => ({
                name: nick,
                value: JSON.stringify({ username: nick, displayName: nick })
            }));
            await interaction.respond(results);
            logObject(logger, 'autocomplete: respond default', { results });
            return;
        }

        try {
            const url = `https://apis.roblox.com/search-api/omni-search?verticalType=user&searchQuery=${encodeURIComponent(value)}&pageToken=&globalSessionId=8fefd242-5667-42e3-9735-e2044c15b567&sessionId=8fefd242-5667-42e3-9735-e2044c15b567`;
            const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
            const data = await res.json();
            const items = (data?.searchResults?.[0]?.contents || []);
            results = items.slice(0, 20).map(u => ({
                name: `${u.displayName} (@${u.username})`,
                value: JSON.stringify({ username: u.username, displayName: u.displayName })
            }));
            logObject(logger, 'autocomplete: respond API', { results });
        } catch (e) {
            logObject(logger, 'autocomplete: search error', { value, e });
            results = popularDefaults.slice(0, 20).map(nick => ({
                name: nick,
                value: JSON.stringify({ username: nick, displayName: nick })
            }));
        }
        await interaction.respond(results);
        logObject(logger, 'autocomplete: respond final', { results });
    }
};