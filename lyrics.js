const axios = require('axios');

module.exports = async (req, res) => {
  let trackId = req.query.trackid || null;
  const spotifyUrl = req.query.url || null;
  const format = req.query.format || 'id3';

  // Parse track ID from the Spotify URL if provided
  if (spotifyUrl) {
    try {
      trackId = spotifyUrl.split('/').pop().split('?')[0]; // Extract the last part of the URL (track ID)
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

    if (response.status === 200 && response.data) {
      // Send the raw response from the external API
      return res.status(200).json(response.data);
    } else {
      return res.status(404).json({ status: 'error', message: 'Lyrics not found for the provided track ID' });
    }
  } catch (error) {
    // Log the detailed error for debugging
    console.error('Error fetching lyrics:', error.message);

    return res.status(500).json({
      status: 'error',
      message: `Internal server error: ${error.message}`,
    });
  }
};
