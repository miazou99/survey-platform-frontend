import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// 是否已配置
export const isSupabaseConfigured = () => {
  return !!(supabaseUrl && supabaseAnonKey);
};

// 创建 Supabase 客户端（延迟初始化，避免在模块加载时就报错）
let supabaseInstance: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!supabaseInstance) {
    if (isSupabaseConfigured()) {
      supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
    } else {
      // 返回一个最小化的 mock 对象，避免报错
      supabaseInstance = {
        from: () => ({
          select: async () => ({ data: [], error: null }),
          insert: async () => ({ data: null, error: { message: 'Supabase not configured' } }),
          update: async () => ({ data: null, error: { message: 'Supabase not configured' } }),
          upsert: async () => ({ data: null, error: { message: 'Supabase not configured' } }),
          delete: async () => ({ data: null, error: { message: 'Supabase not configured' } }),
        }),
        auth: {
          getSession: async () => ({ data: { session: null }, error: null }),
          signIn: async () => ({ data: null, error: { message: 'Supabase not configured' } }),
          signOut: async () => ({ error: null }),
        },
      } as unknown as ReturnType<typeof createClient>;
    }
  }
  return supabaseInstance;
}

// 为了兼容现有代码，导出一个代理对象
export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_, prop) {
    const client = getSupabaseClient();
    const value = (client as any)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});