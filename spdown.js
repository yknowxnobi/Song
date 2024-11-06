const express = require('express');
const axios = require('axios');

const app = express();

const getSpotifyTrackDetails = async (url) => {
  const trackResponse = await axios.get(`https://api.fabdl.com/spotify/get?url=${url}`);
  return trackResponse.data.result;
};

const getDownloadLink = async (gid, track_id) => {
  const downloadResponse = await axios.get(`https://api.fabdl.com/spotify/mp3-convert-task/${gid}/id`);
  const result = downloadResponse.data.result;
  if (result.track_id === track_id) {
    return `https://api.fabdl.com${result.download_url}`;
  }
  return null;
};

app.get('/api/spotify', async (req, res) => {
  const spotifyUrl = req.query.url;

  if (!spotifyUrl) {
    return res.status(400).json({ status: false, message: 'Spotify URL is required' });
  }

  try {
    const trackDetails = await getSpotifyTrackDetails(spotifyUrl);
    const downloadLink = await getDownloadLink(trackDetails.gid, trackDetails.id);

    if (!downloadLink) {
      return res.status(500).json({ status: false, message: 'Error fetching download link' });
    }

    res.json({
      status: true,
      title: trackDetails.name,
      image: trackDetails.image,
      artist: trackDetails.artists,
      duration: trackDetails.duration_ms,
      download_link: downloadLink
    });
  } catch (error) {
    res.status(500).json({ status: false, message: 'An error occurred' });
  }
});

module.exports = app;
