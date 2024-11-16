from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
import requests
import json
import re

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

@app.get("/spotify/lyrics")
async def get_lyrics(id: str = None, url: str = None):
    # If URL is provided, extract track ID from it
    if url:
        id = extract_track_id_from_url(url)
    
    # If neither id nor url is provided, raise an error
    if not id:
        raise HTTPException(status_code=400, detail="Either 'id' or 'url' must be provided")

    # Define the API endpoint with the trackid parameter from the query
    api_url = f"https://spotify-lyrics-api-pi.vercel.app?trackid={id}&format=id3"
    
    # Send a request to the API
    response = requests.get(api_url)

    # Check if the request was successful
    if response.status_code == 200:
        data = response.json()

        # Initialize an empty string for full lyrics
        full_lyrics = ""

        # Initialize the raw lines (no modification)
        raw_lines = data.get("lines", [])

        # Check if there's no error in the response
        if not data.get("error", True):
            # Collect all lines and concatenate them into full_lyrics
            for line in raw_lines:
                words = line.get("words", "")
                full_lyrics += words + "\n"
            
            # Create the final response
            formatted_response = {
                "status": "success",
                "lyrics": full_lyrics.strip(),  # Remove trailing newline
                "lines": raw_lines  # Preserve the raw lines as they are
            }
        else:
            formatted_response = {"status": "error", "lyrics": "", "lines": []}
    else:
        formatted_response = {"status": "error", "lyrics": "", "lines": []}

    return JSONResponse(content=formatted_response)
