#!/usr/bin/env python3
"""
힉스필드로 만든 타일 텍스처를 게임에 넣는다(텍스처 스킬 4~5단계).

  python3 -I scripts/textures.py            # textures.json의 주소에서 내려받기
  python3 -I scripts/textures.py --local DIR # 이미 받아 둔 DIR/<id>.png 사용

하는 일:
 1. 이미지를 1024×1024로 맞춘다.
 2. 이음새 비율(seam ratio) = 가장자리끼리 붙였을 때의 차이 ÷ 이미지 안쪽 이웃 픽셀 차이. 1.3 이하면 통과.
 3. 넘으면 Moisan 주기 분해(경계 불연속만 제거)로 진짜 seamless로 만든다.
 4. public/textures/<id>.jpg 저장 + 2×2 미리보기(.tiled2x2.jpg)를 scratch/에 만든다.
 5. src/arena/textures.ts 의 AVAILABLE 목록을 갱신한다.
"""
import json, sys, os, re, tempfile, urllib.request
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'textures')
SIZE = 1024


def seam_ratio(a: np.ndarray) -> float:
    a = a.astype(np.float32)
    edge = (np.abs(a[0] - a[-1]).mean() + np.abs(a[:, 0] - a[:, -1]).mean()) / 2
    inner = (np.abs(np.diff(a, axis=0)).mean() + np.abs(np.diff(a, axis=1)).mean()) / 2
    return float(edge / max(inner, 1e-6))


def periodic(u: np.ndarray) -> np.ndarray:
    """Moisan(2011) periodic + smooth 분해에서 주기 성분만 돌려준다."""
    u = u.astype(np.float64)
    out = np.empty_like(u)
    M, N = u.shape[:2]
    q = np.arange(M).reshape(M, 1)
    r = np.arange(N).reshape(1, N)
    den = 2 * np.cos(2 * np.pi * q / M) + 2 * np.cos(2 * np.pi * r / N) - 4
    den[0, 0] = 1
    for c in range(u.shape[2]):
        x = u[:, :, c]
        v = np.zeros_like(x)
        v[0, :] += x[-1, :] - x[0, :]
        v[-1, :] += x[0, :] - x[-1, :]
        v[:, 0] += x[:, -1] - x[:, 0]
        v[:, -1] += x[:, 0] - x[:, -1]
        s = np.fft.fft2(v) / den
        s[0, 0] = 0
        out[:, :, c] = x - np.real(np.fft.ifft2(s))
    return np.clip(out, 0, 255).astype(np.uint8)


def main() -> None:
    cfg = json.load(open(os.path.join(ROOT, 'scripts', 'textures.json')))
    local = sys.argv[2] if len(sys.argv) > 2 and sys.argv[1] == '--local' else None
    os.makedirs(OUT, exist_ok=True)
    scratch = os.path.join(ROOT, 'scratch')
    os.makedirs(scratch, exist_ok=True)
    work = tempfile.mkdtemp(prefix='tex-')  # 내려받은 파일은 빈 폴더에 따로
    done = []
    for item in cfg:
        tid, url = item['id'], item['url']
        src = os.path.join(local, f'{tid}.png') if local else os.path.join(work, f'{tid}.png')
        if not local:
            urllib.request.urlretrieve(url, src)
        im = Image.open(src).convert('RGB').resize((SIZE, SIZE), Image.LANCZOS)
        a = np.asarray(im)
        before = seam_ratio(a)
        if before > 1.3:
            a = periodic(a)
        after = seam_ratio(a)
        Image.fromarray(a).save(os.path.join(OUT, f'{tid}.jpg'), quality=88)
        tile = Image.new('RGB', (SIZE * 2, SIZE * 2))
        for x in (0, SIZE):
            for y in (0, SIZE):
                tile.paste(Image.fromarray(a), (x, y))
        tile.resize((SIZE, SIZE)).save(os.path.join(scratch, f'{tid}.tiled2x2.jpg'), quality=80)
        print(f'{tid}: seam ratio {before:.2f} -> {after:.2f} {"OK" if after <= 1.3 else "CHECK"}')
        done.append(tid)
    # 파생: 철판의 무채색 버전(컨테이너마다 색을 곱해서 빨강·파랑 등으로)
    if 'metal' in done:
        g = Image.open(os.path.join(OUT, 'metal.jpg')).convert('L')
        arr = np.asarray(g).astype(np.float32)
        arr = np.clip((arr - arr.mean()) * 1.25 + 175, 0, 255).astype(np.uint8)
        Image.fromarray(arr).convert('RGB').save(os.path.join(OUT, 'metalg.jpg'), quality=88)
        done.append('metalg')
        print('metalg: derived from metal (grayscale)')
    ts = os.path.join(ROOT, 'src', 'arena', 'textures.ts')
    s = open(ts, encoding='utf-8').read()
    s = re.sub(r"export const AVAILABLE: SurfaceId\[\] = \[[^\]]*\];", 'export const AVAILABLE: SurfaceId[] = [' + ', '.join(f"'{t}'" for t in done) + '];', s)
    open(ts, 'w', encoding='utf-8').write(s)
    print('AVAILABLE =', done)


if __name__ == '__main__':
    main()
