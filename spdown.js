import asyncio
import httpx
from bs4 import BeautifulSoup
import re

async def scrape_and_post(url: str, spotify_url: str) -> str:
    headers = {
        'Sec-CH-UA': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        'Sec-CH-UA-Mobile': '?1',
        'Sec-CH-UA-Platform': '"Android"',
        'DNT': '1',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': '*/*',
        'Origin': 'https://spotifymate.com',
        'Referer': 'https://spotifymate.com/en',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-User': '?1',
        'Sec-Fetch-Dest': 'document',
        'Accept-Language': 'en-US,en;q=0.9',
    }

    cookies = {
        "session_data": "1npg5osrtejnum5848d4qtr058",
        "_ga": "GA1.1.685286815.1739594562",
        "cf_clearance": "nj2uEjYb4EgaOnCrFugggEUkpb2NKylO.d5g_wBY5Og-1739596765-1.2.1.1-WADN6efQ5yKwt5KJN6Ohkb.pjRkG7tv4yP.5bs5_vBqEhg1s7JCyQyrVMfNHoWociV7t5S.0tarFs8Fw51GQ0io7ofI12fNSAbFtfazdLVenwFnhYXhS8VJ2ccw_FHwZTcAXef0BQzQLAWxLCxHSBDZlAFoqhQuWwxdGoGx6u.Y54lIVpjn_o0nG83ep9SMbyrGWsOxUtQDh_q.gK76018TIM9c93BCAJ7S6_Je972DzbTkA_NW3mQLs9qVhHYVhBPLtPbY2O7Yoo_zNcMs1Bv3BBa_CJ1Kd1BSIMDgP7n8",
    }

    async with httpx.AsyncClient(http2=True, timeout=10) as client:
        # Step 1: Scrape the page
        response = await client.get(url, headers=headers, cookies=cookies)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, 'html.parser')
        hidden_input = soup.find('input', {'type': 'hidden'})
        if not hidden_input:
            raise Exception("Hidden input field not found")

        hidden_name = hidden_input.get('name')
        hidden_value = hidden_input.get('value')

        # Step 2: Send POST request
        boundary = "----WebKitFormBoundaryYbqgfXooGwQAzaQH"
        post_data = (
            f"{boundary}\r\n"
            f'Content-Disposition: form-data; name="url"\r\n\r\n'
            f'{spotify_url}\r\n'
            f"{boundary}\r\n"
            f'Content-Disposition: form-data; name="{hidden_name}"\r\n\r\n'
            f'{hidden_value}\r\n'
            f"{boundary}--\r\n"
        )

        post_headers = headers.copy()
        post_headers.update({
            'Content-Length': str(len(post_data)),
            'Content-Type': f'multipart/form-data; boundary={boundary}',
        })

        post_url = 'https://spotifymate.com/action'
        post_response = await client.post(post_url, headers=post_headers, cookies=cookies, content=post_data)
        post_response.raise_for_status()

        # Step 3: Extract Download Link
        post_soup = BeautifulSoup(post_response.text, 'html.parser')
        download_link = post_soup.find('a', onclick='showAd();')

        if download_link:
            return download_link.get('href')

        raise Exception("Download link not found")
