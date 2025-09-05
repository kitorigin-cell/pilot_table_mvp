import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  const setUserContext = async (tgId) => {
    await supabase.rpc('set_current_user_id', { user_tg_id: tgId })
  }

  try {
    const tgId = req.headers['x-telegram-id']
    
    if (!tgId) {
      return res.status(401).json({ error: 'Telegram ID required' })
    }

    await setUserContext(tgId)

    // Проверяем что пользователь - администратор
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('tg_id', tgId)
      .single()

    if (userError) throw userError

    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admin can view audit logs' })
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const { page = 1, limit = 50 } = req.query

    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data: logs, error, count } = await supabase
      .from('audit_log')
      .select(`
        *,
        user:users(id, name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw error

    res.status(200).json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count
      }
    })
  } catch (error) {
    console.error('Audit API error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}