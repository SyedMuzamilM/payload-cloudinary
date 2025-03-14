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

# Validate version format
validate_version() {
    if ! [[ $1 =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9\.]+)?$ ]]; then
        print_message "❌ Invalid version format. Please use semantic versioning (e.g., 1.2.3)" "$RED"
        exit 1
    fi
}

# Backup package.json
backup_package_json() {
    cp package.json package.json.backup
}

# Rollback changes if something fails
rollback() {
    print_message "🔄 Rolling back changes..." "$YELLOW"
    if [ -f package.json.backup ]; then
        mv package.json.backup package.json
        git reset --hard HEAD
        git tag -d "v$new_version" 2>/dev/null
    fi
}

# Generate changelog
generate_changelog() {
    print_message "📝 Generating changelog..." "$YELLOW"
    local prev_tag=$(git describe --tags --abbrev=0 HEAD^1 2>/dev/null || echo "")
    if [ -n "$prev_tag" ]; then
        git log --pretty=format:"- %s" $prev_tag..HEAD > CHANGELOG.tmp
        echo "## $new_version ($(date '+%Y-%m-%d'))" > CHANGELOG.new
        cat CHANGELOG.tmp >> CHANGELOG.new
        echo "" >> CHANGELOG.new
        if [ -f CHANGELOG.md ]; then
            cat CHANGELOG.md >> CHANGELOG.new
        fi
        mv CHANGELOG.new CHANGELOG.md
        rm CHANGELOG.tmp
        git add CHANGELOG.md
    fi
}

# Check npm registry access
check_npm_registry() {
    print_message "🔍 Checking npm registry..." "$YELLOW"
    if ! npm whoami >/dev/null 2>&1; then
        print_message "❌ Not logged in to npm. Please run 'npm login' first." "$RED"
        exit 1
    fi
}

# Set up error handling
trap rollback ERR

# Check if the working directory is clean
if [ -n "$(git status --porcelain)" ]; then
    print_message "❌ Working directory is not clean. Please commit or stash your changes first." "$RED"
    exit 1
fi

# Check npm registry access
check_npm_registry

# Get the current version from package.json
current_version=$(node -p "require('./package.json').version")
print_message "Current version: $current_version" "$YELLOW"

# Ask for the release type
echo "Select release type:"
echo "1) Stable"
echo "2) Beta"
echo "3) Canary"
read -p "Enter choice (1-3): " release_type

# Ask for the new version
read -p "Enter new version (current is $current_version): " new_version

# Validate inputs
validate_version "$new_version"
backup_package_json

# Modify version based on release type
case $release_type in
    2)
        new_version="${new_version}-beta.0"
        npm_tag="beta"
        ;;
    3)
        new_version="${new_version}-canary.$(date +%Y%m%d%H%M)"
        npm_tag="canary"
        ;;
    *)
        npm_tag="latest"
        ;;
esac

# Update version in package.json
npm version $new_version --no-git-tag-version

# Run tests
print_message "🧪 Running tests..." "$YELLOW"
bun test || exit 1

# Build the project
print_message "🏗️ Building project..." "$YELLOW"
bun run build || exit 1

# Generate changelog
generate_changelog

# Create git tag and commit
git add package.json
git commit -m "chore: release v$new_version"
git tag -a "v$new_version" -m "Release v$new_version"

# Push to repository
print_message "🚀 Pushing to repository..." "$YELLOW"
git push && git push --tags

# Publish to npm with appropriate tag
print_message "📦 Publishing to npm with tag: $npm_tag..." "$YELLOW"
if npm publish --tag $npm_tag; then
    print_message "✅ Successfully published version $new_version with tag: $npm_tag" "$GREEN"
    rm package.json.backup
else
    print_message "❌ Failed to publish to npm" "$RED"
    rollback
    exit 1
fi