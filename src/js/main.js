/**
 * 3D Skeleton Editor - Main Logic
 */

class SkeletonEditor {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        
        this.skeleton = null;
        this.boneMeshes = new Map();
        this.boneConnections = [];
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.lastMouse = new THREE.Vector2();
        
        // Edit state
        this.selectedBone = null;
        this.selectedMesh = null;
        this.isDragging = false;
        
        // Drag related
        this.dragPlane = null;
        this.dragStartPoint = new THREE.Vector3();
        this.boneStartPosition = new THREE.Vector3();
        
        // Bone size (auto-adjusted based on range)
        this.boneSphereRadius = 0.02;
        this.rodRadius = 0.008;
        
        // Transform mode
        this.transformMode = 'translate';
        
        this.init();
    }

    init() {
        this.setupScene();
        this.setupCamera();
        this.setupRenderer();
        this.setupLights();
        this.setupControls();
        this.setupHelpers();
        this.setupEventListeners();
        
        this.checkUrlParams();
        this.animate();
    }

    async checkUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const filePath = params.get('file');
        
        if (filePath) {
            try {
                const skeleton = await ImportExport.importFromLocalPath(filePath);
                this.skeleton = skeleton;
                this.renderSkeleton();
                console.log('Successfully loaded file from URL parameter:', filePath);
            } catch (error) {
                console.error('Failed to load file from URL parameter:', error);
                this.createDefaultSkeleton();
            }
        } else {
            this.createDefaultSkeleton();
        }
    }

    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf5f5f5);
        this.scene.fog = new THREE.Fog(0xf5f5f5, 5, 15);
        
        // Create drag plane (facing the camera)
        this.dragPlane = new THREE.Plane();
    }

    setupCamera() {
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(60, aspect, 0.01, 10);
        // Bones are distributed in [-0.5, 0.5], camera position adjusted to a closer distance
        this.camera.position.set(1.5, 1.5, 2);
        this.camera.lookAt(0, 0, 0);
    }

    setupRenderer() {
        const canvas = document.getElementById('canvas');
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: canvas,
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
        mainLight.position.set(10, 20, 10);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        this.scene.add(mainLight);

        const fillLight = new THREE.DirectionalLight(0x667eea, 0.4);
        fillLight.position.set(-10, 5, -10);
        this.scene.add(fillLight);
    }

    setupControls() {
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = true;
        this.controls.minDistance = 1;
        this.controls.maxDistance = 50;
        this.controls.maxPolarAngle = Math.PI;
    }

    setupHelpers() {
        // Grid size adjusted for [-0.5, 0.5] range
        this.gridHelper = new THREE.GridHelper(1, 20, 0x444466, 0x333355);
        this.scene.add(this.gridHelper);
        
        // Axes size adjustment
        this.axesHelper = new THREE.AxesHelper(0.6);
        this.scene.add(this.axesHelper);
    }

    setupEventListeners() {
        window.addEventListener('resize', () => this.onWindowResize());
        
        const canvas = this.renderer.domElement;
        canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
        canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
        canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
        canvas.addEventListener('pointerleave', (e) => this.onPointerUp(e));
        
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        
        this.setupUIListeners();
    }

    setupUIListeners() {
        // PT Import Button
        const importPTBtn = document.getElementById('importPTBtn');
        if (importPTBtn) {
            importPTBtn.addEventListener('click', () => {
                const input = document.getElementById('importPTFile');
                if (input) input.click();
            });
        }

        // PT File Selection
        const importPTFile = document.getElementById('importPTFile');
        if (importPTFile) {
            importPTFile.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) this.importPTSkeleton(file);
                e.target.value = '';
            });
        }

        // Export Button
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportSkeleton());
        }

        // Skeleton Action Buttons
        const addBoneBtn = document.getElementById('addBoneBtn');
        if (addBoneBtn) {
            addBoneBtn.addEventListener('click', () => this.addNewBone());
        }

        const deleteBoneBtn = document.getElementById('deleteBoneBtn');
        if (deleteBoneBtn) {
            deleteBoneBtn.addEventListener('click', () => this.deleteSelectedBones());
        }

        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetView());
        }

        document.getElementById('topView').addEventListener('click', () => this.setView('top'));
        document.getElementById('frontView').addEventListener('click', () => this.setView('front'));
        document.getElementById('sideView').addEventListener('click', () => this.setView('side'));
        document.getElementById('perspectiveView').addEventListener('click', () => this.setView('perspective'));

        document.getElementById('showGrid').addEventListener('change', (e) => {
            this.gridHelper.visible = e.target.checked;
        });
        document.getElementById('showAxes').addEventListener('change', (e) => {
            this.axesHelper.visible = e.target.checked;
        });

        document.getElementById('boneName').addEventListener('input', (e) => {
            this.renameSelectedBone(e.target.value);
        });
    }

    createDefaultSkeleton() {
        this.skeleton = new Skeleton('Default Skeleton');
        
        // Bone positions scaled within [-0.5, 0.5] range
        const root = this.skeleton.addBone(null, 'Root', { x: 0, y: 0, z: 0 });
        root.length = 0.15;
        
        const spine = this.skeleton.addBone(root, 'Spine', { x: 0, y: 0.15, z: 0 });
        spine.length = 0.12;
        
        const head = this.skeleton.addBone(spine, 'Head', { x: 0, y: 0.12, z: 0 });
        head.length = 0.08;
        
        const leftShoulder = this.skeleton.addBone(spine, 'LeftShoulder', { x: 0.05, y: 0.10, z: 0 });
        const leftArm = this.skeleton.addBone(leftShoulder, 'LeftArm', { x: 0.05, y: 0, z: 0 });
        leftArm.length = 0.08;
        const leftForearm = this.skeleton.addBone(leftArm, 'LeftForearm', { x: 0.08, y: 0, z: 0 });
        leftForearm.length = 0.07;
        
        const rightShoulder = this.skeleton.addBone(spine, 'RightShoulder', { x: -0.05, y: 0.10, z: 0 });
        const rightArm = this.skeleton.addBone(rightShoulder, 'RightArm', { x: -0.05, y: 0, z: 0 });
        rightArm.length = 0.08;
        const rightForearm = this.skeleton.addBone(rightArm, 'RightForearm', { x: -0.08, y: 0, z: 0 });
        rightForearm.length = 0.07;
        
        const leftHip = this.skeleton.addBone(root, 'LeftHip', { x: 0.03, y: 0, z: 0 });
        const leftThigh = this.skeleton.addBone(leftHip, 'LeftThigh', { x: 0, y: -0.05, z: 0 });
        leftThigh.length = 0.10;
        const leftShin = this.skeleton.addBone(leftThigh, 'LeftShin', { x: 0, y: -0.10, z: 0 });
        leftShin.length = 0.10;
        
        const rightHip = this.skeleton.addBone(root, 'RightHip', { x: -0.03, y: 0, z: 0 });
        const rightThigh = this.skeleton.addBone(rightHip, 'RightThigh', { x: 0, y: -0.05, z: 0 });
        rightThigh.length = 0.10;
        const rightShin = this.skeleton.addBone(rightThigh, 'RightShin', { x: 0, y: -0.10, z: 0 });
        rightShin.length = 0.10;

        this.renderSkeleton();
    }

    renderSkeleton() {
        this.clearVisualization();

        if (!this.skeleton) {
            console.error('No skeleton data');
            return;
        }
        
        if (!this.skeleton.root) {
            console.error('Skeleton has no root bone');
            return;
        }

        console.log('=== Rendering Skeleton ===');
        console.log('Total bones:', this.skeleton.bones.length);
        console.log('Root bone:', this.skeleton.root.name);

        // Calculate bone position bounds
        const bounds = this.calculateBoneBounds();
        console.log('Bounds:', bounds);
        
        // Calculate appropriate scale factor based on bounds
        const range = Math.max(
            bounds.max.x - bounds.min.x,
            bounds.max.y - bounds.min.y,
            bounds.max.z - bounds.min.z
        );
        
        console.log('Range value:', range);

        // Auto-adjust sphere size
        this.boneSphereRadius = range > 0 ? range / 50 : 0.02;
        this.rodRadius = this.boneSphereRadius * 0.4;
        
        console.log('Sphere radius:', this.boneSphereRadius);

        // Render all bones
        this.skeleton.bones.forEach(bone => {
            this.createBoneMesh(bone);
        });
        
        console.log('Created', this.boneMeshes.size, 'bone meshes');
        console.log('Created', this.boneConnections.length, 'connections');

        this.createBoneConnections();
    }

    calculateBoneBounds() {
        const min = { x: Infinity, y: Infinity, z: Infinity };
        const max = { x: -Infinity, y: -Infinity, z: -Infinity };

        this.skeleton.bones.forEach(bone => {
            min.x = Math.min(min.x, bone.position.x);
            min.y = Math.min(min.y, bone.position.y);
            min.z = Math.min(min.z, bone.position.z);
            max.x = Math.max(max.x, bone.position.x);
            max.y = Math.max(max.y, bone.position.y);
            max.z = Math.max(max.z, bone.position.z);
        });

        return { min, max };
    }

    createBoneMesh(bone) {
        // Bone joint sphere - size auto-adjusted based on range
        const geometry = new THREE.SphereGeometry(this.boneSphereRadius, 24, 24);
        const material = new THREE.MeshStandardMaterial({
            color: bone.metadata.selected ? 0xff4444 : 0x667eea,
            metalness: 0.4,
            roughness: 0.3,
            emissive: bone.metadata.selected ? 0x441111 : 0x111122
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(bone.position.x, bone.position.y, bone.position.z);
        mesh.userData.bone = bone;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Bone connection rod
        if (bone.parent) {
            const start = new THREE.Vector3(
                bone.parent.position.x,
                bone.parent.position.y,
                bone.parent.position.z
            );
            const end = new THREE.Vector3(
                bone.position.x,
                bone.position.y,
                bone.position.z
            );
            
            const direction = new THREE.Vector3().subVectors(end, start);
            const length = direction.length();
            
            const rodGeometry = new THREE.CylinderGeometry(this.rodRadius, this.rodRadius, length, 12);
            const rodMaterial = new THREE.MeshStandardMaterial({
                color: bone.metadata.selected ? 0xff4444 : 0x667eea,
                metalness: 0.3,
                roughness: 0.4
            });
            
            const rod = new THREE.Mesh(rodGeometry, rodMaterial);
            rod.position.copy(start).add(direction.multiplyScalar(0.5));
            rod.quaternion.setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                direction.normalize()
            );
            
            rod.userData.bone = bone;
            rod.userData.isConnection = true;
            rod.castShadow = true;
            
            this.scene.add(rod);
            this.boneConnections.push(rod);
        }

        this.scene.add(mesh);
        this.boneMeshes.set(bone.id, mesh);
    }

    createBoneConnections() {
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0x667eea,
            transparent: true,
            opacity: 0.6,
            linewidth: 2
        });

        this.skeleton.bones.forEach(bone => {
            if (bone.parent) {
                const points = [
                    new THREE.Vector3(bone.parent.position.x, bone.parent.position.y, bone.parent.position.z),
                    new THREE.Vector3(bone.position.x, bone.position.y, bone.position.z)
                ];
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const line = new THREE.Line(geometry, lineMaterial);
                this.scene.add(line);
                this.boneConnections.push(line);
            }
        });
    }

    clearVisualization() {
        this.boneMeshes.forEach(mesh => {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
        });
        this.boneMeshes.clear();

        this.boneConnections.forEach(obj => {
            this.scene.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        });
        this.boneConnections = [];
    }

    onPointerDown(event) {
        if (event.button !== 0) return;
        
        event.preventDefault();
        
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        this.lastMouse.copy(this.mouse);

        this.raycaster.setFromCamera(this.mouse, this.camera);

        const meshes = Array.from(this.boneMeshes.values());
        const intersects = this.raycaster.intersectObjects(meshes);

        if (intersects.length > 0) {
            const mesh = intersects[0].object;
            const bone = mesh.userData.bone;
            
            if (!event.shiftKey) {
                this.skeleton.clearSelection();
            }
            
            this.skeleton.selectBone(bone, event.shiftKey);
            this.updateSelectionVisualization();
            this.updateBoneInfoPanel(bone);
            
            this.selectedBone = bone;
            this.selectedMesh = mesh;
            this.isDragging = true;
            
            // Setup drag plane (facing the camera)
            const cameraDirection = new THREE.Vector3();
            this.camera.getWorldDirection(cameraDirection);
            this.dragPlane.setFromNormalAndCoplanarPoint(
                cameraDirection.negate(),
                mesh.position
            );
            
            // Record drag start point
            this.raycaster.ray.intersectPlane(this.dragPlane, this.dragStartPoint);
            this.boneStartPosition.copy(mesh.position);
            
            this.controls.enabled = false;
            
        } else {
            this.skeleton.clearSelection();
            this.updateSelectionVisualization();
            this.updateBoneInfoPanel(null);
            this.selectedBone = null;
            this.selectedMesh = null;
        }
    }

    onPointerMove(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Handle dragging
        if (this.isDragging && this.selectedMesh) {
            this.handleBoneDrag();
            this.lastMouse.copy(this.mouse);
            return;
        }

        // Hover effect
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const meshes = Array.from(this.boneMeshes.values());
        const intersects = this.raycaster.intersectObjects(meshes);

        this.boneMeshes.forEach(mesh => {
            const bone = mesh.userData.bone;
            if (!this.skeleton.selectedBones.has(bone)) {
                mesh.material.emissive.setHex(0x000000);
            }
        });

        if (intersects.length > 0) {
            const mesh = intersects[0].object;
            const bone = mesh.userData.bone;
            if (!this.skeleton.selectedBones.has(bone)) {
                mesh.material.emissive.setHex(0x333366);
            }
            document.body.style.cursor = 'grab';
        } else {
            document.body.style.cursor = 'default';
        }
    }

    onPointerUp(event) {
        if (this.isDragging) {
            this.isDragging = false;
            this.controls.enabled = true;
            document.body.style.cursor = 'default';
        }
    }

    handleBoneDrag() {
        if (!this.selectedMesh || !this.selectedBone) return;

        // Use raycaster to detect new position
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersectPoint = new THREE.Vector3();
        
        if (!this.raycaster.ray.intersectPlane(this.dragPlane, intersectPoint)) {
            return;
        }

        // Calculate delta
        const delta = new THREE.Vector3().subVectors(intersectPoint, this.dragStartPoint);

        // Apply translation
        const newPosition = this.boneStartPosition.clone().add(delta);
        this.selectedMesh.position.copy(newPosition);
        
        this.selectedBone.position = {
            x: newPosition.x,
            y: newPosition.y,
            z: newPosition.z
        };
        
        this.selectedBone.modifiedAt = new Date().toISOString();

        // Re-render
        this.renderSkeleton();
        this.updateBoneInfoPanel(this.selectedBone);
    }

    onKeyDown(event) {
        if (event.target.tagName === 'INPUT') return;

        switch (event.key) {
            case 'Delete':
            case 'Backspace':
                this.deleteSelectedBones();
                break;
            case 'Escape':
                this.skeleton.clearSelection();
                this.updateSelectionVisualization();
                this.updateBoneInfoPanel(null);
                this.selectedBone = null;
                this.selectedMesh = null;
                break;
        }
    }

    updateSelectionVisualization() {
        this.boneMeshes.forEach((mesh, boneId) => {
            const bone = mesh.userData.bone;
            const isSelected = this.skeleton.selectedBones.has(bone);
            
            mesh.material.color.setHex(isSelected ? 0xff4444 : 0x667eea);
            mesh.material.emissive.setHex(isSelected ? 0x441111 : 0x000000);
        });

        this.boneConnections.forEach(obj => {
            if (obj.userData && obj.userData.bone) {
                const bone = obj.userData.bone;
                if (obj.material) {
                    obj.material.color.setHex(
                        this.skeleton.selectedBones.has(bone) ? 0xff4444 : 0x667eea
                    );
                }
            }
        });
    }

    updateBoneInfoPanel(bone) {
        const panel = document.getElementById('boneInfo');
        const nameInput = document.getElementById('boneName');

        if (!bone) {
            panel.innerHTML = '<p>No bone selected</p>';
            nameInput.value = '';
            nameInput.disabled = true;
            return;
        }

        panel.innerHTML = `
            <p class="bone-name">${bone.name}</p>
            <p class="bone-detail">ID: ${bone.id.substring(0, 16)}...</p>
            <p class="bone-detail">Pos: (${bone.position.x.toFixed(2)}, ${bone.position.y.toFixed(2)}, ${bone.position.z.toFixed(2)})</p>
            <p class="bone-detail">Children: ${bone.children.length}</p>
        `;

        nameInput.value = bone.name;
        nameInput.disabled = false;
    }

    addNewBone() {
        let parentBone = null;
        
        if (this.skeleton.selectedBones.size > 0) {
            parentBone = Array.from(this.skeleton.selectedBones)[0];
        } else {
            parentBone = this.skeleton.root;
        }

        if (!parentBone) {
            alert('Please select a parent bone first');
            return;
        }

        const boneCount = this.skeleton.bones.length + 1;
        const bone = this.skeleton.addBone(
            parentBone,
            `Bone_${boneCount}`,
            {
                x: parentBone.position.x + 0.5,
                y: parentBone.position.y + 0.5,
                z: parentBone.position.z
            }
        );

        bone.length = 0.5;

        this.renderSkeleton();
        
        this.skeleton.selectBone(bone);
        this.updateSelectionVisualization();
        this.updateBoneInfoPanel(bone);
    }

    deleteSelectedBones() {
        if (this.skeleton.selectedBones.size === 0) return;

        const confirmed = confirm(
            `Are you sure you want to delete the selected ${this.skeleton.selectedBones.size} bone(s)?`
        );

        if (confirmed) {
            const bonesToDelete = Array.from(this.skeleton.selectedBones);
            bonesToDelete.forEach(bone => {
                this.skeleton.removeBone(bone);
            });

            this.renderSkeleton();
            this.updateBoneInfoPanel(null);
            this.selectedBone = null;
            this.selectedMesh = null;
        }
    }

    renameSelectedBone(name) {
        if (this.skeleton.selectedBones.size === 1) {
            const bone = Array.from(this.skeleton.selectedBones)[0];
            bone.name = name;
            bone.modifiedAt = new Date().toISOString();
            this.updateBoneInfoPanel(bone);
        }
    }

    setView(view) {
        const distance = 10;
        
        switch (view) {
            case 'top':
                this.camera.position.set(0, distance, 0);
                break;
            case 'front':
                this.camera.position.set(0, 0, distance);
                break;
            case 'side':
                this.camera.position.set(distance, 0, 0);
                break;
            case 'perspective':
                this.camera.position.set(5, 5, 8);
                break;
        }

        this.controls.target.set(0, 0, 0);
        this.controls.update();

        document.querySelectorAll('#toolbar .btn-small').forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById(`${view}View`).classList.add('active');
    }

    resetView() {
        this.setView('perspective');
        this.skeleton.clearSelection();
        this.updateSelectionVisualization();
        this.updateBoneInfoPanel(null);
        this.selectedBone = null;
        this.selectedMesh = null;
    }

    async importSkeleton(file) {
        try {
            const skeleton = await ImportExport.importSkeleton(file);
            
            // Debug: Log bone info
            console.log('=== Skeleton Imported ===');
            console.log('Name:', skeleton.name);
            console.log('Bone count:', skeleton.bones.length);
            console.log('Root bone:', skeleton.root ? skeleton.root.name : 'None');
            
            // Log first few bones
            skeleton.bones.slice(0, 5).forEach(bone => {
                console.log(`  ${bone.name}: parent=${bone.parent ? bone.parent.name : 'None'}, pos=(${bone.position.x.toFixed(3)}, ${bone.position.y.toFixed(3)}, ${bone.position.z.toFixed(3)})`);
            });
            
            this.skeleton = skeleton;
            this.renderSkeleton();
            this.updateBoneInfoPanel(null);
            alert(`Successfully imported skeleton: ${skeleton.name} (${skeleton.bones.length} bones)`);
        } catch (error) {
            console.error('Import error:', error);
            alert(`Import failed: ${error.message}`);
        }
    }

    // Import PT format skeleton
    async importPTSkeleton(file) {
        try {
            // Show loading state
            const btn = document.getElementById('importPTBtn');
            const originalText = btn.textContent;
            btn.textContent = '⌛ Converting...';
            btn.disabled = true;

            const skeleton = await ImportExport.processPTFile(file);
            
            console.log('=== PT Conversion Success ===');
            console.log('Bone count:', skeleton.bones.length);
            
            this.skeleton = skeleton;
            this.renderSkeleton();
            this.updateBoneInfoPanel(null);
            
            btn.textContent = originalText;
            btn.disabled = false;
            
            alert(`Successfully imported skeleton from PT: ${skeleton.bones.length} bones`);
        } catch (error) {
            console.error('PT Conversion Error:', error);
            alert(`PT Import Failed: ${error.message}`);
            
            const btn = document.getElementById('importPTBtn');
            btn.textContent = '📥 Import PT Skeleton';
            btn.disabled = false;
        }
    }

    async exportSkeleton() {
        if (!this.skeleton) return;
        
        const format = document.getElementById('exportFormat').value;
        await ImportExport.exportSkeleton(this.skeleton, format);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize Editor
document.addEventListener('DOMContentLoaded', () => {
    window.editor = new SkeletonEditor();
});
