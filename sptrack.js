const axios = require('axios');

export default async function handler(req, res) {
  try {
    // Extract track ID from URL parameters (query string)
    const { url } = req.query;

    // Validate if the URL parameter is present
    if (!url) {
      return res.status(400).json({ error: 'Spotify URL is required' });
    }

    // Function to extract Spotify track ID from the provided URL
    const getTrackIdFromUrl = (spotifyUrl) => {
      const trackIdMatch = spotifyUrl.match(/track\/([a-zA-Z0-9]+)/);
      if (trackIdMatch && trackIdMatch[1]) {
        return trackIdMatch[1];
      } else {
        throw new Error('Invalid Spotify track URL');
      }
    };

    // Extract the track ID from the provided Spotify URL
    const trackId = getTrackIdFromUrl(url);

    // Construct the API URL for Spotifydown or any other service
    const apiUrl = `https://api.spotifydown.com/download/${trackId}`;

    // Define the request configuration with necessary headers
    let config = {
      method: 'GET',
      url: apiUrl,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'sec-ch-ua': '"Not)A;Brand";v="99", "Google Chrome";v="127", "Chromium";v="127"',
        'dnt': '1',
        'sec-ch-ua-mobile': '?1',
        'sec-ch-ua-platform': '"Android"',
        'origin': 'https://spotifydown.com',
        'sec-fetch-site': 'same-site',
        'sec-fetch-mode': 'cors',
        'sec-fetch-dest': 'empty',
        'referer': 'https://spotifydown.com/',
        'accept-language': 'en-US,en;q=0.9,bn;q=0.8,ru;q=0.7,zh-CN;q=0.6,zh;q=0.5,hi;q=0.4',
        'if-none-match': 'W/"20a-fwb3R3VpID+bytv5VU1H6pvxEpY"',
        'priority': 'u=1, i'
      }
    };

    // Send the request using axios
    const response = await axios.request(config);

    // Send the API response back to the client
    res.status(200).json(response.data);

  } catch (error) {
    // Handle any errors and send an error response
    res.status(500).json({ error: error.message });
  }
}
