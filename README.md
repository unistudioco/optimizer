# Image & Video Optimizer

A configurable image and video optimization script using Node.js with support for selective blur, custom quality settings, and folder/file exclusions.

## Features

- 🖼️ Image optimization (resize, compress)
- 🎬 Video optimization and resizing (FFmpeg-powered)
- 🌀 Optional blur effect with configurable strength (images only)
- 📁 Folder and file inclusion/exclusion
- 🎛️ Configurable quality settings per format
- 📋 Comprehensive configuration file support

## Prerequisites

**FFmpeg Required**: For video processing, you need FFmpeg installed on your system:

- **macOS**: `brew install ffmpeg`
- **Windows**: Download from [FFmpeg.org](https://ffmpeg.org/download.html)
- **Linux**: `sudo apt install ffmpeg` (Ubuntu/Debian) or equivalent

**Note**: You may see a deprecation warning for `fluent-ffmpeg` during installation. This package still works perfectly and is widely used, but is no longer actively maintained. The functionality remains stable.

## Installation

```bash
npm install
```

## Usage

### Basic optimization (no blur):
```bash
npm run optimize
```

### With blur effect:
```bash
npm run optimize:blur
```

### Direct node commands:
```bash
node optimize.js
node optimize.js --blur
```

## Configuration

All settings are configured in `config.json`:

### Folder Settings
```json
"folders": {
  "exclude": ["demos", "landing", "media"],  // Copy these folders without optimization
  "include": []                              // If specified, only process these folders for optimization
}
```

### File Settings
```json
"files": {
  "exclude": ["specific-file.jpg"],          // Skip specific files
  "include": []                              // If specified, only process these files
}
```

### Extension Settings
```json
"extensions": {
  "processable": [".jpg", ".jpeg", ".png", ".gif", ".webp"],  // Image formats to optimize
  "videoProcessable": [".mp4", ".webm", ".mov", ".avi", ".mkv"], // Video formats to process
  "copyOnly": [".svg"],                                       // Copy without processing
  "exclude": [".tmp"]                                         // Skip these extensions
}
```

### Image Quality Settings
```json
"image": {
  "enableResize": false,  // Set to true to resize images based on maxWidth
  "maxWidth": 1200,        // Resize images wider than this to match the maxWidth (enableResize: true)
  "quality": {
    "jpeg": 80,           // JPEG quality (0-100)
    "png": 9,             // PNG compression level (0-9)
    "webp": 80            // WebP quality (0-100)
  }
}
```

### Video Processing Settings
```json
"video": {
  "enableProcessing": true,   // Set to false to copy videos without processing
  "enableResize": true,       // Set to false to keep original video dimensions
  "preserveFormat": true,     // Keep original format (recommended) or convert all to outputFormat
  "maxWidth": 1920,           // Maximum video width
  "maxHeight": 1080,          // Maximum video height
  "quality": {
    "crf": 28,                // Constant Rate Factor (lower = higher quality, 18-28 recommended)
    "preset": "medium",       // Encoding speed: ultrafast, superfast, veryfast, faster, fast, medium, slow, slower, veryslow
    "bitrate": "1000k"        // Target bitrate (optional, leave empty for CRF-based encoding)
  },
  "formats": {
    "outputFormat": "mp4",    // Output format (only used when preserveFormat is false)
    "codec": "libx264"        // Video codec (only used when preserveFormat is false)
  }
}
```

### Blur Settings
```json
"blur": {
  "strength": 5,                                    // Blur strength
  "folders": {
    "exclude": ["demos", "landing", "media"],      // Folders to exclude from blur
    "include": []                                   // If specified, only blur these folders
  },
  "files": {
    "exclude": ["specific-image.jpg"],             // Files to exclude from blur
    "include": []                                   // If specified, only blur these files
  }
}
```

## How It Works

1. **Folder Processing**: 
   - **Excluded folders**: Copied directly without any optimization, resizing, or blur
   - **Included/allowed folders**: Processed for optimization
2. **File Processing**: Verifies file should be processed based on name and extension
3. **Image Optimization**: 
   - Optionally resizes images if `enableResize` is true and width > `maxWidth`
   - Applies compression based on format-specific quality settings
   - Optionally applies blur (if `--blur` flag is used and both folder and file allow it)
4. **Video Processing**:
   - Optionally processes videos with FFmpeg if `enableProcessing` is true
   - Resizes videos if `enableResize` is true and dimensions exceed max values
   - Applies compression using configurable CRF, preset, and bitrate settings
5. **Output**: Saves optimized images and videos to `dist/assets/`

### Blur Logic Hierarchy

When `--blur` flag is used, blur is applied based on this hierarchy:

1. **Folder Level**: 
   - If `blur.folders.include` has items → only blur folders in that list
   - Otherwise → blur all folders except those in `blur.folders.exclude`

2. **File Level** (within allowed folders):
   - If `blur.files.include` has items → only blur files in that list  
   - Otherwise → blur all files except those in `blur.files.exclude`

3. **Final Result**: A file gets blurred only if both its folder AND the file itself are allowed by the configuration

## Examples

### Basic Configuration
```json
{
  "folders": {
    "exclude": ["temp", "drafts"]
  },
  "image": {
    "enableResize": true,
    "maxWidth": 800,
    "quality": {
      "jpeg": 85,
      "png": 8,
      "webp": 85
    }
  }
}
```

### Keep Original Image Sizes
```json
{
  "image": {
    "enableResize": false,    // Disable resizing, keep original dimensions
    "quality": {
      "jpeg": 75,             // Still apply compression
      "png": 7,
      "webp": 75
    }
  }
}
```

### Mixed Processing (Some folders optimized, others copied as-is)
```json
{
  "folders": {
    "exclude": ["logos", "icons", "original-assets"]  // Copy these without any changes
  },
  "image": {
    "enableResize": true,
    "maxWidth": 800,
    "quality": {
      "jpeg": 75,
      "png": 8,
      "webp": 75
    }
  },
  "video": {
    "enableProcessing": true,
    "enableResize": true,
    "maxWidth": 1280,
    "maxHeight": 720,
    "quality": {
      "crf": 24,
      "preset": "fast"
    }
  },
  "blur": {
    "strength": 5,
    "folders": {
      "exclude": ["portfolio"]     // No blur on portfolio, but still optimize
    }
  }
}
```

### High Quality Video Processing (Preserve Original Formats)
```json
{
  "video": {
    "enableProcessing": true,
    "enableResize": false,        // Keep original video dimensions
    "preserveFormat": true,       // Keep MP4 as MP4, WebM as WebM, etc.
    "quality": {
      "crf": 18,                  // High quality encoding
      "preset": "slow",           // Better compression (slower encoding)
      "bitrate": ""               // Use CRF instead of bitrate
    }
  }
}
```

### Web-Optimized Videos
```json
{
  "video": {
    "enableProcessing": true,
    "enableResize": true,
    "maxWidth": 1920,
    "maxHeight": 1080,
    "quality": {
      "crf": 28,                  // Good balance of quality/size
      "preset": "medium",
      "bitrate": "2000k"          // Target bitrate for consistent size
    }
  }
}
```

### Selective Processing
```json
{
  "folders": {
    "include": ["products", "gallery"]  // Only process these folders
  },
  "blur": {
    "strength": 3,
    "folders": {
      "exclude": ["products"]           // Blur gallery but not products
    }
  }
}
```

### Advanced Blur Control
```json
{
  "blur": {
    "strength": 8,
    "folders": {
      "include": ["gallery", "portfolio"],     // Only blur these folders
      "exclude": []
    },
    "files": {
      "include": [],
      "exclude": ["hero-image.jpg", "logo.png"] // Don't blur these specific files
    }
  }
}
```

## Video Processing Notes

### CRF (Constant Rate Factor)
- **Lower values** = Higher quality, larger files (18-23 for high quality)
- **Higher values** = Lower quality, smaller files (28+ for web delivery)
- **Recommended range**: 18-28

### Encoding Presets
- **ultrafast, superfast, veryfast**: Fastest encoding, larger files
- **fast, medium**: Good balance of speed and compression
- **slow, slower, veryslow**: Best compression, slower encoding

### Supported Input Formats
- MP4, WebM, MOV, AVI, MKV

### Format-Specific Processing
- **MP4 files**: Processed with H.264 codec (libx264)
- **WebM files**: Processed with VP9 codec (libvpx-vp9) when preserveFormat is true
- **Other formats**: Use configured codec or fallback to copying

### Fallback Behavior
If video processing fails, the original file is copied without modification to ensure no data loss.

## Troubleshooting

### WebM Processing Issues
If WebM files fail to process (which was the issue you experienced):
1. **Enable preserveFormat**: Set `"preserveFormat": true` in config (recommended)
2. **Check FFmpeg**: Ensure FFmpeg has VP9 support: `ffmpeg -codecs | grep vp9`
3. **Alternative**: Set `"enableProcessing": false` for video files to copy them without processing

### Deprecated Package Warning
The `fluent-ffmpeg` deprecation warning is cosmetic. The package:
- ✅ Still works perfectly
- ✅ Is widely used in production
- ✅ Has stable functionality
- ⚠️ Just isn't actively maintained for new features

## Output Directory

Optimized images and videos are saved to: `dist/assets/`

The script maintains the original folder structure in the output directory. 