import os
from pydantic_settings import BaseSettings

# Direct read
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", ".env")
print(f"Reading from: {env_path}")

if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                key = line.split("=")[0]
                val = "=".join(line.split("=")[1:])
                print(f"{key} = {val}")
else:
    print("File not found")