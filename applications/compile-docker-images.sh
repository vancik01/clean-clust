#!/bin/bash

# Set base directory
BASE_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# List of directories to build
DIRECTORIES=(
    "operators/exp1"
    "operators/exp2"
    "simulators/battery-charge-simulator"
    "simulators/kafka-message-publisher"
    "simulators/load-testing-app"
    "simulators/task-runner"
)

# Function to build and load a specific Docker image
build_specific_image() {
    local specific_dir="$1"
    
    # Check if directory exists
    if [ ! -d "$BASE_DIR/$specific_dir" ]; then
        echo "❌ Error: Directory $specific_dir does not exist in $BASE_DIR"
        exit 1
    fi
    
    # Extract folder name
    FOLDER_NAME=$(basename "$specific_dir")
    IMAGE_NAME="local/${FOLDER_NAME}:latest"
    
    echo "🏗️  Building Docker image for $FOLDER_NAME"
    docker build -t "$IMAGE_NAME" "$BASE_DIR/$specific_dir"
    
    echo "🚢 Loading $IMAGE_NAME into Minikube"
    minikube image load "$IMAGE_NAME"
    
    echo "✅ Image $IMAGE_NAME built and loaded successfully"
}

# Function to build and load all Docker images
build_and_load_images() {
    for dir in "${DIRECTORIES[@]}"; do
        # Extract folder name
        FOLDER_NAME=$(basename "$dir")
        IMAGE_NAME="local/${FOLDER_NAME}:latest"
        
        echo "🏗️  Building Docker image for $FOLDER_NAME"
        docker build -t "$IMAGE_NAME" "$BASE_DIR/$dir"
        
        echo "🚢 Loading $IMAGE_NAME into Minikube"
        minikube image load "$IMAGE_NAME"
        
        echo "✅ Image $IMAGE_NAME built and loaded successfully"
        echo "---"
    done
}

# Main execution
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Usage: $0 [specific-app-directory]"
    echo ""
    echo "Examples:"
    echo "  $0                                      # Build all images"
    echo "  $0 simulators/kafka-message-publisher   # Build only the kafka-message-publisher"
    exit 0
fi

if [ -n "$1" ]; then
    echo "🔨 Starting Docker image build and Minikube image load for specific app: $1"
    build_specific_image "$1"
    echo "🎉 Image for $1 built and loaded into Minikube successfully!"
else
    echo "🔨 Starting Docker image build and Minikube image load process for all apps"
    build_and_load_images
    echo "🎉 All images built and loaded into Minikube successfully!"
fi