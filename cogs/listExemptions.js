const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getSubscribersDb } = require('../utils/database');
const noblox = require('noblox.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('список_исключений')
        .setDescription('Показать все активные исключения (по ролям)'),
    async execute(interaction) {
        const db = getSubscribersDb();
        db.all("SELECT discord_id, roblox_username, exempt_role_id FROM subscribers WHERE status = 'exempt'", async (err, rows) => {
            db.close();
            if (err || !rows || rows.length === 0) {
                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('📋 Список исключений')
                            .setDescription('В базе нет активных исключений.')
                            .setColor(0xCC2641)
                    ],
                    ephemeral: true
                });
            }

            // Собираем красивый список
            let description = '';
            for (const row of rows) {
                let robloxId = null;
                try {
                    robloxId = await noblox.getIdFromUsername(row.roblox_username);
                } catch { /* ignore */ }
                const robloxProfile = robloxId
                    ? `[${row.roblox_username}](https://www.roblox.com/users/${robloxId}/profile)`
                    : row.roblox_username;
                description += `**Discord:** <@${row.discord_id}>\n**Roblox:** ${robloxProfile}\n**Роль исключения:** <@&${row.exempt_role_id}>\n\n`;
            }

            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('📋 Активные исключения')
                        .setDescription(description)
                        .setColor(0xCC2641)
                ],
                ephemeral: false
            });
        });
    }
};