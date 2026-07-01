// KV 缓存层:仅依赖传入的 kv 实例

// 读缓存 → miss 时跑 loader → 回填
export const withCache = async (kv, key, ttlSec, loader) => {
  const cached = await kv.get(key, 'json');
  if (cached) return cached;
  const fresh = await loader();
  if (fresh !== null && fresh !== undefined) {
    try { await kv.put(key, JSON.stringify(fresh), { expirationTtl: ttlSec }); } catch {}
  }
  return fresh;
};

// 清空所有 rank:* 缓存(写操作后调用)
export const bustRanking = async (kv) => {
  const list = await kv.list({ prefix: 'rank:' });
  await Promise.all((list.keys || []).map(k => kv.delete(k.name)));
};

// ============ 评论预设(单条 KV 文本) ============
const PRESET_KEY = 'review_preset';

export const getReviewPreset = async (kv) => {
  return (await kv.get(PRESET_KEY)) || '';
};

export const setReviewPreset = async (kv, content) => {
  await kv.put(PRESET_KEY, content);
};