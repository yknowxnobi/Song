const axios = require('axios');

const client_id = '414df719f85e45c9bd0ee5e83d08b501';
const client_secret = 'fa7e159a0b904b8b8505bf59b6458d3a';

// Function to get Spotify access token
const getAccessToken = async () => {
  const tokenUrl = 'https://accounts.spotify.com/api/token';
  const authOptions = {
    headers: {
      'Authorization': 'Basic ' + Buffer.from(client_id + ':' + client_secret).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    data: 'grant_type=client_credentials'
  };

  try {
    const response = await axios.post(tokenUrl, authOptions.data, { headers: authOptions.headers });
    return response.data.access_token;
  } catch (error) {
    console.error('Failed to get access token', error.response ? error.response.data : error.message);
    throw error;
  }
};

// Function to fetch track details using the Spotify track URL
const getTrackDetails = async (accessToken, trackUrl) => {
  const trackId = trackUrl.split('/').pop().split('?')[0]; // Extract track ID from Spotify URL
  const trackDetailsUrl = `https://api.spotify.com/v1/tracks/${trackId}`;

  try {
    const response = await axios.get(trackDetailsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const trackInfo = response.data;
    return {
      trackName: trackInfo.name,
      artist: trackInfo.artists.map(artist => artist.name).join(', '),
      album: trackInfo.album.name,
      releaseDate: trackInfo.album.release_date,
      durationMs: trackInfo.duration_ms,
      previewUrl: trackInfo.preview_url,
      spotifyUrl: trackInfo.external_urls.spotify,
      imageUrl: trackInfo.album.images[0].url
    };
  } catch (error) {
    console.error('Failed to fetch track details', error.response ? error.response.data : error.message);
    throw error;
  }
};

// Main function to handle the request for track details
module.exports = async (req, res) => {
  const spotifyUrl = req.query.url; // Track URL

  try {
    if (spotifyUrl) {
      // If a Spotify track URL is provided
      const accessToken = await getAccessToken();
      const trackDetails = await getTrackDetails(accessToken, spotifyUrl);

      return res.status(200).json({
        track: trackDetails, // Track details
        developerCredit: 'https://t.me/Teleservices_Api' // Developer credit URL
      });
    } else {
      res.status(400).json({ error: 'Track URL is required' });
    }
  } catch (error) {
    console.error('Error occurred', error.response ? error.response.data : error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
