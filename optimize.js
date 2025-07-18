const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const mkdirp = require('mkdirp');

// Load configuration
let config;
try {
    config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
} catch (error) {
    console.error('Error loading config.json:', error.message);
    process.exit(1);
}

// Check for command line arguments
const args = process.argv.slice(2);
const shouldBlur = args.includes('--blur') || args.includes('--with-blur');

// Paths
const sourceDir = path.resolve(__dirname);
const targetDir = path.resolve(__dirname, 'dist');

// Helper function to check if a folder should be processed
function shouldProcessFolder(folderPath) {
    const folderName = path.basename(folderPath);
    
    // If include list exists and has items, only process folders in the include list
    if (config.folders.include && config.folders.include.length > 0) {
        return config.folders.include.includes(folderName);
    }
    
    // Otherwise, process all folders except those in the exclude list
    return !config.folders.exclude.includes(folderName);
}

// Helper function to check if a file should be processed
function shouldProcessFile(filePath) {
    const fileName = path.basename(filePath);
    const fileExt = path.extname(filePath).toLowerCase();
    
    // Check file exclusions
    if (config.files.exclude.includes(fileName)) {
        return false;
    }
    
    // Check extension exclusions
    if (config.extensions.exclude.includes(fileExt)) {
        return false;
    }
    
    // If include list exists and has items, only process files in the include list
    if (config.files.include && config.files.include.length > 0) {
        return config.files.include.includes(fileName);
    }
    
    return true;
}

// Helper function to check if a folder should receive blur
function shouldBlurFolder(folderPath) {
    const folderName = path.basename(folderPath);
    
    // If include list exists and has items, only blur folders in the include list
    if (config.blur.folders.include && config.blur.folders.include.length > 0) {
        return config.blur.folders.include.includes(folderName);
    }
    
    // Otherwise, blur all folders except those in the exclude list
    return !config.blur.folders.exclude.includes(folderName);
}

// Helper function to check if a file should receive blur
function shouldBlurFile(filePath) {
    const fileName = path.basename(filePath);
    
    // Check file exclusions from blur
    if (config.blur.files.exclude.includes(fileName)) {
        return false;
    }
    
    // If include list exists and has items, only blur files in the include list
    if (config.blur.files.include && config.blur.files.include.length > 0) {
        return config.blur.files.include.includes(fileName);
    }
    
    return true;
}

// Helper function to check file type
function getFileType(filePath) {
    const fileExt = path.extname(filePath).toLowerCase();
    
    if (config.extensions.processable.includes(fileExt)) {
        return 'processable';
    } else if (config.extensions.videoProcessable.includes(fileExt)) {
        return 'video';
    } else if (config.extensions.copyOnly.includes(fileExt)) {
        return 'copyOnly';
    }
    
    return 'other';
}

// Function to process video files
function processVideo(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        console.log(`🎬 Processing video: ${inputPath}`);
        
        if (!config.video.enableProcessing) {
            // Just copy the video without processing
            fs.copyFileSync(inputPath, outputPath);
            console.log(`📹 Copied video without processing: ${outputPath}`);
            resolve();
            return;
        }

        // Get video info first
        ffmpeg.ffprobe(inputPath, (err, metadata) => {
            if (err) {
                console.error(`Error getting video metadata: ${err.message}`);
                // Fallback to copying
                fs.copyFileSync(inputPath, outputPath);
                resolve();
                return;
            }

            const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
            if (!videoStream) {
                console.error(`No video stream found in: ${inputPath}`);
                fs.copyFileSync(inputPath, outputPath);
                resolve();
                return;
            }

            const originalWidth = videoStream.width;
            const originalHeight = videoStream.height;
            const inputFormat = path.extname(inputPath).toLowerCase();
            
            // Determine output format and codec
            let outputFormat, codec, outputFile;
            if (config.video.preserveFormat) {
                // Keep original format
                outputFormat = inputFormat.substring(1); // Remove the dot
                outputFile = outputPath;
                
                // Use appropriate codec for format
                if (inputFormat === '.webm') {
                    codec = 'libvpx-vp9';
                } else if (inputFormat === '.mp4') {
                    codec = 'libx264';
                } else {
                    codec = config.video.formats.codec;
                }
                
                console.log(`📄 Preserving original format: ${outputFormat} with codec: ${codec}`);
            } else {
                // Convert to configured format
                outputFormat = config.video.formats.outputFormat;
                codec = config.video.formats.codec;
                const outputDir = path.dirname(outputPath);
                const outputName = path.basename(outputPath, path.extname(outputPath));
                outputFile = path.join(outputDir, `${outputName}.${outputFormat}`);
                
                console.log(`🔄 Converting to ${outputFormat} with codec: ${codec}`);
            }
            
            let command = ffmpeg(inputPath)
                .output(outputFile)
                .videoCodec(codec);

            // Add format-specific options
            if (codec === 'libvpx-vp9') {
                command = command.outputOptions([
                    `-crf ${config.video.quality.crf}`,
                    '-b:v 0', // Use CRF mode for VP9
                    '-row-mt 1' // Enable row-based multithreading for VP9
                ]);
            } else {
                command = command.outputOptions([
                    `-crf ${config.video.quality.crf}`,
                    `-preset ${config.video.quality.preset}`
                ]);
            }

            // Apply resize if enabled and video is larger than max dimensions
            if (config.video.enableResize) {
                const needsResize = originalWidth > config.video.maxWidth || originalHeight > config.video.maxHeight;
                
                if (needsResize) {
                    command = command.size(`${config.video.maxWidth}x${config.video.maxHeight}`);
                    console.log(`📐 Resizing video from ${originalWidth}x${originalHeight} to max ${config.video.maxWidth}x${config.video.maxHeight}: ${outputFile}`);
                } else {
                    console.log(`📹 Keeping original video size (${originalWidth}x${originalHeight}): ${outputFile}`);
                }
            } else {
                console.log(`📹 Video processing without resize (${originalWidth}x${originalHeight}): ${outputFile}`);
            }

            // Set bitrate if specified and not using VP9 CRF mode
            if (config.video.quality.bitrate && codec !== 'libvpx-vp9') {
                command = command.videoBitrate(config.video.quality.bitrate);
            }

            command
                .on('end', () => {
                    console.log(`✅ Video processed successfully: ${outputFile}`);
                    resolve();
                })
                .on('error', (err) => {
                    console.error(`❌ Error processing video ${inputPath}: ${err.message}`);
                    // Fallback to copying original
                    try {
                        fs.copyFileSync(inputPath, outputPath);
                        console.log(`📹 Copied original video as fallback: ${outputPath}`);
                    } catch (copyErr) {
                        console.error(`Failed to copy video: ${copyErr.message}`);
                    }
                    resolve(); // Resolve anyway to continue processing other files
                })
                .run();
        });
    });
}

// Function to copy files
function copyFileSync(source, target) {
    var targetFile = target;

    // If target is a directory, a new file with the same name will be created
    if (fs.existsSync(target)) {
        if (fs.lstatSync(target).isDirectory()) {
            targetFile = path.join(target, path.basename(source));
        }
    }

    fs.writeFileSync(targetFile, fs.readFileSync(source));
}

// Function to copy folders recursively
function copyFolderRecursiveSync(source, target) {
    var files = [];

    // Check if folder needs to be created or integrated
    var targetFolder = path.join(target, path.basename(source));
    if (!fs.existsSync(targetFolder)) {
        fs.mkdirSync(targetFolder);
    }

    // Copy
    if (fs.lstatSync(source).isDirectory()) {
        files = fs.readdirSync(source);
        files.forEach(function (file) {
            var curSource = path.join(source, file);
            if (fs.lstatSync(curSource).isDirectory()) {
                copyFolderRecursiveSync(curSource, targetFolder);
            } else {
                copyFileSync(curSource, targetFolder);
            }
        });
    }
}

// Function to optimize and blur images
async function optimizeAndBlurImages(source, target, applyBlur = false, parentBlurAllowed = true) {
    const files = fs.readdirSync(source);

    for (const file of files) {
        // Ignore hidden files
        if (file.startsWith('.')) {
            continue;
        }

        const filePath = path.join(source, file);
        const outputFilePath = path.join(target, file);

        console.log(`Processing file: ${filePath}`);
        console.log(`Output file path: ${outputFilePath}`);

        if (fs.lstatSync(filePath).isDirectory()) {
            // Check if folder should be processed for optimization
            const shouldProcess = shouldProcessFolder(filePath);
            
            mkdirp.sync(outputFilePath);
            
            if (!shouldProcess) {
                // Copy excluded folder without any optimization
                console.log(`📁 Copying excluded folder without optimization: ${path.basename(filePath)}`);
                copyFolderContentsDirectly(filePath, outputFilePath);
                continue;
            }
            
            // Check if this folder should receive blur
            const folderAllowsBlur = shouldBlurFolder(filePath);
            const blurForThisFolder = applyBlur && parentBlurAllowed && folderAllowsBlur;
            
            if (applyBlur && !folderAllowsBlur) {
                console.log(`📁 Excluding folder from blur: ${path.basename(filePath)}`);
            }
            
            await optimizeAndBlurImages(filePath, outputFilePath, applyBlur, blurForThisFolder);
        } else {
            // Check if file should be processed
            if (!shouldProcessFile(filePath)) {
                console.log(`📄 Skipping excluded file: ${path.basename(filePath)}`);
                continue;
            }

            const fileType = getFileType(filePath);

            if (fileType === 'processable') {
                // Check if this specific file should receive blur
                const fileAllowsBlur = shouldBlurFile(filePath);
                const shouldBlurThisFile = applyBlur && parentBlurAllowed && fileAllowsBlur;
                
                if (applyBlur && parentBlurAllowed && !fileAllowsBlur) {
                    console.log(`📄 Excluding file from blur: ${path.basename(filePath)}`);
                }

                await sharp(filePath)
                    .metadata()
                    .then(metadata => {
                        let sharpInstance = sharp(filePath);
                        
                        // Apply resize if enabled and image is larger than maxWidth
                        if (config.image.enableResize && metadata.width >= config.image.maxWidth) {
                            sharpInstance = sharpInstance.resize({ width: config.image.maxWidth });
                            console.log(`Resizing from ${metadata.width}px to ${config.image.maxWidth}px: ${outputFilePath}`);
                        } else if (!config.image.enableResize) {
                            console.log(`Keeping original size (${metadata.width}px): ${outputFilePath}`);
                        }
                        
                        // Apply blur if requested and allowed
                        if (shouldBlurThisFile) {
                            sharpInstance = sharpInstance.blur(config.blur.strength);
                            console.log(`Applying blur (${config.blur.strength}) to: ${outputFilePath}`);
                        }
                        
                        return sharpInstance
                            .jpeg({ quality: config.image.quality.jpeg })
                            .png({ compressionLevel: config.image.quality.png })
                            .webp({ quality: config.image.quality.webp })
                            .toFile(outputFilePath)
                            .then(() => console.log(`Optimized successfully: ${outputFilePath}`));
                    })
                    .catch(err => console.error(`Error processing ${filePath}: ${err}`));
            } else if (fileType === 'video') {
                // Process video file
                await processVideo(filePath, outputFilePath);
            } else if (fileType === 'copyOnly') {
                fs.copyFileSync(filePath, outputFilePath);
                console.log(`Copied without modification: ${outputFilePath}`);
            } else {
                fs.copyFileSync(filePath, outputFilePath);
                console.log(`Copied as-is: ${outputFilePath}`);
            }
        }
    }
}

// Function to copy folder contents directly without any processing
function copyFolderContentsDirectly(source, target) {
    const files = fs.readdirSync(source);

    files.forEach(file => {
        // Ignore hidden files
        if (file.startsWith('.')) {
            return;
        }

        const filePath = path.join(source, file);
        const outputFilePath = path.join(target, file);

        if (fs.lstatSync(filePath).isDirectory()) {
            mkdirp.sync(outputFilePath);
            copyFolderContentsDirectly(filePath, outputFilePath);
            console.log(`📁 Copied folder directly: ${path.basename(filePath)}`);
        } else {
            fs.copyFileSync(filePath, outputFilePath);
            console.log(`📄 Copied file directly: ${path.basename(filePath)}`);
        }
    });
}

module.exports = optimizeAndBlurImages;

// Main build function
async function build() {
    try {
        // Create target directory
        mkdirp.sync(targetDir);
        console.log(`Target directory created: ${targetDir}`);
        
        // Display configuration summary
        console.log('\n📋 Configuration Summary:');
        console.log(`   Resize Images: ${config.image.enableResize ? 'Yes' : 'No (keep original size)'}`);
        if (config.image.enableResize) {
            console.log(`   Max Width: ${config.image.maxWidth}px`);
        }
        console.log(`   JPEG Quality: ${config.image.quality.jpeg}`);
        console.log(`   PNG Compression: ${config.image.quality.png}`);
        console.log(`   WebP Quality: ${config.image.quality.webp}`);
        console.log(`   Process Videos: ${config.video.enableProcessing ? 'Yes' : 'No (copy only)'}`);
        if (config.video.enableProcessing) {
            console.log(`   Preserve Format: ${config.video.preserveFormat ? 'Yes' : 'No (convert to ' + config.video.formats.outputFormat + ')'}`);
            console.log(`   Video Resize: ${config.video.enableResize ? 'Yes' : 'No'}`);
            if (config.video.enableResize) {
                console.log(`   Max Video Size: ${config.video.maxWidth}x${config.video.maxHeight}`);
            }
            console.log(`   Video CRF: ${config.video.quality.crf}`);
            console.log(`   Video Preset: ${config.video.quality.preset}`);
            if (!config.video.preserveFormat) {
                console.log(`   Video Codec: ${config.video.formats.codec}`);
            }
        }
        console.log(`   Blur Strength: ${config.blur.strength}`);
        
        if (shouldBlur) {
            console.log('🌀 Blur effect will be applied to images for client');
            
            // Show blur folder configuration
            if (config.blur.folders.include && config.blur.folders.include.length > 0) {
                console.log(`📂 Blur ONLY these folders: ${config.blur.folders.include.join(', ')}`);
            } else if (config.blur.folders.exclude.length > 0) {
                console.log(`📂 Blur excluded folders: ${config.blur.folders.exclude.join(', ')}`);
            }
            
            // Show blur file configuration
            if (config.blur.files.include && config.blur.files.include.length > 0) {
                console.log(`📄 Blur ONLY these files: ${config.blur.files.include.join(', ')}`);
            } else if (config.blur.files.exclude.length > 0) {
                console.log(`📄 Blur excluded files: ${config.blur.files.exclude.join(', ')}`);
            }
        } else {
            console.log('📷 Images will be optimized for web');
        }

        if (config.folders.exclude.length > 0) {
            console.log(`📋 Excluded folders (copied without optimization): ${config.folders.exclude.join(', ')}`);
        }

        console.log(''); // Empty line for readability

        // Optimize and blur images
        await optimizeAndBlurImages(path.join(sourceDir, 'assets'), path.join(targetDir, 'assets'), shouldBlur, true);
    } catch (error) {
        console.error(`Build error: ${error}`);
    }
}

// Run build
build();