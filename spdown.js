const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

const getSpotifyAccessToken = async () => {
  const client_id = '414df719f85e45c9bd0ee5e83d08b501';
  const client_secret = 'fa7e159a0b904b8b8505bf59b6458d3a';

  try {
    const response = await axios.post('https://accounts.spotify.com/api/token',
      new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${client_id}:${client_secret}`).toString('base64')}`
        }
      }
    );
    return response.data.access_token;
  } catch (error) {
    throw new Error('Error fetching Spotify access token');
  }
};

const getTrackMetadata = async (trackId, accessToken) => {
  try {
    const response = await axios.get(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const track = response.data;
    return {
      id: track.id,
      title: track.name,
      artists: track.artists.map(a => a.name).join(', '),
      album: track.album.name,
      releaseDate: track.album.release_date,
      duration: new Date(track.duration_ms).toISOString().substr(14, 5),
      duration_ms: track.duration_ms,
      image: track.album.images[0]?.url || '',
      spotify_url: track.external_urls.spotify,
      popularity: track.popularity,
      isrc: track.external_ids?.isrc || 'N/A'
    };
  } catch (error) {
    throw new Error('Error fetching track metadata');
  }
};

const getSpotmateDownload = async (spotifyUrl) => {
  try {
    const homepage = await axios.get('https://spotmate.online', {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'text/html'
      }
    });

    const $ = cheerio.load(homepage.data);
    const csrfToken = $('meta[name="csrf-token"]').attr('content');

    const setCookie = homepage.headers['set-cookie'];
    let sessionCookie = '';
    if (setCookie) {
      for (const cookie of setCookie) {
        if (cookie.startsWith('spotmateonline_session=')) {
          sessionCookie = cookie.split(';')[0];
          break;
        }
      }
    }

    const convertRes = await axios.post(
      'https://spotmate.online/convert',
      { urls: spotifyUrl },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
          'cookie': sessionCookie,
          'User-Agent': 'Mozilla/5.0',
          'referer': 'https://spotmate.online/en',
          'origin': 'https://spotmate.online'
        }
      }
    );

    if (convertRes.data.error || !convertRes.data.url) {
      throw new Error('Failed to get download link');
    }

    return convertRes.data.url;
  } catch (err) {
    throw new Error('Error fetching Spotmate download link');
  }
};

app.get('/spotify/down', async (req, res) => {
  const spotifyUrl = req.query.url;
  if (!spotifyUrl) {
    return res.status(400).json({ status: false, message: 'Spotify URL is required' });
  }

  try {
    const trackId = spotifyUrl.split('/track/')[1]?.split('?')[0];
    if (!trackId) return res.status(400).json({ status: false, message: 'Invalid Spotify track URL' });

    const accessToken = await getSpotifyAccessToken();
    const metadata = await getTrackMetadata(trackId, accessToken);
    const downloadLink = await getSpotmateDownload(spotifyUrl);

    res.json({
      status: true,
      id: metadata.id,
      title: metadata.title,
      artist: metadata.artists,
      album: metadata.album,
      releaseDate: metadata.releaseDate,
      duration: metadata.duration,
      duration_ms: metadata.duration_ms,
      image: metadata.image,
      spotify_url: metadata.spotify_url,
      popularity: metadata.popularity,
      isrc: metadata.isrc,
      download_link: downloadLink
    });

  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ status: false, message: error.message || 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

module.exports = app;
