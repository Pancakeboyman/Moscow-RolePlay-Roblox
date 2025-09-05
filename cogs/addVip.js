const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getVipDb } = require('../utils/database');
const { ADMIN_ROLES, LOG_CHANNEL } = require('../apikeys');
const { VIP_ROLE_ID, STATUS_LABELS } = require('../constants');
const noblox = require('noblox.js');

// Получить userId Roblox
async function getRobloxId(username) {
    if (!username || typeof username !== 'string' || username.length === 0) return null;
    try {
        const userId = await noblox.getIdFromUsername(username);
        return userId || null;
    } catch (e) {
        return null;
    }
}

// Автоудаление VIP из базы при снятии роли или выходе
function setupVipWatcher(client) {
    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        if (oldMember.roles.cache.has(VIP_ROLE_ID) && !newMember.roles.cache.has(VIP_ROLE_ID)) {
            const db = getVipDb();
            db.run("DELETE FROM vip WHERE discord_id = ?", [newMember.id], (err) => {
                db.close();
                if (err) {
                    console.error(`Ошибка при удалении VIP из базы: ${err.message}`);
                } else {
                    console.log(`Пользователь ${newMember.id} удалён из VIP базы (снята роль VIP).`);
                }
            });
        }
    });

    client.on('guildMemberRemove', async (member) => {
        const db = getVipDb();
        db.run("DELETE FROM vip WHERE discord_id = ?", [member.id], (err) => {
            db.close();
            if (err) {
                console.error(`Ошибка при удалении VIP из базы при выходе: ${err.message}`);
            } else {
                console.log(`Пользователь ${member.id} удалён из VIP базы (вышел с сервера, снята роль VIP).`);
            }
        });
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('добавить_vip')
        .setDescription('Добавить VIP в базу данных')
        .addUserOption(option => option.setName('дискорд').setDescription('Discord пользователь').setRequired(true))
        .addStringOption(option =>
            option.setName('ник_roblox')
                .setDescription('Никнейм Roblox')
                .setRequired(true)
        ),
    async execute(interaction) {
        if (!interaction.member.roles.cache.some(role => ADMIN_ROLES.includes(role.id))) {
            return interaction.reply({
                ephemeral: true,
                embeds: [new EmbedBuilder().setTitle('❌ Отказано в доступе').setDescription('У вас нет прав для использования этой команды!').setColor(0xF31F1F)]
            });
        }
        const user = interaction.options.getUser('дискорд');
        const robloxUsername = interaction.options.getString('ник_roblox');
        const robloxId = await getRobloxId(robloxUsername);

        let member = await interaction.guild.members.fetch(user.id).catch(() => null);
        let hasVipRole = member && member.roles.cache.has(VIP_ROLE_ID);

        if (!hasVipRole) {
            return interaction.reply({
                ephemeral: true,
                embeds: [new EmbedBuilder().setTitle('❌ Не является VIP').setDescription(`Пользователь <@${user.id}> не имеет роли VIP (<@&${VIP_ROLE_ID}>).`).setColor(0xF31F1F)]
            });
        }

        const db = getVipDb();
        db.get("SELECT * FROM vip WHERE discord_id = ?", [user.id], (err, row) => {
            if (row) {
                db.run(
                    "UPDATE vip SET roblox_username = ? WHERE discord_id = ?",
                    [robloxUsername, user.id],
                    async (err) => {
                        db.close();
                        if (err) {
                            return interaction.reply({
                                ephemeral: true,
                                embeds: [new EmbedBuilder().setTitle('❌ Ошибка').setDescription(err.message).setColor(0xF31F1F)]
                            });
                        }
                        const robloxProfile = robloxId
                            ? `[${robloxUsername}](https://www.roblox.com/users/${robloxId}/profile)`
                            : robloxUsername;
                        await interaction.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle('✅ VIP обновлён!')
                                    .setDescription(`**Discord:** <@${user.id}>\n**Roblox:** ${robloxProfile}\n**Статус:** VIP сервера (роль имеется)\n\nVIP сохраняется, пока у пользователя есть роль VIP.`)
                                    .setColor(0xEEC644)
                            ]
                        });

                        // EMBED ДЛЯ ЛОГОВ
                        const logEmbed = new EmbedBuilder()
                            .setTitle('📝 VIP добавлен/обновлён')
                            .setColor(0xEEC644)
                            .addFields(
                                { name: 'Администратор', value: `<@${interaction.user.id}>`, inline: true },
                                { name: 'Пользователь', value: `<@${user.id}>`, inline: true },
                                { name: 'Roblox ник', value: robloxProfile, inline: true },
                                { name: 'Статус', value: 'VIP сервера (роль имеется)', inline: true }
                            )
                            .setFooter({ text: "Moscow RolePlay | ER:LC VIP System" })
                            .setTimestamp();

                        if (LOG_CHANNEL) {
                            const channel = interaction.guild.channels.cache.get(LOG_CHANNEL);
                            if (channel) channel.send({ embeds: [logEmbed] });
                        }

                        // EMBED ДЛЯ ЛИЧКИ
                        await user.send({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle('✨ Теперь вы VIP!')
                                    .setDescription(`**Поздравляем!** Вы получили статус VIP на сервере Moscow RolePlay.\n`)
                                    .addFields(
                                        { name: 'Ваш Discord', value: `<@${user.id}>`, inline: true },
                                        { name: 'Ваш Roblox', value: robloxProfile, inline: true },
                                        { name: '🌟 Ваши привилегии', value: '• Доступ к VIP автомобилям\n• Уникальные награды и бонусы\n• Прямые уведомления о событиях сервера', inline: false },
                                        { name: 'Важно', value: 'Статус сохраняется только при наличии роли VIP на сервере.', inline: false }
                                    )
                                    .setColor(0xEEC644)
                                    .setFooter({ text: "Moscow RolePlay Roblox | Спасибо за поддержку!" })
                                    .setTimestamp()
                            ]
                        }).catch(() => {});
                    }
                );
            } else {
                db.run(
                    "INSERT INTO vip (discord_id, roblox_username) VALUES (?, ?)",
                    [user.id, robloxUsername],
                    async err => {
                        db.close();
                        if (err) {
                            return interaction.reply({
                                ephemeral: true,
                                embeds: [new EmbedBuilder().setTitle('❌ Ошибка').setDescription(err.message).setColor(0xF31F1F)]
                            });
                        }
                        const robloxProfile = robloxId
                            ? `[${robloxUsername}](https://www.roblox.com/users/${robloxId}/profile)`
                            : robloxUsername;
                        await interaction.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle('✅ VIP добавлен!')
                                    .setDescription(`**Discord:** <@${user.id}>\n**Roblox:** ${robloxProfile}\n**Статус:** VIP сервера (роль имеется)\n\nVIP сохраняется, пока у пользователя есть роль VIP.`)
                                    .setColor(0xEEC644)
                            ]
                        });

                        // EMBED ДЛЯ ЛОГОВ
                        const logEmbed = new EmbedBuilder()
                            .setTitle('📝 VIP добавлен')
                            .setColor(0xEEC644)
                            .addFields(
                                { name: 'Администратор', value: `<@${interaction.user.id}>`, inline: true },
                                { name: 'Пользователь', value: `<@${user.id}>`, inline: true },
                                { name: 'Roblox ник', value: robloxProfile, inline: true },
                                { name: 'Статус', value: 'VIP сервера (роль имеется)', inline: true }
                            )
                            .setFooter({ text: "Moscow RolePlay | ER:LC VIP System" })
                            .setTimestamp();

                        if (LOG_CHANNEL) {
                            const channel = interaction.guild.channels.cache.get(LOG_CHANNEL);
                            if (channel) channel.send({ embeds: [logEmbed] });
                        }

                        // EMBED ДЛЯ ЛИЧКИ
                        await user.send({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle('✨ Теперь вы VIP!')
                                    .setDescription(`**Поздравляем!** Вы получили статус VIP на сервере Moscow RolePlay.\n`)
                                    .addFields(
                                        { name: 'Ваш Discord', value: `<@${user.id}>`, inline: true },
                                        { name: 'Ваш Roblox', value: robloxProfile, inline: true },
                                        { name: '🌟 Ваши привилегии', value: '• Доступ к VIP автомобилям\n• Уникальные награды и бонусы\n• Прямые уведомления о событиях сервера', inline: false },
                                        { name: 'Важно', value: 'Статус сохраняется только при наличии роли VIP на сервере.', inline: false }
                                    )
                                    .setColor(0xEEC644)
                                    .setFooter({ text: "Moscow RolePlay Roblox | Спасибо за поддержку!" })
                                    .setTimestamp()
                            ]
                        }).catch(() => {});
                    }
                );
            }
        });
    },
    setupVipWatcher // Экспортируем функцию для автоудаления VIP при снятии роли
};