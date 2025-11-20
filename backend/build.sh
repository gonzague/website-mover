#!/bin/bash

# Build script for Website Mover backend
# Compiles binaries for macOS (ARM/Intel) and Linux

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

OUTPUT_DIR="../frontend/src-tauri/binaries"
BINARY_NAME="website-mover-backend"
SRC="./cmd/server/main.go"

echo -e "${GREEN}🔨 Building Website Mover Backend...${NC}\n"

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Build for macOS ARM (Apple Silicon)
echo -e "${YELLOW}Building for macOS ARM (aarch64-apple-darwin)...${NC}"
GOOS=darwin GOARCH=arm64 go build -o "$OUTPUT_DIR/${BINARY_NAME}-aarch64-apple-darwin" "$SRC"
echo -e "${GREEN}✓ macOS ARM build complete${NC}\n"

# Build for macOS Intel (x86_64)
echo -e "${YELLOW}Building for macOS Intel (x86_64-apple-darwin)...${NC}"
GOOS=darwin GOARCH=amd64 go build -o "$OUTPUT_DIR/${BINARY_NAME}-x86_64-apple-darwin" "$SRC"
echo -e "${GREEN}✓ macOS Intel build complete${NC}\n"

# Build for Linux x86_64
echo -e "${YELLOW}Building for Linux x86_64 (x86_64-unknown-linux-gnu)...${NC}"
GOOS=linux GOARCH=amd64 go build -o "$OUTPUT_DIR/${BINARY_NAME}-x86_64-unknown-linux-gnu" "$SRC"
echo -e "${GREEN}✓ Linux x86_64 build complete${NC}\n"

# List built binaries
echo -e "${GREEN}📦 Built binaries:${NC}"
ls -lh "$OUTPUT_DIR" | grep "$BINARY_NAME"

echo -e "\n${GREEN}✨ All builds completed successfully!${NC}"
