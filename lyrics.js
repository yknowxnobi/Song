// api/lyrics.js

const Lyrics = require('./libs/lyrics');

// Your Spotify client credentials
const client_id = '414df719f85e45c9bd0ee5e83d08b501';
const client_secret = 'fa7e159a0b904b8b8505bf59b6458d3a';

// Create a new instance of the Lyrics class
const lyrics = new Lyrics(client_id, client_secret);

module.exports = async (req, res) => {
    // Check if the method is GET
    if (req.method === 'GET') {
        // Get the track ID from URL parameters
        const { track_id } = req.query;

        // Validate that the track ID is provided
        if (!track_id) {
            return res.status(400).json({ error: 'Track ID is required' });
        }

        try {
            // Get lyrics of the track
            const lyricsData = await lyrics.getLyrics(track_id);
            
            // Return the lyrics as JSON
            return res.status(200).json({ lyrics: lyricsData });
        } catch (error) {
            console.error('Error:', error.message);
            return res.status(500).json({ error: error.message });
        }
    } else {
        // Handle unsupported methods
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
};
