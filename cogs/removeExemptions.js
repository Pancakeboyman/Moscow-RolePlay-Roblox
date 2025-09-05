const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { ADMIN_ROLES, LOG_CHANNEL } = require('../apikeys');
const { getSubscribersDb } = require('../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('убрать_исключение')
        .setDescription('Убрать пользователя из базы исключений')
        .addUserOption(option =>
            option.setName('дискорд')
                .setDescription('Discord пользователь')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('роль')
                .setDescription('ID исключающей роли')
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
        const roleId = interaction.options.getString('роль');

        const db = getSubscribersDb();
        db.get("SELECT * FROM subscribers WHERE discord_id = ? AND exempt_role_id = ? AND status = 'exempt'", [user.id, roleId], (err, row) => {
            if (!row) {
                db.close();
                return interaction.reply({
                    ephemeral: true,
                    embeds: [new EmbedBuilder().setDescription(`❌ Пользователь <@${user.id}> не найден среди активных исключений с ролью <@&${roleId}>.`).setColor(0xF31F1F)]
                });
            }

            db.run("DELETE FROM subscribers WHERE discord_id = ? AND exempt_role_id = ? AND status = 'exempt'", [user.id, roleId], async err => {
                db.close();
                if (err) {
                    return interaction.reply({
                        ephemeral: true,
                        embeds: [new EmbedBuilder().setDescription(`❌ Ошибка: ${err.message}`).setColor(0xF31F1F)]
                    });
                }

                await interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('✅ Исключение удалено')
                            .setDescription(`Пользователь <@${user.id}> больше не находится в базе исключений по роли <@&${roleId}>.`)
                            .setColor(0xCC2641)
                    ],
                    ephemeral: false
                });

                // Логирование
                const logEmbed = new EmbedBuilder()
                    .setTitle('🗑️ Исключение удалено')
                    .setColor(0xCC2641)
                    .addFields(
                        { name: 'Администратор', value: `<@${interaction.user.id}>` },
                        { name: 'Пользователь', value: `<@${user.id}>` },
                        { name: 'Роль исключения', value: `<@&${roleId}>` }
                    );
                if (LOG_CHANNEL) {
                    const channel = interaction.guild.channels.cache.get(LOG_CHANNEL);
                    if (channel) channel.send({ embeds: [logEmbed] });
                }
            });
        });
    }
};