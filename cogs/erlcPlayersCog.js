const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');
const { ERLC_API } = require('../apikeys');

const ERLC_API_URL = 'https://api.policeroleplay.community/v1';

// Карта перевода команд
const TEAM_TRANSLATIONS = {
    "Police": "Полиция",
    "Fire": "Пожарные",
    "Sheriff": "Шериф",
    "Civilian": "Гражданские",
    "DOT": "DOT"
};

// Получить username и id из поля Player ("Username:123456")
function parsePlayerField(playerString) {
    if (!playerString) return { username: "Unknown", id: null };
    const [username, id] = playerString.split(':');
    return { username, id };
}

// Перевод названия команды
function translateTeam(team) {
    if (!team) return "";
    return TEAM_TRANSLATIONS[team] || team;
}

// Ссылка на профиль с командой (русские названия)
function robloxLinkWithTeam(username, robloxId, team) {
    const teamRu = translateTeam(team);
    return `[${username}${teamRu ? ` (${teamRu})` : ""}](https://roblox.com/users/${robloxId}/profile)`;
}

// Список игроков в строку со ссылками
function robloxLinks(arr, withTeam = true) {
    if (!Array.isArray(arr) || arr.length === 0) return "";
    return arr.map((p) => {
        const { username, id } = parsePlayerField(p.Player);
        const team = withTeam ? (p.Team || "") : null;
        if (!id) return `\`${username}\``;
        return robloxLinkWithTeam(username, id, team);
    }).join(', ');
}

// Формируем описание для embed
function buildDescription(staff, players, queue) {
    let desc = `**Персонал Сервера [${staff.length}]**\n` +
        (staff.length ? robloxLinks(staff, true) : '> Нет игроков в этой категории.');

    desc += `\n\n**Онлайн Игроки [${players.length}]**\n` +
        (players.length ? robloxLinks(players, true) : '> Нет игроков в этой категории.');

    desc += `\n\n**Очередь [${queue.length}]**\n` +
        (queue.length ? robloxLinks(queue, false) : '> Нет игроков в этой категории.');

    return desc;
}

// Обрезка описания для Discord (лимит 4096, но лучше <=4000)
function safeDescription(str, maxLength = 4000) {
    if (typeof str !== "string" || str.length < 1) return '> Нет игроков в этой категории.';
    if (str.length > maxLength) return str.slice(0, maxLength - 3) + '...';
    return str;
}

// Получение игроков
async function getErlcPlayers() {
    const res = await fetch(`${ERLC_API_URL}/server/players`, {
        headers: { 'server-key': ERLC_API }
    });
    if (!res.ok) throw new Error('Ошибка получения данных ERLC API.');
    return res.json();
}

// Получение очереди
async function getErlcQueue() {
    const res = await fetch(`${ERLC_API_URL}/server/queue`, {
        headers: { 'server-key': ERLC_API }
    });
    if (!res.ok) throw new Error('Ошибка получения данных ERLC API.');
    return res.json();
}

// Если не помещается — разбиваем на несколько embed-ов
function splitDescriptionEmbeds(staff, players, queue, guild, totalPlayers) {
    const staffBlock = `**Персонал Сервера [${staff.length}]**\n` +
        (staff.length ? robloxLinks(staff, true) : '> Нет игроков в этой категории.');

    const playersArr = players.map((p) => {
        const { username, id } = parsePlayerField(p.Player);
        return robloxLinkWithTeam(username, id, p.Team || "");
    });

    const queueArr = queue.map((p) => {
        const { username, id } = parsePlayerField(p.Player);
        return robloxLinkWithTeam(username, id, null);
    });

    const embeds = [];
    let titleUsed = false;

    // Staff всегда в первом эмбеде
    let desc = staffBlock;

    // Добавляем игроков по кускам
    let chunk = '';
    for (let i = 0; i < playersArr.length; i++) {
        let add = (chunk.length ? ', ' : '') + playersArr[i];
        if ((desc.length + chunk.length + add.length + 40) > 4000) {
            if (chunk.length) {
                desc += `\n\n**Онлайн Игроки**\n${chunk}`;
            }
            embeds.push(
                new EmbedBuilder()
                    .setTitle(!titleUsed ? `Игроки Сервера [${totalPlayers}]` : undefined)
                    .setColor(0x2b2d31)
                    .setDescription(safeDescription(desc))
                    .setTimestamp(new Date())
                    .setAuthor({
                        name: guild.name,
                        iconURL: guild.iconURL({ dynamic: true })
                    })
            );
            titleUsed = true;
            desc = '';
            chunk = playersArr[i];
            continue;
        }
        chunk += add;
    }
    if (chunk.length) {
        desc += `\n\n**Онлайн Игроки**\n${chunk}`;
        chunk = '';
    }

    // Теперь очередь (если есть)
    let qchunk = '';
    for (let i = 0; i < queueArr.length; i++) {
        let add = (qchunk.length ? ', ' : '') + queueArr[i];
        if ((desc.length + qchunk.length + add.length + 30) > 4000) {
            if (qchunk.length) {
                desc += `\n\n**Очередь [${queueArr.length}]**\n${qchunk}`;
            }
            embeds.push(
                new EmbedBuilder()
                    .setColor(0x2b2d31)
                    .setDescription(safeDescription(desc))
                    .setTimestamp(new Date())
                    .setAuthor({
                        name: guild.name,
                        iconURL: guild.iconURL({ dynamic: true })
                    })
            );
            desc = '';
            qchunk = queueArr[i];
            continue;
        }
        qchunk += add;
    }
    if (qchunk.length) {
        desc += `\n\n**Очередь [${queueArr.length}]**\n${qchunk}`;
    }
    if (desc.length) {
        embeds.push(
            new EmbedBuilder()
                .setColor(0x2b2d31)
                .setDescription(safeDescription(desc))
                .setTimestamp(new Date())
                .setAuthor({
                    name: guild.name,
                    iconURL: guild.iconURL({ dynamic: true })
                })
        );
    }

    return embeds;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('erlc')
        .setDescription('Группа команд ER:LC')
        .addSubcommand(sub =>
            sub.setName('игроки')
                .setDescription('Показать всех игроков на сервере.')
        ),

    // СЛЕШ-КОМАНДА
    async execute(interaction) {
        if (interaction.options.getSubcommand() !== 'игроки') return;
        await interaction.deferReply();

        let players, queueRaw;
        try {
            players = await getErlcPlayers();
            queueRaw = await getErlcQueue();
        } catch (e) {
            return interaction.editReply('Ошибка получения данных ERLC API.');
        }

        // Разделяем игроков на персонал и обычных
        const staff = [];
        const actualPlayers = [];
        for (const player of players) {
            if (player.Permission && player.Permission !== 'Normal') {
                staff.push(player);
            } else {
                actualPlayers.push(player);
            }
        }

        // Очередь (queueRaw — это list of player IDs)
        const idPlayerMap = new Map();
        for (const p of players) {
            const { username, id } = parsePlayerField(p.Player);
            idPlayerMap.set(id, { username, team: p.Team });
        }
        const queue = queueRaw.map((id) => {
            const info = idPlayerMap.get(String(id));
            if (info) {
                return { Player: `${info.username}:${id}`, Team: info.team };
            }
            return { Player: `Unknown:${id}`, Team: "" };
        });

        // Одно описание если помещается, иначе — несколько эмбедов
        let description = buildDescription(staff, actualPlayers, queue);
        if (description.length <= 4000) {
            const embed = new EmbedBuilder()
                .setTitle(`Игроки Сервера [${players.length}]`)
                .setColor(0x2b2d31)
                .setDescription(safeDescription(description))
                .setAuthor({
                    name: interaction.guild.name,
                    iconURL: interaction.guild.iconURL({ dynamic: true })
                });
            await interaction.editReply({ embeds: [embed] });
        } else {
            // Несколько embed-ов
            const embeds = splitDescriptionEmbeds(staff, actualPlayers, queue, interaction.guild, players.length);
            await interaction.editReply({ embeds });
        }
    },

    // ПРЕФИКСНАЯ КОМАНДА
    async messageRun(message, args) {
        const prefix = "mrblx!";
        if (!message.content.toLowerCase().startsWith(prefix)) return;

        const parts = message.content.slice(prefix.length).trim().split(/\s+/);
        if (parts[0] !== "erlc" || parts[1] !== "игроки") return;

        let players, queueRaw;
        try {
            players = await getErlcPlayers();
            queueRaw = await getErlcQueue();
        } catch (e) {
            return message.reply('Ошибка получения данных ERLC API.');
        }

        // Разделяем игроков на персонал и обычных
        const staff = [];
        const actualPlayers = [];
        for (const player of players) {
            if (player.Permission && player.Permission !== 'Normal') {
                staff.push(player);
            } else {
                actualPlayers.push(player);
            }
        }

        // Очередь (queueRaw — это list of player IDs)
        const idPlayerMap = new Map();
        for (const p of players) {
            const { username, id } = parsePlayerField(p.Player);
            idPlayerMap.set(id, { username, team: p.Team });
        }
        const queue = queueRaw.map((id) => {
            const info = idPlayerMap.get(String(id));
            if (info) {
                return { Player: `${info.username}:${id}`, Team: info.team };
            }
            return { Player: `Unknown:${id}`, Team: "" };
        });

        let description = buildDescription(staff, actualPlayers, queue);
        if (description.length <= 4000) {
            const embed = new EmbedBuilder()
                .setTitle(`Игроки Сервера [${players.length}]`)
                .setColor(0x2b2d31)
                .setDescription(safeDescription(description))
                .setAuthor({
                    name: message.guild.name,
                    iconURL: message.guild.iconURL({ dynamic: true })
                });
            await message.channel.send({ embeds: [embed] });
        } else {
            // Несколько embed-ов
            const embeds = splitDescriptionEmbeds(staff, actualPlayers, queue, message.guild, players.length);
            await message.channel.send({ embeds });
        }
    }
};