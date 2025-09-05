const fetch = require('node-fetch');
const { BLOXLINK_API_KEY } = require('./apikyes'); // <-- Импортируешь ключ!

/**
 * Получить Roblox ID по Discord ID через Bloxlink API (или свою базу, если реализовано)
 * @param {string|number} discordId
 * @returns {Promise<string|null>}
 */
async function getRobloxId(discordId, apiKey = BLOXLINK_API_KEY) {
    try {
        const res = await fetch(`https://api.blox.link/v4/public/discord-to-roblox/${discordId}`, {
            method: 'GET',
            headers: { 'Authorization': apiKey }
        });
        const data = await res.json();
        if (data && data.robloxID) return data.robloxID;
    } catch (e) {
        console.error('[bloxlink] Ошибка запроса:', e);
    }
    return null;
}

/**
 * Получить Discord ID по Roblox ID через Bloxlink API (или свою базу, если реализовано)
 * @param {string|number} robloxId
 * @returns {Promise<string|null>}
 */
async function getDiscordId(robloxId, apiKey = BLOXLINK_API_KEY) {
    try {
        const res = await fetch(`https://api.blox.link/v4/public/roblox-to-discord/${robloxId}`, {
            method: 'GET',
            headers: { 'Authorization': apiKey }
        });
        const data = await res.json();
        if (data && data.discordID) return data.discordID;
    } catch (e) {
        console.error('[bloxlink] Ошибка запроса:', e);
    }
    return null;
}

/**
 * Получить подробную информацию о Roblox пользователе
 * @param {string|number} robloxId
 * @returns {Promise<object|null>}
 */
async function getRobloxInfo(robloxId) {
    try {
        const res = await fetch(`https://users.roblox.com/v1/users/${robloxId}`);
        if (res.ok) {
            return await res.json();
        }
    } catch (e) {
        console.error('[bloxlink] Ошибка получения Roblox info:', e);
    }
    return null;
}

module.exports = {
    getRobloxId,
    getDiscordId,
    getRobloxInfo,
};