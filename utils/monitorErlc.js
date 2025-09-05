const { EmbedBuilder } = require('discord.js');
const sqlite3 = require('sqlite3');
const fetch = require('node-fetch');
const path = require('path');
const { ERLC_API, LOG_CHANNEL_CARS } = require('../apikeys');
const {
    STATUS1_ROLE_ID,
    STATUS2_ROLE_ID,
    STATUS3_ROLE_ID,
    BOOSTER_ROLE_ID,
    VIP_ROLE_ID,
    STATUS_LABELS
} = require('../constants');
const {
    STATUS1_CARS,
    STATUS2_CARS,
    STATUS3_CARS,
    BOOSTER_CARS,
    VIP_CARS
} = require('../cogs/autoLockCars');

// DB paths
const SUBSCRIBERS_DB_PATH = path.join(__dirname, '../data/subscribers.db');
const VIP_DB_PATH = path.join(__dirname, '../data/vip.db');

const activeViolations = new Map();
const violationPingHistory = new Map();
const violationQueue = [];
let violationQueueBusy = false;

// --- DB utils ---
function getSubscriberRowByRoblox(username) {
    return new Promise((resolve) => {
        const db = new sqlite3.Database(SUBSCRIBERS_DB_PATH);
        db.get("SELECT * FROM subscribers WHERE LOWER(roblox_username) = ?", [username.toLowerCase()], (err, row) => {
            db.close();
            resolve(row || null);
        });
    });
}

function getLockedCars() {
    return new Promise((resolve) => {
        const db = new sqlite3.Database(SUBSCRIBERS_DB_PATH);
        db.all("SELECT car_name FROM locked_cars", (err, rows) => {
            db.close();
            if (err) return resolve([]);
            resolve(rows.map(row => row.car_name.toLowerCase()));
        });
    });
}

// VIP DB utils
function getVipRowByRoblox(username) {
    return new Promise((resolve) => {
        const db = new sqlite3.Database(VIP_DB_PATH);
        db.get("SELECT * FROM vip WHERE LOWER(roblox_username) = ?", [username.toLowerCase()], (err, row) => {
            db.close();
            resolve(row || null);
        });
    });
}

function getLockedVipCars() {
    return new Promise((resolve) => {
        const db = new sqlite3.Database(VIP_DB_PATH);
        db.all("SELECT car_name FROM locked_vip_cars", (err, rows) => {
            db.close();
            if (err) return resolve([]);
            resolve(rows.map(row => row.car_name.toLowerCase()));
        });
    });
}

async function fetchVehicles() {
    try {
        const res = await fetch("https://api.policeroleplay.community/v1/server/vehicles", {
            headers: {
                'server-key': ERLC_API,
                'Accept': '*/*'
            }
        });
        if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
        return res.json();
    } catch (err) {
        return [];
    }
}

async function fetchPlayers() {
    try {
        const res = await fetch("https://api.policeroleplay.community/v1/server/players", {
            headers: {
                'server-key': ERLC_API,
                'Accept': '*/*'
            }
        });
        if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
        return res.json();
    } catch (err) {
        return [];
    }
}

async function getPlayersTeamMap() {
    const players = await fetchPlayers();
    const map = {};
    for (const playerObj of players) {
        if (!playerObj?.Player) continue;
        const [username] = playerObj.Player.split(':');
        map[username.toLowerCase()] = {
            team: playerObj.Team || "",
            ...playerObj,
            originalUsername: username
        };
    }
    return map;
}

async function getMemberRoles(guild, discordId) {
    try {
        const member = await guild.members.fetch({ user: discordId, force: true });
        return member.roles.cache.map(role => role.id);
    } catch {
        return [];
    }
}

function getStatusLevelUniversal(roles, subscriber) {
    if (roles.includes(STATUS3_ROLE_ID)) return 3;
    if (roles.includes(STATUS2_ROLE_ID)) return 2;
    if (roles.includes(STATUS1_ROLE_ID)) return 1;
    if (subscriber && (subscriber.status === 1 || subscriber.status === 2 || subscriber.status === 3)) {
        return Number(subscriber.status);
    }
    if (subscriber && ["1", "2", "3"].includes(subscriber.status)) {
        return Number(subscriber.status);
    }
    return 0;
}
function getBoosterUniversal(roles, subscriber) {
    if (roles.includes(BOOSTER_ROLE_ID)) return true;
    if (subscriber && (subscriber.booster === 1 || subscriber.booster === "1")) return true;
    return false;
}
function getVipUniversal(roles, vipRow) {
    if (roles.includes(VIP_ROLE_ID)) return true;
    if (vipRow) return true;
    return false;
}

// --- LOAD command with retry-after support ---
async function loadPlayer(username) {
    let retryCount = 0;
    while (retryCount < 5) {
        try {
            const res = await fetch("https://api.policeroleplay.community/v1/server/command", {
                method: 'POST',
                headers: {
                    'server-key': ERLC_API,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ command: `:load ${username}` })
            });
            const text = await res.text();
            console.log(`[DEBUG] :load command sent for ${username}, status: ${res.status}, body: ${text}`);

            if (res.status === 200) return JSON.parse(text);

            if (res.status === 429) {
                let retryAfter = 2;
                try {
                    const errorData = JSON.parse(text);
                    retryAfter = errorData.retry_after || retryAfter;
                } catch {}
                await new Promise(res => setTimeout(res, (retryAfter + 0.5) * 1000));
                retryCount++;
                continue;
            }
            throw new Error(`Load error: status=${res.status}, body=${text}`);
        } catch (err) {
            if (retryCount >= 4) {
                console.error('loadPlayer error:', err);
                return null;
            }
            await new Promise(res => setTimeout(res, 2000));
            retryCount++;
        }
    }
    return null;
}

async function sendPrivateMessage(username, vehicle, pmText) {
    const command = `:privatemessage ${username} ${pmText}`;
    let retryCount = 0;
    while (retryCount < 3) {
        try {
            const res = await fetch("https://api.policeroleplay.community/v1/server/command", {
                method: 'POST',
                headers: {
                    'server-key': ERLC_API,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ command })
            });
            if (res.status === 200) return await res.json();
            if (res.status === 429) {
                let retryAfter = 2;
                try {
                    const errorData = await res.json();
                    retryAfter = errorData.retry_after || retryAfter;
                } catch {}
                await new Promise(res => setTimeout(res, (retryAfter + 0.5) * 1000));
                retryCount++;
                continue;
            }
            return null;
        } catch (err) {
            return null;
        }
    }
    return null;
}

async function isStillInVehicle(owner, vehicle) {
    const vehicles = await fetchVehicles();
    return vehicles.some(v => {
        const vOwner = (v.owner || v.Owner || v.player || v.Player || v.username || v.Username || '');
        const vName = (v.name || v.Name || v.model || v.Model || v.vehicle || v.Vehicle || '').toLowerCase();
        return vOwner === owner && vName === vehicle.toLowerCase();
    });
}

function getViolationText(vehicle, statusLevel, hasBooster, isBoosterCar, hasVip, isVipCar) {
    if (isVipCar) {
        if (!hasVip && statusLevel === 0) return `«${vehicle}» доступна только для VIP сервера или подписчиков! Оформите VIP или подписку для доступа.`;
        return null;
    }
    if (isBoosterCar) {
        if (!hasBooster) return `«${vehicle}» доступна только для бустеров сервера! Станьте бустером для доступа.`;
    }
    // Доступность по статусу
    if (statusLevel === 3 && [...STATUS1_CARS, ...STATUS2_CARS, ...STATUS3_CARS].map(x => x.toLowerCase()).includes(vehicle.toLowerCase())) {
        return null; // нет нарушения
    }
    if (statusLevel === 2 && [...STATUS1_CARS, ...STATUS2_CARS].map(x => x.toLowerCase()).includes(vehicle.toLowerCase())) {
        return null;
    }
    if (statusLevel === 1 && [...STATUS1_CARS].map(x => x.toLowerCase()).includes(vehicle.toLowerCase())) {
        return null;
    }
    if (STATUS3_CARS.map(x => x.toLowerCase()).includes(vehicle.toLowerCase())) {
        return `«${vehicle}» доступна только по подписке более высокого уровня.`;
    }
    return `«${vehicle}» предназначена только для подписчиков сервера! Оформите подписку для доступа к этой машине.`;
}

// --- Violation logging ---
async function logViolationToChannel(client, username, vehicle, statusLevel, hasBooster, hasVip, pingType = "normal", isVipCar = false) {
    const isBoosterCar = BOOSTER_CARS.map(x => x.toLowerCase()).includes(vehicle.toLowerCase());
    const channel = client.channels.cache.get(LOG_CHANNEL_CARS);
    if (!channel) return;
    const reason = getViolationText(vehicle, statusLevel, hasBooster, isBoosterCar, hasVip, isVipCar);
    if (!reason) return; // не логировать если нарушения нет!
    const embed = new EmbedBuilder()
        .setTitle("🚨 Обнаружено нарушение!")
        .addFields([
            { name: "👤 Игрок в Roblox", value: `\`${username}\``, inline: true },
            { name: "🚗 Транспорт", value: `\`${vehicle}\``, inline: true },
            { name: "⚠️ Причина", value: reason, inline: false }
        ])
        .setColor(isVipCar ? 0xeec644 : 0xcc2641)
        .setTimestamp()
        .setFooter({ text: "Moscow RolePlay Roblox | Система мониторинга" });
    const roleMention = `<@&1331391035976323165>, <@&1380181692681289758>`;
    if (pingType === "ping") {
        await channel.send({ content: roleMention, embeds: [embed] });
    } else {
        await channel.send({ embeds: [embed] });
    }
}

// --- Violation sequential processor ---
async function processViolationQueue(client) {
    if (violationQueueBusy) return;
    violationQueueBusy = true;

    while (violationQueue.length > 0) {
        const info = violationQueue.shift();
        // Проверяем, всё ещё ли игрок в этой машине
        const stillInVehicle = await isStillInVehicle(info.owner, info.vehicle);
        if (!stillInVehicle) {
            activeViolations.delete(`${info.owner}|${info.vehicle.toLowerCase()}`);
            continue;
        }
        if (info.processed) continue;

        let pingType = "normal";
        let history = violationPingHistory.get(info.owner) || { count: 0, lastPing: 0 };
        let now = Date.now();

        if (history.count === 0) {
            pingType = "ping";
            history = { count: 1, lastPing: now };
        } else if (history.count % 3 === 0 && now - history.lastPing > 120000) {
            pingType = "ping";
            history.count++;
            history.lastPing = now;
        } else {
            pingType = "normal";
            history.count++;
        }
        violationPingHistory.set(info.owner, history);

        // --- LOAD вместо kick ---
        await loadPlayer(info.owner);
        await logViolationToChannel(
            client,
            info.owner,
            info.vehicle,
            info.statusLevel,
            info.hasBooster,
            info.hasVip,
            pingType,
            info.isVipCar
        );

        setTimeout(async () => {
            const isBoosterCar = BOOSTER_CARS.map(x => x.toLowerCase()).includes(info.vehicle.toLowerCase());
            const isVipCar = VIP_CARS.map(x => x.toLowerCase()).includes(info.vehicle.toLowerCase());
            const pmText = getViolationText(info.vehicle, info.statusLevel, info.hasBooster, isBoosterCar, info.hasVip, isVipCar);
            if (pmText) await sendPrivateMessage(info.owner, info.vehicle, pmText);
            activeViolations.delete(`${info.owner}|${info.vehicle.toLowerCase()}`);
        }, 7000);

        info.processed = true;

        await new Promise(res => setTimeout(res, 500));
    }

    violationQueueBusy = false;
}

// --- Main process ---
let monitorStarted = false;

module.exports = async function monitorErlc(client) {
    if (!ERLC_API || ERLC_API === "YOUR_ERLC_API_KEY_HERE") {
        return { violations: 0, apiResults: ["ERLC API ключ не настроен!"] };
    }

    const guild = client.guilds.cache.first();
    const vehicles = await fetchVehicles();
    const lockedCars = await getLockedCars();
    const lockedVipCars = await getLockedVipCars();

    if (!lockedCars.length && !lockedVipCars.length) {
        return { violations: 0, apiResults: ["Нет заблокированных машин для мониторинга!"] };
    }

    const playersTeamMap = await getPlayersTeamMap();

    let violations = 0;
    for (const vehicle of vehicles) {
        const owner = (
            vehicle.owner || vehicle.Owner ||
            vehicle.player || vehicle.Player ||
            vehicle.username || vehicle.Username || ''
        );
        const ownerLower = owner.toLowerCase();

        const vehicle_name = (
            vehicle.name || vehicle.Name ||
            vehicle.model || vehicle.Model ||
            vehicle.vehicle || vehicle.Vehicle || ''
        );

        if (!owner || ['none', 'null', 'nil', ''].includes(ownerLower)) continue;
        if (!vehicle_name) continue;

        const playerTeamInfo = playersTeamMap[ownerLower];
        if (!playerTeamInfo) continue;
        const teamName = (playerTeamInfo.team || "").toLowerCase();
        if (
            teamName !== "civilian" &&
            teamName !== "гражданские" &&
            teamName !== "citizen" &&
            teamName !== "гражданский"
        ) continue;

        const vehicle_to_check = vehicle_name.toLowerCase();
        const key = `${owner}|${vehicle_to_check}`;

        // --- VIP машины: разрешено если есть VIP или подписка на эту машину ---
        if (lockedVipCars.some(lc => lc === vehicle_to_check)) {
            // Получаем VIP
            const vipRow = await getVipRowByRoblox(owner);
            let discordId = vipRow ? vipRow.discord_id : null;
            let roles = [];
            if (discordId && guild) {
                try {
                    const member = await guild.members.fetch({ user: discordId, force: true });
                    roles = member.roles.cache.map(role => role.id);
                } catch {}
            }
            const hasVip = getVipUniversal(roles, vipRow);
            const isVipCar = true;

            // Получаем подписку
            const subscriber = await getSubscriberRowByRoblox(owner);
            let statusLevel = 0;
            let hasBooster = false;
            let exempted = false;
            let discordSubId = subscriber ? subscriber.discord_id : null;
            let subRoles = [];
            if (subscriber && discordSubId && guild) {
                try {
                    const member = await guild.members.fetch({ user: discordSubId, force: true });
                    subRoles = member.roles.cache.map(role => role.id);
                    // --- PATCH: обработка исключения ---
                    if (subscriber.exempt_role_id && member.roles.cache.has(subscriber.exempt_role_id)) {
                        exempted = true;
                    }
                } catch {}
            }
            statusLevel = getStatusLevelUniversal(subRoles, subscriber);
            hasBooster = getBoosterUniversal(subRoles, subscriber);

            // --- PATCH: пропуск нарушения для exempted ---
            if (exempted) {
                if (activeViolations.has(key)) activeViolations.delete(key);
                continue;
            }

            // Считаем машину "разрешённой" если есть VIP или она разрешена по статусу
            let allowedCarList = [];
            if (statusLevel === 3) allowedCarList = [
                ...STATUS1_CARS, ...STATUS2_CARS, ...STATUS3_CARS
            ].map(x => x.toLowerCase());
            else if (statusLevel === 2) allowedCarList = [
                ...STATUS1_CARS, ...STATUS2_CARS
            ].map(x => x.toLowerCase());
            else if (statusLevel === 1) allowedCarList = [
                ...STATUS1_CARS
            ].map(x => x.toLowerCase());

            if (hasVip || allowedCarList.includes(vehicle_to_check)) {
                if (activeViolations.has(key)) activeViolations.delete(key);
                continue;
            }

            // Нарушение, если нет ни VIP, ни подписки на эту машину
            violations++;
            if (!activeViolations.has(key)) {
                const info = {
                    owner,
                    vehicle: vehicle_name,
                    statusLevel,
                    hasBooster,
                    hasVip,
                    processed: false,
                    isVipCar
                };
                activeViolations.set(key, info);
                violationQueue.push(info);
            }
            continue;
        }

        // Normal + Booster check
        if (lockedCars.some(
            lc => lc === vehicle_to_check || vehicle_to_check.includes(lc) || lc.includes(vehicle_to_check)
        )) {
            // --- Если машина есть в VIP_CARS и у игрока есть VIP, пропускаем проверку подписки ---
            if (VIP_CARS.map(x => x.toLowerCase()).includes(vehicle_to_check)) {
                const vipRow = await getVipRowByRoblox(owner);
                let discordId = vipRow ? vipRow.discord_id : null;
                let roles = [];
                if (discordId && guild) {
                    try {
                        const member = await guild.members.fetch({ user: discordId, force: true });
                        roles = member.roles.cache.map(role => role.id);
                    } catch {}
                }
                const hasVip = getVipUniversal(roles, vipRow);
                if (hasVip) {
                    if (activeViolations.has(key)) {
                        activeViolations.delete(key);
                    }
                    continue;
                }
            }
            // --- Логика проверки подписок ---
            const subscriber = await getSubscriberRowByRoblox(owner);
            let statusLevel = 0;
            let hasBooster = false;
            let exempted = false;
            let discordId = subscriber ? subscriber.discord_id : null;
            let roles = [];
            const isBoosterCar = BOOSTER_CARS.map(x => x.toLowerCase()).includes(vehicle_name.toLowerCase());

            if (subscriber) {
                if (subscriber.exempt_role_id && discordId && guild) {
                    try {
                        const member = await guild.members.fetch({ user: discordId, force: true });
                        if (member.roles.cache.has(subscriber.exempt_role_id)) {
                            exempted = true;
                        }
                    } catch {}
                } else if (discordId && guild) {
                    roles = await getMemberRoles(guild, discordId);
                }
            }

            let userCarList = [];
            statusLevel = getStatusLevelUniversal(roles, subscriber);
            hasBooster = getBoosterUniversal(roles, subscriber);

            if (statusLevel === 3) userCarList = [
                ...STATUS1_CARS, ...STATUS2_CARS, ...STATUS3_CARS
            ].map(x => x.toLowerCase());
            else if (statusLevel === 2) userCarList = [
                ...STATUS1_CARS, ...STATUS2_CARS
            ].map(x => x.toLowerCase());
            else if (statusLevel === 1) userCarList = [
                ...STATUS1_CARS
            ].map(x => x.toLowerCase());

            let violation = false;
            if (!exempted) {
                if (isBoosterCar) {
                    violation = !hasBooster;
                } else if (userCarList.length === 0 || !userCarList.includes(vehicle_name.toLowerCase())) {
                    violation = true;
                }
            }

            if (violation) {
                violations++;
                if (!activeViolations.has(key)) {
                    const info = {
                        owner,
                        vehicle: vehicle_name,
                        statusLevel,
                        hasBooster,
                        hasVip: false,
                        processed: false,
                        isVipCar: false
                    };
                    activeViolations.set(key, info);
                    violationQueue.push(info); // добавляем в очередь
                }
            } else {
                if (activeViolations.has(key)) {
                    activeViolations.delete(key);
                }
            }
        } else {
            if (activeViolations.has(key)) {
                activeViolations.delete(key);
            }
        }
    }

    if (!monitorStarted) {
        monitorStarted = true;
        setInterval(() => processViolationQueue(client), 15000);
    }

    return { violations, apiResults: [] };
};