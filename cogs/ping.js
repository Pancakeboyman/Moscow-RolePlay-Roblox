const { SlashCommandBuilder, EmbedBuilder, Events } = require('discord.js');

// HEX для цвета эмбеда
const HEX_COLOR = 0xCC2641;

// Время последнего рестарта (МСК)
const MSK_OFFSET = 3 * 60 * 60 * 1000;
const lastRestartDate = new Date(Date.now() + MSK_OFFSET);
const lastRestartTimestamp = Math.floor(lastRestartDate.getTime() / 1000);

/**
 * Формирует Embed для статуса бота
 */
function makeEmbed(guild, guildPing, apiPing, shard, shardCount, membersCount, totalGuilds) {
    const embed = new EmbedBuilder()
        .setTitle('Статус Бота')
        .setColor(HEX_COLOR);

    if (guild) {
        embed.setAuthor({ name: guild.name, iconURL: guild.iconURL() });
        if (guild.iconURL()) embed.setThumbnail(guild.iconURL());
    } else {
        embed.setAuthor({ name: 'ЛС или неизвестный сервер' });
    }

    embed.addFields([{
        name: 'Информация',
        value: `> **Пинг сервера:** \`${guildPing}мс\`
> **Пинг API:** \`${apiPing}мс\`
> **Последний рестарт:** <t:${lastRestartTimestamp}:f> (МСК)
**[Сервер поддержки](https://discord.gg/bzK3F2U3Fm)**`
    }]);

    const shardText = `${shard + 1} из ${shardCount}`;
    if (guild) {
        embed.setFooter({
            text: `Шард: ${shardText} • Серверов: ${totalGuilds} • Участников на сервере: ${membersCount}`
        });
    } else {
        embed.setFooter({
            text: `Шард: ${shardText} • Серверов: ${totalGuilds}`
        });
    }

    return embed;
}

function setup(client, logger) {
    const PREFIX = 'mrblx!';

    // Префиксная команда mrblx!пинг
    client.on(Events.MessageCreate, async (message) => {
        if (message.author.bot) return;
        if (!message.guild) return;
        if (!message.content.startsWith(PREFIX)) return;

        const args = message.content.slice(PREFIX.length).trim().split(/ +/);
        const commandName = args.shift()?.toLowerCase();

        if (commandName === 'пинг') {
            const apiPing = Math.round(client.ws.ping); // ms
            const start = Date.now();
            const sentMsg = await message.channel.send('Проверка пинга...');
            const end = Date.now();
            const guildPing = end - start;
            const guild = message.guild;
            const shard = guild ? guild.shardId : 0;
            const shardCount = client.shard ? client.shard.count : 1;
            const membersCount = guild ? guild.memberCount : 0;
            const totalGuilds = client.guilds.cache.size;

            const embed = makeEmbed(guild, guildPing, apiPing, shard, shardCount, membersCount, totalGuilds);
            await sentMsg.edit({ content: null, embeds: [embed] });
        }
    });

    // Слэш-команда /пинг
    client.on(Events.InteractionCreate, async (interaction) => {
        if (!interaction.isChatInputCommand()) return;
        if (interaction.commandName === 'пинг') {
            const apiPing = Math.round(client.ws.ping); // ms
            const start = Date.now();
            await interaction.deferReply({ ephemeral: true });
            const end = Date.now();
            const guildPing = end - start;
            const guild = interaction.guild;
            const shard = guild ? guild.shardId : 0;
            const shardCount = client.shard ? client.shard.count : 1;
            const membersCount = guild ? guild.memberCount : 0;
            const totalGuilds = client.guilds.cache.size;

            const embed = makeEmbed(guild, guildPing, apiPing, shard, shardCount, membersCount, totalGuilds);
            await interaction.editReply({ embeds: [embed] });
        }
    });

    // Регистрируем слэш-команду при запуске
    client.once(Events.ClientReady, async () => {
        try {
            // Проверяем, есть ли уже команда - чтобы не плодить дубликаты
            const commands = await client.application.commands.fetch();
            if (!commands.find(cmd => cmd.name === 'пинг')) {
                await client.application.commands.create(
                    new SlashCommandBuilder()
                        .setName('пинг')
                        .setDescription('Показывает пинг бота и Discord API')
                );
                if (logger) logger.info('[Ping] Slash-команда зарегистрирована');
            }
        } catch (e) {
            if (logger) logger.error(`[Ping] Ошибка регистрации: ${e}`);
        }
    });

    if (logger) logger.info('[Ping] Cog инициализирован');
}

module.exports = { setup, makeEmbed };