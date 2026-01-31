# 3D Skeleton Editor (SK-Editor)

A web-based 3D skeleton editor designed for viewing and modifying skeletal data, with seamless support for PyTorch (`.pt`) formats.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.6+](https://img.shields.io/badge/python-3.6+-blue.svg)](https://www.python.org/downloads/)

## 🌟 Core Features

- **Web-based 3D Editing**: Modify bone positions directly in 3D space using interactive transform controls.
- **Native PT Support**: Import and export PyTorch `.pt` files directly without manual conversion.
- **Metadata Preservation**: Maintains original bone names, parent-child hierarchies, and tensor structures during the editing process.
- **Professional UI**: Clean, AISTudio-inspired interface with shortcut support for an efficient workflow.
- **Real-time Preview**: Changes are reflected instantly in the 3D viewport.

## 📂 Project Structure

- **`src/`**: Core application code.
  - `server.py`: Integrated backend handling file I/O and PT conversion.
  - `index.html`: Main editor interface.
  - `js/`: Frontend logic (Three.js rendering, skeleton management, import/export).
  - `style.css`: Editor styling.
- **`data/`**: Example skeleton data files (`.pt`).
- **`scripts/`**: Utility scripts.
  - `Launch Editor.command`: One-click launch script (macOS/Linux).
  - `convert_skeleton.py`: Offline format conversion tools.
- **`requirements.txt`**: Python dependencies.

## 🚀 Getting Started

### 1. Prerequisites

Ensure you have Python 3.6 or higher installed on your system.

### 2. Install Dependencies

Run the following command in the project root:

```bash
pip install -r requirements.txt
```

### 3. Launch the Editor

You can start the editor using either of these methods:

**Method A: Run directly with Python**
```bash
python3 src/server.py
```

**Method B: Use the launch script (macOS/Linux)**
```bash
bash scripts/"Launch Editor.command"
```

Once started, the editor will automatically open in your default browser at `http://localhost:8000`.

## 🛠 How to Use

### Importing Skeletons
- **PyTorch (PT) Format**: Click "📥 Import PT Format". The backend automatically converts the tensor data for the web interface.

### Editing
- **Q / W / E**: Toggle between **Translate**, **Rotate**, and **Scale** modes.
- **Left Click**: Select a bone.
- **Drag Gizmo**: Adjust bone position/orientation in 3D space.
- **Delete**: Remove the selected bone.

### Exporting Data
1. Select **PyTorch PT** from the "Export Format" dropdown.
2. Click "📤 Export Skeleton".
   - The backend reconstructs the tensor structure and triggers a browser download.

## 🔬 Technical Details

The editor uses **Three.js** for 3D rendering and a lightweight **Python BaseHTTP** backend. When handling `.pt` files, the backend ensures that the `skeleton` tensor, `bone_names` list, and `parent_mapping` dictionary match the original format exactly, making the exported data ready for deep learning training or inference.

## 📄 License

This project is licensed under the [MIT License](LICENSE).
