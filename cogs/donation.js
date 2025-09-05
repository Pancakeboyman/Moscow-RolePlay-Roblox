const { Events } = require('discord.js');
const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '..', 'data', 'reminder_state.json');
const CHANNEL_ID = '1331332539716997130'; // 🔁 ВСТАВЬ СВОЙ ID КАНАЛА
const REMINDER_INTERVAL = 10 * 60 * 1000; // Проверять каждые 10 минут
const COOLDOWN = 4 * 60 * 60 * 1000; // 4 часа

function loadLastTime() {
    if (fs.existsSync(STATE_FILE)) {
        const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
        if (data.last_time) return new Date(data.last_time);
    }
    return null;
}

function saveLastTime(time) {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ last_time: time.toISOString() }), 'utf-8');
}

module.exports = {
    name: 'donation_reminder',
    once: false,
    async setup(client) {
        async function sendReminderIfNeeded() {
            const now = new Date();
            const lastTime = loadLastTime();

            // Если файла нет или поле пустое — это самый первый запуск, сразу отправляем
            if (!lastTime) {
                const channel = client.channels.cache.get(CHANNEL_ID);
                if (channel) {
                    await channel.send(
                        "**Спасибо, что вы с нами в Moscow RolePlay!**\n\n" +
                        "⮮ **__Полезные ссылки__** ⮯\n" +
                        "**[Зайти в игру](https://policeroleplay.community/join/MoscowRus)** | " +
                        "**[Подать заявку в команду сервера](https://discord.com/channels/1331331077553262765/1337508581049896981)** | " +
                        "**[Получить помощь](https://discord.com/channels/1331331077553262765/1338585898907861012)**\n\n" +
                        "💎 **Поддержите проект** 💎\n" +
                        "- Посетите [наш магазин](https://discord.com/channels/1331331077553262765/1375539483377799250), получите бонусы и нашу благодарность ❤️"
                    );
                    saveLastTime(now);
                }
                return;
            }

            // Если прошло более 4 часов — отправляем
            if (now - lastTime >= COOLDOWN) {
                const channel = client.channels.cache.get(CHANNEL_ID);
                if (channel) {
                    await channel.send(
                        "**Спасибо, что вы с нами в Moscow RolePlay!**\n\n" +
                        "⮮ **__Полезные ссылки__** ⮯\n" +
                        "**[Зайти в игру](https://policeroleplay.community/join/MoscowRus)** | " +
                        "**[Подать заявку в команду сервера](https://discord.com/channels/1331331077553262765/1337508581049896981)** | " +
                        "**[Получить помощь](https://discord.com/channels/1331331077553262765/1338585898907861012)**\n\n" +
                        "💎 **Поддержите проект** 💎\n" +
                        "- Посетите [наш магазин](https://discord.com/channels/1331331077553262765/1375539483377799250), получите бонусы и нашу благодарность ❤️"
                    );
                    saveLastTime(now);
                }
            }
        }

        client.on(Events.ClientReady, async () => {
            await sendReminderIfNeeded();
            setInterval(sendReminderIfNeeded, REMINDER_INTERVAL);
        });
    }
};