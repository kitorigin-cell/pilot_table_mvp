import logging
from aiogram import Bot, Dispatcher, types
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from aiogram.utils import executor
import os

API_TOKEN = os.getenv("BOT_TOKEN")

logging.basicConfig(level=logging.INFO)

bot = Bot(token=API_TOKEN)
dp = Dispatcher(bot)

@dp.message_handler(commands=["start"])
async def start(message: types.Message):
    keyboard = InlineKeyboardMarkup().add(
        InlineKeyboardButton(
            "Открыть таблицу полётов",
            web_app=WebAppInfo(url="https://YOUR_PROJECT.vercel.app/miniapp/index.html")
        )
    )
    await message.answer("Привет! Открой таблицу:", reply_markup=keyboard)

if __name__ == "__main__":
    executor.start_polling(bot, skip_updates=True)