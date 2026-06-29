// HTTP 相关小工具:cookie 序列化/解析、JSON 响应、HTML 响应

export function parseCookies(req) {
  const h = req.headers.get('Cookie') || '';
  const out = {};
  h.split(';').forEach(p => {
    const [k, ...v] = p.trim().split('=');
    if (k) out[k] = v.join('=');
  });
  return out;
}

export function cookieHeader(name, value, maxAge) {
  const parts = [
    `${name}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax',
    'Max-Age=' + maxAge, 'Secure',
  ];
  return parts.join('; ');
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}