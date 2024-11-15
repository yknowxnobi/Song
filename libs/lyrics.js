const axios = require('axios');

/**
 * Class Spotify
 *
 * This class is responsible for interacting with the Spotify API.
 */
class Spotify {
    constructor(client_id, client_secret) {
        this.client_id = client_id;
        this.client_secret = client_secret;
        this.lyrics_url = 'https://spclient.wg.spotify.com/color-lyrics/v2/track/';
    }

    /**
     * Retrieves an access token from Spotify using client credentials.
     * @return {Promise<string>} The access token.
     */
    async getAccessToken() {
        const tokenUrl = 'https://accounts.spotify.com/api/token';
        const authOptions = {
            headers: {
                'Authorization': 'Basic ' + Buffer.from(`${this.client_id}:${this.client_secret}`).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: 'grant_type=client_credentials'
        };

        try {
            const response = await axios.post(tokenUrl, authOptions.data, { headers: authOptions.headers });
            return response.data.access_token;
        } catch (error) {
            throw new Error('Error retrieving access token: ' + error.message);
        }
    }

    /**
     * Retrieves the lyrics of a track from Spotify.
     * @param {string} track_id The Spotify track id.
     * @return {Promise<string>} The lyrics of the track in JSON format.
     */
    async getLyrics(track_id) {
        const token = await this.getAccessToken();
        const formatted_url = `${this.lyrics_url}${track_id}?format=json&market=from_token`;

        try {
            const response = await axios.get(formatted_url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.0.0 Safari/537.36',
                    'App-platform': 'WebPlayer',
                    Authorization: `Bearer ${token}`
                }
            });

            return response.data;
        } catch (error) {
            throw new Error('Error fetching lyrics: ' + error.message);
        }
    }

    /**
     * Converts lyrics from milliseconds format to LRC format.
     * @param {Array} lyrics The lyrics of the track in JSON format.
     * @return {Array} The lyrics in LRC format.
     */
    getLrcLyrics(lyrics) {
        return lyrics.map(line => ({
            timeTag: this.formatMS(line.startTimeMs),
            words: line.words
        }));
    }

    /**
     * Converts lyrics from milliseconds format to SRT format.
     * @param {Array} lyrics The lyrics of the track in JSON format.
     * @return {Array} The lyrics in SRT format.
     */
    getSrtLyrics(lyrics) {
        return lyrics.slice(1).map((line, i) => ({
            index: i + 1,
            startTime: this.formatSRT(lyrics[i].startTimeMs),
            endTime: this.formatSRT(line.startTimeMs),
            words: lyrics[i].words
        }));
    }

    /**
     * Helper function to convert milliseconds to [mm:ss.xx] format for LRC.
     * @param {number} milliseconds The time in milliseconds.
     * @return {string} The formatted time.
     */
    formatMS(milliseconds) {
        const th_secs = Math.floor(milliseconds / 1000);
        return `${String(Math.floor(th_secs / 60)).padStart(2, '0')}:${String(th_secs % 60).padStart(2, '0')}.${String((milliseconds % 1000) / 10).padStart(2, '0')}`;
    }

    /**
     * Helper function to convert milliseconds to hh:mm:ss,ms format for SRT.
     * @param {number} milliseconds The time in milliseconds.
     * @return {string} The formatted time.
     */
    formatSRT(milliseconds) {
        const hours = Math.floor(milliseconds / 3600000);
        const minutes = Math.floor((milliseconds % 3600000) / 60000);
        const seconds = Math.floor((milliseconds % 60000) / 1000);
        const ms = milliseconds % 1000;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
    }
}

module.exports = Spotify;
