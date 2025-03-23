import aiohttp
import asyncio
import re
import json
from datetime import timedelta
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, Response
from typing import Optional
import os

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
        minutes = duration_ms // 60000
        seconds = (duration_ms % 60000) // 1000
        milliseconds = (duration_ms % 1000)
        return f"{minutes:02}:{seconds:02}.{milliseconds:03}"

    def combine_lyrics(self, lyrics_lines):
        """Combines lyrics into a full string with newline characters."""
        if lyrics_lines:
            return "\n".join([line['words'] for line in lyrics_lines if 'words' in line])
        return "No lyrics available"

    def format_lyrics_as_lrc(self, lyrics_lines):
        """Formats the lyrics into LRC format with timestamps."""
        if not lyrics_lines:
            return "No lyrics available"
        
        lrc_lines = []
        for line in lyrics_lines:
            start_time = int(line['startTimeMs'])
            minutes = start_time // 60000
            seconds = (start_time % 60000) // 1000
            milliseconds = start_time % 1000
            timestamp = f"[{minutes:02}:{seconds:02}.{milliseconds:03}]"
            lrc_lines.append(f"{timestamp}{line['words']}")
        
        return "\n".join(lrc_lines)

    def format_lyrics_for_download(self, track_details, lyrics_lines):
        """Formats the lyrics with metadata for LRC download."""
        lrc_content = f"[ar:{track_details['artists']}]\n"
        lrc_content += f"[al:{track_details['album']}]\n"
        lrc_content += f"[ti:{track_details['title']}]\n"
        lrc_content += f"[length:{self.format_duration(track_details['duration_ms'])}]\n\n"
        
        for line in lyrics_lines:
            start_time = int(line['startTimeMs'])
            minutes = start_time // 60000
            seconds = (start_time % 60000) // 1000
            milliseconds = start_time % 1000
            timestamp = f"[{minutes:02}:{seconds:02}.{milliseconds:03}]"
            lrc_content += f"{timestamp}{line['words']}\n"
        
        return lrc_content

async def fetch_lyrics_and_details(track_id, response_type="text", download=False):
    sp_dc = "AQBfZF-Im6xP-vFXlqnaJVnPbWgJ8ui7MeSvtLnK5qYByRu9Yvpl7Vc-nxBySHBNryQuMfWLqffcuRWJN8E7F1Zk4Hj1NAFkObJ5TbJqkg5wfTx4aPgfpbQN98eeYVvHKPENvEoUVjECHwZMLiWqcikFaiIvJHgPRn-h8RTTSeEM7LrWRyZ34V-VOKPVOLheENAZP4UQ8R3whLKOoldtWW-g6Z3_"
    sp_key = "890acd67-3e50-4709-89ab-04e794616352"

    spotify = Spotify(sp_dc, sp_key)
    access_token = await spotify.get_access_token()

    if access_token:
        track_details_task = spotify.get_track_details(access_token, track_id)
        lyrics_task = spotify.get_lyrics(access_token, track_id)

        track_details, lyrics_data = await asyncio.gather(track_details_task, lyrics_task)

        if track_details and lyrics_data and 'lyrics' in lyrics_data:
            if response_type == "lrc":
                formatted_lyrics = spotify.format_lyrics_as_lrc(lyrics_data['lyrics']['lines'])
            else:
                formatted_lyrics = spotify.combine_lyrics(lyrics_data['lyrics']['lines'])
            
            if download:
                # If download=true, format lyrics for LRC file and save to disk
                lrc_content = spotify.format_lyrics_for_download(track_details, lyrics_data['lyrics']['lines'])
                filename = f"{track_details['title']}.lrc"
                with open(filename, "w") as f:
                    f.write(lrc_content)
                
                return FileResponse(filename, media_type="text/plain", filename=filename)
            
            # Regular JSON response
            response = {
                "status": "success",
                "details": spotify.format_track_details(track_details),
                "lyrics": formatted_lyrics,
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

@app.get("/test")
async def get_lyrics(
    id: str = Query(None, description="Spotify track ID"),
    url: str = Query(None, description="Spotify track URL"),
    type: str = Query("text", description="Response type: text or lrc"),
    download: Optional[bool] = Query(False, description="If true, downloads LRC format")
):
    """
    Get lyrics and track details from a Spotify track URL or ID.
    
    - **id**: Spotify track ID.
    - **url**: Spotify track URL.
    - **type**: Optional. Response format: `text` (default) or `lrc` for LRC format.
    - **download**: Optional. If true, provides the lyrics as an LRC file.
    """
    if not id and not url:
        raise HTTPException(status_code=400, detail="You must provide either a track ID or URL")

    track_id = id if id else Spotify(None, None).extract_track_id(url)
    result = await fetch_lyrics_and_details(track_id, response_type=type, download=download)
    return result
