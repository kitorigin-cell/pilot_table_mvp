import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { initData } = req.body
    
    if (!initData) {
      return res.status(400).json({ error: 'initData is required' })
    }

    // В реальном приложении здесь должна быть проверка подписи Telegram WebApp
    // Для упрощения пропускаем проверку в демо-версии

    const urlParams = new URLSearchParams(initData)
    const tgId = urlParams.get('user[id]')
    const firstName = urlParams.get('user[first_name]')
    const lastName = urlParams.get('user[last_name]')
    const userName = `${firstName} ${lastName || ''}`.trim()

    if (!tgId) {
      return res.status(400).json({ error: 'Telegram user ID not found' })
    }

    // Проверяем существование пользователя
    let { data: user, error: selectError } = await supabase
      .from('users')
      .select('*')
      .eq('tg_id', tgId)
      .single()

    if (selectError && selectError.code !== 'PGRST116') {
      throw selectError
    }

    // Создаем пользователя если не существует
    if (!user) {
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([{ 
          tg_id: tgId, 
          name: userName, 
          role: 'pilot' 
        }])
        .select()
        .single()

      if (insertError) throw insertError
      
      user = newUser

      // Логируем создание пользователя
      await supabase
        .from('audit_log')
        .insert([{
          user_id: user.id,
          action: 'create',
          table_name: 'users',
          record_id: user.id,
          new_values: user
        }])
    }

    res.status(200).json({ user })
  } catch (error) {
    console.error('Auth error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}