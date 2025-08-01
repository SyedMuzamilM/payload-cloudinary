#!/bin/bash

# Colors for console output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored messages
print_message() {
    echo -e "${2}${1}${NC}"
}

# Function to publish test version
publish_test_version() {
    local version=$1
    local tag=$2
    
    print_message "📦 Publishing test version ${version} with tag: ${tag}..." "$YELLOW"
    
    # Update version in package.json
    npm version $version --no-git-tag-version
    
    # Run tests
    print_message "🧪 Running tests..." "$YELLOW"
    bun test || exit 1
    
    # Build the project
    print_message "🏗️ Building project..." "$YELLOW"
    bun run build || exit 1
    
    # Publish with tag
    if npm publish --tag $tag; then
        print_message "✅ Successfully published test version ${version}" "$GREEN"
    else
        print_message "❌ Failed to publish test version" "$RED"
        exit 1
    fi
}

# Check if the working directory is clean
if [ -n "$(git status --porcelain)" ]; then
    print_message "❌ Working directory is not clean. Please commit or stash your changes first." "$RED"
    exit 1
fi

# Get the current version from package.json
current_version=$(node -p "require('./package.json').version")
print_message "Current version: $current_version" "$YELLOW"

# Select test version type
echo "Select test version type:"
echo "1) Development (dev)"
echo "2) Alpha"
echo "3) Beta"
echo "4) Release Candidate (rc)"
read -p "Enter choice (1-4): " version_type

# Get base version
read -p "Enter base version (current is $current_version): " base_version

# Generate version based on type
case $version_type in
    1)
        version="${base_version}-dev.$(date +%Y%m%d%H%M)"
        tag="dev"
        ;;
    2)
        read -p "Enter alpha number (e.g., 1): " alpha_num
        version="${base_version}-alpha.${alpha_num}"
        tag="alpha"
        ;;
    3)
        read -p "Enter beta number (e.g., 1): " beta_num
        version="${base_version}-beta.${beta_num}"
        tag="beta"
        ;;
    4)
        read -p "Enter RC number (e.g., 1): " rc_num
        version="${base_version}-rc.${rc_num}"
        tag="rc"
        ;;
    *)
        print_message "❌ Invalid choice" "$RED"
        exit 1
        ;;
esac

# Publish test version
publish_test_version $version $tag

# Create git tag
git add package.json
git commit -m "chore: release v$version"
git tag -a "v$version" -m "Release v$version"

# Push to repository
print_message "🚀 Pushing to repository..." "$YELLOW"
git push && git push --tags