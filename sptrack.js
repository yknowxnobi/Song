import fetch from 'node-fetch';

export default async function handler(req, res) {
  try {
    // Extract track URL from URL parameters
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
    const apiUrl = `https://api.spotifydown.com/metadata/track/${trackId}`;

    // Define the request configuration with necessary headers
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36',
      //'Accept-Encoding': 'gzip, deflate, br, zstd',
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
    };

    // Fetch data from the external API using node-fetch
    const response = await fetch(apiUrl, { headers });
    
    // Check if the response is ok (status in the range 200-299)
    if (!response.ok) {
      throw new Error('Failed to fetch track details');
    }

    // Parse the JSON response
    const data = await response.json();

    // Structure the response in the desired format
    const result = {
      artist: data.metadata.artists,
      title: data.metadata.title,
      album: data.metadata.album,
      cover: data.metadata.cover,
      isrc: data.metadata.isrc,
      releaseDate: data.metadata.releaseDate,
      link: data.link
    };

    // Send the structured response back to the client
    res.status(200).json(result);

  } catch (error) {
    // Handle any errors and send an error response
    res.status(500).json({ error: error.message });
  }
        }
