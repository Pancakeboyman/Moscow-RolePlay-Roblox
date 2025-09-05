const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { ADMIN_ROLES, LOG_CHANNEL } = require('../apikeys');
const { getVipDb } = require('../utils/database');
const noblox = require('noblox.js');
const { VIP_ROLE_ID, STATUS_LABELS } = require('../constants');

async function getRobloxId(username) {
    if (!username || typeof username !== 'string' || username.length === 0) return null;
    try {
        const userId = await noblox.getIdFromUsername(username);
        return userId || null;
    } catch (e) {
        return null;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('убрать_vip')
        .setDescription('Убрать VIP из базы данных')
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
        const db = getVipDb();
        db.get("SELECT roblox_username FROM vip WHERE discord_id = ?", [user.id], async (err, row) => {
            if (!row) {
                await interaction.reply({ ephemeral: true, embeds: [new EmbedBuilder().setDescription(`❌ Пользователь <@${user.id}> не найден как VIP!`).setColor(0xEEC644)] });
                db.close();
                return;
            }
            db.run("DELETE FROM vip WHERE discord_id = ?", [user.id]);
            await interaction.reply({ embeds: [new EmbedBuilder().setDescription(`✅ Пользователь <@${user.id}> удалён из базы VIP.`).setColor(0xEEC644)] });

            let robloxProfile = row.roblox_username;
            const robloxId = await getRobloxId(row.roblox_username);
            if (robloxId) {
                robloxProfile = `[${row.roblox_username}](https://www.roblox.com/users/${robloxId}/profile)`;
            }

            try {
                const channel = interaction.guild.channels.cache.get(LOG_CHANNEL);
                if (channel) {
                    channel.send({ embeds: [new EmbedBuilder()
                        .setTitle('🗑️ VIP удалён')
                        .addFields(
                            { name: 'Пользователь', value: `<@${user.id}>` },
                            { name: 'Roblox ник', value: robloxProfile },
                            { name: 'Статус', value: "VIP сервера" }
                        ).setColor(0xEEC644)] });
                }
            } catch (e) {}
            db.close();
        });
    }
};