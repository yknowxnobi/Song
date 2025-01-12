const axios = require('axios');

module.exports = async (req, res) => {
    // Get the song name from URL parameters (e.g., /api/song?songName=High%20Hopes)
    const { songName, Name } = req.query;
    const sName = songName || Name;

    if (!sName) {
        return res.status(400).json({ error: 'Missing songName query parameter' });
    }

    try {
        // Step 1: Search for the song using the Spotify search API
        const searchUrl = `https://song-teleservice.vercel.app/spotify/search?q=${encodeURIComponent(sName)}&limit=1`;
        const searchResponse = await axios.get(searchUrl);
        const track = searchResponse.data.tracks[0];

        if (!track) {
            return res.status(404).json({ error: 'Song not found' });
        }

        // Step 2: Extract Spotify URL from the search response
        const spotifyUrl = track.spotifyUrl;
    // Get the song name from URL parameters (e.g., /api/song?songName=High%20Hopes)
    const { songName, Name } = req.query;

    if (!songName || !Name) {
        return res.status(400).json({ error: 'Missing songName query parameter' });
    }

    try {
        // Step 1: Search for the song using the Spotify search API
        const searchUrl = `https://song-teleservice.vercel.app/spotify/search?q=${encodeURIComponent(songName) ||encodeURIComponent(Name) }&limit=1`;
        const searchResponse = await axios.get(searchUrl);
        const track = searchResponse.data.tracks[0];

        if (!track) {
            return res.status(404).json({ error: 'Song not found' });
        }
        // Step 3: Call the download API using the Spotify URL
        const downloadUrl = `https://song-teleservice.vercel.app/spotify/down?url=${encodeURIComponent(spotifyUrl)}`;
        const downloadResponse = await axios.get(downloadUrl);

        // Step 4: Send the download link as a response
        return res.status(200).json({
            trackName: track.trackName,
            artist: track.artist,
            album: track.album,
            releaseDate: track.releaseDate,
            spotifyUrl: track.spotifyUrl,
            previewUrl: track.previewUrl,
            image: track.image,
            downloadLink: downloadResponse.data.download_link,
            duration: downloadResponse.data.duration
        });

    } catch (error) {
        return res.status(500).json({ error: 'Something went wrong', details: error.message });
    }
};
