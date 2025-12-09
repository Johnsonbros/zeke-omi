#!/bin/bash
# Download ML models required for local development
# These models are excluded from git to reduce repository size

echo "Downloading ML models..."

# Create directories if they don't exist
mkdir -p sdks/swift/Sources/omi-lib/Resources

# Download Whisper Tiny English model (~75MB)
if [ ! -f "sdks/swift/Sources/omi-lib/Resources/ggml-tiny.en.bin" ]; then
    echo "Downloading Whisper Tiny English model..."
    curl -L https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin \
        -o sdks/swift/Sources/omi-lib/Resources/ggml-tiny.en.bin
    echo "✓ Whisper model downloaded"
else
    echo "✓ Whisper model already exists"
fi

echo ""
echo "All ML models downloaded successfully!"
echo ""
echo "Note: If you need other Whisper models (base, small, medium, large),"
echo "visit: https://huggingface.co/ggerganov/whisper.cpp"
