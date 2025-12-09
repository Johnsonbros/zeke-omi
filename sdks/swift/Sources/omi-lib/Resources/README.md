# ML Model Resources

Machine learning model files are excluded from the repository to reduce size for Replit deployment.

## Required Model

The Swift SDK requires the Whisper Tiny English model:

- `ggml-tiny.en.bin` (~75MB) - Whisper model for local speech-to-text transcription

## How to Get the Model

### Option 1: Download from Whisper.cpp

```bash
# Clone whisper.cpp repository
git clone https://github.com/ggerganov/whisper.cpp.git

# Download the model
cd whisper.cpp
bash ./models/download-ggml-model.sh tiny.en

# Copy to this directory
cp models/ggml-tiny.en.bin /path/to/omi/sdks/swift/Sources/omi-lib/Resources/
```

### Option 2: Direct Download

Download directly from the Whisper.cpp models:
```
https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin
```

Place the downloaded file in this directory: `sdks/swift/Sources/omi-lib/Resources/`

## Alternative Models

You can also use other Whisper models by downloading different sizes:
- `tiny` - Fastest, lowest accuracy (~75MB)
- `base` - Good balance (~150MB)
- `small` - Better accuracy (~500MB)
- `medium` - High accuracy (~1.5GB)
- `large` - Best accuracy (~3GB)

Note: These files are automatically excluded via `.gitignore` to keep the repository size under 8GB for Replit deployment.
