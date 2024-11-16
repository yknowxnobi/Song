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

  const response = await axios.post(tokenUrl, authOptions.data, { headers: authOptions.headers });
  return response.data.access_token;
};

const getTrackDetails = async (accessToken, trackUrl) => {
  const trackId = trackUrl.split('/').pop().split('?')[0];
  const trackDetailsUrl = `https://api.spotify.com/v1/tracks/${trackId}`;

  const response = await axios.get(trackDetailsUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  const trackInfo = response.data;
  const artists = trackInfo.artists.map(artist => ({
    name: artist.name,
    spotifyUrl: artist.external_urls.spotify,
    id: artist.id,
    uri: artist.uri
  }));

  return {
    trackName: trackInfo.name,
    artists,
    album: trackInfo.album.name,
    albumType: trackInfo.album.album_type,
    albumExternalUrl: trackInfo.album.external_urls.spotify,
    releaseDate: trackInfo.album.release_date,
    spotifyUrl: trackInfo.external_urls.spotify,
    previewUrl: trackInfo.preview_url || 'No preview available',
    image: trackInfo.album.images.length > 0 ? trackInfo.album.images[0].url : 'No image available',
    duration: new Date(trackInfo.duration_ms).toISOString().substr(14, 5),
    popularity: trackInfo.popularity,
    explicit: trackInfo.explicit,
    trackUri: trackInfo.uri,
    durationMs: trackInfo.duration_ms,
    totalTracksInAlbum: trackInfo.album.total_tracks
  };
};

module.exports = async (req, res) => {
  const trackUrl = req.query.url;

  try {
    const accessToken = await getAccessToken();
    const trackDetails = await getTrackDetails(accessToken, trackUrl);

    return res.status(200).json({
      data: trackDetails,
      developerCredit: 'https://t.me/Teleservices_Api'
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};
