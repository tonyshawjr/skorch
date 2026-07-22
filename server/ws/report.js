const crypto = require('crypto');

const DEFAULT_URL = 'https://play.skorchthegame.com/server/php/api/report-match.php';
const FALLBACK_SECRET = 'a86a4a7cccfd5b6263ff0e276ea9d7a1fc2008e4fbcd35c562ef777fcfeb00fb';

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function reportMatch({ p1Ticket, p2Ticket, winnerSlot, nonce, apiUrl, secret }) {
    apiUrl = apiUrl || process.env.MATCH_REPORT_URL || DEFAULT_URL;
    secret = secret || process.env.WS_SECRET || FALLBACK_SECRET;

    const payload = {
        p1_ticket: p1Ticket || null,
        p2_ticket: p2Ticket || null,
        winner: winnerSlot,
        nonce,
        ts: Math.floor(Date.now() / 1000)
    };
    const body = JSON.stringify(payload);
    const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');

    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Skorch-Sign': sig },
                body
            });
            const text = await res.text();
            if (res.status >= 500 && attempt === 0) {
                await sleep(1000);
                continue;
            }
            return { status: res.status, body: text };
        } catch (e) {
            if (attempt === 0) {
                await sleep(1000);
                continue;
            }
            throw e;
        }
    }
}

module.exports = { reportMatch };
