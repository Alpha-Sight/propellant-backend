// #!/bin/bash

// # Script to prepare a logo for BIMI (Brand Indicators for Message Identification)
// # This converts a JPG logo to SVG format suitable for BIMI requirements

// # Check if ImageMagick is installed
// if ! command -v convert &> /dev/null; then
//     echo "ImageMagick is required but not installed. Please install it first."
//     echo "brew install imagemagick"
//     exit 1
// fi

// # Source and destination paths
// SOURCE_LOGO="public/logo.jpg"
// SVG_OUTPUT="public/logo-bimi.svg"
// PNG_TEMP="public/logo-temp.png"

// echo "Preparing logo for BIMI..."
// echo "Source: $SOURCE_LOGO"

// # Create a square PNG with padding
// echo "Converting to square PNG with padding..."
// convert "$SOURCE_LOGO" -resize 512x512 -background white -gravity center -extent 512x512 "$PNG_TEMP"

// # Convert to SVG
// echo "Converting to SVG format..."
// convert "$PNG_TEMP" "$SVG_OUTPUT"

// # Check if potrace is available for better vector conversion
// if command -v potrace &> /dev/null; then
//     echo "Using potrace for better vector conversion..."
//     potrace -s -o "$SVG_OUTPUT" "$PNG_TEMP"
// fi

// # Check file size (BIMI requires < 32KB)
// FILE_SIZE=$(du -k "$SVG_OUTPUT" | cut -f1)
// echo "SVG file size: ${FILE_SIZE}KB (must be under 32KB for BIMI)"

// # Check if svgo is installed for optimization
// if command -v svgo &> /dev/null; then
//     echo "Optimizing SVG with svgo..."
//     svgo -i "$SVG_OUTPUT" -o "$SVG_OUTPUT"
//     NEW_SIZE=$(du -k "$SVG_OUTPUT" | cut -f1)
//     echo "Optimized SVG file size: ${NEW_SIZE}KB"
// fi

// # Cleanup temp file
// rm "$PNG_TEMP"

// echo "BIMI-ready logo created at: $SVG_OUTPUT"
// echo "Next steps:"
// echo "1. Upload this file to a publicly accessible HTTPS URL"
// echo "2. Create a BIMI DNS record: default._bimi.propellanthr.com TXT \"v=BIMI1; l=https://your-domain.com/logo-bimi.svg; a=;\""
// echo "3. Verify your setup at https://bimigroup.org/bimi-generator/"