# Japanese Translator for Vicinae 🗾

A translation extension for [Vicinae](https://github.com/vicinaehq/vicinae) that streamlines Japanese vocabulary mining with instant translation, Anki integration, and VoiceVox audio synthesis.

![extension](https://kurojs.github.io/AssetHub/images/extension_optimized.gif)

## Overview

This extension eliminates friction in vocabulary mining workflows. Traditional vocabulary capture involves multiple manual steps: copying text, opening a dictionary, creating an Anki card, and pasting content. This extension reduces that process to a single keyboard shortcut.

**Platform:** Arch Linux and Arch-based distributions only.

## Features

- Instant translation via Google Translate API
- One-click Anki card creation through AnkiConnect
- Japanese text-to-speech using VoiceVox
- Automatic text loading from clipboard or selection
- Debounced translation (500ms) to reduce API calls
- Support for 10+ target languages

![Actions](https://i.imgur.com/gB9StFG.png)

## Prerequisites

### 1. Vicinae

Install Vicinae on your Arch Linux system:

```bash
# Recommended: AUR package
yay -S vicinae-bin
```

Or download from [GitHub releases](https://github.com/vicinaehq/vicinae/releases).

Configure a keyboard shortcut in your window manager to launch Vicinae.

### 2. Anki with AnkiConnect

Download and install Anki from [https://apps.ankiweb.net/#downloads](https://apps.ankiweb.net/#downloads)

Install AnkiConnect plugin:
1. Open Anki
2. Tools → Add-ons → Get Add-ons...
3. Enter code: `2055492159`
4. Restart Anki

Verify installation:

```bash
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{"action": "version", "version": 6}'
```

Expected response: `{"result": 6, "error": null}`

> **Note:** Keep Anki running in the background for the extension to work.

### 3. VoiceVox (Optional)

Download and install VoiceVox from [https://voicevox.hiroshiba.jp/](https://voicevox.hiroshiba.jp/)

The website provides installers for different platforms.

Verify installation:

```bash
curl http://localhost:50021/speakers
```

> **Note:** Keep VoiceVox running in the background for audio synthesis to work.

### 4. Audio Player

Install an audio player for VoiceVox playback:

```bash
# FFmpeg (recommended)
sudo pacman -S ffmpeg

# Or MPV
sudo pacman -S mpv
```

## Installation

From the extension's source directory:

```bash
npm install
npm run dev
```

The extension will be automatically installed and available in Vicinae. No restart required.

Alternatively, you can build it first:

```bash
npm install
npm run build
```

## Configuration

Access preferences through Vicinae's extension settings.

![Settings](https://i.imgur.com/wQhrqvS.png)

### Available Options

**Anki Settings**
- **Deck Name**: Target Anki deck (default: `CUSTOM TRANSLATE`)
- **Note Type/Model**: Card template (default: `Basic-d5482`)
- **Port**: AnkiConnect port (default: `8765`)

**VoiceVox Settings**
- **Port**: VoiceVox API port (default: `50021`)
- **Speaker ID**: Voice character ID (default: `1`)

**Translation Settings**
- **Source Language**: Input language (default: `ja`)
- **Target Language**: Output language (default: `en`)
- **Auto-load Text**: Automatically load clipboard text (default: `true`)

### Supported Target Languages

English, Spanish, French, German, Italian, Portuguese, Russian, Korean, Chinese (Simplified), Chinese (Traditional)

### VoiceVox Speakers

| ID | Character | Voice Type |
|----|-----------|------------|
| 1 | ずんだもん | High-pitched, friendly |
| 3 | 春日部つむぎ | Calm, clear |
| 8 | 青山龍星 | Deep, mature |
| 2 | 四国めたん | Gentle, warm |

List all available speakers:

```bash
curl http://localhost:50021/speakers | jq
```

## Usage

### Basic Workflow

1. Launch Vicinae and type "Translate"
2. Enter or paste Japanese text (auto-loads from clipboard if enabled)
3. View translation below the search bar
4. Press `Enter` to add card to Anki
5. Press `Ctrl+B` to open Actions menu, then `Shift+Enter` to play audio

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Add card to Anki |
| `Ctrl + B` → `Shift + Enter` | Play audio |
| `Ctrl + B` | Open Actions menu |

## Troubleshooting

### Anki not connected

Verify Anki is running with AnkiConnect:

```bash
curl -X POST http://localhost:8765 -H "Content-Type: application/json" -d '{"action": "version", "version": 6}'
```

Make sure Anki is open in the background.

### Model not found

List available models in Anki:

```bash
curl -X POST http://localhost:8765 \
  -H "Content-Type: application/json" \
  -d '{"action": "modelNames", "version": 6}'
```

Update extension preferences with an existing model name.

### Audio playback fails

Verify VoiceVox is running:

```bash
curl http://localhost:50021/speakers
```

Make sure VoiceVox is open in the background.

## License

MIT License

## Acknowledgments

- [Vicinae](https://github.com/vicinaehq/vicinae) - Linux launcher
- [VoiceVox](https://voicevox.hiroshiba.jp/) - Japanese TTS
- [AnkiConnect](https://foosoft.net/projects/anki-connect/) - Anki automation

---

<div align="center">
<sub><i>Streamline your Japanese learning workflow</i></sub>
</div>