const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Spotify credentials (replace with your actual client ID and secret)
const client_id = '414df719f85e45c9bd0ee5e83d08b501';
const client_secret = 'fa7e159a0b904b8b8505bf59b6458d3a';

// Step 1: Function to get Spotify access token using client ID and secret
const getAccessToken = async () => {
  try {
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'client_credentials',
      }),
      {
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${client_id}:${client_secret}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    return response.data.access_token;
  } catch (error) {
    throw new Error('Error fetching Spotify access token');
  }
};

// Step 2: Function to get track metadata from Spotify API using the access token
const getTrackMetadata = async (trackId, accessToken) => {
  try {
    const response = await axios.get(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const track = response.data;
    return {
      id: track.id,
      title: track.name,
      artists: track.artists.map((artist) => artist.name).join(', '),
      album: track.album.name,
      releaseDate: track.album.release_date,
      duration: new Date(track.duration_ms).toISOString().substr(14, 5),
      duration_ms: track.duration_ms,
      image: track.album.images[0]?.url || '',
      spotify_url: track.external_urls.spotify,
      popularity: track.popularity,
    };
  } catch (error) {
    throw new Error('Error fetching track metadata from Spotify API');
  }
};

// Step 3: Endpoint to fetch track metadata and return it
app.get('/spotify/down', async (req, res) => {
  const spotifyUrl = req.query.url;

  if (!spotifyUrl) {
    return res.status(400).json({ status: false, message: 'Spotify URL is required' });
  }

  try {
    // Extract track ID from Spotify URL (assuming URL format like https://open.spotify.com/track/{trackId})
    const trackId = spotifyUrl.split('/').pop().split('?')[0];

    // Get Spotify access token
    const accessToken = await getAccessToken();

    // Get track metadata from Spotify
    const trackMetadata = await getTrackMetadata(trackId, accessToken);

    // Return metadata in the response
    const finalResult = {
      status: true,
      id: trackMetadata.id,
      title: trackMetadata.title,
      artist: trackMetadata.artists,
      album: trackMetadata.album,
      image: trackMetadata.image,
      duration: trackMetadata.duration,
      releaseDate: trackMetadata.releaseDate,
      popularity: trackMetadata.popularity,
      spotify_url: trackMetadata.spotify_url,
    };

    res.json(finalResult);
  } catch (error) {
    res.status(500).json({ status: false, message: error.message || 'An error occurred' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
