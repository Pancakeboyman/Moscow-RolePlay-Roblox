const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getSubscribersDb } = require('../utils/database');
const { ADMIN_ROLES, SUBSCRIBER_ROLE, LOG_CHANNEL } = require('../apikeys');
const {
    STATUS_LABELS,
    STATUS_ROLES
} = require('../constants');
const noblox = require('noblox.js');

const EXTRA_LOG_CHANNEL = "1363535182342262904";

// Автодополнение через noblox.js (фуззи-поиск, до 10 вариантов, минимум 3 символа!)
async function robloxAutocomplete(username) {
    if (!username || typeof username !== 'string' || username.length < 3) return [];
    try {
        const users = await noblox.searchUsers(username, 10, "");
        if (!Array.isArray(users) || users.length === 0) return [];
        return users
            .filter(user => typeof user.username === 'string' && user.username.length > 0 && typeof user.userId === 'number')
            .map(user => ({
                name: `${user.username} (${user.userId})`,
                value: user.username
            }));
    } catch (e) {
        if (e.message && e.message.includes("429")) return [];
        console.error("Autocomplete error:", e);
        return [];
    }
}

// Точное совпадение userId по никнейму через noblox.js
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
    .setName('добавить_подписчика')
    .setDescription('Добавить подписчика в базу данных')
    .addUserOption(option => option.setName('дискорд').setDescription('Discord пользователь').setRequired(true))
    .addStringOption(option =>
        option.setName('ник_roblox')
        .setDescription('Никнейм Roblox')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addIntegerOption(option => option.setName('дней').setDescription('Количество дней подписки').setRequired(true))
    .addIntegerOption(option =>
        option.setName('статус')
        .setDescription('Статус подписки')
        .setRequired(true)
        .addChoices(
            { name: 'Арбат', value: 1 },
            { name: 'Тверская', value: 2 },
            { name: 'Кремль', value: 3 },
        )
    ),
  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const res = await robloxAutocomplete(focusedValue);
    await interaction.respond(res);
  },
  async execute(interaction) {
    if (!interaction.member.roles.cache.some(role => ADMIN_ROLES.includes(role.id))) {
      return interaction.reply({
        ephemeral: true,
        embeds: [new EmbedBuilder().setTitle('❌ Отказано в доступе').setDescription('У вас нет прав для использования этой команды!').setColor(0xCC2641)]
      });
    }
    const user = interaction.options.getUser('дискорд');
    const robloxUsername = interaction.options.getString('ник_roblox');
    const days = interaction.options.getInteger('дней');
    const status = interaction.options.getInteger('статус');

    // Получить userId по точному совпадению ника (для ссылки)
    const robloxId = await getRobloxId(robloxUsername);

    const db = getSubscribersDb();
    db.get("SELECT * FROM subscribers WHERE discord_id = ?", [user.id], (err, row) => {
      if (row) {
        interaction.reply({
          ephemeral: true,
          embeds: [new EmbedBuilder().setTitle('❌ Пользователь уже существует').setDescription(`Пользователь <@${user.id}> уже есть в базе данных!`).setColor(0xCC2641)]
        });
        db.close();
      } else {
        const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
        // Храним статус как число (1, 2, 3)
        db.run("INSERT INTO subscribers (discord_id, roblox_username, subscription_days, expires_at, status) VALUES (?, ?, ?, ?, ?)",
          [user.id, robloxUsername, days, expiresAt, status], async err => {
            db.close();
            if (err) return interaction.reply({ ephemeral: true, embeds: [new EmbedBuilder().setTitle('❌ Ошибка').setDescription(err.message).setColor(0xCC2641)] });
            let member = await interaction.guild.members.fetch(user.id).catch(() => null);

            // Выдаём роли
            let statusRoleId = STATUS_ROLES[status];
            let statusRole = interaction.guild.roles.cache.get(statusRoleId);
            let subRole = interaction.guild.roles.cache.get(SUBSCRIBER_ROLE);

            if (member) {
              // Удаляем все старые статусные роли
              for (const roleId of Object.values(STATUS_ROLES)) {
                if (member.roles.cache.has(roleId)) await member.roles.remove(roleId).catch(() => {});
              }
              // Добавляем новую статусную роль
              if (statusRole) await member.roles.add(statusRole).catch(() => {});
              // Добавляем роль подписчика
              if (subRole) await member.roles.add(subRole).catch(() => {});
            }

            const robloxProfile = robloxId
                ? `[${robloxUsername}](https://www.roblox.com/users/${robloxId}/profile)`
                : robloxUsername;

            await interaction.reply({
              embeds: [
                new EmbedBuilder()
                  .setTitle('✅ Подписчик добавлен!')
                  .setDescription('Пользователь успешно внесён в базу подписчиков и получил соответствующие роли.')
                  .addFields(
                    { name: '👤 Discord', value: `<@${user.id}>`, inline: true },
                    { name: '🔗 Roblox', value: robloxProfile, inline: true },
                    { name: '⏳ Дни подписки', value: `${days}`, inline: true },
                    { name: '🏷️ Статус', value: STATUS_LABELS[status], inline: true },
                    { name: 'Истекает', value: `<t:${Math.floor(new Date(expiresAt).getTime() / 1000)}:F>`, inline: true }
                  )
                  .setColor(0xCC2641)
                  .setFooter({ text: "Moscow RolePlay | ER:LC Subscriber System" })
                  .setTimestamp()
              ]
            });

            const logEmbed = new EmbedBuilder()
              .setTitle('📝 Подписчик добавлен')
              .setColor(0xCC2641)
              .addFields(
                { name: 'Администратор', value: `<@${interaction.user.id}>`, inline: true },
                { name: 'Пользователь', value: `<@${user.id}>`, inline: true },
                { name: 'Roblox ник', value: robloxProfile, inline: true },
                { name: 'Дни подписки', value: days.toString(), inline: true },
                { name: 'Статус', value: STATUS_LABELS[status], inline: true },
                { name: 'Истекает', value: `<t:${Math.floor(new Date(expiresAt).getTime() / 1000)}:F>`, inline: true }
              )
              .setFooter({ text: "Moscow RolePlay | ER:LC Subscriber System" })
              .setTimestamp();

            if (LOG_CHANNEL) {
              const channel = interaction.guild.channels.cache.get(LOG_CHANNEL);
              if (channel) channel.send({ embeds: [logEmbed] });
            }
            const extraChannel = interaction.guild.channels.cache.get(EXTRA_LOG_CHANNEL);
            if (extraChannel) extraChannel.send({ embeds: [logEmbed] });

            await user.send({
              embeds: [
                new EmbedBuilder()
                  .setTitle('🎉 Ваша подписка активирована!')
                  .setDescription(
                    `**Поздравляем!** Вы получили подписку на **${days} дней**.\n\n` +
                    `**Ваш Roblox никнейм:** ${robloxProfile}\n` +
                    `**Статус:** ${STATUS_LABELS[status]}\n`
                  )
                  .addFields(
                    { name: 'Возможности', value: '• Доступ к заблокированным автомобилям (подробнее в <#1342209500572029059>).\n• Особые награды и внутриигровые бонусы\n• Прямые уведомления о событиях сервера (подобнее в <#1375539483377799250>).', inline: false }
                  )
                  .setColor(0xCC2641)
                  .setFooter({ text: "Moscow RolePlay Roblox | Спасибо за поддержку!" })
                  .setTimestamp()
              ]
            }).catch(() => {});
          });
      }
    });
  }
};