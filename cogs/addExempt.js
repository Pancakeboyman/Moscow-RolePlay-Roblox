const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { ADMIN_ROLES, LOG_CHANNEL } = require('../apikeys');
const { getSubscribersDb } = require('../utils/database');
const noblox = require('noblox.js');
const { EXEMPT_ROLE_IDS } = require('./exemptRoles'); // если оба в cogs, используем ./

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
        .setName('добавить_исключение')
        .setDescription('Добавить пользователя в базу исключений (по ролям)')
        .addUserOption(option =>
            option.setName('дискорд')
                .setDescription('Discord пользователь')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('ник_roblox')
                .setDescription('Roblox никнейм')
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
        const robloxUsername = interaction.options.getString('ник_roblox');

        // Получаем участника на сервере
        let member;
        try {
            member = await interaction.guild.members.fetch(user.id);
        } catch {
            return interaction.reply({
                ephemeral: true,
                embeds: [new EmbedBuilder().setDescription('❌ Пользователь не найден на сервере.').setColor(0xF31F1F)]
            });
        }

        // Фильтруем роли пользователя по EXEMPT_ROLE_IDS
        const userExemptRoles = member.roles.cache.filter(r => EXEMPT_ROLE_IDS.includes(r.id));
        if (userExemptRoles.size === 0) {
            return interaction.reply({
                ephemeral: true,
                embeds: [new EmbedBuilder().setDescription(`❌ У пользователя <@${user.id}> нет ни одной роли-исключения.`).setColor(0xF31F1F)]
            });
        }

        // Если несколько ролей — можно брать первую, либо сделать выбор через select menu (упрощённо — берем первую)
        const exemptRole = userExemptRoles.first();
        const roleId = exemptRole.id;

        const db = getSubscribersDb();
        db.get("SELECT * FROM subscribers WHERE discord_id = ? AND exempt_role_id = ?", [user.id, roleId], (err, row) => {
            if (row) {
                interaction.reply({
                    ephemeral: true,
                    embeds: [new EmbedBuilder().setDescription(`❌ Пользователь <@${user.id}> уже добавлен как исключение с ролью <@&${roleId}>.`).setColor(0xF31F1F)]
                });
                db.close();
                return;
            }

            getRobloxId(robloxUsername).then(robloxId => {
                const robloxProfile = robloxId
                    ? `[${robloxUsername}](https://www.roblox.com/users/${robloxId}/profile)`
                    : robloxUsername;

                // Проверяем, есть ли уже запись по discord_id (например, как подписчик или бустер)
                db.get("SELECT * FROM subscribers WHERE discord_id = ?", [user.id], (err2, row2) => {
                    if (row2) {
                        // Если уже есть запись, обновляем статус и exempt_role_id
                        db.run(
                            "UPDATE subscribers SET status = 'exempt', exempt_role_id = ?, booster = 0, subscription_days = 0 WHERE discord_id = ?",
                            [roleId, user.id],
                            async err3 => {
                                db.close();
                                if (err3) return interaction.reply({ ephemeral: true, embeds: [new EmbedBuilder().setDescription(`❌ Ошибка: ${err3.message}`).setColor(0xF31F1F)] });

                                await interaction.reply({
                                    embeds: [new EmbedBuilder().setTitle('✅ Исключение обновлено!').setDescription(
                                        `**Discord:** <@${user.id}>\n**Roblox:** ${robloxProfile}\n**Исключающая роль:** <@&${roleId}>`
                                    ).setColor(0xCC2641)]
                                });

                                const logEmbed = new EmbedBuilder()
                                    .setTitle('📋 Обновлено исключение')
                                    .setColor(0xCC2641)
                                    .addFields(
                                        { name: 'Администратор', value: `<@${interaction.user.id}>` },
                                        { name: 'Пользователь', value: `<@${user.id}>` },
                                        { name: 'Roblox ник', value: robloxProfile },
                                        { name: 'Роль исключения', value: `<@&${roleId}>` }
                                    );
                                if (LOG_CHANNEL) {
                                    const channel = interaction.guild.channels.cache.get(LOG_CHANNEL);
                                    if (channel) channel.send({ embeds: [logEmbed] });
                                }
                            }
                        );
                    } else {
                        // Если записи нет, создаём новую
                        db.run(
                            "INSERT INTO subscribers (discord_id, roblox_username, exempt_role_id, status, booster, subscription_days) VALUES (?, ?, ?, 'exempt', 0, 0)",
                            [user.id, robloxUsername, roleId],
                            async err3 => {
                                db.close();
                                if (err3) return interaction.reply({ ephemeral: true, embeds: [new EmbedBuilder().setDescription(`❌ Ошибка: ${err3.message}`).setColor(0xF31F1F)] });

                                await interaction.reply({
                                    embeds: [new EmbedBuilder().setTitle('✅ Исключение добавлено!').setDescription(
                                        `**Discord:** <@${user.id}>\n**Roblox:** ${robloxProfile}\n**Исключающая роль:** <@&${roleId}>`
                                    ).setColor(0xCC2641)]
                                });

                                const logEmbed = new EmbedBuilder()
                                    .setTitle('📋 Добавлено исключение')
                                    .setColor(0xCC2641)
                                    .addFields(
                                        { name: 'Администратор', value: `<@${interaction.user.id}>` },
                                        { name: 'Пользователь', value: `<@${user.id}>` },
                                        { name: 'Roblox ник', value: robloxProfile },
                                        { name: 'Роль исключения', value: `<@&${roleId}>` }
                                    );
                                if (LOG_CHANNEL) {
                                    const channel = interaction.guild.channels.cache.get(LOG_CHANNEL);
                                    if (channel) channel.send({ embeds: [logEmbed] });
                                }
                            }
                        );
                    }
                });
            });
        });
    }
};