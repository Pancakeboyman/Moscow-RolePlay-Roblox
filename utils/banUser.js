const fetch = require('node-fetch');
const { ERLC_API } = require('../apikeys');

async function banUser(userId) {
    try {
        const res = await fetch('https://api.policeroleplay.community/v1/server/command', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'server-key': ERLC_API
            },
            body: JSON.stringify({ command: `:ban ${userId}` })
        });
        if (!res.ok) console.error('Ошибка API ERLC:', await res.text());
    } catch (e) { console.error('Ошибка при запросе ERLC:', e); }
}

module.exports = { banUser };