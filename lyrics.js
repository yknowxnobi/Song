const fetch = require('node-fetch');

const apiURL = "https://api.lyrics.ovh";

// Main handler function for the Vercel API
module.exports = async (req, res) => {
  const { artist, title } = req.query;

  // Validate if both artist and title are provided
  if (!artist || !title) {
    return res.status(400).json({
      success: false,
      message: 'Both artist and song title parameters are required.'
    });
  }

  try {
    // Fetch lyrics from Lyrics.ovh
    const response = await fetch(`${apiURL}/v1/${artist}/${title}`);
    
    if (!response.ok) {
      throw new Error('Lyrics not found or invalid song/artist');
    }

    const data = await response.json();

    // Format lyrics with <br> tags for better display in HTML
    const lyrics = data.lyrics.replace(/(\r\n|\r|\n)/g, "<br>");

    // Return lyrics as JSON response
    return res.status(200).json({
      success: true,
      lyrics: lyrics
    });

  } catch (error) {
    console.error('Error fetching lyrics:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to fetch lyrics'
    });
  }
};
