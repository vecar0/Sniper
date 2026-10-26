"""게임에 쓰인 글자만 잘라 낸 웹폰트를 내려받는다(Google Fonts text= 부분 집합). 한글 폰트 전체(수 MB) 대신 수십 KB.
사용: python3 -I scripts/fonts.py   (last-node 폴더에서) — 문구를 바꾸면 다시 실행
"""
import glob, re, urllib.request, urllib.parse, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FAMILIES = {
    'black-han-sans': ('Black+Han+Sans', [400]),
    'plex-kr': ('IBM+Plex+Sans+KR', [400, 600]),
}
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'

def used_chars():
    text = ''
    for f in glob.glob(os.path.join(ROOT, 'js/**/*.js'), recursive=True) + [os.path.join(ROOT, 'index.html')]:
        text += open(f, encoding='utf-8').read()
    chars = set(c for c in text if ord(c) >= 0xAC00 and ord(c) <= 0xD7A3)
    chars |= set(chr(c) for c in range(0x20, 0x7F))
    chars |= set('₵∞×−·…’“”—–→←↑↓◆▶■□○●★%')
    return ''.join(sorted(chars))

def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA})).read()

def main():
    chars = used_chars()
    out = os.path.join(ROOT, 'fonts')
    os.makedirs(out, exist_ok=True)
    for key, (fam, weights) in FAMILIES.items():
        for w in weights:
            css = get(f'https://fonts.googleapis.com/css2?family={fam}:wght@{w}&text={urllib.parse.quote(chars)}').decode()
            urls = re.findall(r'url\((https://[^)]+)\)', css)
            data = b''.join(get(u) for u in urls[:1])
            path = os.path.join(out, f'{key}-{w}.woff2')
            open(path, 'wb').write(data)
            print(path, len(data) // 1024, 'KB', len(chars), 'chars', '(' + str(len(urls)) + ' file)')

main()
