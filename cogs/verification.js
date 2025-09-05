const { Events } = require('discord.js');
const { ComponentType, ButtonStyle, MessageFlags, SeparatorSpacingSize } = require('discord-api-types/v10');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const INSTRUCTION_CHANNEL_ID = '1331385651203145789';
const JOIN_ROLE_IDS = [
    '1331380783193264199', // "неподтверждённый"
    '1331332714258890763'
];
const VERIFIED_ROLE_ID = '1331380701756653661';
const LOG_CHANNEL_ID = '1363535182342262904';

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'verification.db');
const VERIFICATION_LINK = "https://blox.link/dashboard/verifications";
const YOUTUBE_TUTORIAL = "https://www.youtube.com/watch?v=SbDltmom1R8&list=PLz7SOP-guESE1V6ywCCLc1IQWiLURSvBE&index=1";

// --- Компонент V2 для инструкции ---
const instructionComponent = {
    type: ComponentType.Container,
    spoiler: false,
    components: [
        {
            type: ComponentType.MediaGallery,
            items: [
                {
                    media: {
                        url: "https://cdn.discordapp.com/attachments/1363556047704293517/1407715711744348240/-Moscow-RolePlay-Roblox-.png?ex=68a71ceb&is=68a5cb6b&hm=3ff0a7769388f2a325db711f98ee94fb6ae3be18f49e4391298c5d8e3d881aa7&"
                    }
                }
            ]
        },
        {
            type: ComponentType.TextDisplay,
            content: "# 🔒 Верификация через Bloxlink"
        },
        {
            type: ComponentType.Separator,
            spacing: SeparatorSpacingSize.Large,
            divider: true
        },
        {
            type: ComponentType.TextDisplay,
            content:
                "**Чтобы получить доступ ко всем каналам, необходимо пройти быструю верификацию.**\n\n" +
                "📩 Используйте команду `/verify` и следуйте инструкции от бота.\n\n" +
                "🔗 Если ваш аккаунт ещё не привязан к Bloxlink, нажмите на кнопку ниже и следуйте инструкциям.\n\n" +
                "❓ Если у вас есть какие-то вопросы, откройте тикет в канале <#1338585898907861012>"
        },
        {
            type: ComponentType.ActionRow,
            components: [
                {
                    type: ComponentType.Button,
                    style: ButtonStyle.Link,
                    label: "🌐 Перейти к верификации",
                    url: VERIFICATION_LINK
                },
                {
                    type: ComponentType.Button,
                    style: ButtonStyle.Link,
                    label: "🎥 Видео-инструкция",
                    url: YOUTUBE_TUTORIAL
                }
            ]
        },
        {
            type: ComponentType.Separator,
            spacing: SeparatorSpacingSize.Large,
            divider: true
        },
        {
            type: ComponentType.TextDisplay,
            content: "### <:MoscowRolePlayRoblox:1407720150240854166> Bloxlink • Moscow RolePlay Roblox"
        },
        {
            type: ComponentType.Separator,
            spacing: SeparatorSpacingSize.Large,
            divider: true
        },
        {
            type: ComponentType.MediaGallery,
            items: [
                {
                    media: {
                        url: "https://cdn.discordapp.com/attachments/1363556047704293517/1407720803776200765/-.png?ex=68a721a9&is=68a5d029&hm=fe026823161671427235e272bc6dcfff106b24a5484058071a2dc2a73f88c2ba&"
                    }
                }
            ]
        }
    ]
};

// --- Компонент V2 для ЛС подтверждённому ---
function getDmVerifiedComponent(userId) {
    return {
        type: ComponentType.Container,
        spoiler: false,
        components: [
            {
                type: ComponentType.MediaGallery,
                items: [
                    {
                        media: {
                            url: "https://cdn.discordapp.com/attachments/1363556047704293517/1407723969120964638/-Moscow-RolePlay-Roblox-.png?ex=68a7249c&is=68a5d31c&hm=4e0d2dcb8b36b1ccd84410ace0343ac09db986ee0aa9fed657c183e6134c7e88&"
                        }
                    }
                ]
            },
            {
                type: ComponentType.TextDisplay,
                content: `# <@${userId}> ✅ Ты успешно верифицирован!`
            },
            {
                type: ComponentType.Separator,
                spacing: SeparatorSpacingSize.Large,
                divider: true
            },
            {
                type: ComponentType.TextDisplay,
                content:
                    "Добро пожаловать в **<:moscowrus:1374006028185636887> Moscow RolePlay** — твой путь начинается прямо сейчас!\n\n" +
                    "🎮 Получай роли, выбирай фракцию и вступай в игру.\n" +
                    "📌 Ознакомься с важными каналами для новичков."
            },
            {
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.Button,
                        style: ButtonStyle.Link,
                        label: "Присоединиться к серверу",
                        emoji: { id: "1402206531214250075", name: "ERLC" },
                        url: "https://policeroleplay.community/join/MoscowRus"
                    }
                ]
            },
            {
                type: ComponentType.TextDisplay,
                content: "**Удачи и ярких моментов на сервере! 💥**\n\n"
            },
            {
                type: ComponentType.Separator,
                spacing: SeparatorSpacingSize.Large,
                divider: true
            },
            {
                type: ComponentType.TextDisplay,
                content: "\n\n### <:MoscowRolePlayRoblox:1407720150240854166> Moscow RolePlay Roblox • Верификация"
            },
            {
                type: ComponentType.Separator,
                spacing: SeparatorSpacingSize.Large,
                divider: true
            },
            {
                type: ComponentType.MediaGallery,
                items: [
                    {
                        media: {
                            url: "https://cdn.discordapp.com/attachments/1363556047704293517/1407720803776200765/-.png?ex=68a721a9&is=68a5d029&hm=fe026823161671427235e272bc6dcfff106b24a5484058071a2dc2a73f88c2ba&"
                        }
                    }
                ]
            }
        ]
    };
}

// Гарантирует, что папка и таблица БД есть.
function ensureDb(logger = console) {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
            logger.info(`[bloxlink] Создана папка ${DATA_DIR}`);
        }
        if (!fs.existsSync(DB_PATH)) {
            logger.info(`[bloxlink] verification.db не найден, будет создан`);
        }
        const db = new sqlite3.Database(DB_PATH);
        db.run(`
            CREATE TABLE IF NOT EXISTS instructions (
                channel_id TEXT PRIMARY KEY,
                message_id TEXT
            )
        `, (err) => {
            db.close();
            if (err) {
                logger.error(`[bloxlink] Ошибка создания таблицы instructions: ${err}`);
            } else {
                logger.info(`[bloxlink] Таблица instructions в verification.db готова`);
            }
        });
    } catch (err) {
        logger.error(`[bloxlink] Ошибка при ensureDb: ${err && err.stack ? err.stack : err}`);
    }
}

function saveMessageId(channelId, messageId, logger = console) {
    ensureDb(logger);
    const db = new sqlite3.Database(DB_PATH);
    db.run(
        "REPLACE INTO instructions (channel_id, message_id) VALUES (?, ?)",
        [channelId, messageId],
        (err) => {
            db.close();
            if (err) logger.error(`[bloxlink] Ошибка сохранения messageId: ${err}`);
        }
    );
}

function getMessageId(channelId, logger = console) {
    return new Promise((resolve) => {
        ensureDb(logger);
        const db = new sqlite3.Database(DB_PATH);
        db.get(
            "SELECT message_id FROM instructions WHERE channel_id = ?",
            [channelId],
            (err, row) => {
                db.close();
                if (err) logger.error(`[bloxlink] Ошибка получения messageId: ${err}`);
                resolve(row ? row.message_id : null);
            }
        );
    });
}

async function resendInstruction(channel, client, logger = console) {
    try {
        const lastId = await getMessageId(channel.id, logger);
        if (lastId) {
            try {
                const oldMsg = await channel.messages.fetch(lastId);
                await oldMsg.delete();
            } catch (e) {
                logger.warn(`[bloxlink] Не удалось удалить старую инструкцию: ${e}`);
            }
        }
    } catch (e) {
        logger.warn(`[bloxlink] Ошибка при удалении старого сообщения: ${e}`);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    // V2 компонент вместо Embed
    const newMsg = await channel.send({
        flags: MessageFlags.IsComponentsV2,
        components: [instructionComponent]
    });
    saveMessageId(channel.id, newMsg.id, logger);

    const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel) {
        await logChannel.send(`📨 Инструкция по верификации была отправлена в ${channel.toString()}. ID: \`${newMsg.id}\``);
    }
}

module.exports = {
    name: 'bloxlink_verification',
    async setup(client, logger = console) {
        ensureDb(logger);

        // На входе - выдаём стартовые роли из массива JOIN_ROLE_IDS
        client.on(Events.GuildMemberAdd, async member => {
            if (!member.roles.cache.has(VERIFIED_ROLE_ID)) {
                // Получаем только существующие роли из массива
                const rolesToAdd = JOIN_ROLE_IDS
                    .map(id => member.guild.roles.cache.get(id))
                    .filter(role => !!role);

                if (rolesToAdd.length > 0) {
                    try {
                        // Добавляем все роли разом
                        await member.roles.add(
                            rolesToAdd.map(role => role.id),
                            { reason: "Выданы стартовые роли при входе" }
                        );
                        const logChannel = member.guild.channels.cache.get(LOG_CHANNEL_ID);
                        if (logChannel) {
                            await logChannel.send(`👤 ${member.toString()} зашёл на сервер и получил стартовые роли: ${rolesToAdd.map(r => `'${r.name}'`).join(', ')}.`);
                        }
                        logger.info(`[bloxlink] Добавлены стартовые роли пользователю ${member.user.tag}: ${rolesToAdd.map(r => r.name).join(', ')}`);
                    } catch (e) {
                        logger.error(`[bloxlink] Ошибка при выдаче стартовых ролей: ${e}`);
                    }
                }
            }
        });

        // При старте - отправляем инструкцию
        client.on(Events.ClientReady, async () => {
            logger.info(`[bloxlink] ClientReady: пробуем отправить инструкцию`);
            const channel = client.channels.cache.get(INSTRUCTION_CHANNEL_ID);
            if (channel) {
                await resendInstruction(channel, client, logger);
            } else {
                logger.warn(`[bloxlink] Не найден канал инструкции по ID ${INSTRUCTION_CHANNEL_ID}`);
            }
        });

        // Если роль подтверждённого появилась - отправляем ЛС (тоже V2 компонент, с пингом)
        client.on(Events.GuildMemberUpdate, async (before, after) => {
            const beforeRoles = new Set(before.roles.cache.map(role => role.id));
            const afterRoles = new Set(after.roles.cache.map(role => role.id));
            if (!beforeRoles.has(VERIFIED_ROLE_ID) && afterRoles.has(VERIFIED_ROLE_ID)) {
                try {
                    await after.send({
                        flags: MessageFlags.IsComponentsV2,
                        components: [getDmVerifiedComponent(after.id)]
                    });
                    logger.info(`[bloxlink] ЛС успешно отправлено ${after.user.tag}`);
                } catch (e) {
                    logger.warn(`[bloxlink] Не удалось отправить ЛС: ${e}`);
                }
            }
        });

        // Любое сообщение в канале инструкции — НЕ удаляем, просто отправляем инструкцию
        client.on(Events.MessageCreate, async message => {
            if (message.channel.id !== INSTRUCTION_CHANNEL_ID) return;
            if (message.author.id === client.user.id) return;
            await resendInstruction(message.channel, client, logger);
        });
    }
};