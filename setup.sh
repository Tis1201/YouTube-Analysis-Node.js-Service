#!/bin/bash

echo "🚀 Starting setup for YouTube Analysis Service..."

# 1. Check if Docker is installed
if ! command -v docker &> /dev/null
then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# 2. Check if the container already exists
if [ "$(docker ps -aq -f name=youtube-analysis-service)" ]; then
    echo "⚠️ Container 'youtube-analysis-service' already exists."
    
    # If the container is running
    if [ "$(docker ps -q -f name=youtube-analysis-service)" ]; then
        echo "✅ Container is already running. No setup needed."
    else
        echo "🔄 Starting the existing container..."
        docker start youtube-analysis-service
    fi
    exit 0
fi

# 3. Install dependencies (optional, if you want to run locally)
echo "📦 Installing dependencies..."
pnpm install || npm install || yarn install

# 4. Build Docker image
echo "🐳 Building Docker image..."
docker build -t youtube-analysis-service .

# 5. Run container
echo "▶️ Running container..."
docker run -d \
    --name youtube-analysis-service \
    -p 3000:3000 \
    --env-file .env \
    youtube-analysis-service

echo "✅ Setup complete! Service is running at http://localhost:3000"
