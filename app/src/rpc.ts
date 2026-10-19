// The ONLY network access point (PRD v4 §13, D-64). Clients never read tables; every call is an RPC.
const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_KEY as string | undefined;
export const configured = Boolean(URL_ && KEY && !/service_role|sb_secret_/.test(KEY));

export class RpcError extends Error {
  constructor(public code: string, public detail?: string) { super(code); }
}

export async function rpc<T = any>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!configured) throw new RpcError('E_CONFIG');
  const headers: Record<string, string> = { 'Content-Type': 'application/json', apikey: KEY! };
  if (KEY!.startsWith('eyJ')) headers.Authorization = `Bearer ${KEY}`; // legacy JWT keys only; publishable keys are not JWTs
  let res: Response;
  try { res = await fetch(`${URL_}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(args) }); }
  catch { throw new RpcError('E_NETWORK'); }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new RpcError(body?.message ?? `HTTP_${res.status}`, body?.details);
  return body as T;
}

// login-style RPCs return {ok:false, error} instead of raising, so counters persist
export async function rpcOk<T = Record<string, never>>(fn: string, args: Record<string, unknown>): Promise<T> {
  const r = await rpc<{ ok?: boolean; error?: string; detail?: string }>(fn, args);
  if (r && r.ok === false) throw new RpcError(r.error ?? 'E_UNKNOWN', r.detail);
  return r as unknown as T;
}
