const fetch = require('node-fetch');

const sp_dc = 'AQBfZF-Im6xP-vFXlqnaJVnPbWgJ8ui7MeSvtLnK5qYByRu9Yvpl7Vc-nxBySHBNryQuMfWLqffcuRWJN8E7F1Zk4Hj1NAFkObJ5TbJqkg5wfTx4aPgfpbQN98eeYVvHKPENvEoUVjECHwZMLiWqcikFaiIvJHgPRn-h8RTTSeEM7LrWRyZ34V-VOKPVOLheENAZP4UQ8R3whLKOoldtWW-g6Z3_';

const getToken = async () => {
  const response = await fetch('https://open.spotify.com/get_access_token?reason=transport&productType=web_player', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.0.0 Safari/537.36',
      'App-platform': 'WebPlayer',
      'cookie': `sp_dc=${sp_dc};`,
    },
  });

  const tokenData = await response.json();

  if (!tokenData || tokenData.isAnonymous) {
    throw new Error('Invalid SP_DC token');
  }

  return tokenData.accessToken;
};

const getLyrics = async (track_id) => {
  const token = await getToken();

  const response = await fetch(`https://spclient.wg.spotify.com/color-lyrics/v2/track/${track_id}?format=json&market=from_token`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.0.0 Safari/537.36',
      'authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch lyrics');
  }

  const lyricsData = await response.json();
  return lyricsData;
};

module.exports = async (req, res) => {
  const { track_id } = req.query;

  if (!track_id) {
    return res.status(400).json({ error: 'track_id is required' });
  }

  try {
    const lyrics = await getLyrics(track_id);
    res.status(200).json(lyrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
