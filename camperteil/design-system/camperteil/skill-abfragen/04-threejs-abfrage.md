## UI Pro Max Stack Guidelines
**Stack:** threejs | **Query:** material lighting performance orbit
**Source:** stacks/threejs.csv | **Found:** 4 results

### Result 1
- **Category:** Setup
- **Guideline:** Custom Drag Orbit Fallback
- **Description:** When OrbitControls cannot be loaded implement spherical orbit using mousedown/mousemove/mouseup. The key is rotating in spherical coordinates so both horizontal AND vertical drag work correctly.
- **Do:** Rotate camera in spherical coordinates so both axes respond correctly to drag
- **Don't:** Move camera.position.x directly — vertical drag is silently ignored and the orbit is incorrect
- **Code Good:** let dragging = false; let prev = { x: 0, y: 0 }; const radius = camera.position.length(); let theta = 0; let phi = Math.PI / 2; canvas.addEventListener('mousedown', () => dragging = true); canvas.addEventListener('mouseup', () => dragging = false); canvas.addEventListener('mousemove', e => { if (!dragging) return; theta -= (e.clientX - prev.x) * 0.005; phi = Math.max(0.1, Math.min(Math.PI - 0.1, phi - (e.clientY - prev.y) * 0.005)); camera.position.set(radius * Math.sin(phi) * Math.sin(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.cos(theta)); camera.lookAt(scene.position); prev = { x: e.clientX, y: e.clientY }; });
- **Code Bad:** let dragging = false; let prev = { x: 0, y: 0 }; canvas.addEventListener('mousemove', e => { if (!dragging) return; camera.position.x += (e.clientX - prev.x) * 0.005; camera.lookAt(scene.position); prev = { x: e.clientX, y: e.clientY }; }); // BUG: Y-drag ignored; orbit is a horizontal slide not a sphere
- **Severity:** High
- **Docs URL:** https://threejs.org/docs/#examples/en/controls/OrbitControls
- **Applies To:** threejs 0.185.1
- **Status:** active
- **Verified At:** 2026-08-13

### Result 2
- **Category:** Performance
- **Guideline:** Tone Mapping and Output Color Space
- **Description:** Three.js color management is enabled by default. Keep working colors in the linear-sRGB space and set the renderer output color space to SRGBColorSpace; choose tone mapping when rendering HDR lighting to a display.
- **Do:** Use the default ColorManagement.enabled state and set renderer.outputColorSpace plus an appropriate toneMapping
- **Don't:** Disable color management or use removed outputEncoding and sRGBEncoding properties
- **Code Good:** THREE.ColorManagement.enabled = true; renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
- **Code Bad:** renderer.outputEncoding = THREE.sRGBEncoding; // removed legacy properties
- **Severity:** Medium
- **Docs URL:** https://threejs.org/manual/en/color-management.html
- **Applies To:** threejs 0.185.1
- **Status:** active
- **Verified At:** 2026-08-13

### Result 3
- **Category:** Performance
- **Guideline:** InstancedMesh for Repeated Objects
- **Description:** Use THREE.InstancedMesh when rendering 50 or more identical objects. It submits all N transforms in one draw call instead of N draw calls and reduces CPU-GPU communication overhead dramatically.
- **Do:** Use InstancedMesh for any group of 50+ meshes sharing the same geometry and material
- **Don't:** Create 50+ separate Mesh objects with the same geometry and material
- **Code Good:** const COUNT = 500; const iMesh = new THREE.InstancedMesh(geo, mat, COUNT); const matrix = new THREE.Matrix4(); for (let i = 0; i < COUNT; i++) { matrix.setPosition(Math.random()*10, Math.random()*10, Math.random()*10); iMesh.setMatrixAt(i, matrix); } iMesh.instanceMatrix.needsUpdate = true; scene.add(iMesh);
- **Code Bad:** for (let i = 0; i < 500; i++) { scene.add(new THREE.Mesh(geo, mat)); } // 500 separate draw calls per frame
- **Severity:** High
- **Docs URL:** https://threejs.org/docs/#api/en/objects/InstancedMesh
- **Applies To:** threejs 0.185.1
- **Status:** active
- **Verified At:** 2026-08-13

### Result 4
- **Category:** Lighting
- **Guideline:** Skip Lights for MeshBasicMaterial
- **Description:** MeshBasicMaterial completely ignores all scene lights. Adding lights solely to illuminate BasicMaterial objects wastes a light pass on every frame with zero visible effect.
- **Do:** Omit lights entirely when every material in the scene is MeshBasicMaterial
- **Don't:** Add AmbientLight and DirectionalLight to a scene that uses only MeshBasicMaterial
- **Code Good:** // Scene uses only MeshBasicMaterial — no lights needed const mat = new THREE.MeshBasicMaterial({ color: 0x00ffff }); const mesh = new THREE.Mesh(geo, mat); scene.add(mesh); // MeshBasicMaterial is always fully lit by definition
- **Code Bad:** scene.add(new THREE.AmbientLight(0xffffff, 1.0)); // wasted per-frame light pass — BasicMaterial ignores it entirely
- **Severity:** Low
- **Docs URL:** https://threejs.org/docs/#api/en/materials/MeshBasicMaterial
- **Applies To:** threejs 0.185.1
- **Status:** active
- **Verified At:** 2026-08-13

