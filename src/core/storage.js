// R2 对象存储:仅依赖传入的 r2 实例

export const uploadImage = async (r2, file) => {
  const buf = await file.arrayBuffer();
  const ext = (file.type.split('/')[1] || 'jpg');
  const key = `card_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await r2.put(key, buf, { httpMetadata: { contentType: file.type } });
  return { key };
};

export const getImage = async (r2, key) => {
  if (!key) return null;
  const obj = await r2.get(key);
  if (!obj) return null;
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=86400');
  return new Response(obj.body, { headers });
};