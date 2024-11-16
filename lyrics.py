from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
import requests
import json
import re
import asyncio
import aiohttp

# Initialize the FastAPI app
app = FastAPI()

# Function to extract track ID from Spotify URL
def extract_track_id_from_url(url: str) -> str:
    # Regular expression to match Spotify track URL
    match = re.search(r"(https://open.spotify.com/track/)([a-zA-Z0-9]+)", url)
    if match:
        return match.group(2)
    else:
        raise HTTPException(status_code=400, detail="Invalid Spotify URL")

# Asynchronous function to fetch lyrics data
async def get_lyrics_data(track_id: str):
    api_url = f"https://spotify-lyrics-api-pi.vercel.app?trackid={track_id}&format=id3"
    async with aiohttp.ClientSession() as session:
        async with session.get(api_url) as response:
            if response.status == 200:
                data = await response.json()
                return data
            else:
                return {"status": "error", "lyrics": "", "lines": []}

# Asynchronous function to fetch metadata data
async def get_metadata_data(track_id: str):
    api_url = f"https://api.spotifydown.com/metadata/track/{track_id}"
    headers = {
        'sec-ch-ua-platform': '"Android"',
        'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
        'accept': '*/*',
        'origin': 'https://spotifydown.com',
        'referer': 'https://spotifydown.com/',
        'accept-language': 'en-US,en;q=0.9',
    }
    async with aiohttp.ClientSession() as session:
        async with session.get(api_url, headers=headers) as response:
            if response.status == 200:
                return await response.json()
            else:
                return {"status": "error", "metadata": {}}

@app.get("/spotify/lyrics")
async def get_lyrics(id: str = None, url: str = None):
    # If URL is provided, extract track ID from it
    if url:
        id = extract_track_id_from_url(url)
    
    # If neither id nor url is provided, raise an error
    if not id:
        raise HTTPException(status_code=400, detail="Either 'id' or 'url' must be provided")

    # Fetch both lyrics and metadata in parallel
    lyrics_data = await get_lyrics_data(id)
    metadata_data = await get_metadata_data(id)

    # Combine both responses into a single response
    if not lyrics_data.get("error", True) and not metadata_data.get("error", True):
        formatted_response = {
            "status": "success",
            "lyrics": lyrics_data.get("lyrics", ""),
            "lines": lyrics_data.get("lines", []),
            "metadata": metadata_data  # Include metadata in the response
        }
    else:
        formatted_response = {"status": "error", "lyrics": "", "lines": [], "metadata": {}}

    return JSONResponse(content=formatted_response)
