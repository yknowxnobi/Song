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

// Function to fetch album details (including all songs in the album) using Spotify API
const getAlbumDetails = async (accessToken, albumUrl) => {
  const albumId = albumUrl.split('/').pop().split('?')[0]; // Extract album ID from Spotify URL
  const albumDetailsUrl = `https://api.spotify.com/v1/albums/${albumId}`;

  try {
    const response = await axios.get(albumDetailsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const albumInfo = response.data;
    const tracks = albumInfo.tracks.items.map((track, index) => ({
      trackNumber: index + 1,
      trackName: track.name,
      artist: track.artists.map(artist => artist.name).join(', '),
      durationMs: track.duration_ms,
      previewUrl: track.preview_url,
      spotifyUrl: track.external_urls.spotify
    }));

    return {
      albumName: albumInfo.name,
      artist: albumInfo.artists.map(artist => artist.name).join(', '),
      releaseDate: albumInfo.release_date,
      imageUrl: albumInfo.images[0].url,
      totalTracks: albumInfo.total_tracks,
      tracks // List of all track details
    };
  } catch (error) {
    console.error('Failed to fetch album details', error.response ? error.response.data : error.message);
    throw error;
  }
};

// Function to fetch playlist details (including all songs in the playlist) using Spotify API
const getPlaylistDetails = async (accessToken, playlistUrl) => {
  const playlistId = playlistUrl.split('/').pop().split('?')[0]; // Extract playlist ID from Spotify URL
  const playlistDetailsUrl = `https://api.spotify.com/v1/playlists/${playlistId}`;

  try {
    const response = await axios.get(playlistDetailsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const playlistInfo = response.data;
    const tracks = playlistInfo.tracks.items.map((item, index) => ({
      trackNumber: index + 1,
      trackName: item.track.name,
      artist: item.track.artists.map(artist => artist.name).join(', '),
      album: item.track.album.name,
      durationMs: item.track.duration_ms,
      previewUrl: item.track.preview_url,
      spotifyUrl: item.track.external_urls.spotify
    }));

    return {
      playlistName: playlistInfo.name,
      description: playlistInfo.description,
      owner: playlistInfo.owner.display_name,
      imageUrl: playlistInfo.images[0].url,
      totalTracks: playlistInfo.tracks.total,
      tracks // List of all track details
    };
  } catch (error) {
    console.error('Failed to fetch playlist details', error.response ? error.response.data : error.message);
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

// Main function to handle the request for searching songs/albums/playlists
module.exports = async (req, res) => {
  const query = req.query.q; // Search query for tracks or albums
  const spotifyUrl = req.query.url; // Track, album, or playlist URL
  const authorization = req.query.authorization || '@Teleservices_Api';
  const limit = parseInt(req.query.limit, 10) || 30; // Optional limit, default is 30
  const isAlbum = req.query.album === 'true'; // Check if the request is for an album
  const isPlaylist = req.query.playlist === 'true'; // Check if the request is for a playlist
  const bot = req.query.bot
  try {
    if (spotifyUrl && isPlaylist) {
      // If a Spotify playlist URL is provided
      const accessToken = await getAccessToken();
      const playlistDetails = await getPlaylistDetails(accessToken, spotifyUrl);

      return res.status(200).json({
        data: playlistDetails, // Playlist details with all tracks
        developerCredit: 'https://t.me/Teleservices_Api' // Developer credit URL
      });
    } else if (spotifyUrl && isAlbum) {
      // If a Spotify album URL is provided
      const accessToken = await getAccessToken();
      const albumDetails = await getAlbumDetails(accessToken, spotifyUrl);

      return res.status(200).json({
        tracks: albumDetails.tracks, // Album details with all tracks
        developerCredit: 'https://t.me/Teleservices_Api' // Developer credit URL
      });
    } else if (spotifyUrl) {
      // If a Spotify track URL is provided
      const accessToken = await getAccessToken();
      const trackDetails = await searchSongs(accessToken, spotifyUrl);

      const trackInfo = trackDetails.tracks.items[0]; // Assuming it's the first track in the response
      if (trackInfo) {
        const downloadData = await getDownloadLink(spotifyUrl, authorization);

        return res.status(200).json({
          track: {
            trackName: trackInfo.name,
            artist: trackInfo.artists.map(artist => artist.name).join(', '),
            album: trackInfo.album.name,
            releaseDate: trackInfo.album.release_date,
            durationMs: trackInfo.duration_ms,
            previewUrl: trackInfo.preview_url,
            spotifyUrl: trackInfo.external_urls.spotify,
            downloadLink: downloadData.download_link
          },
          credit: downloadData.credit,
          developerCredit: 'https://t.me/Teleservices_Api' // Developer credit URL
        });
      } else {
        return res.status(404).json({ error: 'Track not found' });
      }
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
    } else if (bot) {
      const accessToken = await getAccessToken();
      const trackDetails = await searchSongs(accessToken, bot, 1);
      
      const trackInfo = trackDetails.tracks.items[0];
      
       // Assuming it's the first track in the response
      if (trackInfo) {
        const downloadData = await getDownloadLink(trackInfo.external_urls.spotify, authorization);
        const duration_ms = trackInfo.duration_ms; // Assume this is your duration in milliseconds
        const d = Math.floor(duration_ms / 1000);
        return res.status(200).json({
          track: {
            trackName: trackInfo.name,
            artist: trackInfo.artists.map(artist => artist.name).join(', '),
            image: trackInfo.album.images[0].url,
            durationMs: d,
            spotifyUrl: trackInfo.external_urls.spotify,
            downloadLink: downloadData.download_link
          },
          credit: downloadData.credit,
        });
      } else {
        return res.status(404).json({ error: 'Track not found' });
      }
    }else{
      res.status(500).json({error: 'use the api functions' });
    }
  } catch (error) {
    console.error('Error occurred', error.response ? error.response.data : error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
