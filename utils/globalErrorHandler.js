const { LOG_CHANNEL } = require('../apikeys');

/**
 * Глобальный обработчик ошибок для Node.js + Discord.js.
 * Логирует через winston и отправляет в Discord-канал (если LOG_CHANNEL задан).
 */
function setupGlobalErrorHandler(client, logger) {
    // Необработанные исключения
    process.on('uncaughtException', (err) => {
        logger.error(`GLOBAL uncaughtException: ${err.stack || err}`);
        // Логируем в Discord (если канал доступен)
        if (client && client.channels && client.channels.cache && LOG_CHANNEL) {
            const channel = client.channels.cache.get(LOG_CHANNEL);
            if (channel) {
                channel.send(`❌ **uncaughtException:**\n\`\`\`${err && (err.stack || err.message || err)}\`\`\``).catch(() => {});
            }
        }
    });

    // Необработанные промисы
    process.on('unhandledRejection', (reason, promise) => {
        logger.error(`GLOBAL unhandledRejection: ${reason && reason.stack ? reason.stack : reason}`);
        // Логируем в Discord (если канал доступен)
        if (client && client.channels && client.channels.cache && LOG_CHANNEL) {
            const channel = client.channels.cache.get(LOG_CHANNEL);
            if (channel) {
                channel.send(`❌ **unhandledRejection:**\n\`\`\`${reason && reason.stack ? reason.stack : reason}\`\`\``).catch(() => {});
            }
        }
    });
}

module.exports = { setupGlobalErrorHandler };