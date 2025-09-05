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

    // GET - получение списка пользователей
    if (req.method === 'GET') {
      const { data: users, error } = await supabase
        .from('users')
        .select('id, tg_id, name, role, created_at')
        .order('created_at', { ascending: false })

      if (error) throw error

      return res.status(200).json({ users })
    }

    // PUT - обновление роли пользователя
    if (req.method === 'PUT') {
      const { id, role } = req.body

      if (!id || !role) {
        return res.status(400).json({ error: 'User ID and role are required' })
      }

      // Проверяем что текущий пользователь - администратор
      const { data: currentUser, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('tg_id', tgId)
        .single()

      if (userError) throw userError

      if (currentUser.role !== 'admin') {
        return res.status(403).json({ error: 'Only admin can update user roles' })
      }

      // Получаем старые данные пользователя
      const { data: oldUser, error: selectError } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single()

      if (selectError) throw selectError

      const { data: user, error: updateError } = await supabase
        .from('users')
        .update({ role })
        .eq('id', id)
        .select()
        .single()

      if (updateError) throw updateError

      // Логируем действие
      await supabase
        .from('audit_log')
        .insert([{
          user_id: currentUser.id,
          action: 'update',
          table_name: 'users',
          record_id: id,
          old_values: oldUser,
          new_values: user
        }])

      return res.status(200).json({ user })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('Users API error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}