const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { ADMIN_ROLES } = require('../apikeys');
const { getVipDb } = require('../utils/database');
const noblox = require('noblox.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('активные_vip')
        .setDescription('Показать список активных VIP'),
    async execute(interaction) {
        if (!interaction.member.roles.cache.some(role => ADMIN_ROLES.includes(role.id))) {
            return interaction.reply({
                ephemeral: true,
                embeds: [new EmbedBuilder().setDescription('❌ Нет прав для этой команды!').setColor(0xF31F1F)]
            });
        }
        const db = getVipDb();
        db.all(
            "SELECT discord_id, roblox_username, created_at FROM vip ORDER BY created_at DESC",
            async (err, vips) => {
                if (!vips || vips.length === 0) {
                    return interaction.reply({
                        embeds: [new EmbedBuilder().setTitle('ℹ️ Нет VIP').setDescription('В данный момент нет активных VIP.').setColor(0xEEC644)]
                    });
                }
                let lines = [];
                const robloxUserIds = await Promise.all(
                    vips.map(vip => noblox.getIdFromUsername(vip.roblox_username).catch(() => null))
                );
                for (const [i, vip] of vips.entries()) {
                    let userMention = `<@${vip.discord_id}>`;
                    let robloxProfile = robloxUserIds[i]
                        ? `[${vip.roblox_username}](https://www.roblox.com/users/${robloxUserIds[i]}/profile)`
                        : vip.roblox_username;
                    lines.push(`\`${i + 1}.\` ${userMention} | **Roblox:** ${robloxProfile} | **Статус:** VIP`);
                }
                await interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setTitle('✅ Активные VIP')
                        .setDescription(lines.join('\n'))
                        .setColor(0xEEC644)]
                });
                db.close();
            }
        );
    }
};