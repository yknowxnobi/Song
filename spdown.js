const express = require('express');
const axios = require('axios');

const app = express();

const PORT = process.env.PORT || 3000;

const getSpotifyTrackDetails = async (url) => {
  const response = await axios.get(`https://api.fabdl.com/spotify/get?url=${url}`);
  return response.data.result;
};

const getDownloadLink = async (gid, track_id) => {
  const response = await axios.get(`https://api.fabdl.com/spotify/mp3-convert-task/${gid}/${track_id}`);
  return response.data.result;
};

app.get('/spotify/down', async (req, res) => {
  const spotifyUrl = req.query.url;

  if (!spotifyUrl) {
    return res.status(400).json({ status: false, message: 'Spotify URL is required' });
  }

  try {
    const trackDetails = await getSpotifyTrackDetails(spotifyUrl);
    const { gid, id, name, image, artists, duration_ms } = trackDetails;

    const downloadTask = await getDownloadLink(gid, id);

    if (!downloadTask.download_url) {
      return res.status(500).json({ status: false, message: 'Failed to retrieve download link' });
    }

    const finalResult = {
      status: true,
      id,
      title: name,
      image: image,
      artist: artists,
      duration: duration_ms,
      download_link: `https://api.fabdl.com${downloadTask.download_url}`,
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
