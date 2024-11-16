const axios = require('axios');

module.exports = async (req, res) => {
  let trackId = req.query.trackid || null;
  const spotifyUrl = req.query.url || null;
  const format = req.query.format || 'id3';

  // Parse track ID from the URL if provided
  if (spotifyUrl) {
    try {
      const urlParts = spotifyUrl.split('/');
      const possibleId = urlParts[urlParts.length - 1].split('?')[0];
      trackId = possibleId || trackId;
    } catch (error) {
      return res.status(400).json({ status: 'error', message: 'Invalid Spotify URL format' });
    }
  }

  if (!trackId) {
    return res.status(400).json({ status: 'error', message: 'trackid or url is required' });
  }

  try {
    const apiUrl = `https://spotify-lyrics-api-pi.vercel.app?trackid=${trackId}&format=${format}`;
    const response = await axios.get(apiUrl);

    // Directly send the raw response from the external API
    return res.status(200).json(response.data);
  } catch (error) {
    return res.status(500).json({ status: 'error', message: 'Internal server error'+error });
  }
};
