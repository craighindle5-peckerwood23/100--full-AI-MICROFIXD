#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

TARGET_DIR="${1:-./deploy_target}"
LOG_FILE="deployment.log"

# Function for logging
log_message() {
    local message="$1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') - INFO - ${message}" | tee -a "$LOG_FILE"
}

# Function for error logging
log_error() {
    local message="$1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') - ERROR - ${message}" | tee -a "$LOG_FILE" >&2
}

log_message "Starting deployment process..."

# Ensure target directory exists
if [ ! -d "$TARGET_DIR" ]; then
    log_message "Creating target directory: $TARGET_DIR"
    mkdir -p "$TARGET_DIR" || { log_error "Failed to create directory $TARGET_DIR"; exit 1; }
fi

# Find all zip files in the current directory
shopt -s nullglob
ZIP_FILES=(*.zip)

if [ ${#ZIP_FILES[@]} -eq 0 ]; then
    log_message "No .zip files found to extract. Exiting."
    exit 0
fi

for zip_file in "${ZIP_FILES[@]}"; do
    log_message "Extracting $zip_file to $TARGET_DIR..."
    
    # Extract the zip file, overwriting existing files, and redirect output to log
    if unzip -o "$zip_file" -d "$TARGET_DIR" >> "$LOG_FILE" 2>&1; then
        log_message "Successfully extracted $zip_file."
    else
        log_error "Failed to extract $zip_file."
        exit 1
    fi
done

log_message "Deployment process completed successfully."
