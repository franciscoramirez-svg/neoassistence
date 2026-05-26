"""
Telegram bot for NeoAssistence remote control.

Usage:
  Set BOT_TOKEN env var or create .env with BOT_TOKEN=your_token
  Then: python telegram_bot.py

Commands:
  /status     - Server & deploy status
  /deploy     - Build & push frontend
  /gitpull    - git pull
  /logs       - Last 20 lines of backend log
  /restart    - Restart backend service
  /help       - Show this menu
"""

import os, subprocess, asyncio, logging, time
from pathlib import Path
from dotenv import load_dotenv
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

load_dotenv("bot.env")
logging.basicConfig(level=logging.INFO)

ROOT = Path(__file__).parent
ALLOWED_IDS = os.environ.get("ALLOWED_TELEGRAM_IDS", "").split(",")

def is_allowed(uid: int) -> bool:
    return not ALLOWED_IDS or str(uid) in ALLOWED_IDS

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
    if not is_allowed(update.effective_user.id):
        return await update.message.reply_text("No autorizado")
    git = await run_cmd("git log --oneline -3")
    uptime = await run_cmd("powershell -Command \"(Get-Date) - (Get-Process -Id $PID).StartTime | Select-Object -ExpandProperty TotalMinutes\"")
    await update.message.reply_text(
        f"🤖 *NeoAss Bot activo*\n\n"
        f"📦 *Últimos commits:*\n{git}\n"
        f"⏱️ *Uptime:* {uptime.strip():.0f} min",
        parse_mode="Markdown"
    )

async def cmd_deploy(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_allowed(update.effective_user.id):
        return await update.message.reply_text("No autorizado")
    msg = await update.message.reply_text("🚀 Desplegando...")
    out = await run_cmd("cd frontend && npx next build 2>&1")
    await msg.edit_text(f"✅ *Deploy completo*\n\n```\n{out[-1500:]}\n```", parse_mode="Markdown")

async def cmd_gitpull(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_allowed(update.effective_user.id):
        return await update.message.reply_text("No autorizado")
    out = await run_cmd("git pull")
    await update.message.reply_text(f"📥 *Git pull:*\n```\n{out}\n```", parse_mode="Markdown")

async def cmd_logs(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_allowed(update.effective_user.id):
        return await update.message.reply_text("No autorizado")
    log_file = ROOT / "backend" / "app.log"
    if log_file.exists():
        out = await run_cmd(f"powershell -Command \"Get-Content '{log_file}' -Tail 20\"")
    else:
        out = "No log file found"
    await update.message.reply_text(f"📋 *Últimos logs:*\n```\n{out}\n```", parse_mode="Markdown")

async def cmd_restart(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_allowed(update.effective_user.id):
        return await update.message.reply_text("No autorizado")
    await update.message.reply_text("🔄 Reiniciando backend...")
    out = await run_cmd("powershell -Command \"Restart-Service neoass-backend -ErrorAction SilentlyContinue; echo 'done'\"")
    await update.message.reply_text(f"Resultado: {out}")

async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "🤖 *Comandos disponibles:*\n\n"
        "/status - Estado del servidor\n"
        "/deploy - Build frontend y deploy\n"
        "/gitpull - Traer cambios del repo\n"
        "/logs - Últimos logs\n"
        "/restart - Reiniciar backend\n"
        "/help - Este menú",
        parse_mode="Markdown"
    )

def main():
    token = os.environ.get("BOT_TOKEN")
    if not token:
        print("ERROR: Set BOT_TOKEN env var or in .env file")
        return
    app = Application.builder().token(token).build()
    app.add_handler(CommandHandler("status", cmd_status))
    app.add_handler(CommandHandler("deploy", cmd_deploy))
    app.add_handler(CommandHandler("gitpull", cmd_gitpull))
    app.add_handler(CommandHandler("logs", cmd_logs))
    app.add_handler(CommandHandler("restart", cmd_restart))
    app.add_handler(CommandHandler("help", cmd_help))
    print("🤖 NeoAss Bot running... Press Ctrl+C to stop")
    app.run_polling()

if __name__ == "__main__":
    main()
