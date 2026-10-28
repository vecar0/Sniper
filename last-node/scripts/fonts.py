"""게임에 쓰인 글자만 잘라 낸 웹폰트를 내려받는다(Google Fonts text= 부분 집합). 한글 폰트 전체(수 MB) 대신 수십 KB.
글자가 많으면 Google이 여러 파일로 나눠 주므로 fontTools로 한 파일에 합친다.
사용: pip install fonttools brotli 후 python3 -I scripts/fonts.py   (last-node 폴더에서) — 문구를 바꾸면 다시 실행
"""
import glob, io, re, tempfile, urllib.request, urllib.parse, os
from fontTools.ttLib import TTFont
from fontTools.merge import Merger
from fontTools import subset

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FAMILIES = {
    'barlow-cond': ('Barlow+Condensed', [600, 700]),
    'plex-kr': ('IBM+Plex+Sans+KR', [400, 600]),
}
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'

def used_chars():
    text = ''
    for f in glob.glob(os.path.join(ROOT, 'js/**/*.js'), recursive=True) + [os.path.join(ROOT, 'index.html')]:
        text += open(f, encoding='utf-8').read()
    chars = set(c for c in text if ord(c) >= 0xAC00 and ord(c) <= 0xD7A3)
    chars |= set(chr(c) for c in range(0x20, 0x7F))
    chars |= set('∞×−·…’“”—–→←↑↓◆▶■□○●★%°′')
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
            path = os.path.join(out, f'{key}-{w}.woff2')
            with tempfile.TemporaryDirectory() as tmp:
                parts = []
                for i, u in enumerate(urls):
                    f = TTFont(io.BytesIO(get(u))); f.flavor = None
                    parts.append(os.path.join(tmp, f'{i}.ttf')); f.save(parts[-1])
                font = TTFont(parts[0]) if len(parts) == 1 else Merger().merge(parts)
            # 나뉜 파일에는 쓰지 않는 글자도 섞여 있다 → 쓰는 글자만 남긴다
            sub = subset.Subsetter(subset.Options(layout_features=['kern', 'liga', 'tnum'], notdef_outline=True))
            sub.populate(unicodes=[ord(c) for c in chars]); sub.subset(font)
            font.flavor = 'woff2'; font.save(path)
            cmap = font.getBestCmap()
            missing = ''.join(c for c in chars if c.strip() and ord(c) not in cmap)
            print(path, os.path.getsize(path) // 1024, 'KB', len(chars), 'chars', f'({len(urls)} files merged)', f'missing: {missing}' if missing else '')

main()
