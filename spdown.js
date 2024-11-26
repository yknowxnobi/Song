from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import httpx
from bs4 import BeautifulSoup
import asyncio

app = FastAPI()

async def scrape_and_post(url: str, spotify_url: str) -> str:
    headers = {
        'Cache-Control': 'max-age=0',
        'Sec-CH-UA': '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
        'Sec-CH-UA-Mobile': '?1',
        'Sec-CH-UA-Platform': '"Android"',
        'DNT': '1',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-User': '?1',
        'Sec-Fetch-Dest': 'document',
        'Accept-Language': 'en-US,en;q=0.9,bn;q=0.8,ru;q=0.7,zh-CN;q=0.6,zh;q=0.5,hi;q=0.4',
        'Cookie': '_ga=GA1.1.937952067.1720283735; session_data=br0po1n5iqfu8trkjceasu4ki9;',
        'Priority': 'u=1, i',
        'Referer': 'https://spotifymate.com/en'
    }

    async with httpx.AsyncClient(http2=True) as client:
        try:
            # Fetch the page
            response = await client.get(url, headers=headers)
            response.raise_for_status()

            # Parse HTML content
            soup = BeautifulSoup(response.text, 'html.parser')

            # Extract the hidden input field
            hidden_input = soup.find('input', {'type': 'hidden'})
            if hidden_input:
                hidden_name = hidden_input.get('name')
                hidden_value = hidden_input.get('value')

                # Prepare POST request data
                post_data = (
                    f'------WebKitFormBoundaryiK6ymnqnBNvzaSZq\r\n'
                    f'Content-Disposition: form-data; name="url"\r\n\r\n'
                    f'{spotify_url}\r\n'
                    f'------WebKitFormBoundaryiK6ymnqnBNvzaSZq\r\n'
                    f'Content-Disposition: form-data; name="{hidden_name}"\r\n\r\n'
                    f'{hidden_value}\r\n'
                    f'------WebKitFormBoundaryiK6ymnqnBNvzaSZq--\r\n'
                )

                post_headers = {
                    'Host': 'spotifymate.com',
                    'Content-Length': str(len(post_data)),
                    'Sec-CH-UA': '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
                    'Sec-CH-UA-Platform': '"Android"',
                    'DNT': '1',
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
                    'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundaryiK6ymnqnBNvzaSZq',
                    'Accept': '*/*',
                    'Origin': 'https://spotifymate.com',
                    'Sec-Fetch-Site': 'same-origin',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Dest': 'empty',
                    'Referer': 'https://spotifymate.com/en',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Accept-Language': 'en-US,en;q=0.9,bn;q=0.8,ru;q=0.7,zh-CN;q=0.6,zh;q=0.5,hi;q=0.4',
                    'Cookie': '_ga=GA1.1.937952067.1720283735; session_data=br0po1n5iqfu8trkjceasu4ki9;',
                    'Priority': 'u=1, i'
                }

                # Send POST request
                post_url = 'https://spotifymate.com/action'
                post_response = await client.post(post_url, headers=post_headers, content=post_data)
                post_response.raise_for_status()

                # Parse POST response
                post_soup = BeautifulSoup(post_response.text, 'html.parser')

                # Extract and return the specific download link
                download_link = post_soup.find('a', onclick='showAd();')
                if download_link:
                    link_href = download_link.get('href')
                    return link_href

            raise HTTPException(status_code=404, detail="Hidden input field not found")

        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=str(e))

async def get_track_metadata(track_id: str) -> dict:
    url = f"https://api.spotifydown.com/metadata/track/{track_id}"
    headers = {
        'sec-ch-ua-platform': '"Android"',
        'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
        'accept': '*/*',
        'origin': 'https://spotifydown.com',
        'referer': 'https://spotifydown.com/',
        'accept-language': 'en-US,en;q=0.9',
    }

    async with httpx.AsyncClient(http2=True) as client:
        try:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=str(e))

@app.get("/spotify")
async def scrape(spotify_url: str, track_id: str):
    url = 'https://spotifymate.com/en'

    # Run both tasks concurrently
    download_link, metadata = await asyncio.gather(
        scrape_and_post(url, spotify_url),
        get_track_metadata(track_id)
    )

    return {
        "download_link": download_link,
        "metadata": metadata,
        "credit": "https://t.me/Teleservices_Api",
        "Dev": "@soumyadeepdas765"
    }
