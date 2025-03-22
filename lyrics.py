from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import asyncio
import aiohttp
import re
import time
import base64
import hmac
import hashlib
from datetime import timedelta

app = FastAPI()

class TrackRequest(BaseModel):
    track_url: str

class TrackResponse(BaseModel):
    status: str
    details: dict
    lyrics: str
    lines: list

class Spotify:
    def __init__(self, sp_dc):
        self.sp_dc = sp_dc
        self.auth_url = 'https://open.spotify.com/get_access_token'
        self.base_api_url = 'https://api.spotify.com/v1/'
        self.lyrics_url = 'https://spclient.wg.spotify.com/color-lyrics/v2/track/'
        self.server_time_url = 'https://open.spotify.com/server-time'
        self.access_token = None
        self.access_token_expiration = 0

    async def get_access_token(self):
        if self.access_token and time.time() < self.access_token_expiration - 10:
            return self.access_token

        params = self.get_server_time_params()
        headers = {'User-Agent': 'Mozilla/5.0', 'Cookie': f'sp_dc={self.sp_dc}'}
        async with aiohttp.ClientSession() as session:
            async with session.get(self.auth_url, headers=headers, params=params) as response:
                token_data = await response.json()
                if 'accessToken' in token_data:
                    self.access_token = token_data['accessToken']
                    self.access_token_expiration = token_data['accessTokenExpirationTimestampMs'] / 1000
                    return self.access_token
                else:
                    raise HTTPException(status_code=500, detail="Failed to retrieve access token")

    def get_server_time_params(self):
        response = requests.get(self.server_time_url)
        server_time_data = response.json()
        server_time_seconds = server_time_data['serverTime']
        secret_cipher = [12, 56, 76, 33, 88, 44, 88, 33, 78, 78, 11, 66, 22, 22, 55, 69, 54]
        processed = [(byte ^ (i % 33 + 9)) for i, byte in enumerate(secret_cipher)]
        processed_str = ''.join(map(str, processed))
        secret_bytes = processed_str.encode('utf-8')
        secret_base32 = base64.b32encode(secret_bytes).decode('utf-8').rstrip('=')
        totp = self.generate_totp(secret_base32, server_time_seconds)
        timestamp = int(time.time())
        return {'reason': 'transport', 'productType': 'web_player', 'totp': totp, 'totpVer': '5', 'ts': str(timestamp)}

    def generate_totp(self, secret_base32, timestamp):
        counter = timestamp // 30
        counter_bytes = counter.to_bytes(8, 'big')
        secret_bytes = base64.b32decode(secret_base32.upper() + '=' * (-len(secret_base32) % 8))
        hmac_hash = hmac.new(secret_bytes, counter_bytes, hashlib.sha1).digest()
        offset = hmac_hash[-1] & 0xf
        truncated_hash = hmac_hash[offset:offset + 4]
        code = int.from_bytes(truncated_hash, 'big') & 0x7fffffff
        return str(code)[-6:]

    async def get_track_details(self, access_token, track_url):
        track_id = self.extract_track_id(track_url)
        track_api_url = f"{self.base_api_url}tracks/{track_id}"
        headers = {'Authorization': f'Bearer {access_token}', 'Content-Type': 'application/json'}
        async with aiohttp.ClientSession() as session:
            async with session.get(track_api_url, headers=headers) as response:
                return await response.json()

    async def get_lyrics(self, access_token, track_url):
        track_id = self.extract_track_id(track_url)
        url = f'{self.lyrics_url}{track_id}?format=json&market=from_token'
        headers = {'Authorization': f'Bearer {access_token}', 'User-Agent': 'Mozilla/5.0', 'App-platform': 'WebPlayer'}
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers) as response:
                return await response.json()

    def extract_track_id(self, track_url):
        match = re.search(r'track/([a-zA-Z0-9]+)', track_url)
        return match.group(1) if match else None

    async def fetch_data(self, track_url):
        access_token = await self.get_access_token()
        track_details, lyrics = await asyncio.gather(
            self.get_track_details(access_token, track_url),
            self.get_lyrics(access_token, track_url)
        )
        return {
            "status": "success",
            "details": self.format_track_details(track_details),
            "lyrics": self.get_combined_lyrics(lyrics['lyrics']['lines']) if 'lyrics' in lyrics else "No lyrics available",
            "lines": lyrics['lyrics']['lines'] if 'lyrics' in lyrics else "No lyrics lines available"
        }

    def format_track_details(self, track_details):
        return {
            'name': track_details['name'],
            'title': track_details['name'],
            'artists': track_details['artists'][0]['name'],
            'album': track_details['album']['name'],
            'release_date': track_details['album']['release_date'],
            'duration': self.format_duration(track_details['duration_ms']),
            'duration_ms': track_details['duration_ms'],
            'image_url': track_details['album']['images'][0]['url'],
            'cover': track_details['album']['images'][0]['url'],
            'track_url': track_details['external_urls']['spotify'],
            'popularity': track_details['popularity']
        }

    def format_duration(self, duration_ms):
        return str(timedelta(milliseconds=duration_ms))

    def get_combined_lyrics(self, lyrics):
        return '\n'.join([line['words'] for line in lyrics])

@app.post("/spotify/lyrics", response_model=TrackResponse)
@app.get("/spotify/lyrics", response_model=TrackResponse)
async def get_song_details(request: Optional[TrackRequest] = None, id: str = None, track_url: str = None, url: str = None):
    sp_dc = "AQBfZF-Im6xP-vFXlqnaJVnPbWgJ8ui7MeSvtLnK5qYByRu9Yvpl7Vc-nxBySHBNryQuMfWLqffcuRWJN8E7F1Zk4Hj1NAFkObJ5TbJqkg5wfTx4aPgfpbQN98eeYVvHKPENvEoUVjECHwZMLiWqcikFaiIvJHgPRn-h8RTTSeEM7LrWRyZ34V-VOKPVOLheENAZP4UQ8R3whLKOoldtWW-g6Z3_"
    spotify = Spotify(sp_dc)

    track_url_to_use = track_url or f'https://open.spotify.com/track/{id}' if id else url if url else request.track_url
    if not track_url_to_use:
        raise HTTPException(status_code=400, detail="Either track_url, id, or url must be provided")

    try:
        response = await spotify.fetch_data(track_url_to_use)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return response
