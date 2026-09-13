"""FastAPI 入口。

启动（在 backend/ 目录下）：
    uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
或双击 run.bat / 运行 python run.py
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import UPLOAD_DIR
from .deps import ApiError
from .routers.admin import router as admin_router
from .routers.api import router

app = FastAPI(title="同路人 · 校园拼车后端", version="1.0.0")

# H5 预览（https 页面 + 本地 http 接口）与小程序开发期都需要跨域
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Auth-Token"],
)


@app.exception_handler(ApiError)
async def api_error_handler(request: Request, exc: ApiError):
    return JSONResponse(
        status_code=exc.http_status,
        content={"code": exc.code, "message": exc.message, "data": None},
    )


app.include_router(router)
app.include_router(admin_router)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# 管理员后台静态页面（HTML/CSS/JS，无构建）
from pathlib import Path
_admin_dir = Path(__file__).resolve().parent.parent / "admin"
if _admin_dir.exists():
    app.mount("/admin", StaticFiles(directory=str(_admin_dir), html=True), name="admin")


@app.get("/")
def root():
    return {"service": "同路人校园拼车 Python 后端", "docs": "/docs", "health": "/api/health"}
