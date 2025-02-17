const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

const SP_DC = "AQBfZF-Im6xP-vFXlqnaJVnPbWgJ8ui7MeSvtLnK5qYByRu9Yvpl7Vc-nxBySHBNryQuMfWLqffcuRWJN8E7F1Zk4Hj1NAFkObJ5TbJqkg5wfTx4aPgfpbQN98eeYVvHKPENvEoUVjECHwZMLiWqcikFaiIvJHgPRn-h8RTTSeEM7LrWRyZ34V-VOKPVOLheENAZP4UQ8R3whLKOoldtWW-g6Z3_";
const SP_KEY = "890acd67-3e50-4709-89ab-04e794616352";

const getAccessToken = async () => {
  try {
    const response = await axios.get("https://open.spotify.com/get_access_token", {
      headers: { "Content-Type": "application/json" },
      withCredentials: true,
      cookies: { sp_dc: SP_DC, sp_key: SP_KEY },
    });
    return response.data.accessToken;
  } catch (error) {
    throw new Error("Error fetching Spotify access token");
  }
};

const getSpotifyTrackDetails = async (url) => {
  try {
    const response = await axios.get(`https://api.fabdl.com/spotify/get?url=${url}`);
    return response.data.result;
  } catch (error) {
    throw new Error("Error fetching Spotify track details");
  }
};

const getDownloadLink = async (gid, track_id) => {
  try {
    const response = await axios.get(`https://api.fabdl.com/spotify/mp3-convert-task/${gid}/${track_id}`);
    return response.data.result;
  } catch (error) {
    throw new Error("Error fetching download link");
  }
};

const getTrackMetadata = async (trackId, accessToken) => {
  try {
    const response = await axios.get(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const track = response.data;
    return {
      id: track.id,
      title: track.name,
      artists: track.artists.map((artist) => artist.name).join(", "),
      album: track.album.name,
      releaseDate: track.album.release_date,
      duration: new Date(track.duration_ms).toISOString().substr(14, 5),
      duration_ms: track.duration_ms,
      image: track.album.images[0]?.url || "",
      spotify_url: track.external_urls.spotify,
      popularity: track.popularity,
    };
  } catch (error) {
    throw new Error("Error fetching track metadata");
  }
};

app.get('/spotify/down', async (req, res) => {
  const spotifyUrl = req.query.url;

  if (!spotifyUrl) {
    return res.status(400).json({ status: false, message: "Spotify URL is required" });
  }

  try {
    const trackDetails = await getSpotifyTrackDetails(spotifyUrl);
    const { gid, id, name, image, artists, duration_ms } = trackDetails;
    const downloadTask = await getDownloadLink(gid, id);

    if (!downloadTask.download_url) {
      return res.status(500).json({ status: false, message: "Failed to retrieve download link" });
    }

    const accessToken = await getAccessToken();
    const trackMetadata = await getTrackMetadata(id, accessToken);

    const finalResult = {
      status: true,
      id,
      title: name,
      image: image,
      artist: artists,
      duration: new Date(duration_ms).toISOString().substr(14, 5),
      duration_ms,
      download_link: `https://api.fabdl.com${downloadTask.download_url}`,
      album: trackMetadata.album,
      cover: trackMetadata.image,
      isrc: trackMetadata.isrc || "N/A",
      releaseDate: trackMetadata.releaseDate,
      spotify_url: `https://open.spotify.com/track/${id}`
    };

    res.json(finalResult);
  } catch (error) {
    res.status(500).json({ status: false, message: error.message || "An error occurred" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
