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

// Снимает блокировку
async function unlockAppealForUser(discordId) {
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM appeal_blocked WHERE discordId = ?', [discordId], err => {
            if (err) return reject(err);
            resolve();
        });
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('разблокировать')
        .setDescription('Разблокировать апелляцию пользователю')
        .addSubcommand(sub =>
            sub
                .setName('апелляцию')
                .setDescription('Разрешить подачу апелляции')
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
            const alreadyUnlocked = !(await isAppealBlocked(discordUser.id));
            if (alreadyUnlocked) {
                return await interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x43d67b)
                            .setTitle('Уже разблокировано')
                            .setDescription(`Апелляция для пользователя <@${discordUser.id}> уже была разблокирована!`)
                    ],
                    flags: 64
                });
            }
            await unlockAppealForUser(discordUser.id);
            return await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x43d67b)
                        .setTitle('Успех')
                        .setDescription(`Апелляция для пользователя <@${discordUser.id}> разблокирована!`)
                ],
                flags: 64
            });
        } catch (e) {
            if (interaction.client && interaction.client.logger) {
                interaction.client.logger.error(`[unlockAppeal] Не удалось разблокировать апелляцию: ${e.stack || e}`);
            } else {
                console.error('[unlockAppeal] Не удалось разблокировать апелляцию:', e);
            }
            return await interaction.reply({
                embeds: [
                    new EmbedBuilder().setColor(0xff0000)
                        .setTitle('Ошибка')
                        .setDescription('Не удалось разблокировать апелляцию.\n```\n' + (e?.message || e) + '\n```')
                ],
                flags: 64
            });
        }
    }
};