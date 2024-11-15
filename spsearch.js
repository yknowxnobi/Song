const axios = require('axios');

const client_id = '414df719f85e45c9bd0ee5e83d08b501';
const client_secret = 'fa7e159a0b904b8b8505bf59b6458d3a';

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
    throw error;
  }
};

const searchSongs = async (accessToken, query, limit = 30, offset = 0) => {
  const searchUrl = 'https://api.spotify.com/v1/search';
  const options = {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    },
    params: {
      q: query,
      type: 'track',
      limit,
      offset
    }
  };

  try {
    const response = await axios.get(searchUrl, options);
    return response.data;
  } catch (error) {
    throw error;
  }
};

module.exports = async (req, res) => {
  const query = req.query.q;
  let limit = parseInt(req.query.limit, 10) || 30;
  const offset = parseInt(req.query.offset, 10) || 0;
  
  try {
    const accessToken = await getAccessToken();

    // Adjusting logic to handle limit of 100 with two pages (Spotify API max limit is 50)
    if (limit > 50) {
      const firstLimit = 50;
      const secondLimit = limit - 50;
      const firstOffset = offset;
      const secondOffset = offset + 50;

      // Fetch first page of 50 results
      const firstPageResults = await searchSongs(accessToken, query, firstLimit, firstOffset);
      const firstTracks = firstPageResults.tracks.items;

      // Fetch second page for remaining results
      const secondPageResults = await searchSongs(accessToken, query, secondLimit, secondOffset);
      const secondTracks = secondPageResults.tracks.items;

      // Combine both pages of results
      const combinedTracks = [...firstTracks, ...secondTracks];

      const trackDetailsList = combinedTracks.map((track, index) => {
        const previewUrl = track.preview_url || 'No preview available';
        const image = track.album.images.length > 0 ? track.album.images[0].url : 'No image available';

        return {
          id: index + 1,
          trackName: track.name,
          artist: track.artists.map(artist => artist.name).join(', '),
          album: track.album.name,
          releaseDate: track.album.release_date,
          spotifyUrl: track.external_urls.spotify,
          previewUrl,
          image
        };
      });

      return res.status(200).json({
        tracks: trackDetailsList,
        developerCredit: 'https://t.me/Teleservices_Api'
      });
    } else {
      // Handle cases where limit is 50 or less
      const searchResults = await searchSongs(accessToken, query, limit, offset);
      const tracks = searchResults.tracks.items;

      if (tracks.length > 0) {
        const trackDetailsList = tracks.map((track, index) => {
          const previewUrl = track.preview_url || 'No preview available';
          const image = track.album.images.length > 0 ? track.album.images[0].url : 'No image available';
const artists = track.artists.map(artist => ({
      name: artist.name,
      spotifyUrl: artist.external_urls.spotify,
      id: artist.id,
      uri: artist.uri
    }));
          return {
            id: index + 1,
            trackName: track.name,
            artists,
            artist: track.artists.map(artist => artist.name).join(', '),
            album: track.album.name,
            releaseDate: track.album.release_date,
            spotifyUrl: track.external_urls.spotify,
            previewUrl,
            image
          };
        });

        return res.status(200).json({
          tracks: trackDetailsList,
          developerCredit: 'https://t.me/Teleservices_Api'
        });
      } else {
        return res.status(404).json({ error: 'No tracks found' });
      }
    }
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};
