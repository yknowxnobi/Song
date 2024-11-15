const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * Class Lyrics
 *
 * This class is responsible for interacting with the Spotify API to get track lyrics.
 */
class Lyrics {
    constructor(client_id, client_secret) {
        this.token_url = 'https://accounts.spotify.com/api/token';
        this.lyrics_url = 'https://spclient.wg.spotify.com/color-lyrics/v2/track/';
        this.client_id = client_id;
        this.client_secret = client_secret;
        this.cache_file = path.join(require('os').tmpdir(), 'spotify_token.json');
    }

    /**
     * Retrieves an access token from Spotify using the client credentials.
     */
    async getAccessToken() {
        const authOptions = {
            headers: {
                'Authorization': 'Basic ' + Buffer.from(this.client_id + ':' + this.client_secret).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: 'grant_type=client_credentials'
        };

        try {
            const response = await axios.post(this.token_url, authOptions.data, { headers: authOptions.headers });
            return response.data.access_token;
        } catch (error) {
            throw new Error('Failed to fetch access token: ' + error.message);
        }
    }

    /**
     * Checks if the access token is expired and retrieves a new one if it is.
     */
    async checkTokenExpire() {
        if (fs.existsSync(this.cache_file)) {
            const tokenData = JSON.parse(fs.readFileSync(this.cache_file, 'utf-8'));
            const timeleft = tokenData.accessTokenExpirationTimestampMs;
            const timenow = Date.now();

            if (timeleft < timenow) {
                await this.getAccessToken();
            }
        } else {
            await this.getAccessToken();
        }
    }

    /**
     * Retrieves the lyrics of a track from Spotify.
     * @param {string} track_id The Spotify track id.
     * @return {Promise<string>} The lyrics of the track in JSON format.
     */
    async getLyrics(track_id) {
        const token = await this.getAccessToken();
        const formated_url = `${this.lyrics_url}${track_id}?format=json&market=from_token`;

        try {
            const response = await axios.get(formated_url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.0.0 Safari/537.36',
                    'App-platform': 'WebPlayer',
                    Authorization: `Bearer ${token}`
                }
            });
            return response.data;
        } catch (error) {
            throw new Error('Failed to fetch lyrics: ' + error.message);
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

module.exports = Lyrics;
