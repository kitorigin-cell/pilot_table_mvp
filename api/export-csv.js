import { createClient } from '@supabase/supabase-js'
import { Parser } from 'json2csv'

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

    // Проверяем роль пользователя
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('tg_id', tgId)
      .single()

    if (userError) throw userError

    if (!['admin', 'accountant', 'manager'].includes(user.role)) {
      return res.status(403).json({ error: 'Access denied' })
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const { status, startDate, endDate } = req.query

    let query = supabase
      .from('flights')
      .select('*')
      .order('date', { ascending: false })

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    if (startDate) {
      query = query.gte('date', startDate)
    }

    if (endDate) {
      query = query.lte('date', endDate)
    }

    const { data: flights, error } = await query

    if (error) throw error

    // Форматируем данные для CSV
    const formattedData = flights.map(flight => ({
      Дата: new Date(flight.date).toLocaleDateString('ru-RU'),
      Маршрут: flight.route,
      Статус: getStatusText(flight.status),
      'Затраты': flight.costs,
      'Прибыль': flight.profit,
      'Комментарий менеджера': flight.manager_comment || '',
      'Комментарий пилота': flight.pilot_comment || '',
      'Дата создания': new Date(flight.created_at).toLocaleDateString('ru-RU')
    }))

    const parser = new Parser()
    const csv = parser.parse(formattedData)

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename=flights-export.csv')
    res.status(200).send(csv)

  } catch (error) {
    console.error('CSV export error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

function getStatusText(status) {
  const statusMap = {
    'planned': 'Запланирован',
    'cancelled': 'Отменен',
    'in-progress': 'Выполняется',
    'completed': 'Выполнен'
  }
  return statusMap[status] || status
}