/**
 * 3D Skeleton Editor - Data structures and classes
 */

class BoneNode {
    constructor(name = 'Bone', position = { x: 0, y: 0, z: 0 }) {
        this.id = this.generateId();
        this.name = name;
        this.originalName = null;  // Original bone name (for PT format)
        this.position = { ...position };
        this.rotation = { x: 0, y: 0, z: 0 };
        this.scale = { x: 1, y: 1, z: 1 };
        this.children = [];
        this.parent = null;
        this.length = 1.0;
        this.thickness = 0.1;
        this.color = 0x667eea;
        
        // Metadata
        this.metadata = {};
        this.createdAt = new Date().toISOString();
        this.modifiedAt = new Date().toISOString();
    }

    generateId() {
        return 'bone_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    addChild(child) {
        if (child.parent) {
            child.parent.removeChild(child);
        }
        child.parent = this;
        this.children.push(child);
        this.modifiedAt = new Date().toISOString();
    }

    removeChild(child) {
        const index = this.children.indexOf(child);
        if (index > -1) {
            this.children.splice(index, 1);
            child.parent = null;
            this.modifiedAt = new Date().toISOString();
        }
    }

    getWorldPosition() {
        let x = this.position.x;
        let y = this.position.y;
        let z = this.position.z;

        let current = this.parent;
        while (current) {
            x += current.position.x;
            y += current.position.y;
            z += current.position.z;
            current = current.parent;
        }

        return { x, y, z };
    }

    clone(deep = true) {
        const clone = new BoneNode(this.name + '_clone', { ...this.position });
        clone.rotation = { ...this.rotation };
        clone.scale = { ...this.scale };
        clone.length = this.length;
        clone.thickness = this.thickness;
        clone.color = this.color;
        clone.metadata = { ...this.metadata };

        if (deep) {
            this.children.forEach(child => {
                const childClone = child.clone(true);
                clone.addChild(childClone);
            });
        }

        return clone;
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            originalName: this.originalName,
            position: this.position,
            rotation: this.rotation,
            scale: this.scale,
            length: this.length,
            thickness: this.thickness,
            color: this.color,
            metadata: this.metadata,
            createdAt: this.createdAt,
            modifiedAt: this.modifiedAt,
            children: this.children.map(child => child.toJSON())
        };
    }

    static fromJSON(data) {
        const bone = new BoneNode(data.name, data.position);
        bone.id = data.id;
        bone.originalName = data.originalName || null;
        bone.rotation = data.rotation || { x: 0, y: 0, z: 0 };
        bone.scale = data.scale || { x: 1, y: 1, z: 1 };
        bone.length = data.length || 1.0;
        bone.thickness = data.thickness || 0.1;
        bone.color = data.color || 0x667eea;
        bone.metadata = data.metadata || {};
        bone.createdAt = data.createdAt;
        bone.modifiedAt = data.modifiedAt;

        if (data.children && data.children.length > 0) {
            data.children.forEach(childData => {
                const childBone = BoneNode.fromJSON(childData);
                bone.addChild(childBone);
            });
        }

        return bone;
    }
}

class Skeleton {
    constructor(name = 'Skeleton') {
        this.id = this.generateId();
        this.name = name;
        this.root = null;
        this.bones = [];
        this.selectedBones = new Set();
        
        // Skeleton metadata
        this.metadata = {
            version: '1.0.0',
            author: '',
            description: '',
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString()
        };
    }

    generateId() {
        return 'skeleton_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    setRoot(bone) {
        this.root = bone;
        this.updateBoneList();
        this.metadata.modifiedAt = new Date().toISOString();
    }

    addBone(parentBone, name, position) {
        if (!parentBone && !this.root) {
            // Create root bone
            const bone = new BoneNode(name, position);
            this.setRoot(bone);
            return bone;
        }

        const parent = parentBone || this.root;
        const bone = new BoneNode(name, position);
        parent.addChild(bone);
        this.updateBoneList();
        this.metadata.modifiedAt = new Date().toISOString();
        return bone;
    }

    removeBone(bone) {
        if (!bone) return;

        // Recursively remove all children
        const children = [...bone.children];
        children.forEach(child => this.removeBone(child));

        if (bone.parent) {
            bone.parent.removeChild(bone);
        } else if (bone === this.root) {
            this.root = null;
        }

        this.selectedBones.delete(bone);
        this.updateBoneList();
        this.metadata.modifiedAt = new Date().toISOString();
    }

    selectBone(bone, multi = false) {
        if (!multi) {
            this.selectedBones.forEach(b => b.metadata.selected = false);
            this.selectedBones.clear();
        }

        if (bone && !this.selectedBones.has(bone)) {
            this.selectedBones.add(bone);
            bone.metadata.selected = true;
        }
    }

    clearSelection() {
        this.selectedBones.forEach(b => b.metadata.selected = false);
        this.selectedBones.clear();
    }

    getBoneById(id) {
        return this.bones.find(bone => bone.id === id);
    }

    getBoneByName(name) {
        return this.bones.find(bone => bone.name === name);
    }

    updateBoneList() {
        const dfsBones = [];
        if (this.root) {
            this._collectBonesRecursive(this.root, dfsBones);
        }
        
        // If the current bones list already contains all DFS-traversed bones,
        // it means it's just in a different order (maybe the original order from import),
        // we prioritize keeping it as is.
        if (this.bones.length === dfsBones.length && dfsBones.length > 0) {
            const currentSet = new Set(this.bones);
            const isMatch = dfsBones.every(b => currentSet.has(b));
            if (isMatch) {
                return; 
            }
        }
        
        this.bones = dfsBones;
    }

    _collectBonesRecursive(bone, list) {
        list.push(bone);
        bone.children.forEach(child => this._collectBonesRecursive(child, list));
    }

    collectBones(bone) {
        // Keep for backward compatibility, but uses recursive internal version
        this.bones.push(bone);
        bone.children.forEach(child => this.collectBones(child));
    }

    findBonePath(targetBone) {
        if (!targetBone) return [];

        const path = [];
        let current = targetBone;

        while (current) {
            path.unshift(current);
            current = current.parent;
        }

        return path;
    }

    getCommonAncestor(bone1, bone2) {
        const path1 = new Set(this.findBonePath(bone1));
        const path2 = this.findBonePath(bone2);

        for (const bone of path2) {
            if (path1.has(bone)) {
                return bone;
            }
        }

        return null;
    }

    clone() {
        const clone = new Skeleton(this.name + '_clone');
        clone.metadata = { ...this.metadata };

        if (this.root) {
            clone.setRoot(this.root.clone(true));
        }

        return clone;
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            metadata: this.metadata,
            root: this.root ? this.root.toJSON() : null,
            boneCount: this.bones.length
        };
    }

    static fromJSON(data) {
        const skeleton = new Skeleton(data.name);
        skeleton.id = data.id || skeleton.id;
        skeleton.metadata = { ...skeleton.metadata, ...data.metadata };

        if (data.root) {
            skeleton.setRoot(BoneNode.fromJSON(data.root));
        }

        return skeleton;
    }

    // Compatibility format for import/export
    exportToSimpleJSON() {
        // Use the current this.bones list, which should maintain the original import order (unless deletions/additions occurred)
        const bonesData = this.bones.map((bone, index) => {
            return {
                index: index,
                name: bone.name,
                originalName: bone.originalName,
                position: bone.position,
                rotation: bone.rotation,
                scale: bone.scale,
                length: bone.length,
                parentIndex: bone.parent ? this.bones.indexOf(bone.parent) : -1,
                parentName: bone.parent ? (bone.parent.originalName || bone.parent.name) : null
            };
        });

        return {
            name: this.name,
            boneCount: bonesData.length,
            bones: bonesData,
            format: 'simple'
        };
    }

    static importFromSimpleJSON(data) {
        const skeleton = new Skeleton(data.name || 'Imported Skeleton');
        
        if (!data.bones || data.bones.length === 0) {
            return skeleton;
        }

        // Create all bones
        const boneArray = [];
        data.bones.forEach(boneData => {
            const bone = new BoneNode(
                boneData.name || `Bone_${boneData.index}`,
                boneData.position || { x: 0, y: 0, z: 0 }
            );
            bone.rotation = boneData.rotation || { x: 0, y: 0, z: 0 };
            bone.length = boneData.length || 1.0;
            boneArray[boneData.index] = bone;
        });

        // Establish parent-child relationships
        data.bones.forEach(boneData => {
            if (boneData.parentIndex !== undefined && boneData.parentIndex >= 0) {
                const parent = boneArray[boneData.parentIndex];
                const bone = boneArray[boneData.index];
                if (parent && bone) {
                    parent.addChild(bone);
                }
            }
        });

        // Set root bone
        const rootBone = boneArray.find(b => !data.bones[boneArray.indexOf(b)]?.parentIndex || 
            data.bones[boneArray.indexOf(b)]?.parentIndex < 0);
        
        if (rootBone) {
            skeleton.setRoot(rootBone);
        }

        return skeleton;
    }
}

// Export classes
window.BoneNode = BoneNode;
window.Skeleton = Skeleton;
