const axios = require('axios');

// Function to fetch Spotify track details using Teleservices API
const getSpotifyTrackDetails = async (spotifyUrl, authorization) => {
  const encodedSpotifyUrl = encodeURIComponent(spotifyUrl);
  const downloadApiUrl = `https://teleservicesapi.vercel.app/spotify?authorization=${authorization}&spotify_url=${encodedSpotifyUrl}`;

  console.log("Requesting download link from:", downloadApiUrl); // Debugging log

  try {
    // Send a request to Teleservices API for track details and download link
    const response = await axios.get(downloadApiUrl);
    console.log("Response data:", response.data); // Debugging log

    return response.data; // Returning the data from the API response
  } catch (error) {
    console.error('Failed to get download link', error.response ? error.response.data : error.message);
    throw error; // Throw the error to handle it in the main function
  }
};

// Main function to handle the request
module.exports = async (req, res) => {
  const spotifyUrl = req.query.url; // Track URL passed as a query parameter
  const authorization = req.query.authorization || '@Teleservices_Api'; // Default authorization token

  try {
    if (spotifyUrl) {
      // If a Spotify track URL is provided, fetch details
      const trackData = await getSpotifyTrackDetails(spotifyUrl, authorization);

      return res.status(200).json({
        data: trackData, // Track details and download link
        developerCredit: 'https://t.me/Teleservices_Api' // Developer credit URL
      });
    } else {
      return res.status(400).json({ error: 'Query parameter "url" is required' });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
