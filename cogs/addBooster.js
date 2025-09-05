const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getSubscribersDb } = require('../utils/database');
const { ADMIN_ROLES, LOG_CHANNEL } = require('../apikeys');
const noblox = require('noblox.js');

const BOOSTER_ROLE_ID = "1364498859933438073";

// Получить userId по никнейму через noblox.js (точное совпадение)
async function getRobloxId(username) {
    try {
        const users = await noblox.searchUsers(username, 1, "");
        if (Array.isArray(users) && users.length > 0 && users[0].username.toLowerCase() === username.toLowerCase())
            return users[0].userId;
        return null;
    } catch (e) {
        if (e.message && e.message.includes("429")) return [];
        console.error("Autocomplete error:", e);
        return null;
    }
}

// Автоудаление бустера из базы если роль снята или пользователь вышел
function setupBoosterWatcher(client) {
    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        // Если роль бустера убрали
        if (oldMember.roles.cache.has(BOOSTER_ROLE_ID) && !newMember.roles.cache.has(BOOSTER_ROLE_ID)) {
            const db = getSubscribersDb();
            db.run("UPDATE subscribers SET booster = 0 WHERE discord_id = ?", [newMember.id], (err) => {
                db.close();
                if (err) {
                    console.error(`Ошибка при обновлении бустера в базе: ${err.message}`);
                } else {
                    console.log(`Пользователь ${newMember.id} обновлён в базе (снята роль бустера).`);
                }
            });
        }
    });

    client.on('guildMemberRemove', async (member) => {
        const db = getSubscribersDb();
        db.run("UPDATE subscribers SET booster = 0 WHERE discord_id = ?", [member.id], (err) => {
            db.close();
            if (err) {
                console.error(`Ошибка при обновлении бустера в базе при выходе: ${err.message}`);
            } else {
                console.log(`Пользователь ${member.id} обновлён в базе (вышел с сервера, снята роль бустера).`);
            }
        });
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('добавить_бустера')
        .setDescription('Добавить бустера в базу данных')
        .addUserOption(option => option.setName('дискорд').setDescription('Discord пользователь').setRequired(true))
        .addStringOption(option =>
            option.setName('ник_roblox')
                .setDescription('Никнейм Roblox')
                .setRequired(true)
                .setAutocomplete(true)
        ),
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        if (!focusedValue || typeof focusedValue !== 'string' || focusedValue.length < 3) {
            return interaction.respond([
                { name: "Введите минимум 3 символа", value: "none" }
            ]);
        }
        try {
            const users = await noblox.searchUsers(focusedValue, 20, "");
            if (!Array.isArray(users) || users.length === 0) {
                return interaction.respond([
                    { name: "Ничего не найдено", value: "none" }
                ]);
            }
            const res = users
                .filter(user => user.username)
                .map(user => ({
                    name: `${user.username} (${user.userId})`,
                    value: user.username
                }));
            if (res.length === 0) {
                return interaction.respond([
                    { name: "Ничего не найдено", value: "none" }
                ]);
            }
            await interaction.respond(res);
        } catch (e) {
            if (e.message && e.message.includes("429")) {
                return interaction.respond([
                    { name: "Слишком много запросов, попробуйте позже", value: "none" }
                ]);
            }
            console.error("Autocomplete error:", e);
            await interaction.respond([
                { name: "Ошибка поиска", value: "none" }
            ]);
        }
    },
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
        let hasBoosterRole = member && member.roles.cache.has(BOOSTER_ROLE_ID);

        if (!hasBoosterRole) {
            return interaction.reply({
                ephemeral: true,
                embeds: [new EmbedBuilder().setTitle('❌ Не является бустером').setDescription(`Пользователь <@${user.id}> не имеет роли бустера (<@&${BOOSTER_ROLE_ID}>).`).setColor(0xF31F1F)]
            });
        }

        const db = getSubscribersDb();
        db.get("SELECT * FROM subscribers WHERE discord_id = ?", [user.id], (err, row) => {
            if (row) {
                // Уже есть в базе — просто обновим booster = 1 и roblox_username
                db.run(
                    "UPDATE subscribers SET booster = 1, roblox_username = ? WHERE discord_id = ?",
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
                                    .setTitle('✅ Бустер обновлён!')
                                    .setDescription(
                                        `**Discord:** <@${user.id}>\n**Roblox:** ${robloxProfile}\n**Статус:** Бустер сервера (роль имеется)\n\nБустер сохраняется, пока у пользователя есть роль бустера.`
                                    )
                                    .setColor(0xCC2641)
                            ]
                        });

                        // EMBED ДЛЯ ЛОГОВ
                        const logEmbed = new EmbedBuilder()
                            .setTitle('📝 Бустер добавлен/обновлён')
                            .setColor(0xCC2641)
                            .addFields(
                                { name: 'Администратор', value: `<@${interaction.user.id}>`, inline: true },
                                { name: 'Пользователь', value: `<@${user.id}>`, inline: true },
                                { name: 'Roblox ник', value: robloxProfile, inline: true },
                                { name: 'Статус', value: 'Бустер сервера (роль имеется)', inline: true }
                            )
                            .setFooter({ text: "Moscow RolePlay | ER:LC Booster System" })
                            .setTimestamp();

                        if (LOG_CHANNEL) {
                            const channel = interaction.guild.channels.cache.get(LOG_CHANNEL);
                            if (channel) channel.send({ embeds: [logEmbed] });
                        }

                        // EMBED ДЛЯ ЛИЧКИ
                        await user.send({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle('✨ Теперь вы бустер!')
                                    .setDescription(`**Поздравляем!** Вы получили статус бустера на сервере Moscow RolePlay.\n`)
                                    .addFields(
                                        { name: 'Ваш Discord', value: `<@${user.id}>`, inline: true },
                                        { name: 'Ваш Roblox', value: robloxProfile, inline: true },
                                        { name: '🌟 Ваши привилегии', value: '• Доступ к эксклюзивным автомобилям (подробнее в <#1342209500572029059>).\n• Уникальные награды и внутриигровые бонусы\n• Прямые уведомления о событиях сервера', inline: false },
                                        { name: 'Важно', value: 'Статус сохраняется только при наличии роли бустера на сервере.', inline: false }
                                    )
                                    .setColor(0xCC2641)
                                    .setFooter({ text: "Moscow RolePlay Roblox | Спасибо за поддержку!" })
                                    .setTimestamp()
                            ]
                        }).catch(() => {});
                    }
                );
            } else {
                // Нет в базе — добавим новую запись
                db.run(
                    "INSERT INTO subscribers (discord_id, roblox_username, subscription_days, expires_at, status, booster) VALUES (?, ?, ?, ?, ?, ?)",
                    [user.id, robloxUsername, 0, null, null, 1],
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
                                    .setTitle('✅ Бустер добавлен!')
                                    .setDescription(
                                        `**Discord:** <@${user.id}>\n**Roblox:** ${robloxProfile}\n**Статус:** Бустер сервера (роль имеется)\n\nБустер сохраняется, пока у пользователя есть роль бустера.`
                                    )
                                    .setColor(0xCC2641)
                            ]
                        });

                        // EMBED ДЛЯ ЛОГОВ
                        const logEmbed = new EmbedBuilder()
                            .setTitle('📝 Бустер добавлен')
                            .setColor(0xCC2641)
                            .addFields(
                                { name: 'Администратор', value: `<@${interaction.user.id}>`, inline: true },
                                { name: 'Пользователь', value: `<@${user.id}>`, inline: true },
                                { name: 'Roblox ник', value: robloxProfile, inline: true },
                                { name: 'Статус', value: 'Бустер сервера (роль имеется)', inline: true }
                            )
                            .setFooter({ text: "Moscow RolePlay | ER:LC Booster System" })
                            .setTimestamp();

                        if (LOG_CHANNEL) {
                            const channel = interaction.guild.channels.cache.get(LOG_CHANNEL);
                            if (channel) channel.send({ embeds: [logEmbed] });
                        }

                        // EMBED ДЛЯ ЛИЧКИ
                        await user.send({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle('✨ Теперь вы бустер!')
                                    .setDescription(`**Поздравляем!** Вы получили статус бустера на сервере Moscow RolePlay.\n`)
                                    .addFields(
                                        { name: 'Ваш Discord', value: `<@${user.id}>`, inline: true },
                                        { name: 'Ваш Roblox', value: robloxProfile, inline: true },
                                        { name: '🌟 Ваши привилегии', value: '• Доступ к эксклюзивным автомобилям (подробнее в <#1342209500572029059>).\n• Уникальные награды и внутриигровые бонусы\n• Прямые уведомления о событиях сервера', inline: false },
                                        { name: 'Важно', value: 'Статус сохраняется только при наличии роли бустера на сервере.', inline: false }
                                    )
                                    .setColor(0xCC2641)
                                    .setFooter({ text: "Moscow RolePlay Roblox | Спасибо за поддержку!" })
                                    .setTimestamp()
                            ]
                        }).catch(() => {});
                    }
                );
            }
        });
    },
    setupBoosterWatcher // Экспортируем функцию для автоудаления бустера при снятии роли
};