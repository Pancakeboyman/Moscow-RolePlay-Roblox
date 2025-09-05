require('dotenv').config();

module.exports = {
    BOTTOKEN: process.env.BOTTOKEN,
    ERLC_API: process.env.ERLC_API,
    GUILD_ID: process.env.GUILD_ID,
    ADMIN_ROLES: process.env.ADMIN_ROLES ? process.env.ADMIN_ROLES.split(',') : [],
    SUBSCRIBER_ROLE: process.env.SUBSCRIBER_ROLE,
    LOG_CHANNEL: process.env.LOG_CHANNEL,
    LOG_CHANNEL_CARS: process.env.LOG_CHANNEL_CARS,
    BLOXLINK_API_KEY: process.env.BLOXLINK_API_KEY // <-- теперь доступно тут!
};