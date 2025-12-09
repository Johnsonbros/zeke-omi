#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "Building Zeke Core..."
echo "Working directory: $(pwd)"

ZEKE_DIR="$SCRIPT_DIR/zeke-core"

echo "Installing Python dependencies..."
if [ -f "$ZEKE_DIR/requirements.txt" ]; then
    pip install --no-cache-dir -r "$ZEKE_DIR/requirements.txt"
fi

echo "Building dashboard..."
cd "$ZEKE_DIR/dashboard"
npm ci
npm run build

echo "Cleaning up dev dependencies..."
npm prune --production 2>/dev/null || true

echo "Build complete!"
