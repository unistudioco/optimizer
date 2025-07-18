const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
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
    } else if (config.extensions.copyOnly.includes(fileExt)) {
        return 'copyOnly';
    }
    
    return 'other';
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
function optimizeAndBlurImages(source, target, applyBlur = false, parentBlurAllowed = true) {
    const files = fs.readdirSync(source);

    files.forEach(file => {
        // Ignore hidden files
        if (file.startsWith('.')) {
            return;
        }

        const filePath = path.join(source, file);
        const outputFilePath = path.join(target, file);

        console.log(`Processing file: ${filePath}`);
        console.log(`Output file path: ${outputFilePath}`);

        if (fs.lstatSync(filePath).isDirectory()) {
            // Check if folder should be processed
            if (!shouldProcessFolder(filePath)) {
                console.log(`📁 Skipping excluded folder: ${path.basename(filePath)}`);
                return;
            }

            mkdirp.sync(outputFilePath);
            
            // Check if this folder should receive blur
            const folderAllowsBlur = shouldBlurFolder(filePath);
            const blurForThisFolder = applyBlur && parentBlurAllowed && folderAllowsBlur;
            
            if (applyBlur && !folderAllowsBlur) {
                console.log(`📁 Excluding folder from blur: ${path.basename(filePath)}`);
            }
            
            optimizeAndBlurImages(filePath, outputFilePath, applyBlur, blurForThisFolder);
        } else {
            // Check if file should be processed
            if (!shouldProcessFile(filePath)) {
                console.log(`📄 Skipping excluded file: ${path.basename(filePath)}`);
                return;
            }

            const fileType = getFileType(filePath);

            if (fileType === 'processable') {
                // Check if this specific file should receive blur
                const fileAllowsBlur = shouldBlurFile(filePath);
                const shouldBlurThisFile = applyBlur && parentBlurAllowed && fileAllowsBlur;
                
                if (applyBlur && parentBlurAllowed && !fileAllowsBlur) {
                    console.log(`📄 Excluding file from blur: ${path.basename(filePath)}`);
                }

                sharp(filePath)
                    .metadata()
                    .then(metadata => {
                        let sharpInstance = sharp(filePath);
                        
                        if (metadata.width >= config.image.maxWidth) {
                            sharpInstance = sharpInstance.resize({ width: config.image.maxWidth });
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
            } else if (fileType === 'copyOnly') {
                fs.copyFileSync(filePath, outputFilePath);
                console.log(`Copied without modification: ${outputFilePath}`);
            } else {
                fs.copyFileSync(filePath, outputFilePath);
                console.log(`Copied as-is: ${outputFilePath}`);
            }
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
        console.log(`   Max Width: ${config.image.maxWidth}px`);
        console.log(`   JPEG Quality: ${config.image.quality.jpeg}`);
        console.log(`   PNG Compression: ${config.image.quality.png}`);
        console.log(`   WebP Quality: ${config.image.quality.webp}`);
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
            console.log(`🚫 Excluded folders: ${config.folders.exclude.join(', ')}`);
        }

        console.log(''); // Empty line for readability

        // Optimize and blur images
        optimizeAndBlurImages(path.join(sourceDir, 'assets'), path.join(targetDir, 'assets'), shouldBlur, true);
    } catch (error) {
        console.error(`Build error: ${error}`);
    }
}

// Run build
build();