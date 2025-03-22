from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import requests
import json
import time
import base64
import hmac
import hashlib
from binascii import unhexlify
from typing import List

app = FastAPI()

SP_DC = "AQBfZF-Im6xP-vFXlqnaJVnPbWgJ8ui7MeSvtLnK5qYByRu9Yvpl7Vc-nxBySHBNryQuMfWLqffcuRWJN8E7F1Zk4Hj1NAFkObJ5TbJqkg5wfTx4aPgfpbQN98eeYVvHKPENvEoUVjECHwZMLiWqcikFaiIvJHgPRn-h8RTTSeEM7LrWRyZ34V-VOKPVOLheENAZP4UQ8R3whLKOoldtWW-g6Z3_"
SP_KEY = "890acd67-3e50-4709-89ab-04e794616352"
CACHE_FILE = "/tmp/spotify_token.json"

def generate_totp(server_time_seconds):
    secret_cipher = [12, 56, 76, 33, 88, 44, 88, 33, 78, 78, 11, 66, 22, 22, 55, 69, 54]
    processed = ''.join([chr(byte ^ (i % 33 + 9)) for i, byte in enumerate(secret_cipher)])
    secret_bytes = unhexlify(processed.encode('utf-8'))
    secret_base32 = base64.b32encode(secret_bytes).decode().rstrip('=')
    counter = int(server_time_seconds // 30)
    mac = hmac.new(secret_base32.encode(), counter.to_bytes(8, 'big'), hashlib.sha1).digest()
    offset = mac[-1] & 0xf
    code = (int.from_bytes(mac[offset:offset+4], 'big') & 0x7fffffff) % 10**6
    return f"{code:06}"

def get_server_time_params():
    response = requests.get("https://open.spotify.com/server-time")
    server_time_data = response.json()
    server_time_seconds = server_time_data['serverTime']
    totp = generate_totp(server_time_seconds)
    timestamp = str(int(time.time()))
    return {
        'reason': 'transport',
        'productType': 'web_player',
        'totp': totp,
        'totpVer': '5',
        'ts': timestamp,
    }

def get_token():
    if not SP_DC:
        raise HTTPException(status_code=400, detail="SP_DC is not set.")
    params = get_server_time_params()
    headers = {
        'User-Agent': 'Mozilla/5.0',
        'Cookie': f'sp_dc={SP_DC}'
    }
    response = requests.get('https://open.spotify.com/get_access_token', headers=headers, params=params)
    if response.status_code != 200:
        raise HTTPException(status_code=500, detail="Token request failed.")
    token_data = response.json()
    if token_data.get('isAnonymous'):
        raise HTTPException(status_code=400, detail="Invalid SP_DC.")
    with open(CACHE_FILE, 'w') as f:
        json.dump(token_data, f)

def check_token_expire():
    if not CACHE_FILE:
        get_token()
    with open(CACHE_FILE) as f:
        token_data = json.load(f)
    time_left = token_data['accessTokenExpirationTimestampMs']
    if int(time.time() * 1000) >= time_left:
        get_token()

@app.get("/spotify/lyrics")
def get_lyrics(id: str = None, url: str = None):
    track_id = id if id else url.split('/')[-1]
    check_token_expire()
    with open(CACHE_FILE) as f:
        token_data = json.load(f)
    token = token_data['accessToken']
    lyrics_url = f"https://spclient.wg.spotify.com/color-lyrics/v2/track/{track_id}?format=json&market=from_token"
    headers = {
        'User-Agent': 'Mozilla/5.0',
        'authorization': f'Bearer {token}'
    }
    response = requests.get(lyrics_url, headers=headers)
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail="Failed to fetch lyrics.")
    return response.json()

def format_ms(milliseconds):
    th_secs = milliseconds // 1000
    return f"{th_secs // 60:02}:{th_secs % 60:02}.{(milliseconds % 1000) // 10:02}"

def format_srt(milliseconds):
    hours = milliseconds // 3600000
    minutes = (milliseconds % 3600000) // 60000
    seconds = (milliseconds % 60000) // 1000
    ms = milliseconds % 1000
    return f"{hours:02}:{minutes:02}:{seconds:02},{ms:03}"

@app.get("/spotify/lyrics/lrc")
def get_lrc_lyrics(id: str):
    lyrics_data = get_lyrics(id)
    lrc = [{"timeTag": format_ms(line['startTimeMs']), "words": line['words']} for line in lyrics_data['lines']]
    return lrc

@app.get("/spotify/lyrics/srt")
def get_srt_lyrics(id: str):
    lyrics_data = get_lyrics(id)
    srt = [{"index": i+1, "startTime": format_srt(lyrics_data['lines'][i-1]['startTimeMs']),
            "endTime": format_srt(lyrics_data['lines'][i]['startTimeMs']),
            "words": lyrics_data['lines'][i-1]['words']} for i in range(1, len(lyrics_data['lines']))]
    return srt
