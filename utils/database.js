const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Пути к базам данных
const DATA_DIR = path.join(__dirname, '..', 'data');
const SUBSCRIBERS_DB_PATH = path.join(DATA_DIR, 'subscribers.db');
const VIP_DB_PATH = path.join(DATA_DIR, 'vip.db');
const APPEALS_DB_PATH = path.join(DATA_DIR, 'appeals.db');
const PUNISHMENTS_DB_PATH = path.join(DATA_DIR, 'roblox_punishments.db');

// --- ИНИЦИАЛИЗАЦИЯ ВСЕХ БАЗ ДАННЫХ --- //
function initDatabase() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // Инициализация subscribers.db
    const subDb = new sqlite3.Database(SUBSCRIBERS_DB_PATH);
    subDb.serialize(() => {
        subDb.run(`
            CREATE TABLE IF NOT EXISTS subscribers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                discord_id TEXT NOT NULL UNIQUE,
                roblox_username TEXT NOT NULL,
                subscription_days INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP,
                status TEXT,
                booster INTEGER DEFAULT 0,
                exempt_role_id TEXT
            )
        `);
        subDb.run(`
            CREATE TABLE IF NOT EXISTS locked_cars (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                car_name TEXT NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        subDb.run(`
            CREATE TABLE IF NOT EXISTS subscriber_cars (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                discord_id TEXT NOT NULL,
                car_name TEXT NOT NULL,
                UNIQUE(discord_id, car_name)
            )
        `);
    });
    subDb.close();

    // Инициализация vip.db
    const vipDb = new sqlite3.Database(VIP_DB_PATH);
    vipDb.serialize(() => {
        vipDb.run(`
            CREATE TABLE IF NOT EXISTS vip (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                discord_id TEXT NOT NULL UNIQUE,
                roblox_username TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        vipDb.run(`
            CREATE TABLE IF NOT EXISTS locked_vip_cars (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                car_name TEXT NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
    });
    vipDb.close();

    // Инициализация appeals.db
    const appealDb = new sqlite3.Database(APPEALS_DB_PATH);
    appealDb.serialize(() => {
        appealDb.run(`
            CREATE TABLE IF NOT EXISTS appeals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                roblox_username TEXT,
                ban_date TEXT,
                ban_reason TEXT,
                appeal_text TEXT,
                timestamp TEXT,
                appeal_id TEXT
            )
        `);
        appealDb.run(`
            CREATE TABLE IF NOT EXISTS appeal_buttons (
                id TEXT PRIMARY KEY,
                appeal_id TEXT,
                discord_msg_id TEXT,
                user_id TEXT,
                created_at TEXT
            )
        `);
        // Новая таблица для блокировок апелляций (appeals.db) — если нужно, но не используется для блокировки!
        appealDb.run(`
            CREATE TABLE IF NOT EXISTS appeal_blocked (
                discordId TEXT PRIMARY KEY
            )
        `);
    });
    appealDb.close();

    // Инициализация roblox_punishments.db (именно тут работает блокировка апелляций!)
    const punishDb = new sqlite3.Database(PUNISHMENTS_DB_PATH);
    punishDb.serialize(() => {
        punishDb.run(`
            CREATE TABLE IF NOT EXISTS appeal_blocked (
                discordId TEXT PRIMARY KEY
            )
        `);
    });
    punishDb.close();
}

// --- РАБОТА С subscribers.db --- //
function getSubscribersDb() {
    return new sqlite3.Database(SUBSCRIBERS_DB_PATH);
}

// --- РАБОТА С vip.db --- //
function getVipDb() {
    return new sqlite3.Database(VIP_DB_PATH);
}

// --- РАБОТА С appeals.db --- //
function getAppealsDb() {
    return new sqlite3.Database(APPEALS_DB_PATH);
}

// --- РАБОТА С roblox_punishments.db --- //
function getPunishmentsDb() {
    return new sqlite3.Database(PUNISHMENTS_DB_PATH);
}

// Старый стиль: save_appeal(user_id, roblox_username, ban_date, ban_reason, appeal_text, timestamp)
function save_appeal(user_id, roblox_username, ban_date, ban_reason, appeal_text, timestamp) {
    const db = getAppealsDb();
    db.run(`
        INSERT INTO appeals (user_id, roblox_username, ban_date, ban_reason, appeal_text, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
    `, [user_id, roblox_username, ban_date, ban_reason, appeal_text, timestamp]);
    db.close();
}

// Новый стиль: saveAppeal({ user_id, roblox_username, ban_date, ban_reason, appeal_text, timestamp, appeal_id })
function saveAppeal(appeal) {
    const db = getAppealsDb();
    db.run(`
        INSERT INTO appeals (user_id, roblox_username, ban_date, ban_reason, appeal_text, timestamp, appeal_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
        appeal.user_id,
        appeal.roblox_username,
        appeal.ban_date,
        appeal.ban_reason,
        appeal.appeal_text,
        appeal.timestamp,
        appeal.appeal_id || null
    ]);
    db.close();
}

// --- КНОПКИ АПЕЛЛЯЦИЙ --- //
function saveAppealButton({ id, appeal_id, discord_msg_id, user_id }) {
    console.log('[DB] saveAppealButton:', id);
    const db = getAppealsDb();
    db.run(
        'INSERT OR IGNORE INTO appeal_buttons (id, appeal_id, discord_msg_id, user_id, created_at) VALUES (?, ?, ?, ?, ?)',
        [id, appeal_id, discord_msg_id, user_id, new Date().toISOString()]
    );
    db.close();
}

function removeAppealButton(id) {
    console.log('[DB] removeAppealButton:', id);
    const db = getAppealsDb();
    db.run('DELETE FROM appeal_buttons WHERE id = ?', [id]);
    db.close();
}

function getAppealButton(id, cb) {
    console.log('[DB] getAppealButton:', id);
    const db = getAppealsDb();
    db.get('SELECT * FROM appeal_buttons WHERE id = ?', [id], (err, row) => {
        console.log('[DB] got row:', row);
        cb(err, row);
        db.close();
    });
}

/**
 * Проверка: есть ли машина у пользователя в подписке или он исключение
 * @param {string} discordId
 * @param {string} carName
 * @param {function} callback(err, result: boolean)
 */
function hasCarOrExemption(discordId, carName, callback) {
    const db = getSubscribersDb();
    db.get(
        `SELECT * FROM subscribers WHERE discord_id = ?`,
        [discordId],
        (err, subscriber) => {
            if (err) {
                db.close();
                return callback(err, false);
            }
            if (subscriber && subscriber.exempt_role_id) {
                db.close();
                return callback(null, true);
            }
            db.get(
                `SELECT * FROM subscriber_cars WHERE discord_id = ? AND car_name = ?`,
                [discordId, carName],
                (err2, carRow) => {
                    db.close();
                    if (err2) return callback(err2, false);
                    if (carRow) return callback(null, true);
                    return callback(null, false);
                }
            );
        }
    );
}

// --- Новое: работа с блокировкой апелляций в БД НАказаний (roblox_punishments.db) ---
function blockAppeal(discordId, cb) {
    const db = getPunishmentsDb();
    db.run('INSERT OR IGNORE INTO appeal_blocked (discordId) VALUES (?)', [discordId], function (err) {
        if (cb) cb(err);
        db.close();
    });
}

function unblockAppeal(discordId, cb) {
    const db = getPunishmentsDb();
    db.run('DELETE FROM appeal_blocked WHERE discordId = ?', [discordId], function (err) {
        if (cb) cb(err);
        db.close();
    });
}

function isAppealBlocked(discordId, cb) {
    const db = getPunishmentsDb();
    db.get('SELECT 1 FROM appeal_blocked WHERE discordId = ?', [discordId], (err, row) => {
        cb(!!row, err);
        db.close();
    });
}

module.exports = {
    // Общая инициализация
    initDatabase,
    getSubscribersDb,
    getVipDb,
    getAppealsDb,
    getPunishmentsDb,
    save_appeal,
    saveAppeal,

    // Кнопки апелляций
    saveAppealButton,
    removeAppealButton,
    getAppealButton,

    // Проверка машины/исключения
    hasCarOrExemption,

    // Блокировка апелляций (используется roblox_punishments.db!)
    blockAppeal,
    unblockAppeal,
    isAppealBlocked
};
