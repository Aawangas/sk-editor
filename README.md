# 3D Skeleton Editor

A web-based 3D skeleton editor designed for viewing and modifying skeletal data, with seamless support for PyTorch (`.pt`) and JSON formats.

## Project Structure

- **`data/`**: Contains skeleton data files (`.pt`, `.json`) and example files.
- **`src/`**: The core application code, including the web interface and the Python backend server.
  - `server.py`: Integrated backend handling file I/O and PT conversion.
  - `index.html`: Main editor interface.
  - `js/`: Frontend logic (Three.js, Skeleton management, Import/Export).
- **`scripts/`**: Utility scripts for environment setup and legacy format conversion.
- **`requirements.txt`**: Python dependencies.

## Key Features

- **Web-based 3D Editing**: Modify bone positions directly in a 3D space.
- **PT & JSON Integration**: Seamlessly import and export PyTorch `.pt` files without needing manual terminal conversion.
- **Preserved Metadata**: Maintains original bone names and parent-child hierarchies during round-trip editing.
- **AISTudio Style UI**: Clean, professional interface for efficient workflow.

## Getting Started

### 1. Install Dependencies

Ensure you have Python 3.6+ and the required libraries installed:

```bash
pip install -r requirements.txt
```

### 2. Launch the Editor

Run the integrated server from the `src` directory:

```bash
python3 src/server.py
```

Or use the provided script (macOS/Linux):

```bash
bash scripts/"Launch Editor.command"
```

The editor will automatically open in your default browser at `http://localhost:8000`.

## How to Use

### Importing Skeletons
- **JSON**: Click "📥 Import Skeleton (JSON)" and select your file.
- **PyTorch (PT)**: Click "📥 Import PT Format". The backend will automatically handle the conversion.

### Exporting Skeletons
1. Select your desired format from the "Export Format" dropdown (Standard JSON, Simple JSON, or PyTorch PT).
2. Click "📤 Export Skeleton".
   - If **PT** is selected, the server will generate the `.pt` file and trigger a browser download.

### Editing
- **G / R / S**: Switch between Translate, Rotate, and Scale modes.
- **Left Click**: Select a bone.
- **Drag**: Move the selected bone (in Translate mode).
- **Shift + Click**: Select multiple bones.
- **Delete**: Remove selected bones.

## Technical Details

The editor uses **Three.js** for 3D rendering and a lightweight **Python (BaseHTTP)** backend for processing PyTorch tensors. When exporting to PT, the backend ensures that the `skeleton` tensor, `bone_names` list, and `parent_mapping` dictionary match the original format exactly.

## License

MIT License
