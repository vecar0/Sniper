/**
 * 3D 모델 내려받기 → 최적화 → public/models/<이름>.glb, src/arena/models.ts의 MODELS_AVAILABLE 갱신.
 * 최적화: 텍스처를 작게(tex px) + WebP, 중복 정점 합치기. (gltf-transform CLI를 npx로 실행)
 *   node scripts/models.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const list = JSON.parse(readFileSync('scripts/models.json', 'utf8'));
const work = join(tmpdir(), 'longshot-models');
mkdirSync(work, { recursive: true });
mkdirSync('public/models', { recursive: true });
const gt = (...args) => execFileSync('npx', ['--yes', '@gltf-transform/cli@4', ...args], { stdio: 'inherit' });

const done = [];
for (const [id, { url, tex, animOnly }] of Object.entries(list)) {
  if (id.startsWith('_')) continue;
  const raw = join(work, `${id}.raw.glb`);
  if (!existsSync(raw)) {
    // curl은 환경의 프록시 설정을 그대로 따른다(node fetch는 아님)
    execFileSync('curl', ['-sSfL', '-o', raw, url], { stdio: 'inherit' });
  }
  if (animOnly) {
    // 애니메이션만 쓰는 파일: 메시 · 재질 · 텍스처를 지우고 뼈대 + 동작만 남긴다
    const { NodeIO } = await import('@gltf-transform/core');
    const { prune } = await import('@gltf-transform/functions');
    const io = new NodeIO();
    const doc = await io.read(raw);
    for (const n of doc.getRoot().listNodes()) n.setMesh(null).setSkin(null);
    for (const m of doc.getRoot().listMeshes()) m.dispose();
    await doc.transform(prune());
    await io.write(`public/models/${id}.glb`, doc);
    console.log(`${id}: ${(statSync(raw).size / 1e6).toFixed(1)}MB → ${(statSync(`public/models/${id}.glb`).size / 1e6).toFixed(2)}MB (애니메이션만)`);
    done.push(id);
    continue;
  }
  const a = join(work, `${id}.a.glb`), b = join(work, `${id}.b.glb`);
  gt('weld', raw, a);
  gt('resize', a, b, '--width', String(tex), '--height', String(tex));
  gt('webp', b, `public/models/${id}.glb`, '--quality', '82');
  console.log(`${id}: ${(statSync(raw).size / 1e6).toFixed(1)}MB → ${(statSync(`public/models/${id}.glb`).size / 1e6).toFixed(2)}MB`);
  done.push(id);
}
const p = 'src/arena/models.ts';
const src = readFileSync(p, 'utf8').replace(/export const MODELS_AVAILABLE: ModelId\[\] = \[[^\]]*\];/, `export const MODELS_AVAILABLE: ModelId[] = [${done.map((d) => `'${d}'`).join(', ')}];`);
writeFileSync(p, src);
