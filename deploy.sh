#!/bin/bash

# Deployment script for Skids Soundscape
# This script prepares the app for production deployment

echo "🚀 Preparing Skids Soundscape for deployment..."

# Check if all required files exist
required_files=("index.html" "style.css" "app.js" "manifest.json" "netlify.toml")

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ Error: Required file $file not found!"
        exit 1
    fi
done

echo "✅ All required files found"

# Validate HTML (basic check)
if command -v html5validator &> /dev/null; then
    echo "🔍 Validating HTML..."
    html5validator --root . --also-check-css
else
    echo "⚠️ HTML validator not found, skipping validation"
fi

# Check for common issues
echo "🔍 Checking for common issues..."

# Check if favicon exists
if [ ! -f "favicon.svg" ]; then
    echo "⚠️ Warning: favicon.svg not found"
fi

# Check if robots.txt exists
if [ ! -f "robots.txt" ]; then
    echo "⚠️ Warning: robots.txt not found"
fi

echo "✅ Pre-deployment checks complete!"
echo ""
echo "📋 Deployment Instructions:"
echo "1. Push code to your Git repository"
echo "2. Connect repository to Netlify"
echo "3. Set build command to: echo 'Static site, no build required'"
echo "4. Set publish directory to: ."
echo "5. Deploy!"
echo ""
echo "🌐 Your app will be available at: https://skids-soundscape.netlify.app"
echo "📝 Remember to update the URLs in meta tags and manifest.json with your actual domain"
