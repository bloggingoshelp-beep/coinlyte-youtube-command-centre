import urllib.request, urllib.parse, json, re, datetime, os
import xml.etree.ElementTree as ET

TODAY      = datetime.datetime.now().strftime("%b %d, %Y")
CID        = os.environ.get('YT_CLIENT_ID','')
CSEC       = os.environ.get('YT_CLIENT_SECRET','')
RTOK       = os.environ.get('YT_REFRESH_TOKEN','')
KEY        = os.environ.get('YT_API_KEY','')
ANTHROPIC_KEY = os.environ.get('ANTHROPIC_API_KEY','')
SUPABASE_URL = os.environ.get('SUPABASE_URL','')
SUPABASE_SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY','')
CHANNEL_ID = "UCaTJZv99ieTa6f5ht4gEXMA"
print(f"Secrets: CLIENT_ID={'SET' if CID else 'MISSING'} | SECRET={'SET' if CSEC else 'MISSING'} | REFRESH_TOKEN={'SET' if RTOK else 'MISSING'} | API_KEY={'SET' if KEY else 'MISSING'} | ANTHROPIC={'SET' if ANTHROPIC_KEY else 'MISSING'}")

def utc_now():
  return datetime.datetime.now(datetime.timezone.utc)

SCAM_WORDS = ['whatsapp','telegram','signal','dm me','message me','invest with me',
  'double your','guaranteed profit','profit of','trading expert','account manager',
  'recovery','lost funds','contact me','reach me','bit.ly','t.me','wa.me',
  'pump','signal group','join my','100x profit']

SCAM_AUTHOR_PREFIXES = ['oliv']
SCAM_AUTHOR_WORDS = ['whatsapp','telegram','signal','crypto help','trading expert',
  'investment coach','recovery agent','account manager','support team']
SCAM_TEXT_PATTERNS = [
  r'\+?\d[\d\s().-]{7,}\d',
  r'\b(text|reply|message|contact|reach)\s+(me|him|her|us)\b',
  r'\b(whats\s?app|telegram|signal)\b',
  r'\b(recover|recovery)\s+(your\s+)?(funds|money|wallet|account)\b',
  r'\bguaranteed\s+(profit|returns?)\b'
]

def is_scam(t): return any(s in t.lower() for s in SCAM_WORDS)

def is_scam_author(author):
  raw = (author or '').lower().strip()
  compact = re.sub(r'[^a-z0-9]+', '', raw)
  if any(compact.startswith(prefix) for prefix in SCAM_AUTHOR_PREFIXES):
    return True
  return any(word in raw for word in SCAM_AUTHOR_WORDS)

def is_scam_comment(text, author=''):
  if not text: return True
  if is_scam_author(author): return True
  if is_scam(text): return True
  lower = text.lower()
  return any(re.search(pattern, lower) for pattern in SCAM_TEXT_PATTERNS)

def comment_intent(t):
  t = t.lower()
  if '?' in t or any(w in t for w in ['kaise','how to','kya hai','what is','shuru','start']): return 'ask'
  if any(w in t for w in ['please make','video banao','cover karo','request','topic chahiye']): return 'idea'
  if any(w in t for w in ['thanks','great','amazing','best','bahut acha','loved it']): return 'praise'
  return 'concern'

def days_ago(iso):
  try:
    d = datetime.datetime.fromisoformat(iso.replace('Z','+00:00'))
    n = (datetime.datetime.now(datetime.timezone.utc) - d).days
    return 'Today' if n==0 else ('Yesterday' if n==1 else f'{n}d ago')
  except: return '-'

def safe_get(url, headers=None, timeout=15):
  try:
    req = urllib.request.Request(url, headers=headers or {'User-Agent':'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
      return r.read()
  except urllib.error.HTTPError as e:
    body = e.read().decode('utf-8', errors='ignore')[:300]
    try:
      err_json = json.loads(body)
      reason = err_json.get('error',{}).get('errors',[{}])[0].get('reason','?')
      msg = err_json.get('error',{}).get('message','?')
      print(f"  GET {e.code} {url[:55]}: reason={reason} | {msg}")
    except:
      print(f"  GET {e.code} {url[:55]}: {body[:120]}")
    return None
  except Exception as e:
    print(f"  GET failed {url[:60]}: {e}"); return None

def get_access_token():
  data = urllib.parse.urlencode({
    'client_id':CID,'client_secret':CSEC,
    'refresh_token':RTOK,'grant_type':'refresh_token'
  }).encode()
  try:
    req = urllib.request.Request('https://oauth2.googleapis.com/token', data=data,
          headers={'Content-Type':'application/x-www-form-urlencoded'})
    with urllib.request.urlopen(req, timeout=12) as r:
      return json.loads(r.read()).get('access_token','')
  except Exception as e:
    print(f"Token refresh error: {e}"); return ''

def analytics_get(path, token):
  raw = safe_get(f'https://youtubeanalytics.googleapis.com/v2/reports?{path}',
                 headers={'Authorization':f'Bearer {token}'})
  return json.loads(raw) if raw else {}

# ── Board memory for AI de-duplication ─────────────────────────────────────
TOPIC_STOPWORDS = {
  'the','and','for','with','from','this','that','your','what','why','how','will',
  'into','about','after','before','india','indian','crypto','video','full',
  'explained','guide','impact','news','update','investor','investors','price',
  'kya','kaise','hai','hain','hoga','hogi','liye','mein','main','par','aur',
  'se','ke','ka','ki','ko','ye','kare','karna','badlega','badlenge'
}

def topic_tokens(text):
  text = re.sub(r'https?://\S+', ' ', str(text or '').lower())
  text = re.sub(r'[^\w\u0900-\u097f₹$%]+', ' ', text)
  tokens = []
  for token in text.split():
    if len(token) < 3: continue
    if token in TOPIC_STOPWORDS: continue
    if token.isdigit(): continue
    tokens.append(token)
  return set(tokens)

def topic_similarity(a, b):
  ta, tb = topic_tokens(a), topic_tokens(b)
  if not ta or not tb: return 0
  return len(ta & tb) / max(1, min(len(ta), len(tb)))

def fetch_board_memory():
  empty = {'pipeline': [], 'savedRadar': [], 'dismissedIdeas': []}
  if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("Board memory: Supabase secrets missing — AI refresh will only use live-data history")
    return empty
  try:
    base = SUPABASE_URL.rstrip('/')
    url = f"{base}/rest/v1/app_state?key=eq.operational&select=data&limit=1"
    req = urllib.request.Request(url, headers={
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': f'Bearer {SUPABASE_SERVICE_ROLE_KEY}',
      'Content-Type': 'application/json'
    })
    with urllib.request.urlopen(req, timeout=12) as resp:
      rows = json.loads(resp.read())
      data = rows[0].get('data', {}) if rows else {}
      memory = {
        'pipeline': data.get('pipeline') or [],
        'savedRadar': data.get('savedRadar') or [],
        'dismissedIdeas': data.get('dismissedIdeas') or []
      }
      print(f"Board memory: {len(memory['pipeline'])} planner cards | {len(memory['savedRadar'])} saved radar | {len(memory['dismissedIdeas'])} dismissed ideas")
      return memory
  except Exception as e:
    print(f"Board memory unavailable: {e}")
    return empty

def memory_titles(board_memory, recent_titles=None):
  titles = []
  for card in board_memory.get('pipeline', []):
    if card.get('title'): titles.append(card['title'])
    if card.get('researchBrief'): titles.append(card['researchBrief'])
  for item in board_memory.get('savedRadar', []):
    if item.get('title'): titles.append(item['title'])
  for key in board_memory.get('dismissedIdeas', []):
    title = str(key).split('::', 1)[0].strip()
    if title: titles.append(title)
  titles.extend(recent_titles or [])
  out = []
  seen = set()
  for title in titles:
    clean = re.sub(r'\s+', ' ', str(title or '')).strip()
    if not clean: continue
    low = clean.lower()
    if low not in seen:
      seen.add(low)
      out.append(clean)
  return out

def summarize_memory_for_prompt(titles, limit=45):
  if not titles:
    return '- No shared board memory found'
  return '\n'.join(f'- {title[:140]}' for title in titles[:limit])

def is_memory_duplicate(title, blocked_titles, threshold=0.62):
  for blocked in blocked_titles:
    if topic_similarity(title, blocked) >= threshold:
      return blocked
  return ''

def dedupe_generated_ideas(ideas, blocked_titles):
  kept, seen_titles, source_counts = [], [], {}
  for idea in ideas or []:
    title = str(idea.get('title', '')).strip()
    if not title: continue
    blocked = is_memory_duplicate(title, blocked_titles)
    if blocked:
      print(f"  Drop duplicate idea: {title[:65]} ≈ {blocked[:65]}")
      continue
    if is_memory_duplicate(title, seen_titles, threshold=0.72):
      print(f"  Drop repeated generated cluster: {title[:65]}")
      continue
    source = str(idea.get('source', 'Unknown')).strip() or 'Unknown'
    source_counts[source] = source_counts.get(source, 0) + 1
    if source_counts[source] > 4:
      print(f"  Drop source overload ({source}): {title[:65]}")
      continue
    kept.append(idea)
    seen_titles.append(title)
    if len(kept) >= 15:
      break
  return kept

# ── RSS feed ───────────────────────────────────────────────────────────────
def rss_videos(channel_id, max_results=10):
  raw = safe_get(f'https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}')
  if not raw: return []
  try:
    root = ET.fromstring(raw)
    ns = {'yt':'http://www.youtube.com/xml/schemas/2015',
          'a':'http://www.w3.org/2005/Atom'}
    out = []
    for entry in root.findall('a:entry', ns)[:max_results]:
      vid  = entry.find('yt:videoId', ns)
      ttl  = entry.find('a:title', ns)
      pub  = entry.find('a:published', ns)
      if vid is not None and ttl is not None:
        out.append({'title':ttl.text,'days':days_ago(pub.text if pub is not None else ''),
                    'videoId':vid.text})
    print(f"  RSS {channel_id[:24]}: {len(out)} videos")
    return out
  except Exception as e:
    print(f"  RSS parse error {channel_id}: {e}"); return []

# ── oEmbed ─────────────────────────────────────────────────────────────────
def oembed_title(video_id):
  url = f'https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json'
  raw = safe_get(url)
  if raw:
    try: return json.loads(raw).get('title','')
    except: pass
  return ''

# ── News RSS ───────────────────────────────────────────────────────────────
MAX_NEWS_AGE_DAYS = 7
HOT_NARRATIVE_AGE_DAYS = 14

def _parse_pub(pub_str):
  """Parse RSS pubDate to a timezone-aware UTC datetime. Returns None on failure."""
  if not pub_str: return None
  s = pub_str.strip()
  # RFC-2822: Mon, 15 Jan 2026 08:00:00 +0000
  for fmt in ('%a, %d %b %Y %H:%M:%S %z', '%a, %d %b %Y %H:%M:%S %Z',
              '%d %b %Y %H:%M:%S %z', '%Y-%m-%dT%H:%M:%S%z'):
    try:
      import time as _time
      dt = datetime.datetime.strptime(s[:31], fmt)
      return dt.astimezone(datetime.timezone.utc)
    except: pass
  # email.utils fallback
  try:
    import email.utils
    tt = email.utils.parsedate_tz(s)
    if tt:
      ts = email.utils.mktime_tz(tt)
      return datetime.datetime.fromtimestamp(ts, datetime.timezone.utc)
  except: pass
  return None

def _days_old(pub_str):
  dt = _parse_pub(pub_str)
  if dt is None: return 0        # unknown age → include
  return max(0, (utc_now() - dt).days)

def parse_news_rss(raw, region, max_items=6, max_age_days=MAX_NEWS_AGE_DAYS):
  items = []
  try:
    root = ET.fromstring(raw)
    collected = 0
    for item in root.findall('.//item'):
      if collected >= max_items: break
      title = item.find('title')
      link  = item.find('link')
      pub   = item.find('pubDate')
      pub_str = (pub.text or '').strip() if pub is not None else ''
      age = _days_old(pub_str)
      if age > max_age_days:
        continue                 # skip stale news
      if title is not None and title.text:
        t = title.text.strip()
        if ' - ' in t:
          t = t.rsplit(' - ', 1)[0].strip()
        items.append({
          'title':  t[:120],
          'url':    (link.text or '').strip() if link is not None else '',
          'pub':    pub_str[:30],
          'age_days': age,
          'region': region
        })
        collected += 1
  except Exception as e:
    print(f"  News parse error: {e}")
  return items

# ═══════════════════════════════════════════════════════════════════════════
# STEP 1: OAuth token
# ═══════════════════════════════════════════════════════════════════════════
ACCESS_TOKEN = get_access_token()
print(f"OAuth token: {'OK' if ACCESS_TOKEN else 'FAILED'}")

# ═══════════════════════════════════════════════════════════════════════════
# STEP 2: Channel stats
# ═══════════════════════════════════════════════════════════════════════════
subs, views, vids_count = 35800, 1447926, 155
if KEY:
  raw = safe_get(
    f'https://www.googleapis.com/youtube/v3/channels?part=statistics&id={CHANNEL_ID}&key={KEY}',
    headers={'User-Agent':'Mozilla/5.0'}
  )
  if raw:
    try:
      d = json.loads(raw)
      st = d.get('items',[{}])[0].get('statistics',{})
      subs       = int(st.get('subscriberCount', subs))
      views      = int(st.get('viewCount', views))
      vids_count = int(st.get('videoCount', vids_count))
      print(f"Channel stats: {subs:,} subs | {views:,} views | {vids_count} videos")
    except Exception as e:
      print(f"  Stats parse error: {e}")

# ═══════════════════════════════════════════════════════════════════════════
# STEP 3: Competitor + channel RSS videos
# ═══════════════════════════════════════════════════════════════════════════
def channel_id_for_handle(handle):
  """Lookup YouTube channel ID by scraping the channel page (no API key needed)."""
  url = f'https://www.youtube.com/@{handle}'
  raw = safe_get(url, headers={
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }, timeout=15)
  if raw:
    text = raw.decode('utf-8', errors='ignore')
    for pattern in [
      r'"channelId":"(UC[a-zA-Z0-9_-]{22})"',
      r'"externalId":"(UC[a-zA-Z0-9_-]{22})"',
      r'channel/(UC[a-zA-Z0-9_-]{22})',
      r'"browseId":"(UC[a-zA-Z0-9_-]{22})"',
    ]:
      m = re.search(pattern, text)
      if m:
        cid = m.group(1)
        print(f"  @{handle} → {cid}")
        return cid
    print(f"  @{handle}: could not extract channel ID from page")
  else:
    print(f"  @{handle}: page fetch failed")
  return None

print("Fetching CoinLyte RSS...")
coinlyte_vids = rss_videos(CHANNEL_ID, 10)

print("Fetching Coin Bureau RSS...")
COIN_BUREAU_CHANNEL_ID = 'UCqK_GSMbpiV8spgD3ZGloSw'
coin_bureau_vids = rss_videos(COIN_BUREAU_CHANNEL_ID, 8)
if not coin_bureau_vids:
  cb_id = channel_id_for_handle('CoinBureau')
  coin_bureau_vids = rss_videos(cb_id, 8) if cb_id else []
if not coin_bureau_vids:
  # Known fallback ID for the official @CoinBureau channel.
  for cid in [COIN_BUREAU_CHANNEL_ID]:
    coin_bureau_vids = rss_videos(cid, 8)
    if coin_bureau_vids: break

print("Fetching Cyber Scrilla RSS...")
cs_id = channel_id_for_handle('CyberScrilla')
cyberscrilla_vids = rss_videos(cs_id, 8) if cs_id else []
if not cyberscrilla_vids:
  for cid in ['UCEoHpgGZ5K4nFMoLHXI_YAA', 'UCfItEX8xuKB8F0xPDHGFqmA']:
    cyberscrilla_vids = rss_videos(cid, 8)
    if cyberscrilla_vids: break

print("Fetching Bankless RSS...")
bankless_vids = rss_videos('UCAl9Ld79qaZxp9JzEOwd3aA', 8)

# ═══════════════════════════════════════════════════════════════════════════
# STEP 4: Comments — 200 most recent from ANY video on the channel
# Uses allThreadsRelatedToChannelId to capture trending older videos too
# ═══════════════════════════════════════════════════════════════════════════
all_comments = []
if KEY:
  print("Fetching 200 most recent channel comments (any video, sorted by date)...")
  next_page = None
  page = 0
  while len(all_comments) < 200 and page < 4:
    # allThreadsRelatedToChannelId needs OAuth; API key alone returns 403
    if ACCESS_TOKEN:
      url = (f'https://www.googleapis.com/youtube/v3/commentThreads'
             f'?part=snippet'
             f'&allThreadsRelatedToChannelId={CHANNEL_ID}'
             f'&maxResults=100&order=time')
      if next_page: url += f'&pageToken={next_page}'
      raw = safe_get(url, headers={'Authorization': f'Bearer {ACCESS_TOKEN}'})
    else:
      url = (f'https://www.googleapis.com/youtube/v3/commentThreads'
             f'?part=snippet'
             f'&allThreadsRelatedToChannelId={CHANNEL_ID}'
             f'&maxResults=100&order=time&key={KEY}')
      if next_page: url += f'&pageToken={next_page}'
      raw = safe_get(url)
    if not raw:
      print(f"  Page {page}: no data (HTTP error/403) — falling back to per-video fetch...")
      if page == 0:
        for v in coinlyte_vids[:10]:
          vid_id = v.get('videoId','')
          if not vid_id: continue
          # Per-video public comments work with the API key and do not need the
          # OAuth comment scope, so this is the reliable fallback for dashboards.
          vraw = safe_get(f'https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId={vid_id}&maxResults=50&order=time&key={KEY}')
          if not vraw: continue
          vp = json.loads(vraw)
          if vp.get('error'): continue
          for item in vp.get('items',[]):
            c = item.get('snippet',{}).get('topLevelComment',{}).get('snippet',{})
            text = c.get('textOriginal','') or c.get('textDisplay','')
            author = c.get('authorDisplayName','')
            if text and not is_scam_comment(text, author) and len(text.strip()) > 10:
              all_comments.append({
                'author': author,
                'text':   text[:250],
                'age':    days_ago(c.get('publishedAt','')),
                'intent': comment_intent(text),
                'likes':  int(c.get('likeCount',0)),
                'videoTitle': v['title'],
                'videoId': vid_id,
                'publishedAt': c.get('publishedAt','')
              })
          if len(all_comments) >= 200: break
      break
    parsed = json.loads(raw)
    if parsed.get('error'):
      msg = parsed['error'].get('message','?')
      print(f"  Comments API error: {msg}")
      if 'forbidden' in msg.lower() or 'disabled' in msg.lower() or '403' in str(parsed['error'].get('code','')):
        print("  Falling back to per-video comment fetch (API error)...")
        for v in coinlyte_vids[:10]:
          vid_id = v.get('videoId','')
          if not vid_id: continue
          vraw = safe_get(f'https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId={vid_id}&maxResults=50&order=time&key={KEY}')
          if not vraw: continue
          vp = json.loads(vraw)
          if vp.get('error'): continue
          for item in vp.get('items',[]):
            c = item.get('snippet',{}).get('topLevelComment',{}).get('snippet',{})
            text = c.get('textOriginal','') or c.get('textDisplay','')
            author = c.get('authorDisplayName','')
            if text and not is_scam_comment(text, author) and len(text.strip()) > 10:
              all_comments.append({
                'author': author,
                'text':   text[:250],
                'age':    days_ago(c.get('publishedAt','')),
                'intent': comment_intent(text),
                'likes':  int(c.get('likeCount',0)),
                'videoTitle': v['title'],
                'videoId': vid_id,
                'publishedAt': c.get('publishedAt','')
              })
          if len(all_comments) >= 200: break
      break
    items = parsed.get('items',[])
    page += 1
    print(f"  Page {page}: {len(items)} comments")
    for item in items:
      c   = item.get('snippet',{}).get('topLevelComment',{}).get('snippet',{})
      vid_info = item.get('snippet',{})
      text = c.get('textOriginal','') or c.get('textDisplay','')
      author = c.get('authorDisplayName','')
      if text and not is_scam_comment(text, author) and len(text.strip()) > 10:
        # Get video title from coinlyte_vids lookup or snippet
        vid_id = vid_info.get('videoId','')
        vid_title = next((v['title'] for v in coinlyte_vids if v.get('videoId')==vid_id), f'Video {vid_id[:8]}')
        all_comments.append({
          'author':      author,
          'text':        text[:250],
          'age':         days_ago(c.get('publishedAt','')),
          'intent':      comment_intent(text),
          'likes':       int(c.get('likeCount',0)),
          'videoTitle':  vid_title,
          'videoId':     vid_id,
          'publishedAt': c.get('publishedAt','')
        })
    next_page = parsed.get('nextPageToken')
    if not next_page: break

  all_comments = all_comments[:200]
  # Sort by likes so most-engaged comments surface first in Claude prompt
  all_comments.sort(key=lambda x: -x.get('likes',0))
  print(f"Comments total: {len(all_comments)} across {len(set(c['videoId'] for c in all_comments))} videos (sorted by engagement)")
else:
  print("Skipping comments (no YT_API_KEY)")

theme_kw = [
  ('Cold Wallet / Hardware Security',  ['cold wallet','hardware','tangem','ledger','secure','seed phrase','private key']),
  ('Beginner Guide — Invest Kaise?',   ['start','beginner','pehli baar','kaise invest','how to start','shuru','first time']),
  ('India Crypto Tax',                 ['tax','tds','30%','itr','income tax','save tax','tax bachao']),
  ('XRP / Altcoin Predictions',        ['xrp','ripple','price','target','prediction','kab aaega','altcoin']),
  ('DeFi Safety in India',             ['defi','yield','farming','safe','risk','protocol','liquidity']),
  ('CBDC vs Crypto',                   ['cbdc','digital rupee','rbi','e-rupee','government coin','central bank']),
  ('Ethereum Staking from India',      ['ethereum','staking','eth','stake','earning','passive','validator']),
  ('Exchange / KYC Issues',            ['coindcx','wazirx','binance','freeze','kyc','account block','withdrawal']),
  ('Bitcoin Price / Outlook',          ['bitcoin','btc','price','bull','bear','100k','sats']),
  ('Scam / Security Alert',            ['scam','fraud','hack','phishing','fake','lost','recovery']),
]
themes = []
for topic, kw in theme_kw:
  matches = [c for c in all_comments if any(k in c['text'].lower() for k in kw)]
  # Use highest-liked match as sample for most representative quote
  best = max(matches, key=lambda x: x.get('likes',0)) if matches else None
  sample = best['text'][:130]+'...' if best and len(best['text'])>130 else (best['text'] if best else '')
  themes.append({'topic':topic,'count':len(matches),'sample':sample})
themes.sort(key=lambda x:-x['count'])
# Log top themes
for t in themes[:5]:
  if t['count'] > 0:
    print(f"  Theme '{t['topic']}': {t['count']} comments")

# ═══════════════════════════════════════════════════════════════════════════
# STEP 5: Analytics
# ═══════════════════════════════════════════════════════════════════════════
analytics = {}
video_titles = {}
if ACCESS_TOKEN:
  end_date  = datetime.datetime.now().strftime('%Y-%m-%d')
  start_7   = (datetime.datetime.now()-datetime.timedelta(days=7)).strftime('%Y-%m-%d')
  start_28  = (datetime.datetime.now()-datetime.timedelta(days=28)).strftime('%Y-%m-%d')
  start_90  = (datetime.datetime.now()-datetime.timedelta(days=90)).strftime('%Y-%m-%d')
  start_365 = (datetime.datetime.now()-datetime.timedelta(days=365)).strftime('%Y-%m-%d')
  CORE_M = "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,subscribersLost,likes,comments,shares"

  def fp(start, end, label='', include_hourly=False):
    print(f"  Analytics {label}...")
    result = {
      'core':    analytics_get(f"ids=channel%3D%3D{CHANNEL_ID}&startDate={start}&endDate={end}&metrics={CORE_M}", ACCESS_TOKEN),
      'geo':     analytics_get(f"ids=channel%3D%3D{CHANNEL_ID}&startDate={start}&endDate={end}&metrics=views,estimatedMinutesWatched&dimensions=country&sort=-views&maxResults=15", ACCESS_TOKEN),
      'device':  analytics_get(f"ids=channel%3D%3D{CHANNEL_ID}&startDate={start}&endDate={end}&metrics=views&dimensions=deviceType&sort=-views", ACCESS_TOKEN),
      'traffic': analytics_get(f"ids=channel%3D%3D{CHANNEL_ID}&startDate={start}&endDate={end}&metrics=views&dimensions=insightTrafficSourceType&sort=-views", ACCESS_TOKEN),
      'hourly':  {},
      'daily':   analytics_get(f"ids=channel%3D%3D{CHANNEL_ID}&startDate={start}&endDate={end}&metrics=views,subscribersGained&dimensions=day&sort=day", ACCESS_TOKEN),
      'period':  {'start':start,'end':end}
    }
    # hourly dimension only valid for ≤7 day ranges
    if include_hourly:
      result['hourly'] = analytics_get(f"ids=channel%3D%3D{CHANNEL_ID}&startDate={start}&endDate={end}&metrics=views,estimatedMinutesWatched&dimensions=hour&sort=-views&maxResults=24", ACCESS_TOKEN)
    return result

  p28  = fp(start_28, end_date, '28d', include_hourly=False)
  p90  = fp(start_90, end_date, '90d', include_hourly=False)
  print("  Analytics hourly (7d): skipped (YouTube Analytics rejected hour dimension for this channel)")
  hourly_7d = {}
  p90['ageGender'] = analytics_get(f"ids=channel%3D%3D{CHANNEL_ID}&startDate={start_90}&endDate={end_date}&metrics=viewerPercentage&dimensions=ageGroup,gender", ACCESS_TOKEN)
  p365 = fp(start_365, end_date, '1yr', include_hourly=False)
  p365['ageGender'] = analytics_get(f"ids=channel%3D%3D{CHANNEL_ID}&startDate={start_365}&endDate={end_date}&metrics=viewerPercentage&dimensions=ageGroup,gender", ACCESS_TOKEN)

  print("  Fetching top videos...")
  top_videos = analytics_get(f"ids=channel%3D%3D{CHANNEL_ID}&startDate={start_365}&endDate={end_date}&metrics=views,estimatedMinutesWatched,averageViewPercentage,likes,subscribersGained&dimensions=video&sort=-views&maxResults=10", ACCESS_TOKEN)
  p90['topVideos']  = top_videos
  p365['topVideos'] = top_videos

  video_titles = {}
  if top_videos and top_videos.get('rows'):
    top_ids = [r[0] for r in top_videos['rows'][:10] if r]
    print(f"  Fetching {len(top_ids)} video titles via oEmbed...")
    for vid_id in top_ids:
      title = oembed_title(vid_id)
      if title:
        video_titles[vid_id] = title

  analytics = {
    'p28':p28,'p90':p90,'p365':p365,
    'videoTitles':video_titles,
    'core':p90.get('core'),'geo':p90.get('geo'),'device':p90.get('device'),
    'traffic':p90.get('traffic'),'ageGender':p90.get('ageGender'),
    'daily':p28.get('daily'),'topVideos':top_videos,
    'hourly':hourly_7d,'period':p90.get('period')
  }
  print(f"Analytics done.")
else:
  print("No OAuth token — analytics skipped")

# ═══════════════════════════════════════════════════════════════════════════
# STEP 6: News Intelligence (RSS, no API key needed)
# ═══════════════════════════════════════════════════════════════════════════
print("\nFetching news feeds...")

NEWS_FEEDS = [
  # Dedicated crypto news sources
  ('coindesk',      'https://www.coindesk.com/arc/outboundfeeds/rss/', 'Global'),
  ('cointelegraph', 'https://cointelegraph.com/rss', 'Global'),
  ('decrypt',       'https://decrypt.co/feed', 'Global'),
  ('theblock',      'https://www.theblock.co/rss.xml', 'Global'),
  # India-specific
  ('et_crypto',     'https://economictimes.indiatimes.com/markets/cryptocurrency/rssfeeds/7771157.cms', 'India'),
  ('india_crypto',  'https://news.google.com/rss/search?q=india+crypto+regulation+rbi+sebi&hl=en-IN&gl=IN&ceid=IN:en', 'India'),
  ('india_tax',     'https://news.google.com/rss/search?q=india+crypto+tax+tds+30+percent+2026&hl=en-IN&gl=IN&ceid=IN:en', 'India'),
  ('modi_rbi',      'https://news.google.com/rss/search?q=modi+rbi+cbdc+digital+rupee+cryptocurrency&hl=en-IN&gl=IN&ceid=IN:en', 'India'),
  ('india_exch',    'https://news.google.com/rss/search?q=coindcx+wazirx+zebpay+india+crypto+exchange+2026&hl=en-IN&gl=IN&ceid=IN:en', 'India'),
  # US / Global regulation
  ('genius_act',    'https://news.google.com/rss/search?q=GENIUS+Act+stablecoin+regulation+crypto&hl=en&gl=US&ceid=US:en', 'Regulation'),
  ('clarity_act',   'https://news.google.com/rss/search?q=Clarity+Act+crypto+SEC+CFTC+regulation&hl=en&gl=US&ceid=US:en', 'Regulation'),
  ('crypto_reg',    'https://news.google.com/rss/search?q=crypto+regulation+SEC+ETF+approval+2026&hl=en&gl=US&ceid=US:en', 'Regulation'),
  # Major coins
  ('bitcoin',       'https://news.google.com/rss/search?q=bitcoin+BTC+price+halving+ETF+2026&hl=en&gl=US&ceid=US:en', 'Market'),
  ('ethereum',      'https://news.google.com/rss/search?q=ethereum+ETH+staking+upgrade+price+2026&hl=en&gl=US&ceid=US:en', 'Market'),
  ('xrp',           'https://news.google.com/rss/search?q=XRP+ripple+SEC+lawsuit+price+2026&hl=en&gl=US&ceid=US:en', 'Market'),
  ('solana',        'https://news.google.com/rss/search?q=solana+SOL+price+ecosystem+2026&hl=en&gl=US&ceid=US:en', 'Market'),
  # Trending topics
  ('defi',          'https://news.google.com/rss/search?q=defi+hack+exploit+yield+2026&hl=en&gl=US&ceid=US:en', 'Market'),
  ('stablecoin',    'https://news.google.com/rss/search?q=USDT+USDC+stablecoin+tether+2026&hl=en&gl=US&ceid=US:en', 'Market'),
  ('altcoins',      'https://news.google.com/rss/search?q=altcoin+crypto+bull+run+top+coins+2026&hl=en&gl=US&ceid=US:en', 'Market'),
  ('ai_crypto',     'https://news.google.com/rss/search?q=AI+crypto+token+artificial+intelligence+blockchain+2026&hl=en&gl=US&ceid=US:en', 'Market'),
  ('rwa',           'https://news.google.com/rss/search?q=RWA+real+world+assets+tokenization+crypto+2026&hl=en&gl=US&ceid=US:en', 'Market'),
  # Hot narrative radar: fast-moving stories that may not fit normal coin/regulation feeds.
  ('hot_hyperliquid', 'https://news.google.com/rss/search?q=Hyperliquid+HYPE+SpaceX+pre-IPO+tokenized+stocks+crypto&hl=en&gl=US&ceid=US:en', 'Hot'),
  ('hot_tokenized_stocks', 'https://news.google.com/rss/search?q=tokenized+stocks+pre-IPO+perpetuals+crypto+xStocks+RWA&hl=en&gl=US&ceid=US:en', 'Hot'),
  ('hot_top_coins', 'https://news.google.com/rss/search?q=bitcoin+ethereum+solana+xrp+bnb+dogecoin+cardano+sui+hyperliquid+crypto+breaking+news&hl=en&gl=US&ceid=US:en', 'Hot'),
  ('hot_market_structure', 'https://news.google.com/rss/search?q=crypto+exchange+perpetuals+liquidation+whale+ETF+tokenization+India+investors&hl=en&gl=US&ceid=US:en', 'Hot'),
]

all_news = {}
for key_name, url, region in NEWS_FEEDS:
  raw = safe_get(url, headers={'User-Agent': 'Mozilla/5.0 (compatible; newsbot/1.0)'}, timeout=12)
  if raw:
    max_age = HOT_NARRATIVE_AGE_DAYS if region == 'Hot' else MAX_NEWS_AGE_DAYS
    items = parse_news_rss(raw, region, max_items=5, max_age_days=max_age)
    all_news[key_name] = items
    print(f"  {key_name}: {len(items)} articles")
  else:
    all_news[key_name] = []
    print(f"  {key_name}: failed")

def dedup(items):
  """Deduplicate by URL and by normalised title (strips punctuation, first 55 chars)."""
  seen_t, seen_u, out = set(), set(), []
  for item in items:
    # Normalise title: lowercase, strip non-alphanumeric, take first 55 chars
    norm = re.sub(r'[^a-z0-9 ]', '', item['title'].lower())[:55].strip()
    # Normalise URL: strip query string & trailing slash
    url_key = item.get('url','').split('?')[0].rstrip('/')
    if norm in seen_t:
      continue
    if url_key and url_key in seen_u:
      continue
    seen_t.add(norm)
    if url_key: seen_u.add(url_key)
    out.append(item)
  return out

india_news = dedup(
  all_news.get('et_crypto',[]) + all_news.get('india_crypto',[]) +
  all_news.get('india_tax',[]) + all_news.get('modi_rbi',[]) +
  all_news.get('india_exch',[])
)[:15]

reg_news = dedup(
  all_news.get('genius_act',[]) + all_news.get('clarity_act',[]) +
  all_news.get('crypto_reg',[])
)[:10]

market_news = dedup(
  all_news.get('coindesk',[]) + all_news.get('cointelegraph',[]) +
  all_news.get('decrypt',[]) + all_news.get('theblock',[]) +
  all_news.get('bitcoin',[]) + all_news.get('ethereum',[]) +
  all_news.get('xrp',[]) + all_news.get('solana',[]) +
  all_news.get('defi',[]) + all_news.get('stablecoin',[]) +
  all_news.get('altcoins',[]) + all_news.get('ai_crypto',[]) +
  all_news.get('rwa',[])
)[:20]

hot_news = dedup(
  all_news.get('hot_hyperliquid',[]) + all_news.get('hot_tokenized_stocks',[]) +
  all_news.get('hot_top_coins',[]) + all_news.get('hot_market_structure',[])
)[:15]

news_intelligence = {
  'india': india_news, 'regulation': reg_news,
  'market': market_news, 'hot': hot_news, 'fetchedAt': TODAY
}
print(f"News: India={len(india_news)} | Reg={len(reg_news)} | Market={len(market_news)} | Hot={len(hot_news)} | Total={len(india_news)+len(reg_news)+len(market_news)+len(hot_news)}")

# ═══════════════════════════════════════════════════════════════════════════
# STEP 6.5: Video Performance Analysis — find underperformers + top formats
# ═══════════════════════════════════════════════════════════════════════════
video_performance = []
underperformers   = []

try:
  # Build per-video stats from analytics topVideos
  top_rows = []
  vt = analytics.get('p90',{}).get('topVideos',{}) or analytics.get('videoTitles',{})
  tv = analytics.get('p90',{}).get('topVideos',{})
  if tv and tv.get('rows'):
    top_rows = tv['rows']  # [videoId, views, minutes, avgPct, likes, subs]

  # Map video IDs to performance data
  perf_map = {}
  for row in top_rows:
    vid_id = row[0]
    perf_map[vid_id] = {'views': row[1], 'watchPct': row[3], 'likes': row[4], 'subsGained': row[5]}

  # 30-day avg views per video (proxy for baseline)
  p28_views = 0
  p28_core  = analytics.get('p28',{}).get('core',{})
  if p28_core and p28_core.get('rows'):
    p28_views = p28_core['rows'][0][0]
  avg_views_per_video = p28_views / max(len(coinlyte_vids), 1)

  for v in coinlyte_vids[:10]:
    vid_id = v.get('videoId','')
    title  = v.get('title','')
    days_n = v.get('days','')
    perf   = perf_map.get(vid_id, {})
    v_views = perf.get('views', 0)
    pct_of_avg = (v_views / avg_views_per_video * 100) if avg_views_per_video > 0 and v_views > 0 else None
    entry = {'videoId':vid_id,'title':title,'days':days_n,'views':v_views,
             'watchPct':perf.get('watchPct',0),'likes':perf.get('likes',0),
             'pctOfAvg':round(pct_of_avg,1) if pct_of_avg else None}
    video_performance.append(entry)
    if pct_of_avg and pct_of_avg < 60 and days_n not in ['Today','Yesterday']:
      underperformers.append(entry)

  if underperformers:
    print(f"Underperformers identified: {len(underperformers)} videos below 60% of avg")
    for u in underperformers:
      print(f"  {u['title'][:50]} → {u['views']:,} views ({u['pctOfAvg']}% of avg)")
except Exception as e:
  print(f"Performance analysis error: {e}")

# ═══════════════════════════════════════════════════════════════════════════
# STEP 7: Claude AI — Generate Video Ideas from all signals
# ═══════════════════════════════════════════════════════════════════════════
video_ideas = []
if ANTHROPIC_KEY:
  print("\nCalling Claude to generate video ideas...")
  try:
    # Build signal context
    cl_titles   = [v['title'] for v in coinlyte_vids[:10]]
    cb_titles   = [v['title'] for v in coin_bureau_vids[:8]]
    cs_titles   = [v['title'] for v in cyberscrilla_vids[:8]]
    india_hdls  = [n['title'] for n in india_news[:8]]
    reg_hdls    = [n['title'] for n in reg_news[:5]]
    mkt_hdls    = [n['title'] for n in market_news[:10]]
    hot_hdls    = [n['title'] for n in hot_news[:10]]
    comment_str = ', '.join([t['topic'] for t in themes[:8] if t['count'] > 0] or [t['topic'] for t in themes[:5]])
    top_vids_str = ', '.join([v for v in video_titles.values()][:5]) if video_titles else 'Security guides, XRP explained, Exchange guides'
    board_memory = fetch_board_memory()
    recent_upload_memory = cl_titles + [v for v in video_titles.values()]
    blocked_titles = memory_titles(board_memory, recent_upload_memory)
    blocked_context = summarize_memory_for_prompt(blocked_titles)

    # Build analytics context strings
    geo_str = ''
    try:
      geo_rows = analytics.get('p28',{}).get('geo',{}).get('rows',[])
      total_geo = sum(r[1] for r in geo_rows) or 1
      geo_str = ' | '.join([f"{r[0]}: {r[1]*100//total_geo}%" for r in geo_rows[:5]])
    except: geo_str = 'IN: 82%'

    traffic_str = ''
    try:
      tr_rows = analytics.get('p28',{}).get('traffic',{}).get('rows',[])
      total_tr = sum(r[1] for r in tr_rows) or 1
      tr_labels = {'YT_SEARCH':'Search','SUBSCRIBER':'Subscribers','RELATED_VIDEO':'Related','SHORTS':'Shorts','NOTIFICATION':'Notifications'}
      traffic_str = ' | '.join([f"{tr_labels.get(r[0],r[0])}: {r[1]*100//total_tr}%" for r in tr_rows[:5]])
    except: traffic_str = 'Search + Subscribers dominant'

    # Top comment requests (with real counts)
    top_requests = [f"{t['topic']} ({t['count']} comments)" for t in themes if t['count'] > 0]
    if not top_requests:
      top_requests = [t['topic'] for t in themes[:5]]

    # Underperformer context
    underperf_str = ''
    if underperformers:
      parts = []
      for u in underperformers[:3]:
        parts.append(f"'{u['title'][:55]}' ({u['views']:,} views, {u['pctOfAvg']}% of avg) — suggest pivot angle")
      underperf_str = '\n'.join(parts)

    # Actual top comments (highest liked, for Claude to read real audience voice)
    top_comment_samples = []
    for c in all_comments[:20]:
      if len(c['text'].strip()) > 20:
        top_comment_samples.append(f"  [{c['intent']}] {c['text'][:150]}")
    comment_samples_str = '\n'.join(top_comment_samples[:15]) if top_comment_samples else '  No comments fetched yet'

    prompt = f"""You are the world's best YouTube content strategist for CoinLyte — India's Hindi crypto education channel.

═══ CHANNEL INTELLIGENCE ═══
Subscribers: {subs:,} | Total views (90d): {analytics.get('p90',{}).get('core',{}).get('rows',[[0]])[0][0] if analytics.get('p90',{}).get('core',{}).get('rows') else 'N/A'}
Geography: {geo_str}
Traffic sources: {traffic_str}
Device: 87% mobile (short attention spans — hook in first 10 seconds)
Avg view retention: ~28% (pain point — hook + chapters matter)
Upload frequency: 10-12 videos/month

All-time top performers (highest views):
{chr(10).join(f'- {t}' for t in list(video_titles.values())[:8]) if video_titles else '- Security guides, XRP explained, exchange guides, comparison videos'}

═══ RECENT UPLOADS (last 30 days — do NOT duplicate) ═══
{chr(10).join(f'- {t}' for t in cl_titles)}

═══ SHARED BOARD MEMORY — NEVER RECREATE THESE ═══
These topics are already in the planner, saved for later, previously dismissed, or already published by CoinLyte. Treat them as blocked unless the new angle is clearly different and more specific:
{blocked_context}

═══ UNDERPERFORMING RECENT VIDEOS (below 60% average — needs topic pivot) ═══
{underperf_str if underperf_str else 'No significant underperformers detected'}

═══ AUDIENCE VOICE — Top {len(all_comments)} comments (sorted by engagement) ═══
{comment_samples_str}

Top recurring comment themes:
{chr(10).join(f'- {r}' for r in top_requests) if top_requests else '- No comment data yet'}

═══ COMPETITOR CONTENT THIS WEEK ═══
Coin Bureau official @CoinBureau channel (English, global crypto narratives):
{chr(10).join(f'- {t}' for t in cb_titles) if cb_titles else '- RSS data unavailable'}

Cyber Scrilla (English, hardware wallet focus, 500K subs):
{chr(10).join(f'- {t}' for t in cs_titles) if cs_titles else '- RSS data unavailable'}

═══ BREAKING NEWS SIGNALS ═══
India crypto news:
{chr(10).join(f'- {t}' for t in india_hdls) if india_hdls else '- No live news'}

US regulation (GENIUS Act / Clarity Act):
{chr(10).join(f'- {t}' for t in reg_hdls) if reg_hdls else '- No live news'}

Global market (Bitcoin / Ethereum / XRP):
{chr(10).join(f'- {t}' for t in mkt_hdls) if mkt_hdls else '- No live news'}

Hot narrative radar (top coins, Hyperliquid/HYPE, SpaceX pre-IPO, tokenized stocks, perps, RWA):
{chr(10).join(f'- {t}' for t in hot_hdls) if hot_hdls else '- No live hot narratives'}

═══ YOUR TASK ═══
Generate exactly 20 candidate video ideas for CoinLyte. The app will keep the best non-duplicate 15 after memory filtering. Rules:
1. NEVER duplicate a recent upload topic
2. NEVER recreate a topic already in Shared Board Memory, even if the wording changes
3. Do not make 10 ideas from one news item. Maximum 2 ideas per event cluster and maximum 4 per source group.
4. For underperforming videos, suggest a PIVOT only when the title is genuinely different from the original
5. Always add India angle: ₹ amounts, Indian exchange names, India regulation, "Indian investor" framing
6. Mix formats that historically perform: Comparison > Explained > Security Guide > News reaction > Prediction
7. Mobile-first titles: punchy, emoji, fear hook OR curiosity hook, under 70 chars

Priority distribution for candidates: 5 urgent (news-driven, post this week) + 8 high (competitor gaps) + 7 medium (evergreen/community asks)

Sources for each idea MUST be one of: "Coin Bureau", "Cyber Scrilla", "India News", "Regulation News", "Market News", "Community Comments", "Analytics Data", "Topic Pivot"

For each idea return a JSON object with EXACTLY these fields:
- "title": Hindi/English mix, emoji, India angle, ₹ or % when possible (max 80 chars)
- "priority": "urgent" | "high" | "medium"
- "category": Security | India Focus | Policy | Macro | Education | DeFi | Comparison | Breaking | XRP | Bitcoin | Stablecoin | Strategy
- "signal": competitor_gap | news_trend | audience_ask | analytics_insight | topic_pivot
- "why": 1-2 sentences — specific India angle + performance prediction based on channel data
- "source": exact source name from the list above

Return ONLY a valid JSON array of 20 objects. Zero markdown, zero explanation."""

    payload_claude = json.dumps({
      "model": "claude-haiku-4-5-20251001",
      "max_tokens": 3000,
      "messages": [{"role": "user", "content": prompt}]
    })
    req = urllib.request.Request(
      'https://api.anthropic.com/v1/messages',
      data=payload_claude.encode(),
      headers={
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      method='POST'
    )
    with urllib.request.urlopen(req, timeout=45) as resp:
      result = json.loads(resp.read())
      content = result['content'][0]['text'].strip()
      # Strip markdown code fences if present
      if content.startswith('```'):
        content = re.sub(r'```[\w]*\n?', '', content).strip()
      raw_video_ideas = json.loads(content)
      print(f"Claude generated {len(raw_video_ideas)} raw video ideas")
      video_ideas = dedupe_generated_ideas(raw_video_ideas, blocked_titles)
      print(f"AI memory filter kept {len(video_ideas)} video ideas")
  except Exception as e:
    print(f"Claude API error: {e}")
    video_ideas = []
else:
  print("ANTHROPIC_API_KEY not set — skipping AI video ideas")

# ═══════════════════════════════════════════════════════════════════════════
# STEP 8: Build payload and write standalone live data
# ═══════════════════════════════════════════════════════════════════════════
payload = json.dumps({
  'coinlyte':coinlyte_vids,'coinbureau':coin_bureau_vids,
  'cyberscrilla':cyberscrilla_vids,'bankless':bankless_vids,
  'comments':all_comments[:200],'commentThemes':themes,
  'totalComments':len(all_comments),'lastRefresh':TODAY,'refreshedAt':utc_now().strftime('%Y-%m-%dT%H:%M:%SZ'),
  'channelStats':{'subs':subs,'views':views,'vids':vids_count},
  'news':news_intelligence,
  'videoIdeas':video_ideas,
  'videoPerformance':video_performance,
  'analytics':analytics
}, ensure_ascii=False, separators=(',',':'))

os.makedirs('assets', exist_ok=True)
with open('assets/live-data.js','w',encoding='utf-8') as f:
  f.write('// Generated by .github/scripts/refresh.py. Do not edit by hand.\n')
  f.write('window.COINLYTE_LIVE_DATA = ')
  f.write(payload)
  f.write(';\n')

status_payload = {
  'status':'completed',
  'completedAt':utc_now().strftime('%Y-%m-%dT%H:%M:%SZ'),
  'lastRefresh':TODAY,
  'datasets':{
    'channel': bool(coinlyte_vids),
    'analytics': bool(analytics),
    'comments': len(all_comments),
    'competitors': len(coin_bureau_vids) + len(cyberscrilla_vids) + len(bankless_vids),
    'news': len(india_news) + len(reg_news) + len(market_news) + len(hot_news),
    'ideas': len(video_ideas)
  }
}
with open('assets/refresh-status.json','w',encoding='utf-8') as f:
  json.dump(status_payload, f, ensure_ascii=False, indent=2)

print(f"Wrote assets/live-data.js ({len(payload):,} chars)")
print(f"Wrote assets/refresh-status.json")

print(f"\n✅ Done: {TODAY} | CoinLyte:{len(coinlyte_vids)} | CB:{len(coin_bureau_vids)} | CS:{len(cyberscrilla_vids)} | Comments:{len(all_comments)} | News:India={len(india_news)},Reg={len(reg_news)},Mkt={len(market_news)},Hot={len(hot_news)} | Ideas:{len(video_ideas)}")
