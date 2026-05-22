#!/bin/bash
cd /opt/render/project/src/backend
uvicorn app.main:app --host 0.0.0.0 --port $PORT
