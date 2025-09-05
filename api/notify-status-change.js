import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  // Проверка секретного ключа
  if (req.headers['x-api-secret'] !== process.env.API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { flightId, oldStatus, newStatus, userId } = req.body

    // Получаем информацию о полете
    const { data: flight, error: flightError } = await supabase
      .from('flights')
      .select('route, date')
      .eq('id', flightId)
      .single()

    if (flightError) throw flightError

    // Получаем пользователей для уведомления
    const { data: usersToNotify, error: usersError } = await supabase
      .from('users')
      .select('tg_id, role')
      .in('role', ['admin', 'manager'])
      .not('tg_id', 'is', null)

    if (usersError) throw usersError

    // Формируем сообщение
    const message = `🔄 Изменение статуса рейса
Маршрут: ${flight.route}
Дата: ${new Date(flight.date).toLocaleDateString('ru-RU')}
Статус: ${getStatusText(oldStatus)} → ${getStatusText(newStatus)}`

    // Отправляем уведомления
    const sendPromises = usersToNotify.map(async user => {
      try {
        const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: user.tg_id,
            text: message,
            parse_mode: 'HTML'
          }),
        })

        if (!response.ok) {
          console.error(`Failed to send notification to user ${user.tg_id}`)
        }
      } catch (error) {
        console.error('Error sending notification:', error)
      }
    })

    await Promise.all(sendPromises)

    res.status(200).json({ success: true })
  } catch (error) {
    console.error('Notification error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

function getStatusText(status) {
  const statusMap = {
    'planned': '📅 Запланирован',
    'cancelled': '❌ Отменен',
    'in-progress': '✈️ Выполняется',
    'completed': '✅ Выполнен'
  }
  return statusMap[status] || status
}