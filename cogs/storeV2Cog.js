const { SlashCommandBuilder } = require('discord.js');
const { MessageFlags, ComponentType, SeparatorSpacingSize, ButtonStyle } = require('discord-api-types/v10');

// --- Компоненты подписок ---
const arbatComponent = {
  type: ComponentType.Container,
  accent_color: 0x006800,
  spoiler: false,
  components: [
    {
      type: ComponentType.TextDisplay,
      content:
        "# 🟠 **Подписка \"Арбат\" (70 Robux в месяц / 750 Robux в год)**\nЭксклюзивная роль <@&1375524323724496946>\n\n" +
        "**🔹Эксклюзивные Каналы**\n`#чат-подписчиков` - Общайтесь с другими участниками поддержки или используйте команды в тихом эксклюзивном канале.\n\n" +
        "**🔹Приоритетные заявки**\nЛюбая ваша заявка в команду будет рассмотрена в течение 24 часов после открытия тикета поддержки.\n\n" +
        "**🔹Опросы сообщества**\nСпециальный доступ к опросам по потенциальным изменениям, отзывам или общим идеям, касающимся Moscow RolePlay.\n\n" +
        "**🔹Использование звуковой панели Discord**\nДоступ к использованию звуковой панели Discord в голосовых чатах.\n\n" +
        "**🔹Создание опросов в чате**\nВозможность создавать опросы Discord прямо в чате.\n\n" +
        "**🔹Использование внешних стикеров**\nВозможность использовать стикеры из других серверов Discord в чате.\n\n" +
        "**🔹Переименование приватного голосового канала**\nВозможность изменять название любого приватного голосового канала, которым вы владеете."
    },
    {
      type: ComponentType.ActionRow,
      components: [
        {
          type: ComponentType.Button,
          style: ButtonStyle.Link,
          label: "Пробный период",
          url: "https://www.roblox.com/game-pass/1284347509/Trial-Period-Pass"
        },
        {
          type: ComponentType.Button,
          style: ButtonStyle.Link,
          label: "Месячная подписка",
          url: "https://www.roblox.com/game-pass/1284581407/Starter-Pass"
        },
        {
          type: ComponentType.Button,
          style: ButtonStyle.Link,
          label: "Годовая подписка",
          url: "https://www.roblox.com/game-pass/1229099939/Starter-Pass-Year"
        }
      ]
    }
  ]
};

const tverskayaComponent = {
  type: ComponentType.Container,
  accent_color: 0x006800,
  spoiler: false,
  components: [
    {
      type: ComponentType.TextDisplay,
      content:
        "# 🔵 **Подписка \"Тверская\" (120 Robux в месяц / 1200 Robux в год)**\nЭксклюзивная роль <@&1375524827770912788>\n\n" +
        "**🔹Эксклюзивные Каналы**\n`#чат-подписчиков` - Общайтесь с другими участниками поддержки или используйте команды в тихом эксклюзивном канале.\n\n" +
        "**🔹Кастомная роль (без иконки)**\nПолучите уникальную роль (без иконки) поверх всех ваших текущих ролей, обратившись в поддержку.\n\n" +
        "**🔹Смена ника**\nВозможность изменить свой никнейм на сервере Moscow RolePlay, обратившись в поддержку.\n\n" +
        "**🔹Эксклюзивные розыгрыши для подписчиков**\nДоступ к розыгрышам, доступным только для подписчиков.\n\n" +
        "**🔹Приоритетные заявки**\nЛюбая ваша заявка в команду будет рассмотрена в течение 24 часов после открытия тикета поддержки.\n\n" +
        "**🔹Опросы сообщества**\nСпециальный доступ к опросам.\n\n" +
        "**🔹Использование звуковой панели Discord**\nДоступ к использованию звуковой панели Discord.\n\n" +
        "**🔹Создание опросов в чате**\nВозможность создавать опросы Discord.\n\n" +
        "**🔹Отправка изображений**\nРазрешение публиковать изображения.\n\n" +
        "**🔹Использование внешних стикеров**\nИспользование стикеров из других серверов Discord.\n\n" +
        "**🔹Переименование приватного голосового канала**\nВозможность изменять название приватного голосового канала."
    },
    {
      type: ComponentType.ActionRow,
      components: [
        {
          type: ComponentType.Button,
          style: ButtonStyle.Link,
          label: "Пробный период",
          url: "https://www.roblox.com/game-pass/1284347509/Trial-Period-Pass"
        },
        {
          type: ComponentType.Button,
          style: ButtonStyle.Link,
          label: "Месячная подписка",
          url: "https://www.roblox.com/game-pass/1229513047/Pro-Pass"
        },
        {
          type: ComponentType.Button,
          style: ButtonStyle.Link,
          label: "Годовая подписка",
          url: "https://www.roblox.com/game-pass/1232075298/Pro-Pass-Year"
        }
      ]
    }
  ]
};

const kremlinComponent = {
  type: ComponentType.Container,
  accent_color: 0x006800,
  spoiler: false,
  components: [
    {
      type: ComponentType.TextDisplay,
      content:
        "# 🔴 **Подписка \"Кремль\" (270 Robux / 2950 Robux в год)**\nЭксклюзивная роль <@&1375525084219052144>\n\n" +
        "**🔹Эксклюзивные Каналы**\n`#чат-подписчиков` - Общайтесь с другими участниками поддержки или используйте команды.\n`#чат-обновлений` - Узнавайте о планах будущих изменений.\n\n" +
        "**🔹Кастомная роль (с иконкой)**\nПолучите уникальную роль с иконкой.\n\n" +
        "**🔹Смена ника**\nВозможность изменить свой никнейм.\n\n" +
        "**🔹Эксклюзивные розыгрыши для подписчиков**\nДоступ к розыгрышам.\n\n" +
        "**🔹Приоритетные заявки**\nЛюбая ваша заявка будет рассмотрена быстро.\n\n" +
        "**🔹Опросы сообщества**\nДоступ к опросам.\n\n" +
        "**🔹Использование звуковой панели Discord**\nДоступ к панели.\n\n" +
        "**🔹Создание опросов**\nВозможность создавать опросы.\n\n" +
        "**🔹Доступ к голосовым каналам для персонала**\nВозможность общаться с командой.\n\n" +
        "**🔹Ранний доступ к информации**\nУзнавайте первыми о изменениях.\n\n" +
        "**🔹Отправка изображений**\nПубликация изображений.\n\n" +
        "**🔹Использование внешних стикеров**\nИспользование стикеров из других серверов.\n\n" +
        "**🔹Переименование приватного голосового канала**\nИзменение названия канала."
    },
    {
      type: ComponentType.ActionRow,
      components: [
        {
          type: ComponentType.Button,
          style: ButtonStyle.Link,
          label: "Пробный период",
          url: "https://www.roblox.com/game-pass/1284347509/Trial-Period-Pass"
        },
        {
          type: ComponentType.Button,
          style: ButtonStyle.Link,
          label: "Месячная подписка",
          url: "https://www.roblox.com/game-pass/1331231379/Ultimate-Pass"
        },
        {
          type: ComponentType.Button,
          style: ButtonStyle.Link,
          label: "Годовая подписка",
          url: "https://www.roblox.com/game-pass/1231048318/Ultimate-Pass-Year"
        }
      ]
    }
  ]
};

// --- Донатные планы (на русском) ---
const deluxeComponent = {
  type: ComponentType.Container,
  accent_color: 0xFFD700,
  spoiler: false,
  components: [
    {
      type: ComponentType.TextDisplay,
      content:
        "# 💎 **Донат (от 500 до 1000 Robux)**\n\n" +
        "Вы получаете особую роль, доступ к закрытым каналам поддержки и упоминание в благодарностях проекта.\n\n" +
        "Выберите сумму доната:"
    },
    {
      type: ComponentType.ActionRow,
      components: [
        {
          type: ComponentType.Button,
          style: ButtonStyle.Link,
          label: "500 Robux",
          url: "https://www.roblox.com/game-pass/2011111111/Donator500"
        },
        {
          type: ComponentType.Button,
          style: ButtonStyle.Link,
          label: "750 Robux",
          url: "https://www.roblox.com/game-pass/2011111112/Donator750"
        },
        {
          type: ComponentType.Button,
          style: ButtonStyle.Link,
          label: "900 Robux",
          url: "https://www.roblox.com/game-pass/2011111113/Donator900"
        },
        {
          type: ComponentType.Button,
          style: ButtonStyle.Link,
          label: "950 Robux",
          url: "https://www.roblox.com/game-pass/2011111114/Donator950"
        },
        {
          type: ComponentType.Button,
          style: ButtonStyle.Link,
          label: "1000 Robux",
          url: "https://www.roblox.com/game-pass/2011111115/Donator1000"
        }
      ]
    }
  ]
};

const donationComponent = {
  type: ComponentType.Container,
  accent_color: 0x00BFFF,
  spoiler: false,
  components: [
    {
      type: ComponentType.TextDisplay,
      content:
        "# 🚗 **Супер (от 5000 до 10000 Robux)**\n\n" +
        "Вы получаете особую роль, возможность персонального общения с администрацией и бонусы на сервере.\n\n" +
        "Выберите сумму доната:"
    },
    {
      type: ComponentType.ActionRow,
      components: [
        {
          type: ComponentType.Button,
          style: ButtonStyle.Link,
          label: "5000 Robux",
          url: "https://www.roblox.com/game-pass/2022222221/SuperDonator5000"
        },
        {
          type: ComponentType.Button,
          style: ButtonStyle.Link,
          label: "6000 Robux",
          url: "https://www.roblox.com/game-pass/2022222222/SuperDonator6000"
        },
        {
          type: ComponentType.Button,
          style: ButtonStyle.Link,
          label: "7000 Robux",
          url: "https://www.roblox.com/game-pass/2022222223/SuperDonator7000"
        },
        {
          type: ComponentType.Button,
          style: ButtonStyle.Link,
          label: "8500 Robux",
          url: "https://www.roblox.com/game-pass/2022222224/SuperDonator8500"
        },
        {
          type: ComponentType.Button,
          style: ButtonStyle.Link,
          label: "10000 Robux",
          url: "https://www.roblox.com/game-pass/2022222225/SuperDonator10000"
        }
      ]
    }
  ]
};

const supremeComponent = {
  type: ComponentType.Container,
  accent_color: 0x9400D3,
  spoiler: false,
  components: [
    {
      type: ComponentType.TextDisplay,
      content:
        "# 🌌 **Мега Донат (от 30000 до 60000 Robux)**\n\n" +
        "Вы становитесь легендой проекта, получаете бессрочную VIP-роль, уникальные возможности и публичную благодарность!\n\n" +
        "Выберите сумму доната:"
    },
    {
      type: ComponentType.ActionRow,
      components: [
        {
          type: ComponentType.Button,
          style: ButtonStyle.Link,
          label: "30000 Robux",
          url: "https://www.roblox.com/game-pass/2033333331/Legend30000"
        },
        {
          type: ComponentType.Button,
          style: ButtonStyle.Link,
          label: "35000 Robux",
          url: "https://www.roblox.com/game-pass/2033333332/Legend35000"
        },
        {
          type: ComponentType.Button,
          style: ButtonStyle.Link,
          label: "40000 Robux",
          url: "https://www.roblox.com/game-pass/2033333333/Legend40000"
        },
        {
          type: ComponentType.Button,
          style: ButtonStyle.Link,
          label: "50000 Robux",
          url: "https://www.roblox.com/game-pass/2033333334/Legend50000"
        },
        {
          type: ComponentType.Button,
          style: ButtonStyle.Link,
          label: "60000 Robux",
          url: "https://www.roblox.com/game-pass/2033333335/Legend60000"
        }
      ]
    }
  ]
};

// --- Основной контейнер магазина ---
const mainComponent = {
  type: ComponentType.Container,
  accent_color: 26624,
  spoiler: false,
  components: [
    {
      type: ComponentType.MediaGallery,
      items: [
        {
          media: {
            url: "https://cdn.discordapp.com/attachments/1363556047704293517/1404014643768332308/--.png?ex=6899a608&is=68985488&hm=c9e2fce9a00beb683afc3e97b4958ff5b78d0d4c5073f8e75789c12153e65c16&"
          }
        }
      ]
    },
    {
      type: ComponentType.TextDisplay,
      content: "# <:moscowrus:1374006028185636887> **Официальный магазин MRP**"
    },
    {
      type: ComponentType.TextDisplay,
      content: "**Последнее обновление:** <t:1754812545:D>"
    },
    {
      type: ComponentType.TextDisplay,
      content: "Добро пожаловать в официальный магазин <:moscowrus:1374006028185636887> **Moscow RolePlay**! Пожалуйста, ознакомьтесь с правилами заказа перед покупкой."
    },
    {
      type: ComponentType.TextDisplay,
      content:
        "> - Все подписки и покупки окончательные, возврат средств невозможен даже при отмене или ошибке.\n" +
        "> - Пробный период предоставляется на 1 неделю и только для одной подписки. Повторно оформить пробный период нельзя, даже для других вариантов.\n" +
        "> - Оформляя подписку, вы подтверждаете согласие с правилами сервера, политикой возвратов и пользовательским соглашением Moscow RolePlay. В случае нарушений подписка может быть приостановлена или аннулирована без возврата средств.\n" +
        "> - После покупки обязательно откройте тикет и приложите чек для получения привилегий.\n" +
        "> - Цены не обсуждаются, споры с администрацией не принимаются."
    },
    {
      type: ComponentType.Separator,
      spacing: SeparatorSpacingSize.Large,
      divider: true
    },
    // --- Блок подписок ---
    {
      type: ComponentType.TextDisplay,
      content: "## Подписки"
    },
    {
      type: ComponentType.ActionRow,
      components: [
        {
          style: ButtonStyle.Secondary,
          type: ComponentType.Button,
          label: "Статус Арбат",
          custom_id: "status_arbat"
        },
        {
          style: ButtonStyle.Secondary,
          type: ComponentType.Button,
          label: "Статус Тверская",
          custom_id: "status_tverskaya"
        },
        {
          style: ButtonStyle.Secondary,
          type: ComponentType.Button,
          label: "Статус Кремль",
          custom_id: "status_kremlin"
        }
      ]
    },
    {
      type: ComponentType.Separator,
      spacing: SeparatorSpacingSize.Large,
      divider: true
    },
    // --- Блок донатов ---
    {
      type: ComponentType.TextDisplay,
      content: "## Донаты"
    },
    {
      type: ComponentType.ActionRow,
      components: [
        {
          style: ButtonStyle.Secondary,
          type: ComponentType.Button,
          label: "Донат (500-1000)",
          custom_id: "donate_deluxe"
        },
        {
          style: ButtonStyle.Secondary,
          type: ComponentType.Button,
          label: "Супер Донат (5000-10000)",
          custom_id: "donate_donation"
        },
        {
          style: ButtonStyle.Secondary,
          type: ComponentType.Button,
          label: "Мега Донат (30000-60000)",
          custom_id: "donate_supreme"
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
      content: "<:White_Warning:1404016185946931270> Не забудьте открыть тикет в канале <#1338585898907861012> после покупки, чтобы получить свои привилегии."
    }
  ]
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('магазин')
    .setDescription('Показать официальный магазин Moscow RolePlay'),

  async execute(interaction) {
    await interaction.reply({
      content: "✅ Меню магазина отправлено! (Сообщение в канал без указания пользователя)",
      flags: MessageFlags.Ephemeral
    });

    await interaction.channel.send({
      flags: MessageFlags.IsComponentsV2,
      components: [mainComponent]
    });
  },

  async onInteraction(interaction) {
    if (!interaction.isButton()) return false;

    // Подписки
    if (interaction.customId === "status_arbat") {
      await interaction.reply({
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        components: [arbatComponent]
      });
      return true;
    }
    if (interaction.customId === "status_tverskaya") {
      await interaction.reply({
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        components: [tverskayaComponent]
      });
      return true;
    }
    if (interaction.customId === "status_kremlin") {
      await interaction.reply({
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        components: [kremlinComponent]
      });
      return true;
    }
    // Донаты
    if (interaction.customId === "donate_deluxe") {
      await interaction.reply({
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        components: [deluxeComponent]
      });
      return true;
    }
    if (interaction.customId === "donate_donation") {
      await interaction.reply({
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        components: [donationComponent]
      });
      return true;
    }
    if (interaction.customId === "donate_supreme") {
      await interaction.reply({
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        components: [supremeComponent]
      });
      return true;
    }
    // Фоллбек для неизвестной кнопки
    await interaction.reply({
      content: '❌ Неизвестная кнопка! Возможно, она устарела или была удалена.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }
};