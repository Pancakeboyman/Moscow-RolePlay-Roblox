const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const { 
    saveAppeal, 
    saveAppealButton, 
    removeAppealButton, 
    getAppealButton,
    isAppealBlocked // <--- добавлено!
} = require('../utils/database');
const { DateTime } = require('luxon');
const { v4: uuidv4 } = require('uuid');

let shopModule;
try { shopModule = require('./storeV2Cog'); } catch {}

const LOG_CHANNEL_ID = '1363535182342262904';
const APPEAL_CHANNEL_ID = '1363535639529652466';
const GUILD_ID = '1331331077553262765';

function safeCustomId(id) {
    if (!id) return '';
    return id.length > 100 ? id.slice(0, 97) + '...' : id;
}

function safeEmbedField(field, max = 1024) {
    if (!field) return '';
    if (typeof field !== 'string') field = String(field);
    if (field.length > max) return field.slice(0, max - 3) + '...';
    return field;
}

function createAppealModal() {
    return new ModalBuilder()
        .setCustomId('appeal_modal')
        .setTitle('📝 Апелляция на разбан')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('roblox_username')
                    .setLabel('Ваш юзернейм Roblox')
                    .setPlaceholder('Укажите ваш Roblox никнейм (например: MalovYT)')
                    .setRequired(true)
                    .setStyle(TextInputStyle.Short)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('ban_date')
                    .setLabel('Когда вы были забанены?')
                    .setPlaceholder('Укажите дату или примерное время бана')
                    .setRequired(true)
                    .setStyle(TextInputStyle.Short)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('ban_reason')
                    .setLabel('Почему вы были забанены?')
                    .setPlaceholder('Опишите, за что вы получили бан')
                    .setRequired(true)
                    .setStyle(TextInputStyle.Paragraph)
                    .setMaxLength(4000)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('appeal_reason')
                    .setLabel('Почему вас нужно разбанить? (3+ предложения)')
                    .setPlaceholder('Подробно объясните, почему вас стоит разбанить')
                    .setRequired(true)
                    .setStyle(TextInputStyle.Paragraph)
                    .setMaxLength(4000)
            )
        );
}

function createReplyModal(targetUserId) {
    return new ModalBuilder()
        .setCustomId(safeCustomId(`reply_modal:${targetUserId}`))
        .setTitle('📬 Ответ на апелляцию')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('response')
                    .setLabel('Ваш ответ пользователю')
                    .setPlaceholder('Введите сообщение, которое будет отправлено в ЛС')
                    .setStyle(TextInputStyle.Paragraph)
                    .setMaxLength(2000)
            )
        );
}

function getReplyActionRowUnique(targetUserId, appealId) {
    const rawId = `close_appeal_${appealId}_${uuidv4()}`;
    const customId = safeCustomId(rawId);
    return {
        row: new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(customId)
                .setLabel('Закрыть апелляцию')
                .setEmoji('🔒')
                .setStyle(ButtonStyle.Danger)
        ),
        customId
    };
}

function getFinalDecisionRow(mainMessageId, targetUserId, buttonCustomId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(safeCustomId(`accept_appeal:${mainMessageId}:${targetUserId}:${buttonCustomId}`))
            .setLabel('✅ Апелляция одобрена')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(safeCustomId(`reject_appeal:${mainMessageId}:${targetUserId}:${buttonCustomId}`))
            .setLabel('❌ Апелляция отклонена')
            .setStyle(ButtonStyle.Danger)
    );
}

const APPEAL_BUTTON_PREFIXES = [
    "close_appeal_",
    "accept_appeal:",
    "reject_appeal:",
    "reply_to_user:",
    "reply_modal:"
];

function isAppealButton(customId) {
    return APPEAL_BUTTON_PREFIXES.some(prefix => customId.startsWith(prefix));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('апелляция')
        .setDescription('Апелляции и обращения')
        .addSubcommandGroup(group =>
            group
                .setName('на')
                .setDescription('Действия с апелляциями')
                .addSubcommand(sub =>
                    sub
                        .setName('разбан')
                        .setDescription('Подать апелляцию на разбан')
                )
        ),
    async execute(interaction) {
        // --- ПРОВЕРКА БЛОКИРОВКИ ПРИ ВЫПОЛНЕНИИ КОМАНДЫ ---
        if (
            interaction.options.getSubcommandGroup() === 'на' &&
            interaction.options.getSubcommand() === 'разбан'
        ) {
            // Проверка блокировки апелляции до открытия формы!
            const blocked = await new Promise(resolve => isAppealBlocked(interaction.user.id, resolve));
            if (blocked) {
                await interaction.reply({ content: 'Ваша апелляция заблокирована. Вы получили перманентный бан. Апелляция невозможна.', flags: 64 });
                return;
            }
            await interaction.showModal(createAppealModal());
        }
    },
    async handleModal(interaction, { db, logger, client }) {
        if (interaction.customId === 'appeal_modal') {
            // Теперь этот блок не нужен, т.к. проверка выше!
            // if (await new Promise(resolve => isAppealBlocked(interaction.user.id, resolve))) {
            //     await interaction.reply({ content: 'Ваша апелляция заблокирована. Вы получили перманентный бан. Апелляция невозможна.', flags: 64 });
            //     return true;
            // }

            const roblox_username = interaction.fields.getTextInputValue('roblox_username');
            const ban_date = interaction.fields.getTextInputValue('ban_date');
            const ban_reason = interaction.fields.getTextInputValue('ban_reason');
            const appeal_reason = interaction.fields.getTextInputValue('appeal_reason');
            const user = interaction.user;
            const timestamp = DateTime.now().setZone('Europe/Moscow').toFormat('yyyy-LL-dd HH:mm:ss');
            const appealId = uuidv4();

            try {
                saveAppeal({
                    user_id: user.id,
                    roblox_username,
                    ban_date,
                    ban_reason,
                    appeal_text: appeal_reason,
                    timestamp,
                    appeal_id: appealId
                });
            } catch (e) {
                logger?.error?.('Ошибка при сохранении апелляции: ' + e);
            }

            const embed = new EmbedBuilder()
                .setTitle('📥 Новая апелляция на разбан')
                .setColor(0xff0000)
                .addFields(
                    { name: '👤 Discord', value: safeEmbedField(`${user} (\`${user.id}\`)`), inline: false },
                    { name: '🎮 Roblox', value: safeEmbedField(roblox_username), inline: false },
                    { name: '📅 Дата бана', value: safeEmbedField(ban_date), inline: false },
                    { name: '🚫 Причина бана', value: safeEmbedField(ban_reason), inline: false },
                    { name: '📄 Апелляция', value: safeEmbedField(appeal_reason, 1024), inline: false }
                )
                .setFooter({ text: `Время отправки: ${timestamp}`.slice(0, 2048) })
                .setTimestamp(new Date());

            const guild = interaction.guild ?? client.guilds.cache.get(GUILD_ID);
            if (!guild) {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: '❌ Не удалось определить сервер. Попробуйте позже или обратитесь к администрации.', flags: 64 });
                }
                return true;
            }
            const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
            const appealChannel = guild.channels.cache.get(APPEAL_CHANNEL_ID);

            if (logChannel) {
                await logChannel.send({ content: `📥 Апелляция от ${user}`, embeds: [embed] });
            }
            if (appealChannel) {
                const { row, customId } = getReplyActionRowUnique(user.id, appealId);
                logger?.info?.('[appeals] Saving customId for button:', customId);
                const sent = await appealChannel.send({
                    embeds: [embed],
                    components: [row]
                });
                saveAppealButton({
                    id: customId,
                    appeal_id: appealId,
                    discord_msg_id: sent.id,
                    user_id: user.id
                });
            }
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '✅ Апелляция отправлена. Ожидайте ответа.', flags: 64 });
            }
            return true;
        }

        if (interaction.customId.startsWith('reply_modal:')) {
            const targetUserId = interaction.customId.split(':')[1];
            const response = interaction.fields.getTextInputValue('response');
            try {
                const user = await client.users.fetch(targetUserId);
                const embed = new EmbedBuilder()
                    .setTitle('📬 Сообщение от администрации')
                    .setDescription(safeEmbedField(response, 4096))
                    .setColor(0x43d67b)
                    .setFooter({ text: 'Ответ на вашу апелляцию' });
                await user.send({ embeds: [embed] });
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: '✅ Ответ отправлен пользователю в ЛС.', flags: 64 });
                }
            } catch (e) {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: '❌ Не удалось отправить сообщение — пользователь закрыл ЛС.', flags: 64 });
                }
            }
            return true;
        }
    },

    async onInteraction(interaction, { db, logger, client }) {
        if (!interaction.isButton()) return false;

        // Новый перехватчик: реагируем только на свои кнопки!
        if (!isAppealButton(interaction.customId)) {
            // Не кнопка апелляции — не обрабатываем, пусть обработает другой cog или основной обработчик
            return false;
        }

        // --- Кнопки апелляции ниже ---
        if (interaction.customId.startsWith('close_appeal_')) {
            let handled = false;

            await new Promise((resolve) => {
                logger?.info?.('[appeals] Поиск customId кнопки:', interaction.customId);
                getAppealButton(interaction.customId, async (err, buttonRow) => {
                    logger?.info?.('[appeals] Результат поиска customId:', buttonRow);
                    if (!buttonRow) {
                        if (!interaction.replied && !interaction.deferred) {
                            try {
                                await interaction.reply({ content: '❌ Эта кнопка больше неактуальна!', flags: 64 });
                            } catch (e) {}
                        }
                        handled = true;
                        return resolve();
                    }

                    try {
                        const components = [getFinalDecisionRow(buttonRow.discord_msg_id, buttonRow.user_id, interaction.customId)];
                        components.forEach(row => {
                            row.components.forEach(btn => {
                                if (btn.label && btn.label.length > 80) btn.setLabel(btn.label.slice(0, 77) + '...');
                                if (btn.customId && btn.customId.length > 100) btn.setCustomId(safeCustomId(btn.customId));
                            });
                        });
                        if (!interaction.replied && !interaction.deferred) {
                            await interaction.reply({
                                content: 'Выберите результат апелляции:',
                                components,
                                flags: 64
                            });
                        }
                    } catch (e) {
                        logger?.error?.('Ошибка при reply (close_appeal): ' + e + '\nStack: ' + e.stack);
                    }
                    handled = true;
                    return resolve();
                });
            });
            if (handled) return true;
            return false;
        }

        if (interaction.customId.startsWith('accept_appeal:') || interaction.customId.startsWith('reject_appeal:')) {
            const [action, mainMessageId, userId, buttonCustomId] = interaction.customId.split(':');
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.update({ content: 'Результат выбран.', components: [], flags: 64 });
                }

                let targetChannel = interaction.channel;
                if (targetChannel.isThread && typeof targetChannel.parent?.messages?.fetch === "function") {
                    targetChannel = targetChannel.parent;
                }
                const mainMsg = await targetChannel.messages.fetch(mainMessageId);
                const origEmbed = mainMsg.embeds[0];
                const resultText = action === 'accept_appeal'
                    ? '✅ Одобрено персоналом'
                    : '❌ Отклонено персоналом';
                const embed = EmbedBuilder.from(origEmbed)
                    .setFooter({ text: safeEmbedField(resultText, 2048) });
                await mainMsg.edit({ embeds: [embed], components: [] });

                if (buttonCustomId) {
                    logger?.info?.('[appeals] Удаляем customId из БД:', buttonCustomId);
                    removeAppealButton(buttonCustomId);
                }

                try {
                    const user = await client.users.fetch(userId);
                    if (action === 'accept_appeal') {
                        await user.send({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle('✅ Ваша апелляция одобрена')
                                    .setDescription('Вы будете разбанены. Благодарим за ожидание!')
                                    .setColor(0x43d67b)
                            ]
                        });
                    } else {
                        await user.send({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle('❌ Ваша апелляция отклонена')
                                    .setDescription('По решению персонала вы остаетесь в бане.')
                                    .setColor(0xff0000)
                            ]
                        });
                    }
                } catch {}
            } catch (err) {
                logger?.error?.('Ошибка при изменении основного сообщения: ' + err);
            }
            return true;
        }

        if (interaction.customId.startsWith('reply_to_user:')) {
            const [_, userId] = interaction.customId.split(':');
            if (!interaction.replied && !interaction.deferred) {
                await interaction.showModal(createReplyModal(userId));
            }
            return true;
        }

        return false;
    }
};