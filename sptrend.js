const axios = require('axios');

// Spotify credentials stored as environment variables
const CLIENT_ID = "414df719f85e45c9bd0ee5e83d08b501";
const CLIENT_SECRET = "fa7e159a0b904b8b8505bf59b6458d3a";

// Function to get the access token
async function getAccessToken() {
    const url = 'https://accounts.spotify.com/api/token';
    const headers = {
        'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
    };

    const data = 'grant_type=client_credentials';

    try {
        const response = await axios.post(url, data, { headers });
        return response.data.access_token;
    } catch (error) {
        console.error('Error getting access token:', error);
        throw new Error('Unable to get access token');
    }
}

// Function to fetch data from Spotify based on category and type
async function fetchSpotifyData(accessToken, category, type) {
    let url = '';

    if (category === 'trending') {
        switch (type) {
            case 'songs':
            case 'albums':
                url = 'https://api.spotify.com/v1/browse/new-releases';
                break;
            case 'playlists':
                url = 'https://api.spotify.com/v1/browse/featured-playlists';
                break;
            default:
                throw new Error('Invalid type for trending');
        }
    } else if (category === 'new') {
        switch (type) {
            case 'songs':
            case 'albums':
                url = 'https://api.spotify.com/v1/browse/new-releases';
                break;
            case 'playlists':
                url = 'https://api.spotify.com/v1/browse/featured-playlists';
                break;
            default:
                throw new Error('Invalid type for latest');
        }
    } else {
        throw new Error('Invalid category. Use "trending" or "new".');
    }

    const headers = {
        'Authorization': 'Bearer ' + accessToken
    };

    try {
        const response = await axios.get(url, { headers });
        return response.data;
    } catch (error) {
        console.error('Error fetching data from Spotify:', error);
        throw new Error('Unable to fetch data from Spotify');
    }
}

module.exports = async (req, res) => {
    const { category, type } = req.query;

    if (!category || !type) {
        return res.status(400).json({ success: false, message: 'Category and type parameters are required.' });
    }

    try {
        const accessToken = await getAccessToken();
        const spotifyData = await fetchSpotifyData(accessToken, category, type);

        let result;
        if (type === 'songs' || type === 'albums') {
            result = spotifyData.albums.items.map(item => ({
                name: item.name,
                artist: item.artists.map(artist => artist.name).join(', '),
                release_date: item.release_date,
                url: item.external_urls.spotify,
                image: item.images[0]?.url
            }));
        } else if (type === 'playlists') {
            result = spotifyData.playlists.items.map(item => ({
                name: item.name,
                description: item.description,
                url: item.external_urls.spotify,
                image: item.images[0]?.url
            }));
        } else {
            return res.status(400).json({ success: false, message: 'Invalid type specified.' });
        }

        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
