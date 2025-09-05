const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { ADMIN_ROLES } = require('../apikeys');
const noblox = require('noblox.js');

const STATUS_LABELS = {
    1: "Арбат",
    2: "Тверская",
    3: "Кремль"
};

// Получить Roblox userId через noblox.js (официальная Roblox база)
async function getRobloxId(username) {
    if (!username || typeof username !== 'string' || username.length === 0) return null;
    try {
        const userId = await noblox.getIdFromUsername(username);
        return userId || null;
    } catch (e) {
        console.error("getRobloxId error:", e);
        return null;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('активные_подписки')
        .setDescription('Показать список активных подписчиков'),
    async execute(interaction, { db }) {
        if (!interaction.member.roles.cache.some(role => ADMIN_ROLES.includes(role.id))) {
            return interaction.reply({
                ephemeral: true,
                embeds: [new EmbedBuilder().setDescription('❌ Нет прав для этой команды!').setColor(0xF31F1F)]
            });
        }
        // Только активные!
        db.all(
            "SELECT discord_id, roblox_username, subscription_days, created_at, expires_at, status, booster FROM subscribers WHERE expires_at > datetime('now') ORDER BY expires_at DESC",
            async (err, subs) => {
                if (!subs || subs.length === 0) {
                    return interaction.reply({
                        embeds: [new EmbedBuilder().setTitle('ℹ️ Нет активных подписчиков').setDescription('В данный момент нет активных подписчиков.').setColor(0xF31F1F)]
                    });
                }
                const now = Date.now();
                let lines = [];
                // Получаем userId'ы для всех Roblox-ников параллельно через noblox.js
                const robloxUserIds = await Promise.all(subs.map(sub => getRobloxId(sub.roblox_username)));

                for (const [i, sub] of subs.entries()) {
                    let userMention = `<@${sub.discord_id}>`;
                    let expiresAt = sub.expires_at ? new Date(sub.expires_at) : null;
                    let left = '';
                    if (expiresAt) {
                        const diff = expiresAt.getTime() - now;
                        if (diff > 0) left = `${Math.floor(diff / (24 * 60 * 60 * 1000))} дн.`;
                        else left = 'истекла';
                    } else {
                        left = '∞';
                    }
                    let statusText = sub.booster ? "Бустер сервера" : (STATUS_LABELS[sub.status] || 'Нет');
                    let robloxProfile = robloxUserIds[i]
                        ? `[${sub.roblox_username}](https://www.roblox.com/users/${robloxUserIds[i]}/profile)`
                        : sub.roblox_username;
                    lines.push(`\`${i + 1}.\` ${userMention} | **Roblox:** ${robloxProfile} | **Осталось:** ${left} | **Статус:** ${statusText}`);
                }
                interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setTitle('✅ Активные подписчики')
                        .setDescription(lines.join('\n'))
                        .setColor(0xF31F1F)]
                });
            }
        );
    }
};