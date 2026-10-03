#!/usr/bin/env python3
"""Record the app's 14 narration files with the free Kokoro voice model.

  .venv/bin/python narrate.py              record every window whose text changed
  .venv/bin/python narrate.py --all        record all 14 again
  .venv/bin/python narrate.py --text-only  write the spoken texts, record nothing

Voice: af_alloy at speed 0.92 (the author's choice, 2026-10-02).

What each file reads, from the app's own copies of the text:
  intro-narration-wN.mp3   the window's title and its intro (windows.json
                           runtime_state_summary in the corpus, layout removed)
  guide-narration-wN.mp3   the companion guide: title, 'Why this matters',
                           'Watch for this', then the full guide (lib/guides.json)

The words are only adjusted for speaking (years as said aloud, 'c.' as
'around', dashes as pauses); the screen text is never changed. The exact words
spoken are written to texts/ so they can be checked, and manifest.json records
a hash of each, so a re-run only re-records windows whose text has changed.
Files go straight into the app's public/audio/, where each play button switches
on by itself when its file appears (public/audio/README.md).
"""
import hashlib, html, json, os, re, subprocess, sys, time

APP = os.path.expanduser('~/dev/silicon-altar-shell')
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(APP, 'public', 'audio')
FFMPEG = os.path.expanduser('~/bin/ffmpeg')
VOICE, SPEED = 'af_alloy', 0.92

ONES = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split()
TENS = 'zero ten twenty thirty forty fifty sixty seventy eighty ninety'.split()

def two(n):
    if n < 20: return ONES[n]
    t, o = divmod(n, 10)
    return TENS[t] + ('' if o == 0 else '-' + ONES[o])

def year(y):
    """1066 -> ten sixty-six; 1100 -> eleven hundred; 1907 -> nineteen oh seven;
    2008 -> two thousand eight; 2026 -> twenty twenty-six."""
    hi, lo = divmod(y, 100)
    if 2000 <= y <= 2009: return 'two thousand' + ('' if lo == 0 else ' ' + ONES[lo])
    if lo == 0: return two(hi) + ' hundred'
    if lo < 10: return two(hi) + ' oh ' + ONES[lo]
    return two(hi) + ' ' + two(lo)

def decade(y):
    """1380s -> thirteen-eighties; 1920s -> nineteen-twenties; 1900s -> nineteen-hundreds."""
    hi, lo = divmod(y, 100)
    if lo == 0: return two(hi) + ' hundreds'
    w = two(lo)
    w = w[:-1] + 'ies' if w.endswith('y') else w + 's'
    return two(hi) + ' ' + w

def speakable(t):
    t = html.unescape(t)
    t = re.sub(r'\b(1[0-9]{3}|20[0-9]{2})s\b', lambda m: decade(int(m.group(1))), t)
    t = re.sub(r'(?<![\d,.])\b(1[0-9]{3}|20[0-9]{2})\b(?!\d|,\d)', lambda m: year(int(m.group(1))), t)
    t = re.sub(r'\bc\.\s*', 'around ', t)
    t = re.sub(r'\bv\.\s', 'versus ', t)
    t = re.sub(r'\s*[–—]\s*', ', ', t)          # en and em dashes as a pause
    t = re.sub(r'\s+', ' ', t).strip()
    return t

CORPUS = os.environ.get('SILICON_ALTAR_REPO', os.path.expanduser('~/dev/Silicon_Altar_LIVE'))
CORPUS_W = {w['id'].lstrip('W'): w for w in json.load(open(os.path.join(CORPUS, 'windows.json'), encoding='utf-8'))['windows']}

def texts():
    g = json.load(open(os.path.join(APP, 'lib', 'guides.json'), encoding='utf-8'))
    out = {}
    for n in range(7):
        page = open(os.path.join(APP, 'public', 'windows', f'window-{n}.html'), encoding='utf-8').read()
        title = html.unescape(re.sub(r'<[^>]+>', '', re.search(r'<title>([^<]*)</title>', page).group(1)))
        name = title.split(':', 1)[1].split('·')[0].strip() if ':' in title else title
        # The intro now carries paragraph breaks and '- ' list lines (Thread 37); read it
        # from the corpus data with that layout removed, so the spoken words stay the same.
        intro = re.sub(r'^- ', '', CORPUS_W[str(n)]['runtime_state_summary'], flags=re.M)
        out[f'intro-narration-w{n}'] = speakable(f'{name}. {intro}')
        r = g[str(n)]
        full = r.get('fullGuide') or ''
        full = ' '.join(full) if isinstance(full, list) else full
        out[f'guide-narration-w{n}'] = speakable(
            f"{name}. Why this matters. {r.get('whyThisMatters', '')} Watch for this. {r.get('watchForThis', '')} {full}")
    return out

def main():
    os.makedirs(os.path.join(HERE, 'texts'), exist_ok=True)
    man_path = os.path.join(HERE, 'manifest.json')
    manifest = json.load(open(man_path)) if os.path.exists(man_path) else {}
    todo = []
    for key, text in texts().items():
        open(os.path.join(HERE, 'texts', key + '.txt'), 'w', encoding='utf-8').write(text + '\n')
        h = hashlib.sha256(f'{VOICE}|{SPEED}|{text}'.encode()).hexdigest()[:16]
        if '--all' in sys.argv or manifest.get(key) != h or not os.path.exists(os.path.join(OUT, key + '.mp3')):
            todo.append((key, text, h))
    print(f'{len(todo)} file(s) to record')
    if '--text-only' in sys.argv or not todo: return
    import soundfile as sf
    from kokoro_onnx import Kokoro
    k = Kokoro(os.path.join(HERE, 'models', 'kokoro-v1.0.onnx'), os.path.join(HERE, 'models', 'voices-v1.0.bin'))
    for key, text, h in todo:
        t = time.time()
        samples, rate = k.create(text, voice=VOICE, speed=SPEED, lang='en-us')
        wav = os.path.join(HERE, key + '.wav')
        sf.write(wav, samples, rate)
        subprocess.run([FFMPEG, '-loglevel', 'error', '-y', '-i', wav, '-ac', '1', '-ar', '44100', '-b:a', '96k',
                        os.path.join(OUT, key + '.mp3')], check=True)
        os.remove(wav)
        manifest[key] = h
        json.dump(manifest, open(man_path, 'w'), indent=1)
        print(f'{key}: {len(samples)/rate/60:.1f} min of audio in {time.time()-t:.0f}s')

if __name__ == '__main__':
    main()
