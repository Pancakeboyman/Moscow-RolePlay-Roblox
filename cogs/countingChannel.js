const { Events } = require('discord.js');

const CHANNEL_ID = '1407651007122640937';

const MILESTONE_RANGES = [
    {
        from: 100, to: 499, every: 100, emojis: ['🎉', '🍕','<:MRPRoblox:1407659721401438298>'],
    },
    {
        from: 500, to: 999, every: 500, emojis: ['🥳', '🔥','<a:Party_animated:1407659881955065877>'],
    },
    {
        from: 1000, to: 9999, every: 1000, emojis: ['🚀', '💎', '🏆'],
    },
    {
        from: 10000, to: Infinity, every: 10000, emojis: ['💯', '🌟', '🥇'],
    },
];

class CountingChannel {
    constructor(client, logger) {
        this.client = client;
        this.logger = logger;
        this.currentCount = 0;
        this.lastAuthorId = null;
        this.targetCount = 100;

        this._ready = false;

        this.client.once(Events.ClientReady, async () => {
            await this.auditChannel();
            this._ready = true;
            if (this.logger) this.logger.info(`[CountingChannel] Аудит канала завершён`);
        });

        this.client.on(Events.MessageCreate, async (message) => {
            if (!this._ready) return;
            await this.onMessage(message);
        });

        this.client.on(Events.MessageDelete, async (message) => {
            if (message.channel && message.channel.id === CHANNEL_ID) {
                await this.auditChannel();
                if (this.logger) this.logger.info(`[CountingChannel] Аудит после удаления сообщения`);
            }
        });

        if (this.logger) this.logger.info(`[CountingChannel] Cog инициализирован`);
    }

    getNextTarget(currentTarget) {
        if (currentTarget < 500) return currentTarget + 100;
        if (currentTarget === 500) return 1000;
        if (currentTarget < 9000) return currentTarget + 1000;
        if (currentTarget === 9000) return 10000;
        return currentTarget + 10000;
    }

    getChannelName(target) {
        if (target <= 500) return `🧾┃отсчёт-до-${target}`;
        if (target < 10000) {
            const k = Math.floor(target / 1000);
            return `🧾┃отсчёт-до-${k}к`;
        }
        const k = Math.floor(target / 1000);
        return `🧾┃отсчёт-до-${k}к`;
    }

    async addMilestoneReactions(message, number) {
        for (const range of MILESTONE_RANGES) {
            if (
                number >= range.from &&
                number <= range.to &&
                number % range.every === 0
            ) {
                for (const emoji of range.emojis) {
                    try { await message.react(emoji); } catch (e) {}
                }
            }
        }
    }

    // Исправленная логика поиска лучшей последовательности сообщений
    async auditChannel() {
        try {
            const channel = await this.client.channels.fetch(CHANNEL_ID);
            if (!channel || !channel.isTextBased()) return;

            // fetch all messages
            let fetched = [];
            let lastId;
            while (true) {
                const options = { limit: 100 };
                if (lastId) options.before = lastId;
                const messages = await channel.messages.fetch(options);
                if (messages.size === 0) break;
                fetched = fetched.concat(Array.from(messages.values()));
                lastId = messages.last()?.id;
                if (messages.size < 100) break;
            }
            // Сортируем по возрастанию времени
            const sorted = fetched.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

            // Найдём ЛУЧШУЮ корректную последовательность (максимальную по длине)
            let bestChain = [];
            for (let i = 0; i < sorted.length; i++) {
                if (sorted[i].author.id === this.client.user.id) continue;
                const startContent = sorted[i].content.trim();
                if (!/^\d+$/.test(startContent)) continue;
                let chain = [sorted[i]];
                let expected = parseInt(startContent, 10);
                let lastId = sorted[i].author.id;
                for (let j = i + 1; j < sorted.length; j++) {
                    const msg = sorted[j];
                    if (msg.author.id === this.client.user.id) continue;
                    const content = msg.content.trim();
                    if (!/^\d+$/.test(content)) continue;
                    const number = parseInt(content, 10);
                    if (number === expected + 1 && msg.author.id !== lastId) {
                        chain.push(msg);
                        expected = number;
                        lastId = msg.author.id;
                    } else if (number > expected + 1 || msg.author.id === lastId) {
                        break;
                    }
                }
                if (chain.length > bestChain.length) bestChain = chain;
            }

            // Всё, что не в bestChain — удалить!
            const bestIds = new Set(bestChain.map(m => m.id));
            for (const msg of sorted) {
                if (msg.author.id === this.client.user.id) continue;
                if (!bestIds.has(msg.id)) {
                    try { await msg.delete(); } catch (e) {}
                }
            }

            // Проставить реакции на правильные
            for (const msg of bestChain) {
                if (!msg.reactions.cache.has('✅')) {
                    try { await msg.react('✅'); } catch (e) {}
                }
                await this.addMilestoneReactions(msg, parseInt(msg.content.trim(), 10));
            }

            if (bestChain.length > 0) {
                const lastMsg = bestChain[bestChain.length - 1];
                this.currentCount = parseInt(lastMsg.content.trim(), 10);
                this.lastAuthorId = lastMsg.author.id;
            } else {
                this.currentCount = 0;
                this.lastAuthorId = null;
            }

            // Подобрать targetCount правильно
            this.targetCount = 100;
            while (this.currentCount >= this.targetCount) {
                this.targetCount = this.getNextTarget(this.targetCount);
            }

            await this.updateChannelNameIfNeeded();

        } catch (e) {
            if (this.logger) this.logger.error(`[CountingChannel] Ошибка аудита: ${e}`);
        }
    }

    async updateChannelNameIfNeeded() {
        let updated = false;
        while (this.currentCount >= this.targetCount) {
            this.targetCount = this.getNextTarget(this.targetCount);
            updated = true;
        }
        if (updated) {
            const newName = this.getChannelName(this.targetCount);
            try {
                const channel = await this.client.channels.fetch(CHANNEL_ID);
                await channel.setName(newName);
                if (this.logger) this.logger.info(`Название канала изменено на ${newName}`);
            } catch(e) {
                if (this.logger) this.logger.error(`Ошибка смены имени канала: ${e}`);
            }
        }
    }

    async onMessage(message) {
        if (message.channel.id !== CHANNEL_ID) return;
        if (message.author.id === this.client.user.id) return;

        // Только числа без пробелов и символов
        if (!/^\d+$/.test(message.content.trim())) {
            await message.delete();
            return;
        }

        const number = parseInt(message.content.trim(), 10);

        // Проверяем правильность числа и автора по актуальным данным
        if (number !== this.currentCount + 1) {
            await message.delete();
            return;
        }
        if (this.lastAuthorId === message.author.id) {
            await message.delete();
            return;
        }

        // Валидное сообщение: обновляем состояние, ставим реакции
        this.currentCount = number;
        this.lastAuthorId = message.author.id;
        try {
            await message.react('✅');
            await this.addMilestoneReactions(message, number);
        } catch (e) {
            if (this.logger) this.logger.warn(`[CountingChannel] Не удалось поставить реакцию: ${e}`);
        }
        await this.updateChannelNameIfNeeded();
    }
}

function setup(client, logger) {
    new CountingChannel(client, logger);
}

module.exports = { setup };