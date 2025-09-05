const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { ADMIN_ROLES, LOG_CHANNEL } = require('../apikeys');
const { getSubscribersDb } = require('../utils/database');
const noblox = require('noblox.js');
const { BOOSTER_ROLE_ID, STATUS_LABELS } = require('../constants');

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
        .setName('убрать_бустера')
        .setDescription('Убрать бустера из базы данных')
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
        db.get("SELECT roblox_username, subscription_days, booster FROM subscribers WHERE discord_id = ? AND booster = 1", [user.id], async (err, row) => {
            if (!row) {
                await interaction.reply({ ephemeral: true, embeds: [new EmbedBuilder().setDescription(`❌ Пользователь <@${user.id}> не найден как бустер!`).setColor(0xF31F1F)] });
                db.close();
                return;
            }
            db.run("DELETE FROM subscribers WHERE discord_id = ? AND booster = 1", [user.id]);
            // Не забираем роль бустера!
            await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✅ Пользователь <@${user.id}> удалён из базы бустеров.`).setColor(0xF31F1F)] });

            // Получаем Roblox userId и формируем ссылку через noblox.js
            let robloxProfile = row.roblox_username;
            const robloxId = await getRobloxId(row.roblox_username);
            if (robloxId) {
                robloxProfile = `[${row.roblox_username}](https://www.roblox.com/users/${robloxId}/profile)`;
            }

            try {
                const channel = interaction.guild.channels.cache.get(LOG_CHANNEL);
                if (channel) {
                    channel.send({ embeds: [new EmbedBuilder()
                        .setTitle('🗑️ Бустер удалён')
                        .addFields(
                            { name: 'Пользователь', value: `<@${user.id}>` },
                            { name: 'Roblox ник', value: robloxProfile },
                            { name: 'Было дней подписки', value: String(row.subscription_days) },
                            { name: 'Статус', value: STATUS_LABELS[BOOSTER_ROLE_ID] || "Бустер сервера" }
                        ).setColor(0xF31F1F)] });
                }
            } catch (e) { }
            db.close();
        });
    }
};