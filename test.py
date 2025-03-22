from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
import asyncio
import aiohttp
import re
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
    def __init__(self, sp_dc, sp_key):
        self.sp_dc = sp_dc
        self.sp_key = sp_key
        self.auth_url = 'http://46.202.167.246:6060/token'
        self.base_api_url = 'https://api.spotify.com/v1/'
        self.lyrics_url = 'https://spclient.wg.spotify.com/color-lyrics/v2/track/'

    async def get_access_token(self):
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(self.auth_url, cookies={'sp_dc': self.sp_dc, 'sp_key': self.sp_key}) as response:
                    token_data = await response.json()
                    return token_data['token_data'][access_token]
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error fetching token: {str(e)}")

    async def get_track_details(self, access_token, track_url):
        try:
            track_id = self.extract_track_id(track_url)
            track_api_url = f"{self.base_api_url}tracks/{track_id}"
            headers = {'Authorization': f'Bearer {access_token}', 'Content-Type': 'application/json'}
            async with aiohttp.ClientSession() as session:
                async with session.get(track_api_url, headers=headers) as response:
                    return await response.json()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error fetching track details: {str(e)}")

    async def get_lyrics(self, access_token, track_url):
        try:
            track_id = self.extract_track_id(track_url)
            url = f'{self.lyrics_url}{track_id}?format=json&market=from_token'
            headers = {'Authorization': f'Bearer {access_token}', 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.0.0 Safari/537.36', 'App-platform': 'WebPlayer'}
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers) as response:
                    return await response.json()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error fetching lyrics: {str(e)}")

    def extract_track_id(self, track_url):
        match = re.search(r'track/([a-zA-Z0-9]+)', track_url)
        return match.group(1) if match else None

    async def fetch_data(self, track_url):
        access_token = await self.get_access_token()
        track_details, lyrics = await asyncio.gather(
            self.get_track_details(access_token, track_url),
            self.get_lyrics(access_token, track_url)
        )
        formatted_response = {
            "status": "success",
            "details": self.format_track_details(track_details),
            "lyrics": self.get_combined_lyrics(lyrics['lyrics']['lines']) if 'lyrics' in lyrics else "No lyrics available",
            "lines": lyrics['lyrics']['lines'] if 'lyrics' in lyrics else "No lyrics lines available"
        }
        return formatted_response

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

# FastAPI Route
@app.post("/spotify/lyrics", response_model=TrackResponse)
@app.get("/spotify/lyrics", response_model=TrackResponse)
async def get_song_details(request: Optional[TrackRequest] = None, id: str = None, track_url: str = None, url: str = None):
    sp_dc = "AQBfZF-Im6xP-vFXlqnaJVnPbWgJ8ui7MeSvtLnK5qYByRu9Yvpl7Vc-nxBySHBNryQuMfWLqffcuRWJN8E7F1Zk4Hj1NAFkObJ5TbJqkg5wfTx4aPgfpbQN98eeYVvHKPENvEoUVjECHwZMLiWqcikFaiIvJHgPRn-h8RTTSeEM7LrWRyZ34V-VOKPVOLheENAZP4UQ8R3whLKOoldtWW-g6Z3_"
    sp_key = "890acd67-3e50-4709-89ab-04e794616352"
    spotify = Spotify(sp_dc, sp_key)
    
    # Determine the track URL from the request body or query parameters
    track_url_to_use = None
    if track_url:
        track_url_to_use = track_url
    elif id:
        track_url_to_use = f'https://open.spotify.com/track/{id}'
    elif url:
        track_url_to_use = url
    elif request and request.track_url:
        track_url_to_use = request.track_url
    else:
        raise HTTPException(status_code=400, detail="Either track_url, id, or url must be provided")
    
    response = await spotify.fetch_data(track_url_to_use)
    return response
