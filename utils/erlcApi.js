const fetch = require('node-fetch');
const { ERLC_API } = require('../apikeys');

async function getVehicles() {
  const url = "https://api.policeroleplay.community/v1/server/vehicles";
  const headers = {
    'server-key': ERLC_API,
    'Accept': '*/*'
  };
  const resp = await fetch(url, { headers });
  if (!resp.ok) throw new Error(`ERLC API error: ${resp.status} ${await resp.text()}`);
  return await resp.json();
}

async function sendCommand(command) {
  const url = "https://api.policeroleplay.community/v1/server/command";
  const headers = {
    'server-key': ERLC_API,
    'Content-Type': 'application/json'
  };
  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ command })
  });
  return resp;
}

module.exports = { getVehicles, sendCommand };