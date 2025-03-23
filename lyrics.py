import aiohttp
import asyncio
import re
import json
from datetime import timedelta
from fastapi import FastAPI, HTTPException, Query

app = FastAPI()

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
                    return token_data['token_data']['access_token']
        except Exception as e:
            print(f"Error fetching token: {str(e)}")
            return None

    async def get_track_details(self, access_token, track_id):
        try:
            track_api_url = f"{self.base_api_url}tracks/{track_id}"
            headers = {'Authorization': f'Bearer {access_token}', 'Content-Type': 'application/json'}
            async with aiohttp.ClientSession() as session:
                async with session.get(track_api_url, headers=headers) as response:
                    return await response.json()
        except Exception as e:
            print(f"Error fetching track details: {str(e)}")
            return None

    async def get_lyrics(self, access_token, track_id):
        try:
            url = f'{self.lyrics_url}{track_id}?format=json&market=from_token'
            headers = {
                'Authorization': f'Bearer {access_token}', 
                'User-Agent': 'Mozilla/5.0', 
                'App-platform': 'WebPlayer'
            }
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers) as response:
                    return await response.json()
        except Exception as e:
            print(f"Error fetching lyrics: {str(e)}")
            return None

    def extract_track_id(self, track_url):
        match = re.search(r'track/([a-zA-Z0-9]+)', track_url)
        return match.group(1) if match else track_url  # If it's already an ID

    def format_track_details(self, track_details):
        """Formats the track details into a structured JSON object."""
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

    def combine_lyrics(self, lyrics_lines):
        """Combines lyrics into a full string with newline characters."""
        if lyrics_lines:
            return "\n".join([line['words'] for line in lyrics_lines if 'words' in line])
        return "No lyrics available"

async def fetch_lyrics_and_details(track_id):
    sp_dc = "AQBfZF-Im6xP-vFXlqnaJVnPbWgJ8ui7MeSvtLnK5qYByRu9Yvpl7Vc-nxBySHBNryQuMfWLqffcuRWJN8E7F1Zk4Hj1NAFkObJ5TbJqkg5wfTx4aPgfpbQN98eeYVvHKPENvEoUVjECHwZMLiWqcikFaiIvJHgPRn-h8RTTSeEM7LrWRyZ34V-VOKPVOLheENAZP4UQ8R3whLKOoldtWW-g6Z3_"
    sp_key = "890acd67-3e50-4709-89ab-04e794616352"

    spotify = Spotify(sp_dc, sp_key)
    access_token = await spotify.get_access_token()

    if access_token:
        track_details_task = spotify.get_track_details(access_token, track_id)
        lyrics_task = spotify.get_lyrics(access_token, track_id)

        track_details, lyrics_data = await asyncio.gather(track_details_task, lyrics_task)

        if track_details and lyrics_data and 'lyrics' in lyrics_data:
            combined_lyrics = spotify.combine_lyrics(lyrics_data['lyrics']['lines'])
            response = {
                "status": "success",
                "details": spotify.format_track_details(track_details),
                "lyrics": combined_lyrics,
                "raw": lyrics_data['lyrics']
            }
        else:
            response = {
                "status": "failed",
                "details": "No track details available",
                "lyrics": "No lyrics available",
                "raw": "No raw lyrics data"
            }
        return response
    else:
        raise HTTPException(status_code=500, detail="Unable to fetch access token")

@app.get("/spotify/lyrics")
async def get_lyrics(id: str = Query(None, description="Spotify track ID"), url: str = Query(None, description="Spotify track URL")):
    """
    Get lyrics and track details from a Spotify track URL or ID.
    
    - **id**: Spotify track ID.
    - **url**: Spotify track URL.
    """
    if not id and not url:
        raise HTTPException(status_code=400, detail="You must provide either a track ID or URL")

    track_id = id if id else Spotify(None, None).extract_track_id(url)
    result = await fetch_lyrics_and_details(track_id)
    return result
