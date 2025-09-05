import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  // Установка пользовательского контекста для RLS
  const setUserContext = async (tgId) => {
    await supabase.rpc('set_current_user_id', { user_tg_id: tgId })
  }

  try {
    const tgId = req.headers['x-telegram-id']
    
    if (!tgId) {
      return res.status(401).json({ error: 'Telegram ID required' })
    }

    await setUserContext(tgId)

    // GET - получение списка полетов
    if (req.method === 'GET') {
      const { status, search } = req.query
      
      let query = supabase
        .from('flights')
        .select('*')
        .order('date', { ascending: false })

      if (status) {
        query = query.eq('status', status)
      }

      if (search) {
        query = query.ilike('route', `%${search}%`)
      }

      const { data, error } = await query

      if (error) throw error

      return res.status(200).json({ flights: data })
    }

    // POST - создание нового полета
    if (req.method === 'POST') {
      const { date, route, costs, profit, manager_comment, status } = req.body
      
      // Получаем ID пользователя
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('tg_id', tgId)
        .single()

      if (userError) throw userError

      const { data: flight, error: insertError } = await supabase
        .from('flights')
        .insert([{
          date,
          route,
          costs: costs || 0,
          profit: profit || 0,
          manager_comment,
          status: status || 'planned',
          created_by: user.id
        }])
        .select()
        .single()

      if (insertError) throw insertError

      // Логируем действие
      await supabase
        .from('audit_log')
        .insert([{
          user_id: user.id,
          action: 'create',
          table_name: 'flights',
          record_id: flight.id,
          new_values: flight
        }])

      return res.status(201).json({ flight })
    }

    // PUT - обновление полета
    if (req.method === 'PUT') {
      const { id, ...updates } = req.body

      if (!id) {
        return res.status(400).json({ error: 'Flight ID required' })
      }

      // Получаем текущие данные полета
      const { data: oldFlight, error: selectError } = await supabase
        .from('flights')
        .select('*')
        .eq('id', id)
        .single()

      if (selectError) throw selectError

      // Получаем ID пользователя
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('tg_id', tgId)
        .single()

      if (userError) throw userError

      const { data: flight, error: updateError } = await supabase
        .from('flights')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

      if (updateError) throw updateError

      // Логируем действие
      await supabase
        .from('audit_log')
        .insert([{
          user_id: user.id,
          action: 'update',
          table_name: 'flights',
          record_id: id,
          old_values: oldFlight,
          new_values: flight
        }])

      // Отправляем уведомление при изменении статуса
      if (updates.status && updates.status !== oldFlight.status) {
        // Асинхронно отправляем уведомление
        fetch(`${process.env.VERCEL_URL}/api/notify-status-change`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Secret': process.env.API_SECRET
          },
          body: JSON.stringify({
            flightId: id,
            oldStatus: oldFlight.status,
            newStatus: updates.status,
            userId: user.id
          })
        }).catch(console.error)
      }

      return res.status(200).json({ flight })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('Flights API error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}