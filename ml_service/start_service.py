#!/usr/bin/env python3
"""
ML Service Startup Script
Starts the FastAPI ML service with proper configuration
"""

import os
import sys
import logging
import argparse
from pathlib import Path

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

from api import app
import uvicorn

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def parse_arguments():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description='ML Prediction Service')
    parser.add_argument('--host', default='0.0.0.0', help='Host to bind to')
    parser.add_argument('--port', type=int, default=8001, help='Port to bind to')
    parser.add_argument('--workers', type=int, default=1, help='Number of workers')
    parser.add_argument('--reload', action='store_true', help='Enable auto-reload')
    parser.add_argument('--log-level', default='info', help='Logging level')
    parser.add_argument('--model-dir', default='models', help='Directory for model storage')

    return parser.parse_args()

def setup_environment():
    """Setup environment variables and directories"""
    # Create model directory if it doesn't exist
    model_dir = os.getenv('MODEL_DIR', 'models')
    os.makedirs(model_dir, exist_ok=True)

    # Set environment variables
    os.environ.setdefault('MODEL_DIR', model_dir)

    logger.info(f"Model directory: {model_dir}")

def check_dependencies():
    """Check if required dependencies are installed"""
    required_modules = [
        'fastapi', 'uvicorn', 'pandas', 'numpy', 'scikit_learn', 'joblib'
    ]

    missing_modules = []
    for module in required_modules:
        try:
            __import__(module.replace('_', '-'))
        except ImportError:
            missing_modules.append(module)

    if missing_modules:
        logger.error(f"Missing required modules: {', '.join(missing_modules)}")
        logger.error("Please install them using: pip install -r requirements.txt")
        sys.exit(1)

    logger.info("All dependencies are available")

def main():
    """Main function to start the service"""
    try:
        # Parse arguments
        args = parse_arguments()

        # Setup environment
        setup_environment()

        # Check dependencies
        check_dependencies()

        # Log startup information
        logger.info("Starting ML Prediction Service...")
        logger.info(f"Host: {args.host}")
        logger.info(f"Port: {args.port}")
        logger.info(f"Workers: {args.workers}")
        logger.info(f"Reload: {args.reload}")
        logger.info(f"Log level: {args.log_level}")

        # Start the server
        uvicorn.run(
            "api:app",
            host=args.host,
            port=args.port,
            workers=args.workers,
            reload=args.reload,
            log_level=args.log_level
        )

    except KeyboardInterrupt:
        logger.info("Service stopped by user")
    except Exception as e:
        logger.error(f"Error starting service: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()