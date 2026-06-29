// 邀请码生成:可被 routes/admin.js 或任何模块引用

export function genInviteCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map(b => b.toString(36).padStart(2, '0')).join('').toUpperCase().slice(0, 12);
}