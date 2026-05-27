"""
Telegram bot for NeoAssistence remote control.

Usage:
  Create bot.env: BOT_TOKEN=your_token
  Then: python telegram_bot.py

Commands:
  /status     - Server & deploy status
  /deploy     - Build & push frontend
  /gitpull    - git pull
  /logs       - Last 20 lines of backend log
  /restart    - Restart backend service
  /help       - Show this menu
"""

import os, subprocess, asyncio, logging
from pathlib import Path
from dotenv import load_dotenv
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

load_dotenv("bot.env")
logging.basicConfig(level=logging.INFO)

ROOT = Path(__file__).parent

async def run_cmd(cmd: str, timeout: int = 60) -> str:
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout, cwd=ROOT)
        out = (r.stdout or "") + (r.stderr or "")
        return out[:2000] or "OK (no output)"
    except subprocess.TimeoutExpired:
        return "Command timed out"
    except Exception as e:
        return f"Error: {e}"

async def cmd_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    git = await run_cmd("git log --oneline -3")
    await update.message.reply_text(
        f"Estado del servidor:\n\n"
        f"Ultimos commits:\n{git}\n"
        f"Bot activo",
    )

async def cmd_deploy(update: Update, context: ContextTypes.DEFAULT_TYPE):
    msg = await update.message.reply_text("Desplegando...")
    out = await run_cmd("cd frontend && npx next build 2>&1")
    await msg.edit_text(f"Deploy completo:\n\n{out[-1500:]}")

async def cmd_gitpull(update: Update, context: ContextTypes.DEFAULT_TYPE):
    out = await run_cmd("git pull")
    await update.message.reply_text(f"Git pull:\n{out}")

async def cmd_logs(update: Update, context: ContextTypes.DEFAULT_TYPE):
    log_file = ROOT / "backend" / "app.log"
    if log_file.exists():
        out = await run_cmd(f"powershell -Command \"Get-Content '{log_file}' -Tail 20\"")
    else:
        out = "No log file found"
    await update.message.reply_text(f"Ultimos logs:\n{out}")

async def cmd_restart(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Reiniciando backend...")
    out = await run_cmd("powershell -Command \"Restart-Service neoass-backend -ErrorAction SilentlyContinue; echo 'done'\"")
    await update.message.reply_text(f"Resultado: {out}")

async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Comandos disponibles:\n\n"
        "/status - Estado del servidor\n"
        "/deploy - Build frontend\n"
        "/gitpull - Traer cambios del repo\n"
        "/logs - Ultimos logs\n"
        "/restart - Reiniciar backend\n"
        "/help - Este menu",
    )

def main():
    token = os.environ.get("BOT_TOKEN")
    if not token:
        print("ERROR: Set BOT_TOKEN in bot.env file")
        return
    app = Application.builder().token(token).build()
    app.add_handler(CommandHandler("status", cmd_status))
    app.add_handler(CommandHandler("deploy", cmd_deploy))
    app.add_handler(CommandHandler("gitpull", cmd_gitpull))
    app.add_handler(CommandHandler("logs", cmd_logs))
    app.add_handler(CommandHandler("restart", cmd_restart))
    app.add_handler(CommandHandler("help", cmd_help))
    print("NeoAss Bot running...")
    app.run_polling()

if __name__ == "__main__":
    main()
