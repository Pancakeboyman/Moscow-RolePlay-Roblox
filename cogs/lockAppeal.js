const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.resolve(__dirname, '../data/roblox_punishments.db');
const db = new sqlite3.Database(DB_PATH);

const ALLOWED_ROLES = ['1331342900205850686']; // Измени на свои роли

function hasAllowedRole(interaction) {
    return interaction.member.roles.cache.some(role => ALLOWED_ROLES.includes(role.id));
}

// Проверка: заблокирована ли апелляция
async function isAppealBlocked(discordId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT 1 FROM appeal_blocked WHERE discordId = ?', [discordId], (err, row) => {
            if (err) return reject(err);
            resolve(!!row);
        });
    });
}

// Ставит блокировку
async function lockAppealForUser(discordId) {
    return new Promise((resolve, reject) => {
        db.run('INSERT OR IGNORE INTO appeal_blocked (discordId) VALUES (?)', [discordId], err => {
            if (err) return reject(err);
            resolve();
        });
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('заблокировать')
        .setDescription('Заблокировать апелляцию пользователю')
        .addSubcommand(sub =>
            sub
                .setName('апелляцию')
                .setDescription('Запретить подачу апелляции')
                .addUserOption(option =>
                    option.setName('пользователь')
                        .setDescription('Discord пользователь')
                        .setRequired(true)
                )
        ),
    async execute(interaction) {
        if (!hasAllowedRole(interaction)) {
            return await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xff0000)
                        .setTitle('Ошибка')
                        .setDescription('⛔ Нет прав на выполнение этой команды!')
                ],
                flags: 64
            });
        }
        if (interaction.options.getSubcommand() !== 'апелляцию') {
            return await interaction.reply({
                embeds: [
                    new EmbedBuilder().setColor(0xff0000).setTitle('Ошибка').setDescription('❌ Неизвестная команда!')
                ],
                flags: 64
            });
        }
        const discordUser = interaction.options.getUser('пользователь');
        if (!discordUser) {
            return await interaction.reply({
                embeds: [
                    new EmbedBuilder().setColor(0xff0000).setTitle('Ошибка').setDescription('Пользователь не найден!')
                ],
                flags: 64
            });
        }
        try {
            const alreadyBlocked = await isAppealBlocked(discordUser.id);
            if (alreadyBlocked) {
                return await interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xED4348)
                            .setTitle('Уже заблокировано')
                            .setDescription(`Апелляция для пользователя <@${discordUser.id}> уже была заблокирована!`)
                    ],
                    flags: 64
                });
            }
            await lockAppealForUser(discordUser.id);
            return await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xED4348)
                        .setTitle('Успех')
                        .setDescription(`Апелляция для пользователя <@${discordUser.id}> теперь заблокирована!`)
                ],
                flags: 64
            });
        } catch (e) {
            if (interaction.client && interaction.client.logger) {
                interaction.client.logger.error(`[lockAppeal] Не удалось заблокировать апелляцию: ${e.stack || e}`);
            } else {
                console.error('[lockAppeal] Не удалось заблокировать апелляцию:', e);
            }
            return await interaction.reply({
                embeds: [
                    new EmbedBuilder().setColor(0xff0000)
                        .setTitle('Ошибка')
                        .setDescription('Не удалось заблокировать апелляцию.\n```\n' + (e?.message || e) + '\n```')
                ],
                flags: 64
            });
        }
    }
};