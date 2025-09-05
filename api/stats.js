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

    // Проверяем роль пользователя
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('tg_id', tgId)
      .single()

    if (userError) throw userError

    if (!['admin', 'accountant'].includes(user.role)) {
      return res.status(403).json({ error: 'Access denied' })
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const { period = 'month' } = req.query

    // Получаем статистику по прибылям и затратам
    let dateFilter = ''
    switch (period) {
      case 'week':
        dateFilter = 'date >= CURRENT_DATE - INTERVAL \'7 days\''
        break
      case 'month':
        dateFilter = 'date >= CURRENT_DATE - INTERVAL \'30 days\''
        break
      case 'quarter':
        dateFilter = 'date >= CURRENT_DATE - INTERVAL \'90 days\''
        break
      case 'year':
        dateFilter = 'date >= CURRENT_DATE - INTERVAL \'365 days\''
        break
    }

    const { data: stats, error: statsError } = await supabase
      .from('flights')
      .select('date, costs, profit, status')
      .eq('status', 'completed')
      .not('costs', 'is', null)
      .not('profit', 'is', null)
      .order('date', { ascending: true })

    if (statsError) throw statsError

    // Агрегируем данные по дням/неделям/месяцам
    const aggregatedData = stats.reduce((acc, flight) => {
      const date = new Date(flight.date).toISOString().split('T')[0]
      if (!acc[date]) {
        acc[date] = { date, costs: 0, profit: 0, flights: 0 }
      }
      acc[date].costs += parseFloat(flight.costs) || 0
      acc[date].profit += parseFloat(flight.profit) || 0
      acc[date].flights += 1
      return acc
    }, {})

    const chartData = Object.values(aggregatedData).sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    )

    // Общая статистика
    const totalStats = {
      totalFlights: stats.length,
      totalCosts: stats.reduce((sum, f) => sum + parseFloat(f.costs || 0), 0),
      totalProfit: stats.reduce((sum, f) => sum + parseFloat(f.profit || 0), 0),
      avgProfitPerFlight: stats.length > 0 
        ? stats.reduce((sum, f) => sum + parseFloat(f.profit || 0), 0) / stats.length 
        : 0
    }

    res.status(200).json({
      chartData,
      totalStats,
      period
    })
  } catch (error) {
    console.error('Stats API error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}