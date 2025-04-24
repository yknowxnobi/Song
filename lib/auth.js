const axios = require('axios');

async function getToken() {
  const url = "https://clienttoken.spotify.com/v1/clienttoken";
  
  const payload = {
    client_data: {
      client_version: "1.2.60.345.g460c2dc4",
      client_id: "d8a5ed958d274c2e8ee717e6a4b0971d",
      js_sdk_data: {
        device_brand: "unknown",
        device_model: "unknown",
        os: "linux",
        os_version: "unknown",
        device_id: "5592d43a-d6b7-41fd-9151-0813a5190078",
        device_type: "computer"
      }
    }
  };

  const headers = {
    'User-Agent': "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
    'Accept': "application/json",
    'Accept-Encoding': "gzip, deflate, br, zstd",
    'Content-Type': "application/json",
    'sec-ch-ua-platform': "\"Linux\"",
    'sec-ch-ua': "\"Not(A:Brand\";v=\"99\", \"Google Chrome\";v=\"133\", \"Chromium\";v=\"133\"",
    'dnt': "1",
    'sec-ch-ua-mobile': "?0",
    'origin': "https://open.spotify.com",
    'sec-fetch-site': "same-site",
    'sec-fetch-mode': "cors",
    'sec-fetch-dest': "empty",
    'referer': "https://open.spotify.com/",
    'accept-language': "en-US,en;q=0.9,bn;q=0.8,ru;q=0.7,zh-CN;q=0.6,zh;q=0.5,hi;q=0.4,la;q=0.3",
    'priority': "u=1, i"
  };

  try {
    const response = await axios.post(url, payload, { headers });
    return response.data;
  } catch (error) {
    console.error('Error getting token:', error);
    throw error;
  }
}

module.exports = { getToken };
