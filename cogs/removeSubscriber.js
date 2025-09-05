const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { SUBSCRIBER_ROLE, LOG_CHANNEL, ADMIN_ROLES } = require('../apikeys');
const { getSubscribersDb } = require('../utils/database');
const { STATUS_ROLES, BOOSTER_ROLE_ID, STATUS_LABELS } = require('../constants');
const noblox = require('noblox.js');

// Получить Roblox userId через noblox.js (официальная Roblox база)
async function getRobloxId(username) {
    // username должен быть строкой и не пустым
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
        .setName('убрать_подписчика')
        .setDescription('Убрать подписчика из базы данных')
        .addUserOption(option =>
            option.setName('дискорд')
                .setDescription('Discord пользователь для удаления')
                .setRequired(true)
        ),
    async execute(interaction) {
        if (!interaction.member.roles.cache.some(role => ADMIN_ROLES.includes(role.id))) {
            return interaction.reply({
                ephemeral: true,
                embeds: [new EmbedBuilder().setDescription('❌ Нет прав для этой команды!').setColor(0xF31F1F)]
            });
        }
        const user = interaction.options.getUser('дискорд');
        const db = getSubscribersDb();
        db.get("SELECT roblox_username, subscription_days, status, booster FROM subscribers WHERE discord_id = ?", [user.id], async (err, row) => {
            if (!row) {
                await interaction.reply({ ephemeral: true, embeds: [new EmbedBuilder().setDescription(`❌ Пользователь <@${user.id}> не найден в базе!`).setColor(0xF31F1F)] });
                db.close();
                return;
            }
            db.run("DELETE FROM subscribers WHERE discord_id = ?", [user.id]);
            try {
                const member = await interaction.guild.members.fetch(user.id);
                if (member) {
                    // Снимаем роль подписчика
                    const subscriberRole = interaction.guild.roles.cache.get(SUBSCRIBER_ROLE);
                    if (subscriberRole && member.roles.cache.has(subscriberRole.id)) {
                        await member.roles.remove(subscriberRole).catch((e) => {console.error("Ошибка снятия роли подписчика:", e);});
                    }
                    // Снимаем статусные роли
                    Object.values(STATUS_ROLES).forEach(roleId => {
                        const role = interaction.guild.roles.cache.get(roleId);
                        if (role && member.roles.cache.has(role.id)) {
                            member.roles.remove(role).catch((e) => {console.error(`Ошибка снятия роли статусной (${role.name}):`, e);});
                        }
                    });
                    // Снимаем роль бустера, если есть
                    const boosterRole = interaction.guild.roles.cache.get(BOOSTER_ROLE_ID);
                    if (boosterRole && member.roles.cache.has(boosterRole.id)) {
                        await member.roles.remove(boosterRole).catch((e) => {console.error("Ошибка снятия роли бустера:", e);});
                    }
                }
            } catch (e) {
                console.error("Ошибка снятия ролей:", e);
            }
            await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✅ Пользователь <@${user.id}> удалён из базы и лишён всех ролей подписчика.`).setColor(0xF31F1F)] });

            // Получаем Roblox userId и формируем ссылку через noblox.js
            let robloxProfile = row.roblox_username;
            const robloxId = await getRobloxId(row.roblox_username);
            if (robloxId) {
                robloxProfile = `[${row.roblox_username}](https://www.roblox.com/users/${robloxId}/profile)`;
            }

            try {
                const channel = interaction.guild.channels.cache.get(LOG_CHANNEL);
                if (channel) {
                    let statusText = row.booster ? STATUS_LABELS[BOOSTER_ROLE_ID] : (STATUS_LABELS[row.status] || 'Нет');
                    channel.send({ embeds: [new EmbedBuilder()
                        .setTitle('🗑️ Подписчик удалён')
                        .addFields(
                            { name: 'Пользователь', value: `<@${user.id}>` },
                            { name: 'Roblox ник', value: robloxProfile },
                            { name: 'Было дней подписки', value: String(row.subscription_days) },
                            { name: 'Статус', value: statusText }
                        ).setColor(0xF31F1F)] });
                }
            } catch (e) { }
            db.close();
        });
    }
};