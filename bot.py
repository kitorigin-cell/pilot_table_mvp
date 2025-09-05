#API_TOKEN = "8455605775:AAG_wSjBAhA9rWr2a9BWC86ElgisTXJjhnA"
#pilot-table-mvp.vercel
import asyncio
import logging
import os
import json
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

API_TOKEN = "8455605775:AAG_wSjBAhA9rWr2a9BWC86ElgisTXJjhnA"
USERS_FILE = os.path.join(os.getcwd(), "data", "users.json")

logging.basicConfig(level=logging.INFO)

bot = Bot(token=API_TOKEN)
dp = Dispatcher()

# =================== Вспомогательные функции ===================
def load_users():
    with open(USERS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_users(users):
    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, indent=2, ensure_ascii=False)

# =================== Команды ===================

@dp.message(Command(commands=["start"]))
async def start_handler(message: types.Message):
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="Открыть таблицу полётов",
                    web_app=WebAppInfo(url="https://pilot-table-mvp.vercel.app/miniapp/index.html")
                )
            ]
        ]
    )
    await message.answer("Привет! Открой таблицу:", reply_markup=keyboard)

@dp.message(Command(commands=["whoami"]))
async def whoami_handler(message: types.Message):
    await message.answer(f"Ваш tg_id: {message.from_user.id}")

@dp.message(Command(commands=["make_admin"]))
async def make_admin_handler(message: types.Message):
    args = message.text.split()
    if len(args) != 2:
        await message.answer("Использование: /make_admin <tg_id>")
        return

    try:
        tg_id = int(args[1])
    except ValueError:
        await message.answer("tg_id должен быть числом.")
        return

    users = load_users()
    user = next((u for u in users if u["tg_id"] == tg_id), None)

    if not user:
        await message.answer(f"Пользователь с tg_id={tg_id} не найден.")
        return

    user["role"] = "admin"
    save_users(users)
    await message.answer(f"Пользователь {user['username']} теперь администратор!")

# =================== Запуск бота ===================
async def main():
    try:
        logging.info("Бот запускается...")
        await dp.start_polling(bot)
    finally:
        await bot.session.close()

if __name__ == "__main__":
    asyncio.run(main())