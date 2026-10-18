"""
Poly Haven(CC0) PBR 텍스처 내려받기 → public/textures/pbr/<이름>_{d,n,r}.jpg
  d = 색(sRGB), n = 노멀(OpenGL), r = 거칠기(흑백)
크기는 scripts/polyhaven.json의 size(px). 실행: python3 -I scripts/polyhaven.py
"""
import json
import os
import subprocess
import sys
import tempfile

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'textures', 'pbr')
CFG = json.load(open(os.path.join(ROOT, 'scripts', 'polyhaven.json')))


def curl(url: str, dst: str) -> None:
    # curl은 환경의 프록시 설정을 그대로 따른다
    subprocess.run(['curl', '-sSfL', '-m', '300', '-o', dst, url], check=True)


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    work = tempfile.mkdtemp(prefix='polyhaven-')
    for tid, opt in CFG['textures'].items():
        size = opt.get('size', 1024)
        meta = os.path.join(work, tid + '.json')
        curl(f'https://api.polyhaven.com/files/{tid}', meta)
        files = json.load(open(meta))
        for key, suffix, mode in (('Diffuse', 'd', 'RGB'), ('nor_gl', 'n', 'RGB'), ('Rough', 'r', 'L')):
            src = files[key]['1k']['jpg']['url'] if 'jpg' in files[key]['1k'] else files[key]['1k']['png']['url']
            raw = os.path.join(work, f'{tid}_{suffix}' + os.path.splitext(src)[1])
            curl(src, raw)
            im = Image.open(raw).convert(mode)
            s = size if suffix == 'd' else max(256, size // 2)
            im = im.resize((s, s), Image.LANCZOS)
            dst = os.path.join(OUT, f'{tid}_{suffix}.jpg')
            im.save(dst, quality=80 if suffix != 'n' else 88, optimize=True)
            print(tid, suffix, s, os.path.getsize(dst) // 1024, 'KB')
    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    print('total', total // 1024, 'KB')


if __name__ == '__main__':
    sys.exit(main())
