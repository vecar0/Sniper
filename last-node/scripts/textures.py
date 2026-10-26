"""생성된 basecolor → seamless(Moisan 주기 분해) + 노멀 + 거칠기 맵.
사용: python3 -I scripts/textures.py <원본폴더> <출력폴더>
원본 폴더에 concrete.png plate.png container.png panel.png rust.png 가 있어야 한다.
"""
import sys
import numpy as np
from PIL import Image

# 재질별: (노멀 세기, 거칠기 기본값, 거칠기 대비, 밝기 배율)
SPEC = {
    'concrete': (5.0, 0.78, 0.35, 1.0),
    'plate': (7.0, 0.45, 0.45, 1.0),
    'container': (8.0, 0.6, 0.4, 1.0),
    'panel': (6.0, 0.5, 0.35, 1.0),
    'rust': (5.0, 0.8, 0.3, 1.0),
}


def periodic(u):
    """Moisan 주기+매끄러움 분해: 경계 불연속을 없앤 주기 성분만 남긴다."""
    h, w = u.shape
    v = np.zeros_like(u)
    v[0, :] += u[-1, :] - u[0, :]
    v[-1, :] += u[0, :] - u[-1, :]
    v[:, 0] += u[:, -1] - u[:, 0]
    v[:, -1] += u[:, 0] - u[:, -1]
    q = np.arange(h).reshape(h, 1)
    r = np.arange(w).reshape(1, w)
    den = 2 * np.cos(2 * np.pi * q / h) + 2 * np.cos(2 * np.pi * r / w) - 4
    den[0, 0] = 1
    s = np.fft.fft2(v) / den
    s[0, 0] = 0
    return u - np.real(np.fft.ifft2(s))


def blur(a, k):
    f = np.fft.fft2(a)
    h, w = a.shape
    y = np.fft.fftfreq(h).reshape(h, 1)
    x = np.fft.fftfreq(w).reshape(1, w)
    g = np.exp(-(x * x + y * y) * (k * k) * 2 * np.pi * np.pi)
    return np.real(np.fft.ifft2(f * g))


def seam_ratio(a):
    l = a.mean(2) if a.ndim == 3 else a
    seam = np.abs(l[:, 0] - l[:, -1]).mean() + np.abs(l[0, :] - l[-1, :]).mean()
    inner = np.abs(l[:, 1:] - l[:, :-1]).mean() + np.abs(l[1:, :] - l[:-1, :]).mean()
    return seam / inner


def main(src, dst):
    for name, (nstr, rbase, rcon, bright) in SPEC.items():
        im = Image.open(f'{src}/{name}.png').convert('RGB').resize((1024, 1024), Image.LANCZOS)
        a = np.asarray(im).astype(np.float64) / 255.0
        before = seam_ratio(a)
        a = np.stack([periodic(a[:, :, c]) for c in range(3)], 2)
        a = np.clip(a * bright, 0, 1)
        after = seam_ratio(a)
        lum = a @ np.array([0.299, 0.587, 0.114])
        height = blur(lum, 1.2)
        # 노멀(주기 경계 포함 미분)
        dx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * nstr
        dy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * nstr
        n = np.stack([-dx, dy, np.ones_like(dx)], 2)
        n /= np.linalg.norm(n, axis=2, keepdims=True)
        normal = ((n * 0.5 + 0.5) * 255).astype(np.uint8)
        # 거칠기: 밝은 부분(마모·먼지)은 거칠게, 어두운 부분(젖음·기름)은 매끄럽게
        detail = lum - blur(lum, 8)
        rough = np.clip(rbase + (lum - lum.mean()) * rcon + detail * 0.8, 0.05, 1.0)
        Image.fromarray((a * 255).astype(np.uint8)).save(f'{dst}/{name}_c.jpg', quality=88)
        Image.fromarray(normal).save(f'{dst}/{name}_n.jpg', quality=92)
        Image.fromarray((rough * 255).astype(np.uint8)).save(f'{dst}/{name}_r.jpg', quality=88)
        print(f'{name}: seam ratio {before:.2f} -> {after:.2f}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
