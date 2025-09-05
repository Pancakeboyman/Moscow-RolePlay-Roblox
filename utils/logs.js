const winston = require('winston');
const { EmbedBuilder } = require('discord.js');

const LOG_CHANNEL_ID = '1363535182342262904';

// Настройка логирования через winston
function setup_logging() {
    winston.configure({
        level: 'info',
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.printf(({ timestamp, level, message }) => `${timestamp} - VoiceLogs - ${level.toUpperCase()} - ${message}`)
        ),
        transports: [
            new winston.transports.File({ filename: 'data/logs.txt', encoding: 'utf8' }),
            new winston.transports.Console()
        ]
    });
}

// Отправить лог в Discord-канал и в winston
async function send_log(guild, content, level = 'info') {
    const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);

    // Отправка в Discord-канал
    if (logChannel) {
        const embed = new EmbedBuilder()
            .setTitle('📄 Лог голосового канала')
            .setDescription(content)
            .setColor('Blue');
        await logChannel.send({ embeds: [embed] });
    }

    // Запись через winston
    switch (level.toLowerCase()) {
        case 'warning':
            winston.warn(content);
            break;
        case 'error':
            winston.error(content);
            break;
        case 'debug':
            winston.debug(content);
            break;
        default:
            winston.info(content);
            break;
    }
}

module.exports = {
    LOG_CHANNEL_ID,
    setup_logging,
    send_log
};