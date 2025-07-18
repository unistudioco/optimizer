# Image Optimizer

A configurable image optimization script using Node.js with support for selective blur, custom quality settings, and folder/file exclusions.

## Features

- 🖼️ Image optimization (resize, compress)
- 🌀 Optional blur effect with configurable strength
- 📁 Folder and file inclusion/exclusion
- 🎛️ Configurable quality settings per format
- 📋 Comprehensive configuration file support

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
node optimize.js --with-blur
```

## Configuration

All settings are configured in `config.json`:

### Folder Settings
```json
"folders": {
  "exclude": ["demos", "landing", "media"],  // Skip these folders entirely
  "include": []                              // If specified, only process these folders
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
  "copyOnly": [".svg"],                                       // Copy without processing
  "exclude": [".tmp"]                                         // Skip these extensions
}
```

### Image Quality Settings
```json
"image": {
  "maxWidth": 700,        // Resize images wider than this
  "quality": {
    "jpeg": 80,           // JPEG quality (0-100)
    "png": 9,             // PNG compression level (0-9)
    "webp": 80            // WebP quality (0-100)
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

1. **Folder Processing**: Checks folder inclusion/exclusion rules
2. **File Processing**: Verifies file should be processed based on name and extension
3. **Image Optimization**: 
   - Resizes images if width > `maxWidth`
   - Applies compression based on format-specific quality settings
   - Optionally applies blur (if `--blur` flag is used and both folder and file allow it)
4. **Output**: Saves optimized images to `dist/assets/`

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
    "maxWidth": 800,
    "quality": {
      "jpeg": 85,
      "png": 8,
      "webp": 85
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

## Output Directory

Optimized images are saved to: `dist/assets/`

The script maintains the original folder structure in the output directory. 