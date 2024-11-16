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

# Asynchronous function to fetch metadata
async def fetch_metadata(track_id: str) -> dict:
    url = f"https://api.spotifydown.com/metadata/track/{track_id}"
    headers = {
        'sec-ch-ua-platform': '"Android"',
        'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
        'accept': '*/*',
        'origin': 'https://spotifydown.com',
        'referer': 'https://spotifydown.com/',
        'accept-language': 'en-US,en;q=0.9',
    }
    async with aiohttp.ClientSession() as session:
        async with session.get(url, headers=headers) as response:
            if response.status == 200:
                return await response.json()
            return {}

@app.get("/spotify/lyrics")
async def get_lyrics(id: str = None, url: str = None):
    # If URL is provided, extract track ID from it
    if url:
        id = extract_track_id_from_url(url)
    
    # If neither id nor url is provided, raise an error
    if not id:
        raise HTTPException(status_code=400, detail="Either 'id' or 'url' must be provided")

    # Define the API endpoint for lyrics with the trackid parameter
    api_url = f"https://spotify-lyrics-api-pi.vercel.app?trackid={id}&format=id3"
    
    # Initialize the requests in parallel using asyncio
    async with aiohttp.ClientSession() as session:
        # Fetch lyrics and metadata concurrently
        lyrics_task = session.get(api_url)
        metadata_task = fetch_metadata(id)

        lyrics_response = await lyrics_task
        metadata_response = await metadata_task

        # Check if the lyrics request was successful
        if lyrics_response.status == 200:
            lyrics_data = await lyrics_response.json()

            # Initialize an empty string for full lyrics
            full_lyrics = ""
            raw_lines = lyrics_data.get("lines", [])

            # Check if there's no error in the lyrics response
            if not lyrics_data.get("error", True):
                for line in raw_lines:
                    words = line.get("words", "")
                    full_lyrics += words + "\n"
                
                # Prepare the final response
                formatted_response = {
                    "status": "success",
                    "details": metadata_response,
                    "lyrics": full_lyrics.strip(),
                    "lines": raw_lines
                }
            else:
                formatted_response = {"status": "error", "lyrics": "", "lines": [], "metadata": metadata_response}
        else:
            formatted_response = {"status": "error", "lyrics": "", "lines": [], "metadata": metadata_response}

    return JSONResponse(content=formatted_response)
