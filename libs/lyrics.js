const axios = require('axios');

class Spotify {
  constructor(sp_dc) {
    this.token_url = 'https://open.spotify.com/get_access_token?reason=transport&productType=web_player';
    this.lyrics_url = 'https://spclient.wg.spotify.com/color-lyrics/v2/track/';
    this.sp_dc = sp_dc;
  }

  // Retrieves an access token from Spotify
  async getToken() {
    if (!this.sp_dc) throw new Error('Please set SP_DC as an environmental variable.');

    try {
      const response = await axios.get(this.token_url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.0.0 Safari/537.36',
          'App-platform': 'WebPlayer',
          'Content-Type': 'text/html; charset=utf-8',
          'Cookie': `sp_dc=${this.sp_dc}`
        }
      });
      const tokenJson = response.data;
      if (!tokenJson || tokenJson.isAnonymous) throw new Error('The SP_DC set seems to be invalid, please correct it!');
      return tokenJson.accessToken;
    } catch (error) {
      throw new Error('Error fetching access token: ' + error.message);
    }
  }

  // Checks if the token is expired (for future expansion) and fetches a new one if needed
  async checkTokenExpire() {
    const token = await this.getToken();
    return token;
  }

  // Retrieves the lyrics of a track from Spotify
  async getLyrics(track_id) {
    try {
      const token = await this.getToken();
      const url = `${this.lyrics_url}${track_id}?format=json&market=from_token`;

      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.0.0 Safari/537.36',
          'App-platform': 'WebPlayer',
          'Authorization': `Bearer ${token}`
        }
      });

      return response.data;
    } catch (error) {
      throw new Error('Error fetching lyrics: ' + error.message);
    }
  }

  // Converts lyrics from milliseconds to LRC format
  getLrcLyrics(lyrics) {
    return lyrics.map(line => ({
      timeTag: this.formatMS(line.startTimeMs),
      words: line.words
    }));
  }

  // Converts lyrics from milliseconds to SRT format
  getSrtLyrics(lyrics) {
    const srt = [];
    for (let i = 1; i < lyrics.length; i++) {
      const startTime = this.formatSRT(lyrics[i-1].startTimeMs);
      const endTime = this.formatSRT(lyrics[i].startTimeMs);
      srt.push({
        index: i,
        startTime: startTime,
        endTime: endTime,
        words: lyrics[i-1].words
      });
    }
    return srt;
  }

  // Helper function to convert milliseconds to [ mm:ss.xx ] format
  formatMS(milliseconds) {
    const thSecs = Math.floor(milliseconds / 1000);
    return `${String(Math.floor(thSecs / 60)).padStart(2, '0')}:${String(thSecs % 60).padStart(2, '0')}.${String(Math.floor((milliseconds % 1000) / 10)).padStart(2, '0')}`;
  }

  // Helper function to format milliseconds to SRT time format ( hh:mm:ss, ms )
  formatSRT(milliseconds) {
    const hours = Math.floor(milliseconds / 3600000);
    const minutes = Math.floor((milliseconds % 3600000) / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    const ms = milliseconds % 1000;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  }
}

module.exports = Spotify;
