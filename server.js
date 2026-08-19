const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;

app.get('/proxy/streaks/:channel', async (req, res) => {
  try {
    const channel = req.params.channel;
    const limit = req.query.limit || '50';
    const url = `https://lumosbot.app/api/twitch/streaks/${encodeURIComponent(channel)}?limit=${encodeURIComponent(limit)}`;

    const response = await fetch(url, { timeout: 10000 });

    if (!response.ok) {
      const text = await response.text();
      try {
        return res.status(response.status).json(JSON.parse(text));
      } catch (error) {
        return res.status(response.status).type('text').send(text);
      }
    }

    const json = await response.json();
    res.json(json);
  } catch (err) {
    res.status(502).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => console.log(`Proxy listening on http://localhost:${PORT}`));