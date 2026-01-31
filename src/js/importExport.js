/**
 * 3D Skeleton Editor - Import/Export Module
 */

const ImportExport = {
    // Import skeleton
    importSkeleton(file, callback) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('No file selected'));
                return;
            }

            const reader = new FileReader();
            
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    const skeleton = this.parseSkeletonData(data);
                    
                    if (callback) {
                        callback(skeleton);
                    }
                    
                    resolve(skeleton);
                } catch (error) {
                    // Try to process as PT file
                    this.processPTFile(file).then(skeleton => {
                        if (callback) {
                            callback(skeleton);
                        }
                        resolve(skeleton);
                    }).catch(err => {
                        reject(new Error('Failed to parse skeleton data: ' + err.message));
                    });
                }
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };
            
            reader.readAsText(file);
        });
    },

    // Process PT file (via backend API)
    async processPTFile(file) {
        const formData = new FormData();
        // Read file as binary stream
        const arrayBuffer = await file.arrayBuffer();
        
        console.log('Sending PT file to server for conversion...', file.name);

        const response = await fetch('/api/convert_pt', {
            method: 'POST',
            body: arrayBuffer,
            headers: {
                'Content-Type': 'application/octet-stream'
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Server conversion failed');
        }

        const result = await response.json();
        console.log('Conversion successful:', result);
        
        if (result.status === 'success') {
            return this.importSimpleFormat(result.skeleton);
        } else {
            throw new Error(result.message);
        }
    },

    // Load PT file using Python (Legacy/Internal)
    async loadPTWithPython(arrayBuffer, filename) {
        // Convert ArrayBuffer to base64
        const base64 = this.arrayBufferToBase64(arrayBuffer);
        
        // Call Python service via fetch or use inline script
        // Here we create a temporary Python script
        const tempScript = `
import torch
import base64
import json
import sys

# Load data from base64
data = base64.b64decode("${base64}")

# Save temporary file
with open("/tmp/temp_skeleton.pt", "wb") as f:
    f.write(data)

# Load skeleton
skeleton_data = torch.load("/tmp/temp_skeleton.pt", map_location="cpu")

# Convert to our format
result = {
    "name": "Imported Skeleton",
    "bones": []
}

skeleton = skeleton_data["skeleton"]
bone_names = skeleton_data["bone_names"]
parent_mapping = skeleton_data["parent_mapping"]

# Find root bone (parent points to itself)
root_name = None
for name, parent in parent_mapping.items():
    if name == parent:
        root_name = name
        break

if root_name is None:
    root_name = bone_names[0]

# Build bone list
for i, bone_name in enumerate(bone_names):
    parent_name = parent_mapping.get(bone_name, "")
    
    # Get position
    if isinstance(skeleton, torch.Tensor):
        position = skeleton[i].tolist()
    elif isinstance(skeleton, list):
        position = skeleton[i]
    else:
        position = [0, 0, 0]
    
    bone = {
        "name": bone_name.split("--")[-1].split("_")[0],  # Simplified name
        "originalName": bone_name,
        "position": {
            "x": float(position[0]),
            "y": float(position[1]),
            "z": float(position[2])
        },
        "parentIndex": -1,
        "parentName": parent_name if parent_name != bone_name else None
    }
    
    result["bones"].append(bone)

# Output JSON
print(json.dumps(result))
`;

        // Since Python cannot run directly in browser, we use the integrated backend API
        return new Promise((resolve, reject) => {
            reject(new Error(
                'PT format needs to be converted in a Python environment.\n\n' +
                'Please ensure the backend server is running.'
            ));
        });
    },

    // ArrayBuffer to Base64
    arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    },

    // Parse different skeleton data formats
    parseSkeletonData(data) {
        console.log('=== parseSkeletonData ===');
        console.log('has root:', !!data.root);
        console.log('has boneCount:', data.boneCount !== undefined);
        console.log('has bones:', !!data.bones);
        console.log('has id:', !!data.id);
        console.log('has name:', !!data.name);
        
        // Check for standard format
        if (data.root && data.boneCount !== undefined) {
            console.log('Using standard format');
            return this.importStandardFormat(data);
        }
        
        // Check for simple format
        if (data.bones && Array.isArray(data.bones)) {
            console.log('Using simple format');
            return this.importSimpleFormat(data);
        }
        
        // Try parsing as standard skeleton format
        if (data.id && data.name) {
            console.log('Using Skeleton.fromJSON');
            return Skeleton.fromJSON(data);
        }
        
        throw new Error('Unsupported skeleton data format');
    },

    // Import simple format (bones array)
    importSimpleFormat(data) {
        const skeleton = new Skeleton(data.name || 'Imported Skeleton');
        
        if (!data.bones || data.bones.length === 0) {
            return skeleton;
        }

        // Create name-to-bone mapping
        const nameToBone = {};
        const bones = data.bones;
        
        // Create all bones first
        bones.forEach((boneData, index) => {
            const bone = new BoneNode(
                boneData.name || `Bone_${index}`,
                boneData.position || { x: 0, y: 0, z: 0 }
            );
            
            if (boneData.rotation) {
                bone.rotation = boneData.rotation;
            }
            if (boneData.scale) {
                bone.scale = boneData.scale;
            }
            if (boneData.length) {
                bone.length = boneData.length;
            }
            if (boneData.thickness) {
                bone.thickness = boneData.thickness;
            }
            
            // Save original name
            bone.originalName = boneData.originalName || boneData.name || null;
            
            skeleton.bones.push(bone);
            nameToBone[boneData.name] = bone;
        });

        // Establish parent-child relationships
        let rootBone = null;
        bones.forEach((boneData, index) => {
            const bone = skeleton.bones[index];
            
            // Prioritize parentIndex as it's the most reliable sequence reference
            if (boneData.parentIndex !== undefined && boneData.parentIndex >= 0) {
                const parentBone = skeleton.bones[boneData.parentIndex];
                if (parentBone && parentBone !== bone) {
                    parentBone.addChild(bone);
                }
            }
            // Use parentName as fallback
            else if (boneData.parentName) {
                const parentBone = nameToBone[boneData.parentName];
                if (parentBone && parentBone !== bone) {
                    parentBone.addChild(bone);
                }
            }
        });

        // Find root bone (no parent)
        rootBone = skeleton.bones.find(b => !b.parent);
        
        // Set root bone
        if (rootBone) {
            skeleton.setRoot(rootBone);
        } else if (skeleton.bones.length > 0) {
            // If no root found, set first bone as root
            skeleton.setRoot(skeleton.bones[0]);
        }

        // Force update bone list
        skeleton.updateBoneList();

        return skeleton;
    },

    // Import standard format
    importStandardFormat(data) {
        return Skeleton.fromJSON(data);
    },

    // Export skeleton to PT format (via Python)
    exportToPTFormat(skeleton, callback) {
        // Build Python-readable data
        const boneNames = skeleton.bones.map(b => b.originalName || b.name);
        const positions = skeleton.bones.map(b => [b.position.x, b.position.y, b.position.z]);
        const parentMapping = {};
        
        skeleton.bones.forEach(bone => {
            const name = bone.originalName || bone.name;
            if (bone.parent) {
                parentMapping[name] = bone.parent.originalName || bone.parent.name;
            } else {
                parentMapping[name] = name;  // Root bone points to itself
            }
        });
        
        const data = {
            skeleton: positions,
            bone_names: boneNames,
            parent_mapping: parentMapping
        };
        
        // Generate Python script to save PT file
        const pythonScript = `
import torch
import json

data = ${JSON.stringify(data, null, 2)}

result = {
    "skeleton": torch.tensor(data["skeleton"], dtype=torch.float32),
    "bone_names": data["bone_names"],
    "parent_mapping": data["parent_mapping"]
}

torch.save(result, "${skeleton.name.replace(/\s+/g, '_')}.pt")
print("Saved to ${skeleton.name.replace(/\s+/g, '_')}.pt")
`;
        
        if (callback) {
            callback(data, pythonScript);
        }
        
        return { data, pythonScript };
    },

    // Export skeleton
    async exportSkeleton(skeleton, format = 'standard', callback) {
        let data;
        let filename;
        let mimeType;

        if (format === 'pt') {
            try {
                // Show loading state
                console.log('Requesting PT export from server...');
                const skeletonData = skeleton.exportToSimpleJSON();
                
                const response = await fetch('/api/export_pt', {
                    method: 'POST',
                    body: JSON.stringify({ skeleton: skeletonData }),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.message || 'PT export failed');
                }

                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${skeleton.name.replace(/\s+/g, '_')}.pt`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                if (callback) callback({ status: 'success' });
                return;
            } catch (error) {
                console.error('PT export error:', error);
                alert(`PT Export Failed: ${error.message}`);
                return;
            }
        }

        switch (format) {
            case 'simple':
                data = skeleton.exportToSimpleJSON();
                filename = `${skeleton.name.replace(/\s+/g, '_')}_simple.json`;
                mimeType = 'application/json';
                break;
            
            case 'standard':
            default:
                data = skeleton.toJSON();
                filename = `${skeleton.name.replace(/\s+/g, '_')}.json`;
                mimeType = 'application/json';
                break;
        }

        this.downloadFile(data, filename, mimeType);
        
        if (callback) {
            callback(data);
        }
        
        return data;
    },

    // Export in different formats
    exportToFormat(skeleton, format) {
        switch (format) {
            case 'json':
                return {
                    data: skeleton.toJSON(),
                    filename: `${skeleton.name}.json`
                };
            
            case 'simple':
                return {
                    data: skeleton.exportToSimpleJSON(),
                    filename: `${skeleton.name}_simple.json`
                };
            
            case 'pt':
                return this.exportToPTFormat(skeleton);
            
            case 'full':
                const fullData = {
                    ...skeleton.toJSON(),
                    exportInfo: {
                        format: 'full',
                        exportDate: new Date().toISOString(),
                        exporter: '3D Skeleton Editor',
                        exporterVersion: '1.0.0'
                    }
                };
                return {
                    data: fullData,
                    filename: `${skeleton.name}_full.json`
                };
            
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    },

    // Download Python script
    downloadPythonScript(script, filename) {
        const blob = new Blob([script], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 100);
    },

    // Download file
    downloadFile(data, filename, mimeType = 'application/json') {
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 100);
    },

    // Export as string
    exportToString(skeleton, format = 'standard') {
        let data;
        
        switch (format) {
            case 'simple':
                data = skeleton.exportToSimpleJSON();
                break;
            case 'full':
                data = {
                    ...skeleton.toJSON(),
                    exportInfo: {
                        format: 'full',
                        exportDate: new Date().toISOString()
                    }
                };
                break;
            default:
                data = skeleton.toJSON();
        }
        
        return JSON.stringify(data, null, 2);
    },

    // Import skeleton from URL
    importFromURL(url, callback) {
        return new Promise((resolve, reject) => {
            fetch(url)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP Error: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    const skeleton = this.parseSkeletonData(data);
                    
                    if (callback) {
                        callback(skeleton);
                    }
                    
                    resolve(skeleton);
                })
                .catch(error => {
                    reject(new Error('Import from URL failed: ' + error.message));
                });
        });
    },

    // Export scene data
    exportSceneData(skeleton, visualData) {
        return {
            skeleton: skeleton.toJSON(),
            visual: {
                backgroundColor: visualData.backgroundColor,
                gridEnabled: visualData.gridEnabled,
                axesEnabled: visualData.axesEnabled,
                cameraPosition: visualData.cameraPosition,
                cameraTarget: visualData.cameraTarget
            },
            exportInfo: {
                format: 'scene',
                exportDate: new Date().toISOString(),
                exporter: '3D Skeleton Editor',
                exporterVersion: '1.0.0'
            }
        };
    },

    // Validate skeleton data
    validateSkeletonData(data) {
        const errors = [];
        const warnings = [];

        if (!data) {
            errors.push('Data is empty');
            return { valid: false, errors, warnings };
        }

        if (!data.name) {
            warnings.push('Skeleton has no name, using default');
        }

        if (!data.root && !data.bones) {
            errors.push('Incomplete data: no root or bones list');
        }

        if (data.bones && Array.isArray(data.bones)) {
            if (data.bones.length === 0) {
                warnings.push('Bone list is empty');
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    },

    // Import from local path (via backend API)
    async importFromLocalPath(path) {
        console.log('Loading from local path:', path);
        const response = await fetch(`/api/load_local?path=${encodeURIComponent(path)}`);
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to load local file');
        }

        const result = await response.json();
        if (result.status === 'success') {
            return this.importSimpleFormat(result.skeleton);
        } else {
            throw new Error(result.message);
        }
    },

    // Copy to clipboard
    copyToClipboard(skeleton, format = 'standard') {
        const data = this.exportToString(skeleton, format);
        
        navigator.clipboard.writeText(data)
            .then(() => {
                console.log('Skeleton data copied to clipboard');
                return true;
            })
            .catch(error => {
                console.error('Failed to copy to clipboard:', error);
                return false;
            });
    },

    // Import from clipboard
    async importFromClipboard() {
        try {
            const text = await navigator.clipboard.readText();
            const data = JSON.parse(text);
            return this.parseSkeletonData(data);
        } catch (error) {
            throw new Error('Failed to import from clipboard: ' + error.message);
        }
    }
};

// 导出模块
window.ImportExport = ImportExport;
