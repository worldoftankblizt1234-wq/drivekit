// Counts Mapillary traffic-sign features inside Vietnam from z14 vector tiles.
// Resume-aware: reads/writes test/count-progress.json, writes test/count-result.json when done.
// A tile that answers 404/204 has no data and counts as 0 signs (success).
// Failed tiles are NEVER dropped: all of them persist in progress.failed
// and are re-queued first next run (past MAX_TILES they ride deferred).
// Failure reasons are recorded in progress.failReasons/failSamples.
// A 200 whose body is not a vector tile is retried (3 attempts), then recorded as 'invalid tile body'.
// RESET_COUNT=1 recounts from scratch, ignoring saved progress.
// Env: MAPILLARY_TOKEN (required, from a repository secret — never log it),
//      MAX_TILES_PER_RUN (default 45000, keeps each run under the 50k/day tile quota),
//      CONCURRENCY (default 20),
//      DRY_RUN_BBOX ("minLng,minLat,maxLng,maxLat" — test mode: no file writes, prints a summary).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PROGRESS_PATH = join(ROOT, 'test', 'count-progress.json');
const RESULT_PATH = join(ROOT, 'test', 'count-result.json');
const TOKEN = process.env.MAPILLARY_TOKEN || '';
if (!TOKEN) {
  console.error('ERROR: MAPILLARY_TOKEN is not set. Add it as a repository secret named MAPILLARY_TOKEN.');
  process.exit(1);
}
const MAX_TILES = Math.max(1, parseInt(process.env.MAX_TILES_PER_RUN || '45000', 10));
const CONC = Math.max(1, parseInt(process.env.CONCURRENCY || '20', 10));
const DRY_PARTS = (process.env.DRY_RUN_BBOX || '').split(',').map(Number);
const DRY = DRY_PARTS.length === 4 && DRY_PARTS.every(Number.isFinite);

// Simplified Natural Earth 1:110m Vietnam boundary, [lng, lat]. Same ring the test page uses.
const VN_RING = [[104.334335,10.486544],[105.199915,10.88931],[106.24967,10.961812],[105.810524,11.567615],[107.491403,12.337206],[107.614548,13.535531],[107.382727,14.202441],[107.564525,15.202173],[107.312706,15.908538],[106.556008,16.604284],[105.925762,17.485315],[105.094598,18.666975],[103.896532,19.265181],[104.183388,19.624668],[104.822574,19.886642],[104.435,20.758733],[103.203861,20.766562],[102.754896,21.675137],[102.170436,22.464753],[102.706992,22.708795],[103.504515,22.703757],[104.476858,22.81915],[105.329209,23.352063],[105.811247,22.976892],[106.725403,22.794268],[106.567273,22.218205],[107.04342,21.811899],[108.05018,21.55238],[106.715068,20.696851],[105.881682,19.75205],[105.662006,19.058165],[106.426817,18.004121],[107.361954,16.697457],[108.269495,16.079742],[108.877107,15.276691],[109.33527,13.426028],[109.200136,11.666859],[108.36613,11.008321],[107.220929,10.364484],[106.405113,9.53084],[105.158264,8.59976],[104.795185,9.241038],[105.076202,9.918491],[104.334335,10.486544]];

const Z = 14, N = 16384, EXTENT = 4096;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function inRing(x, y) {
  let ins = false;
  const n = VN_RING.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = VN_RING[i][0], yi = VN_RING[i][1], xj = VN_RING[j][0], yj = VN_RING[j][1];
    if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) ins = !ins;
  }
  return ins;
}
function boxIntersects(w, s, e, n) {
  if (e < 102.17 || w > 109.34 || n < 8.6 || s > 23.35) return false;
  const pts = [[w, s], [e, s], [e, n], [w, n], [(w + e) / 2, (s + n) / 2]];
  for (const [x, y] of pts) if (inRing(x, y)) return true;
  for (const [x, y] of VN_RING) if (x >= w && x <= e && y >= s && y <= n) return true;
  return false;
}
const lng2x = (lng) => Math.floor(((lng + 180) / 360) * N);
const lat2y = (lat) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * N);
};
const x2lng = (x) => (x / N) * 360 - 180;
const y2lat = (y) => {
  const n = Math.PI * (1 - (2 * y) / N);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
};

function buildTileList() {
  const x0 = lng2x(102.14), x1 = lng2x(109.34), y0 = lat2y(23.4), y1 = lat2y(8.55);
  const list = [];
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      const w = x2lng(x), e = x2lng(x + 1), n = y2lat(y), s = y2lat(y + 1);
      if (boxIntersects(w, s, e, n)) list.push([x, y]);
    }
  }
  list.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  return list;
}

class FatalError extends Error {}
class RateLimited extends Error {}

async function fetchTile(x, y) {
  const url = `https://tiles.mapillary.com/maps/vtp/mly_map_feature_traffic_sign/2/${Z}/${x}/${y}?access_token=${encodeURIComponent(TOKEN)}`;
  let retried429 = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 20000);
    try {
      const r = await fetch(url, { signal: ctl.signal });
      if (r.status === 403) throw new FatalError('HTTP 403 from tiles API (token invalid or blocked).');
      if (r.status === 429) {
        if (!retried429) {
          retried429 = true;
          await sleep(30000);
          continue;
        }
        throw new RateLimited('HTTP 429 persists after retry — daily tile quota likely reached.');
      }
      // A tile with no data answers 404/204: empty, not an error. Return
      // at once — retrying cannot create data.
      if (r.status === 404 || r.status === 204) return null;
      if (r.status !== 200) {
        if (attempt < 2) { await sleep(2000 * (attempt + 1)); continue; }
        const err = new Error('HTTP ' + r.status);
        err.status = r.status;
        throw err;
      }
      const buf = Buffer.from(await r.arrayBuffer());
      // A 200 can still carry a non-tile body (error page/JSON). Validate by
      // parsing: a body that is not a vector tile is retried like any other
      // transient failure, never tallied at once as a decode error.
      try {
        new VectorTile(new PbfReader(buf));
      } catch {
        if (attempt < 2) { await sleep(2000 * (attempt + 1)); continue; }
        const err = new Error('invalid tile body (not a vector tile)');
        err.invalidBody = true;
        throw err;
      }
      return buf;
    } catch (e) {
      if (e instanceof FatalError || e instanceof RateLimited) throw e;
      if (attempt < 2) { await sleep(2000 * (attempt + 1)); continue; }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error('tile fetch failed after retries');
}

function countTile(buf, tx, ty) {
  if (!buf || buf.length === 0) return { count: 0, samples: [] };
  const vt = new VectorTile(new PbfReader(buf));
  const layer = vt.layers.traffic_sign;
  if (!layer) return { count: 0, samples: [] };
  const seenIds = new Set();
  let count = 0;
  const samples = [];
  for (let i = 0; i < layer.length; i++) {
    const f = layer.feature(i);
    const id = f.properties && f.properties.id;
    if (id !== undefined && id !== null) {
      if (seenIds.has(id)) continue;
      seenIds.add(id);
    }
    const geom = f.loadGeometry();
    if (!geom || !geom[0] || !geom[0][0]) continue;
    const gx = geom[0][0].x, gy = geom[0][0].y;
    const lng = ((tx + gx / EXTENT) / N) * 360 - 180;
    const n = Math.PI * (1 - (2 * (ty + gy / EXTENT)) / N);
    const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
    if (inRing(lng, lat)) {
      count++;
      if (samples.length < 3) samples.push([Number(lng.toFixed(5)), Number(lat.toFixed(5))]);
    }
  }
  return { count, samples };
}

async function main() {
  const startedAt = Date.now();
  const allTiles = buildTileList();
  console.log(`Tile list: ${allTiles.length} land-intersecting z14 tiles.`);

  const RESET = !DRY && (process.env.RESET_COUNT === '1' || process.env.RESET_COUNT === 'true');
  let queue;
  let progress = null;
  let deferredFailed = [];
  let numFailedQueued = 0;
  if (DRY) {
    const [w, s, e, n] = DRY_PARTS;
    queue = allTiles.filter(([x, y]) => {
      const tw = x2lng(x), te = x2lng(x + 1), tn = y2lat(y), ts = y2lat(y + 1);
      return te >= w && tw <= e && tn >= s && ts <= n;
    }).slice(0, 200);
    console.log(`DRY RUN: ${queue.length} tiles in bbox, no files written.`);
  } else {
    if (existsSync(PROGRESS_PATH)) {
      try { progress = JSON.parse(readFileSync(PROGRESS_PATH, 'utf8')); } catch { progress = null; }
    }
    if (RESET || !progress || !Array.isArray(progress.failed) || typeof progress.nextIndex !== 'number') {
      if (RESET) console.log('RESET_COUNT is set — recounting from scratch, saved progress ignored.');
      progress = { nextIndex: 0, total: 0, runs: 0, failed: [] };
    }
    const failedTiles = progress.failed
      .map((k) => k.split('/').map(Number))
      .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
    // Failed tiles go first, but one run must never exceed MAX_TILES:
    // failures past the cap ride in deferredFailed and are carried into
    // the next run untouched. Nothing is ever dropped.
    const queuedFailed = failedTiles.slice(0, MAX_TILES);
    deferredFailed = failedTiles.slice(MAX_TILES);
    numFailedQueued = queuedFailed.length;
    const budget = Math.max(0, MAX_TILES - queuedFailed.length);
    const fresh = allTiles.slice(progress.nextIndex, progress.nextIndex + budget);
    queue = [...queuedFailed, ...fresh];
    console.log(`Resume: nextIndex=${progress.nextIndex}, counted-so-far=${progress.total}, failed-queued=${queuedFailed.length}, failed-deferred=${deferredFailed.length}, this-run-tiles=${queue.length}.`);
  }

  let done = 0, signs = 0, failed = [];
  const failReasons = {};
  const failSamples = [];
  let stopFlag = false, fatal = null;
  let qi = 0;
  const t0 = Date.now();
  async function worker() {
    while (qi < queue.length && !stopFlag && !fatal) {
      const idx = qi++;
      const [x, y] = queue[idx];
      try {
        const buf = await fetchTile(x, y);
        const { count, samples } = countTile(buf, x, y);
        signs += count;
        if (samples.length && done < 3) console.log(`sample z${Z}/${x}/${y}:`, JSON.stringify(samples));
      } catch (e) {
        if (e instanceof FatalError) { fatal = e; break; }
        if (e instanceof RateLimited) { stopFlag = true; console.log('RATE LIMITED — stopping run, progress will be saved.'); break; }
        failed.push(`${x}/${y}`);
        const reason = e.status ? `HTTP ${e.status}` : (e.invalidBody ? 'invalid tile body' : (e.name === 'AbortError' ? 'timeout' : `error: ${String(e.message || e).slice(0, 60)}`));
        failReasons[reason] = (failReasons[reason] || 0) + 1;
        if (failSamples.length < 10) failSamples.push(`${x}/${y}: ${reason}`);
      }
      done++;
      if (done % 1000 === 0) {
        console.log(`progress: ${done}/${queue.length} tiles, signs=${signs}, failed=${failed.length}, ${Math.round((Date.now() - t0) / 1000)}s`);
      }
    }
  }
  const workers = [];
  for (let i = 0; i < CONC; i++) workers.push(worker());
  await Promise.all(workers);

  if (fatal) {
    console.error('FATAL: ' + fatal.message);
    process.exit(1);
  }
  console.log(`Run finished: ${done}/${queue.length} tiles attempted, signs-in-run=${signs}, failed=${failed.length}, failReasons=${JSON.stringify(failReasons)}, rateLimited=${stopFlag}, ${Math.round((Date.now() - startedAt) / 1000)}s total.`);

  if (DRY) {
    console.log(`DRY RUN TOTAL for bbox: ${signs} signs in ${done} tiles.`);
    return;
  }

  // Queue order is failed-first, so `done` counts from the front: tiles attempted
  // beyond the failed prefix are fresh tiles, and nextIndex must advance only
  // past fresh tiles actually attempted — never past unattempted ones.
  // Failed tiles never attempted this run stay in the failed list.
  const freshAttempted = Math.max(0, done - numFailedQueued);
  const nextIndex = Math.min(allTiles.length, progress.nextIndex + freshAttempted);
  const unattemptedFailed = queue.slice(done, numFailedQueued).map(([x, y]) => `${x}/${y}`);
  const allFailed = [...unattemptedFailed, ...failed, ...deferredFailed.map(([x, y]) => `${x}/${y}`)];
  const mergedReasons = { ...(progress.failReasons || {}) };
  for (const [k, v] of Object.entries(failReasons)) mergedReasons[k] = (mergedReasons[k] || 0) + v;
  const newProgress = {
    nextIndex,
    total: progress.total + signs,
    runs: progress.runs + 1,
    failed: allFailed,
    failReasons: mergedReasons,
    failSamples,
    updatedAt: new Date().toISOString(),
    tilesTotal: allTiles.length,
    rateLimited: stopFlag,
  };
  mkdirSync(join(ROOT, 'test'), { recursive: true });
  writeFileSync(PROGRESS_PATH, JSON.stringify(newProgress, null, 2) + '\n');
  console.log(`Progress saved: nextIndex=${nextIndex}/${allTiles.length}, total=${newProgress.total}, failed=${allFailed.length}.`);

  if (nextIndex >= allTiles.length && allFailed.length === 0) {
    const result = {
      total: newProgress.total,
      tilesTotal: allTiles.length,
      failedTiles: 0,
      countedAt: new Date().toISOString(),
      runs: newProgress.runs,
    };
    writeFileSync(RESULT_PATH, JSON.stringify(result, null, 2) + '\n');
    console.log(`DONE. Total traffic signs in Vietnam: ${result.total}.`);
  } else {
    console.log('Not done yet — re-run (manually or on schedule) to continue.');
  }
}

main().catch((e) => {
  console.error('UNEXPECTED ERROR: ' + (e && e.stack ? e.stack : String(e)));
  process.exit(1);
});
