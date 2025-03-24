from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import asyncio
import aiohttp
import re
from datetime import timedelta
from fastapi.responses import StreamingResponse
from io import BytesIO

app = FastAPI()

class TrackRequest(BaseModel):
    track_url: str

class Spotify:
    def __init__(self, sp_dc, sp_key):
        self.sp_dc = sp_dc
        self.sp_key = sp_key
        self.auth_url = 'http://46.202.167.246:6060/token'
        self.base_api_url = 'https://api.spotify.com/v1/'
        self.lyrics_url = 'https://spotify-lyrics-api-pi.vercel.app?trackid='

    async def get_access_token(self):
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(self.auth_url, cookies={'sp_dc': self.sp_dc, 'sp_key': self.sp_key}) as response:
                    token_data = await response.json()
                    return token_data['token_data']['access_token']
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
            headers = {'Authorization': f'Bearer {access_token}', 'User-Agent': 'Mozilla/5.0', 'App-platform': 'WebPlayer'}
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers) as response:
                    return await response.json()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error fetching lyrics: {str(e)}")

    def extract_track_id(self, track_url):
        match = re.search(r'track/([a-zA-Z0-9]+)', track_url)
        return match.group(1) if match else None

    async def fetch_data(self, track_url, response_type=None):
        access_token = await self.get_access_token()
        track_details, lyrics = await asyncio.gather(
            self.get_track_details(access_token, track_url),
            self.get_lyrics(access_token, track_url)
        )
        combined_lyrics = self.get_combined_lyrics(lyrics['lyrics']['lines'], response_type) if 'lyrics' in lyrics else "No lyrics available"
        formatted_response = {
            "status": "success",
            "details": self.format_track_details(track_details),
            "lyrics": combined_lyrics,
            "raw": lyrics['lyrics'] if 'lyrics' in lyrics else "No raw lyrics available"
        }
        return formatted_response, combined_lyrics

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
            'track_url': track_details['external_urls']['spotify'],
            'popularity': track_details['popularity']
        }

    def format_duration(self, duration_ms):
        return str(timedelta(milliseconds=duration_ms))

    def get_combined_lyrics(self, lyrics, response_type=None):
        if response_type == 'lrc':
            lrc_lines = []
            for line in lyrics:
                start_time = int(line['startTimeMs']) / 1000
                formatted_time = f"[{timedelta(seconds=start_time)}]".replace('000', '').replace('days, ', '')
                lrc_lines.append(f"{formatted_time} {line['words']}")
            return '\n'.join(lrc_lines)
        return '\n'.join([line['words'] for line in lyrics])

@app.get("/spotify/lyrics", response_model=None)
async def get_song_details(id: str = None, url: str = None, type: str = None, download: bool = False):
    sp_dc = "YOUR_SP_DC"
    sp_key = "YOUR_SP_KEY"
    spotify = Spotify(sp_dc, sp_key)

    track_url_to_use = None
    if id:
        track_url_to_use = f'https://open.spotify.com/track/{id}'
    elif url:
        track_url_to_use = url
    else:
        raise HTTPException(status_code=400, detail="Either 'id' or 'url' must be provided")

    response, combined_lyrics = await spotify.fetch_data(track_url_to_use, type)

    if download and type == 'lrc':
        # Create the .lrc file content
        track_details = response['details']
        lrc_header = f"[ar:{track_details['artists']}]\n[al:{track_details['album']}]\n[ti:{track_details['name']}]\n[length:{track_details['duration']}]\n\n"
        lrc_content = lrc_header + combined_lyrics

        # Stream the content as an attachment
        lrc_file = BytesIO(lrc_content.encode('utf-8'))
        headers = {
            'Content-Disposition': f'attachment; filename="{track_details["name"]}.lrc"'
        }
        return StreamingResponse(lrc_file, headers=headers, media_type="application/octet-stream")

    # Return the normal JSON response
    return response
