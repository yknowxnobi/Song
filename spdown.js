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

// Function to search for songs using query
const searchSongs = async (accessToken, query, limit = 30) => {
  const searchUrl = 'https://api.spotify.com/v1/search';
  const options = {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    },
    params: {
      q: query,
      type: 'track',
      limit // Fetch up to the specified limit of tracks
    }
  };

  try {
    const response = await axios.get(searchUrl, options);
    return response.data;
  } catch (error) {
    console.error('Failed to search tracks', error.response ? error.response.data : error.message);
    throw error;
  }
};

// Function to fetch song details using Spotify API
const getSpotifySongDetails = async (accessToken, spotifyUrl) => {
  const trackId = spotifyUrl.split('/').pop(); // Extract track ID from Spotify URL
  const detailsUrl = `https://api.spotify.com/v1/tracks/${trackId}`;

  try {
    const response = await axios.get(detailsUrl, {
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
      imageUrl: trackInfo.album.images[0].url,
      previewUrl: trackInfo.preview_url,
      spotifyUrl: trackInfo.external_urls.spotify
    };
  } catch (error) {
    console.error('Failed to fetch song details', error.response ? error.response.data : error.message);
    throw error;
  }
};

// Function to fetch download link using Teleservices Downloader API
const getDownloadLink = async (spotifyUrl, authorization) => {
  const downloadApiUrl = `https://teleservicesapi.vercel.app/spotify?authorization=${authorization}&spotify_url=${encodeURIComponent(spotifyUrl)}`;

  try {
    const response = await axios.get(downloadApiUrl);
    return response.data;
  } catch (error) {
    console.error('Failed to get download link', error.response ? error.response.data : error.message);
    throw error;
  }
};

// Main function to handle the request for searching songs
module.exports = async (req, res) => {
  const query = req.query.q; // Search query for tracks
  const spotifyUrl = req.query.url; // Track URL
  const authorization = req.query.authorization || '@Teleservices_Api';
  const limit = parseInt(req.query.limit, 10) || 30; // Optional limit, default is 30

  try {
    let trackDetails;

    if (spotifyUrl) {
      // If a Spotify track URL is provided
      const accessToken = await getAccessToken();
      trackDetails = await getSpotifySongDetails(accessToken, spotifyUrl);

      // Fetch the download link
      const downloadData = await getDownloadLink(spotifyUrl, authorization);

      return res.status(200).json({
        data: trackDetails,
        download_link: downloadData.download_link,
        credit: downloadData.credit,
        developerCredit: 'https://t.me/Teleservices_Api' // Developer credit URL
      });
    } else if (query) {
      // If a search query is provided
      const accessToken = await getAccessToken();
      const searchResults = await searchSongs(accessToken, query, limit);

      const tracks = searchResults.tracks.items;
      if (tracks.length > 0) {
        const trackDetailsList = tracks.map((track, index) => {
          const previewUrl = track.preview_url || 'No preview available';
          const image = track.album.images.length > 0 ? track.album.images[0].url : 'No image available';

          return {
            id: index + 1,
            trackName: track.name,
            artist: track.artists.map(artist => artist.name).join(', '),
            album: track.album.name,
            releaseDate: track.album.release_date,
            spotifyUrl: track.external_urls.spotify,
            previewUrl, // Direct Spotify preview URL
            image // Album cover image
          };
        });

        return res.status(200).json({
          tracks: trackDetailsList, // List of song details
          developerCredit: 'https://t.me/Teleservices_Api' // Developer credit URL
        });
      } else {
        return res.status(404).json({ error: 'No tracks found' });
      }
    } else {
      return res.status(400).json({ error: 'Query parameter "q" or "spotify_url" is required' });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
