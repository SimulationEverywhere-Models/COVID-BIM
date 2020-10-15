let group_of_particles;

class ParticlesExtension extends Autodesk.Viewing.Extension {
    
    constructor(viewer, options) {
        super(viewer, options);
        this._group = null;
        this._button = null;
        // First floor of house
        this.zaxisOffset = -6.5;
        this.pointSize = 50;
    }

    load() {
        this._renderCloud();
        return true;
    }

    _renderCloud(){
        var vShader = `uniform float size;
        varying vec3 vColor;
        void main() {
            vColor = color;
            vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
            gl_PointSize = size * ( size / (length(mvPosition.xyz) + 0.00001) );
            gl_Position = projectionMatrix * mvPosition;
        }`
        // var fShader = `varying vec3 vColor;
        // void main() {
        //     gl_FragColor = vec4( vColor, 1.0 );
        // }`

        var fShader = `varying vec3 vColor;
        uniform sampler2D sprite;
        void main() {
            gl_FragColor = vec4(vColor, 1.0 ) * texture2D( sprite, gl_PointCoord );
            if (gl_FragColor.x < 0.2) discard;
        }`

        var material = new THREE.ShaderMaterial( {
            uniforms: {
                size: { type: 'f', value: 60},
                sprite: { type: 't', value: THREE.ImageUtils.loadTexture("../data/white.png") },
            },
            vertexShader: vShader,
            fragmentShader: fShader,
            transparent: true,
            vertexColors: true,
        });
        var matTwo = new THREE.PointCloudMaterial({
            //map: new THREE.TextureLoader().load( '../data/toppng.com-particles-3000x2000.png' ),
            color: 0xffff00,
            transparent: false,
            opacity: 0.9,
            size: 10,
        })
        
        var group = new THREE.Group()
        let geometryBox = new THREE.BoxGeometry(1,1,1);

        // There should be a human at zero. Not 15
        // Add humans to seperate group later
        for (var i = 0; i < data[15].length; i++){
            var messages = data[15];
            var m = messages[i]
            let geometryBuf = new THREE.BufferGeometry();
            
            let particles;

            // Create human
            if(m.type == -200){
                // create line end points and add to geometry
                const vertices = new Float32Array([
                    1, 1, 1,
                ]);
                geometryBuf.addAttribute('position', new THREE.BufferAttribute(vertices,3));
                // create colors of each end point (vertex) and add to geometry
                const colors = new Float32Array([1.0, 0.0, 0.0]);
                geometryBuf.addAttribute('color', new THREE.BufferAttribute(colors, 3));
                geometryBuf.computeBoundingBox();
                geometryBuf.isPoints = true;
                particles = new THREE.PointCloud(geometryBuf, material)

            }else{
                particles = new THREE.PointCloud(geometryBox, matTwo)
            }
            particles.matrixAutoUpdate = false;
            var particle_matrix = new THREE.Matrix4().makeTranslation(m.x , m.y, this.zaxisOffset);
            
            particles.applyMatrix(particle_matrix);
            particles.matrixAutoUpdate = true;
            // or use object.updateMatrix()

            // Add particles (X.PointCloud)to group
            group.add(particles)
     
        }        
        

        // Add a geometry to each portion of the grid

        // Stop when index is no longer 0, which is time 0

        // Max data are from readData.js
        // let numPoints = max_x * max_y;
        // let positions = new Float32Array(numPoints * 3);
        // let spacing = 5

        // for (var i = 0; i < data[0].length; i++){
        //     var messages = data[0];
        //     var m = messages[i]
        //         // Create Particles 
        //         var particles = new THREE.PointCloud(geometry, matTwo)
        //         // Since we have no use for position, rotation and scale
        //         // turn off matrixAutoUpdate
        //         particles.matrixAutoUpdate = false;

        //         let k = m.x * max_y + m.y;
        //         let u = m.x / max_x - 0.52;
        //         let v = m.y / max_y - 0.52;

        //         positions[3 * k] = u;
        //         positions[3 * k + 1] = v;
        //         positions[3 * k + 2] = this.zaxisOffset;

        //          // in makeTranslation, only the first and last argument will be used for movement
        //         // Left (-ve) / Right (+ve) is first argument
        //         // Down (-ve) / Up (+ve) is last argument
        //         var particle_matrix = new THREE.Matrix4().makeTranslation(m.x , m.y, this.zaxisOffset);
        //         // let rotate = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2)
        //         particles.applyMatrix(particle_matrix);
        //         particles.matrixAutoUpdate = true;

        //         // Add particles (X.PointCloud)to group
        //         group.add(particles)

        //         //this.pointSize = Math.floor(Math.random() * (1 + 70 - 30)) + 30;
            
        // }

        // let up_to_down = -40.5
        // for ( let i = 0; i < 10; i++ ) {
        // let left_to_right = -40.5
        // for ( let j = 0; j < 10; j++ ) {
        //     // Create Particles 
        //     var particles = new THREE.PointCloud(geometry, matTwo)
        //     // Since we have no use for position, rotation and scale
        //     // turn off matrixAutoUpdate
        //     particles.matrixAutoUpdate = false;

        //     // in makeTranslation, only the first and last argument will be used for movement
        //     // Left (-ve) / Right (+ve) is first argument
        //     // Up (-ve) / Down (+ve) is last argument
        //     var particle_matrix = new THREE.Matrix4().makeTranslation(left_to_right, up_to_down, 0.0);
        //     // let rotate = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2)
        //     particles.applyMatrix(particle_matrix);
        //     particles.matrixAutoUpdate = true;

        //     // Add particles (X.PointCloud)to group
        //     group.add(particles)

        //     left_to_right += 1.5
        // }  
        // up_to_down += 1.5
        // }

        // if (!viewer.overlays.hasScene('custom-scene')) {
        //     viewer.overlays.addScene('custom-scene');
        // }
        //this.viewer.overlays.addMesh(group, 'custom-scene');
        this.viewer.impl.createOverlayScene('custom-scene');
        this.viewer.impl.addOverlay('custom-scene', group);
        group_of_particles = group;
        //debugger;

        // Problem:
        //  - Buffer Geom in groups (vertices)
        //  - Map is undefined
    }

    unload() {
        // Clean our UI elements if we added any
        if (this._group) {
            this._group.removeControl(this._button);
            if (this._group.getNumberOfControls() === 0) {
                this.viewer.toolbar.removeControl(this._group);
            }
        }
        console.log('ParticlesExtensions has been unloaded');
        return true;
    }

    _updatePointCloudGeometry(messages){
        // Only update the color based on the state
        var axis = new THREE.Vector3( 1, 1, 0 ).normalize();
        var degrees = Math.PI * 0.01
        for (let index = 0; index < group_of_particles.children.length; index++) {
            // So we can make edits
            group_of_particles.children[index].matrixAutoUpdate = true;

            let maxX = 0.05
            let minX = - 0.05

            let typeOfGeometry = group_of_particles.children[index].geometry.type;
            if(typeOfGeometry == "BoxGeometry"){
                // Rotate particles
                // group_of_particles.children[index].position.x += Math.random() * ((maxX) - (minX)) + (minX);
                group_of_particles.children[index].rotation.x += 0.05
                group_of_particles.children[index].rotation.z -= 0.05
                group_of_particles.children[index].rotateOnAxis(axis, degrees )
                // Change color of particles
                group_of_particles.children[index].material = group_of_particles.children[index].material.clone();
                if(messages[index].state < 3){ group_of_particles.children[index].material.color.setHex( 0xFFFFFF) }
                else if(messages[index].state < 10){ group_of_particles.children[index].material.color.setHex( 0x808080) }
                else{ group_of_particles.children[index].material.color.setHex( 0xFF0000) }
            }else{
                // Change size of particles
                //group_of_particles.children[index].material.uniforms.size.value = Math.random() * ((50) - (40)) + (40);
                
                // Change color of particle
                if(messages[index].state < 10){
                    // Works for yellow [1,1,0], white [1,1,1] and red [1,0,0]
                    group_of_particles.children[index].geometry.attributes.color.array = new Float32Array([1,1,1])
                }
                else {
                    group_of_particles.children[index].geometry.attributes.color.array = new Float32Array([1,0,0])
                }
                group_of_particles.children[index].geometry.attributes.color.needsUpdate = true
            }
            
            //group_of_particles.children[0].geometry.attributes.position.array[0] += 0.5
            //group_of_particles.children[0].geometry.attributes.position.needsUpdate = true
            // or use object.updateMatrix()

          }
        this.viewer.impl.invalidate(true,false,true);
    }

    onToolbarCreated() {
        // Create a new toolbar group if it doesn't exist
        this._group = this.viewer.toolbar.getControl('ParticlesExtensionsToolbar');
        if (!this._group) {
            this._group = new Autodesk.Viewing.UI.ControlGroup('ParticlesExtensionsToolbar');
            this.viewer.toolbar.addControl(this._group);
        }

        // Add a new button to the toolbar group
        this._button = new Autodesk.Viewing.UI.Button('ParticlesExtensionButton');
        this._button.onClick = (ev) => {
            ////////////////////////////
            // Execute an action here //
            ///////////////////////////
            var i = 0;
            var interval = setInterval(() => {
                this._updatePointCloudGeometry(data[i]);
                if (++i == data.length) window.clearInterval(interval);
            }, 0.5);
            
        };
        this._button.setToolTip('My Particles Extension');
        this._button.addClass('ParticlesExtensionIcon');
        this._group.addControl(this._button);
    }
    
}

Autodesk.Viewing.theExtensionManager.registerExtension('ParticlesExtension', ParticlesExtension);
