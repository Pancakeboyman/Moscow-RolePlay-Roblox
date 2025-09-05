const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');

const REPORT_CHANNEL_ID = '1404370357573386341'; // <--- Замените на ваш канал для отчётов
const ALLOWED_ROLE_IDS = ['1331333367743910033', '1368561596921548900', '1364920071201361920']; // <--- Замените на ID ролей, которым разрешена команда
const THUMBNAIL_URL =
  'https://cdn.discordapp.com/attachments/1363556047704293517/1404369256182972436/--Moscow-RolePlay-Roblox.png?ex=689af04a&is=68999eca&hm=d79964e1d947662a9c5c7aac3b3ac9a95189d80a790b200d819104664e45eb7d&';
const EMBED_COLOR = 0xcc2641;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('отчёт_команды')
    .setDescription('Оставить отчёт об использовании команды в игре'),

  async execute(interaction) {
    // Проверка на роль
    if (
      !interaction.member.roles.cache.some((role) =>
        ALLOWED_ROLE_IDS.includes(role.id)
      )
    ) {
      await interaction.reply({
        content: '⛔ У вас нет прав для использования этой команды.',
        ephemeral: true
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId('report_command_modal')
      .setTitle('Отчёт об использовании команды');

    const commandInput = new TextInputBuilder()
      .setCustomId('command_used')
      .setLabel('Какую команду вы использовали?')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const reasonInput = new TextInputBuilder()
      .setCustomId('command_reason')
      .setLabel('С какой целью вы использовали команду?')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const timeInput = new TextInputBuilder()
      .setCustomId('when_used')
      .setLabel('Когда была использована команда? (дата/время)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const logLinkInput = new TextInputBuilder()
      .setCustomId('log_link')
      .setLabel('Ссылка на лог с сообщением (или ID)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const additionalInput = new TextInputBuilder()
      .setCustomId('additional_info')
      .setLabel('Дополнительная информация (необязательно)')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(commandInput),
      new ActionRowBuilder().addComponents(reasonInput),
      new ActionRowBuilder().addComponents(timeInput),
      new ActionRowBuilder().addComponents(logLinkInput),
      new ActionRowBuilder().addComponents(additionalInput)
    );

    await interaction.showModal(modal);
  },

  async handleModal(interaction) {
    if (interaction.customId !== 'report_command_modal') return;

    // Проверка на роль (на всякий случай, как и в execute)
    if (
      !interaction.member.roles.cache.some((role) =>
        ALLOWED_ROLE_IDS.includes(role.id)
      )
    ) {
      await interaction.reply({
        content: '⛔ У вас нет прав для отправки отчёта.',
        ephemeral: true
      });
      return;
    }

    const commandUsed = interaction.fields.getTextInputValue('command_used');
    const commandReason = interaction.fields.getTextInputValue('command_reason');
    const whenUsed = interaction.fields.getTextInputValue('when_used');
    const logLink = interaction.fields.getTextInputValue('log_link');
    const additionalInfo =
      interaction.fields.getTextInputValue('additional_info') || '—';

    const embed = new EmbedBuilder()
      .setTitle('📝 Отчёт об использовании команды')
      .addFields(
        { name: 'Команда', value: commandUsed, inline: true },
        { name: 'Цель использования', value: commandReason, inline: false },
        { name: 'Время использования', value: whenUsed, inline: false },
        { name: 'Лог/ссылка на сообщение', value: logLink, inline: false },
        { name: 'Доп. информация', value: additionalInfo, inline: false }
      )
      .setAuthor({
        name: `${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setThumbnail(THUMBNAIL_URL)
      .setTimestamp(new Date())
      .setFooter({ text: `ID: ${interaction.user.id}` })
      .setColor(EMBED_COLOR);

    const reportChannel = await interaction.client.channels.fetch(
      REPORT_CHANNEL_ID
    );
    if (reportChannel && reportChannel.isTextBased()) {
      await reportChannel.send({ embeds: [embed] });
      await interaction.reply({
        content: 'Ваш отчёт успешно отправлен!',
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: 'Не удалось найти канал для отчётов!',
        ephemeral: true
      });
    }
  }
};