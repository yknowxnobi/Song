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
    def __init__(self):
        self.auth_url = 'http://46.202.167.246:6060/token'
        self.base_api_url = 'https://api.spotify.com/v1/'
        self.lyrics_url = 'https://spclient.wg.spotify.com/color-lyrics/v2/track/'

    async def get_access_token(self):
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(self.auth_url) as response:
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
            headers = {
                'Authorization': f'Bearer {access_token}',
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.0.0 Safari/537.36',
                'App-platform': 'WebPlayer'
            }
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers) as response:
                    return await response.json()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error fetching lyrics: {str(e)}")

    def extract_track_id(self, track_url):
        match = re.search(r'track/([a-zA-Z0-9]+)', track_url)
        return match.group(1) if match else None

    async def fetch_data(self, track_url, lyrics_type='json'):
        access_token = await self.get_access_token()
        track_details, lyrics_data = await asyncio.gather(
            self.get_track_details(access_token, track_url),
            self.get_lyrics(access_token, track_url)
        )

        if lyrics_type == 'lrc':
            formatted_lyrics = self.get_lrc_lyrics(lyrics_data['lyrics']['lines'])
        elif lyrics_type == 'srt':
            formatted_lyrics = self.get_srt_lyrics(lyrics_data['lyrics']['lines'])
        else:
            formatted_lyrics = self.get_combined_lyrics(lyrics_data['lyrics']['lines'])

        formatted_response = {
            "status": "success",
            "details": self.format_track_details(track_details),
            "lyrics": formatted_lyrics,
            "lines": lyrics_data['lyrics']['lines'] if 'lyrics' in lyrics_data else "No lyrics lines available"
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

    def get_lrc_lyrics(self, lyrics):
        lrc = []
        for lines in lyrics:
            lrctime = self.format_ms(int(lines['startTimeMs']))
            lrc.append({'timeTag': lrctime, 'words': lines['words']})
        return lrc

    def get_srt_lyrics(self, lyrics):
        srt = []
        for i in range(1, len(lyrics)):
            srttime = self.format_srt(int(lyrics[i-1]['startTimeMs']))
            srtendtime = self.format_srt(int(lyrics[i]['startTimeMs']))
            srt.append({'index': i, 'startTime': srttime, 'endTime': srtendtime, 'words': lyrics[i-1]['words']})
        return srt

    def format_ms(self, milliseconds):
        th_secs = int(milliseconds / 1000)
        lrc_timetag = '{:02}:{:02}.{:02}'.format(th_secs // 60, th_secs % 60, (milliseconds % 1000) // 10)
        return lrc_timetag

    def format_srt(self, milliseconds):
        hours = milliseconds // 3600000
        minutes = (milliseconds % 3600000) // 60000
        seconds = (milliseconds % 60000) // 1000
        milliseconds = milliseconds % 1000
        return '{:02}:{:02}:{:02},{:03d}'.format(hours, minutes, seconds, milliseconds)

@app.post("/test", response_model=TrackResponse)
@app.get("/test", response_model=TrackResponse)
async def get_song_details(request: Optional[TrackRequest] = None, id: str = None, track_url: str = None, url: str = None, lyrics_type: str = 'json'):
    spotify = Spotify()

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

    response = await spotify.fetch_data(track_url_to_use, lyrics_type=lyrics_type)
    return response
