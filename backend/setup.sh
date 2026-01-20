#!/bin/bash
# MeshSOS Backend Setup Script
# Sets up Python environment and dependencies

set -e  # Exit on error

echo "========================================="
echo "MeshSOS Backend Setup"
echo "========================================="
echo ""

# Check Python version
echo "[1/5] Checking Python version..."
if ! command -v python3 &> /dev/null; then
    echo "Error: python3 not found. Please install Python 3.11+"
    exit 1
fi

PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
echo "  ✓ Found Python $PYTHON_VERSION"

# Create virtual environment
echo ""
echo "[2/5] Creating virtual environment..."
if [ -d ".venv" ]; then
    echo "  ℹ Virtual environment already exists"
else
    python3 -m venv .venv
    echo "  ✓ Created .venv"
fi

# Activate virtual environment
echo ""
echo "[3/5] Activating virtual environment..."
source .venv/bin/activate
echo "  ✓ Activated"

# Install dependencies
echo ""
echo "[4/5] Installing dependencies..."
pip install --upgrade pip > /dev/null 2>&1
pip install -r requirements.txt
echo "  ✓ Dependencies installed"

# Initialize database
echo ""
echo "[5/5] Initializing database..."
python3 -c "
import sys
from pathlib import Path
sys.path.insert(0, str(Path.cwd()))
from database import init_db
conn = init_db()
conn.close()
print('  ✓ Database initialized')
"

echo ""
echo "========================================="
echo "Setup Complete!"
echo "========================================="
echo ""
echo "To get started:"
echo ""
echo "  1. Activate virtual environment:"
echo "     source .venv/bin/activate"
echo ""
echo "  2. Run quick demo:"
echo "     python scripts/demo.py"
echo ""
echo "  3. Or start components manually:"
echo "     python -m api.main                    # Backend API"
echo "     python -m bridge.main /dev/stdin      # Gateway bridge"
echo ""
echo "  4. Run tests:"
echo "     pytest tests/ -v"
echo ""
echo "Documentation: backend/README.md"
echo ""
