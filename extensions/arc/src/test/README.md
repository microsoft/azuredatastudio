# Tests for deploying Arc resources via Jupyter notebook

## Prerequisites
- Python >= 3.6
- Pip package manager
- Azdata CLI installed and logged into an Arc controller

## Running the tests
### 1. (Optional, recommended) Create and activate a Python virtual environment
- `python -m venv env`
- `source env/bin/activate` (Linux)
- `env\Scripts\activate.bat` (Windows)

### 2. Upgrade pip
- `pip install --upgrade pip`

### 3. Install the dependencies
- `pip install -r requirements.txt`

### 4. Run the tests
- `pytest`
