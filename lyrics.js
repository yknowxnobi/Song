const axios = require('axios');

module.exports = async (req, res) => {
  // Get the trackid from the URL parameters
  const { id } = req.query;

  // If no trackid is provided, return an error response
  if (!id) {
    return res.status(400).json({
      status: 'error',
      message: 'Track ID is required',
    });
  }

  // Define the API URL using the trackid
  const apiUrl = `https://spotify-lyrics-api-pi.vercel.app?trackid=${id}&format=id3`;

  try {
    // Make a GET request to the API
    const response = await axios.get(apiUrl);

    // Check if there is an error in the API response
    if (response.data.error) {
      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch lyrics',
      });
    }

    // Initialize the full lyrics string and raw lines
    const rawLines = response.data.lines || [];
    let fullLyrics = '';

    // Collect all lines into the full lyrics string
    rawLines.forEach((line) => {
      fullLyrics += `${line.words}\n`;
    });

    // Create the response object
    const formattedResponse = {
      status: 'success',
      lyrics: fullLyrics.trim(),  // Remove trailing newline
      lines: rawLines,  // Return the raw lines from the API
    };

    // Send the formatted response back to the client
    res.status(200).json(formattedResponse);
  } catch (error) {
    console.error('Error fetching lyrics:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal Server Error',
    });
  }
};
