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
        self.request_count = 0

    async def get_access_token(self):
        if self.access_token and time.time() < self.access_token_expiration - 10 and self.request_count < 5:
            self.request_count += 1
            return self.access_token
        params = self.get_server_time_params()
        headers = {'User-Agent': 'Mozilla/5.0', 'Cookie': f'sp_dc={self.sp_dc}'}
        async with aiohttp.ClientSession() as session:
            async with session.get(self.auth_url, headers=headers, params=params) as response:
                if response.status == 200:
                    token_data = await response.json()
                    self.access_token = token_data['accessToken']
                    self.access_token_expiration = token_data['accessTokenExpirationTimestampMs'] / 1000
                    self.request_count = 1
                    return self.access_token
                else:
                    raise HTTPException(status_code=response.status, detail="Failed to retrieve access token")

    def get_server_time_params(self):
        processed = ''.join(map(str, [(byte ^ (i % 33 + 9)) for i, byte in enumerate([12, 56, 76, 33, 88, 44, 88, 33, 78, 78, 11, 66, 22, 22, 55, 69, 54])]))
        secret_base32 = base64.b32encode(processed.encode('utf-8')).decode('utf-8').rstrip('=')
        return {'reason': 'transport', 'productType': 'web_player', 'totp': self.generate_totp(secret_base32, int(time.time())), 'totpVer': '5', 'ts': str(int(time.time()))}

    def generate_totp(self, secret_base32, timestamp):
        counter_bytes = (timestamp // 30).to_bytes(8, 'big')
        hmac_hash = hmac.new(base64.b32decode(secret_base32.upper() + '=' * (-len(secret_base32) % 8)), counter_bytes, hashlib.sha1).digest()
        return str(int.from_bytes(hmac_hash[hmac_hash[-1] & 0xf:hmac_hash[-1] & 0xf + 4], 'big') & 0x7fffffff)[-6:]

    async def get_track_details(self, access_token, track_url):
        track_id = re.search(r'track/([a-zA-Z0-9]+)', track_url).group(1)
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{self.base_api_url}tracks/{track_id}", headers={'Authorization': f'Bearer {access_token}'}) as response:
                if response.status == 200:
                    return await response.json()
                elif response.status == 401:
                    access_token = await self.get_access_token()
                    async with session.get(f"{self.base_api_url}tracks/{track_id}", headers={'Authorization': f'Bearer {access_token}'}) as retry_response:
                        return await retry_response.json() if retry_response.status == 200 else self.raise_http_exception(retry_response)

    async def get_lyrics(self, access_token, track_url):
        track_id = re.search(r'track/([a-zA-Z0-9]+)', track_url).group(1)
        async with aiohttp.ClientSession() as session:
            async with session.get(f'{self.lyrics_url}{track_id}?format=json&market=from_token', headers={'Authorization': f'Bearer {access_token}'}) as response:
                if response.status == 200:
                    return await response.json()
                elif response.status == 401:
                    access_token = await self.get_access_token()
                    async with session.get(f'{self.lyrics_url}{track_id}?format=json&market=from_token', headers={'Authorization': f'Bearer {access_token}'}) as retry_response:
                        return await retry_response.json() if retry_response.status == 200 else self.raise_http_exception(retry_response)

    def raise_http_exception(self, response):
        raise HTTPException(status_code=response.status, detail="Failed to retrieve data")

    async def fetch_data(self, track_url):
        access_token = await self.get_access_token()
        track_details, lyrics = await asyncio.gather(
            self.get_track_details(access_token, track_url),
            self.get_lyrics(access_token, track_url)
        )
        return {
            "status": "success",
            "details": {
                'name': track_details['name'],
                'artists': track_details['artists'][0]['name'],
                'album': track_details['album']['name'],
                'release_date': track_details['album']['release_date'],
                'duration': str(timedelta(milliseconds=track_details['duration_ms'])),
                'image_url': track_details['album']['images'][0]['url'],
                'popularity': track_details['popularity']
            },
            "lyrics": '\n'.join([line['words'] for line in lyrics['lyrics']['lines']]) if 'lyrics' in lyrics else "No lyrics available",
            "lines": lyrics['lyrics']['lines'] if 'lyrics' in lyrics else []
        }

@app.post("/test", response_model=TrackResponse)
@app.get("/test", response_model=TrackResponse)
async def get_song_details(request: Optional[TrackRequest] = None, id: str = None, track_url: str = None, url: str = None):
    sp_dc = "AQBfZF-Im6xP-vFXlqnaJVnPbWgJ8ui7MeSvtLnK5qYByRu9Yvpl7Vc-nxBySHBNryQuMfWLqffcuRWJN8E7F1Zk4Hj1NAFkObJ5TbJqkg5wfTx4aPgfpbQN98eeYVvHKPENvEoUVjECHwZMLiWqcikFaiIvJHgPRn-h8RTTSeEM7LrWRyZ34V-VOKPVOLheENAZP4UQ8R3whLKOoldtWW-g6Z3_"
    spotify = Spotify(sp_dc)

    track_url_to_use = track_url or f'https://open.spotify.com/track/{id}' if id else url if url else request.track_url
    if not track_url_to_use:
        raise HTTPException(status_code=400, detail="Either track_url, id, or url must be provided")

    try:
        response = await spotify.fetch_data(track_url_to_use)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail="Unknown error")

    return response
