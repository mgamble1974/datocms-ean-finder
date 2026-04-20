/**
 * Vercel serverless proxy voor Icecat API
 *
 * Waarom nodig: browsers blokkeren directe verzoeken naar live.icecat.us
 * vanwege CORS-beleid. Deze functie draait server-side en stuurt het
 * verzoek namens de plug-in door naar Icecat.
 *
 * Aanroep: GET /api/icecat?ean=...&username=...&language=NL[&apikey=...]
 */
module.exports = async function handler(req, res) {
  // Alleen GET toestaan
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { ean, username, language = 'NL', apikey } = req.query;

  if (!ean || !username) {
    res.status(400).json({ error: 'Verplichte parameters ontbreken: ean en username zijn vereist.' });
    return;
  }

  const icecatUrl =
    `https://live.icecat.us/api` +
    `?UserName=${encodeURIComponent(username)}` +
    `&Language=${encodeURIComponent(language)}` +
    `&Content=` +
    `&ean=${encodeURIComponent(ean)}`;

  const headers = {
    'Accept': 'application/json',
  };

  if (apikey) {
    const credentials = Buffer.from(`${username}:${apikey}`).toString('base64');
    headers['Authorization'] = `Basic ${credentials}`;
  }

  try {
    const icecatRes = await fetch(icecatUrl, { headers });
    const text = await icecatRes.text();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Content-Type', 'application/json');
    res.status(icecatRes.status).send(text);
  } catch (err) {
    res.status(502).json({
      error: 'Proxy kon Icecat niet bereiken',
      details: err instanceof Error ? err.message : String(err),
    });
  }
};
