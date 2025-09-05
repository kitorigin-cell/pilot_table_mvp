export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { message } = req.body

    // Обработка команды /start
    if (message?.text === '/start') {
      const webAppUrl = `https://${process.env.VERCEL_URL}`
      
      try {
        // Отправляем сообщение с кнопкой открытия Mini App
        const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: message.chat.id,
            text: 'Добро пожаловать в систему управления полетами! 🛫',
            reply_markup: {
              inline_keyboard: [
                [{
                  text: 'Открыть приложение',
                  web_app: { url: webAppUrl }
                }]
              ]
            }
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to send message')
        }
      } catch (error) {
        console.error('Error handling /start command:', error)
      }
    }

    res.status(200).end()
  } else {
    res.status(404).end()
  }
}