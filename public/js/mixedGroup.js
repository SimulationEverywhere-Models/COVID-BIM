// Author(s): Omar Kawach, Mitali Patel

/* Purpose: 
    - Display the correct geoemetries in the correct coordinates
    - Have geometries change colors and opacity based on certain factors
    - Have geoemtries animated when needed
*/

/* Useful links:
    - THREE.Group() https://threejs.org/docs/index.html#api/en/objects/Group
    - THREE.ShaderMaterial https://threejs.org/docs/#api/en/materials/ShaderMaterial
    - THREE.PointCloud() https://threejs.org/docs/#api/en/objects/Points 
        - We're using an outdated version. The new one is THREE.Points()
    - THREE.Matrix4() https://threejs.org/docs/index.html#api/en/math/Matrix4
*/

/* Cell types:
    - AIR = -100
    - vp_SOURCE = -200
    - IMPERMEABLE_STRUCTURE = -300
    - DOOR = -400
    - TABLE = -500
    - VENTILATION = -600
    - CHAIR = -700
    - vp_RECEIVER = -800
*/

// Will hold a group of various geometries
let group;

class MixedGroupExtension extends Autodesk.Viewing.Extension {
  constructor(viewer, options) {
    super(viewer, options);
    this._group = null;
    this._button = null;

    // For toolbar 
    this.showGroup = false;
    this.resetAll = false;
    this.swapLegend = false;

    // Restuarant Model offsets
    // Negative values move down (depending on perspective)
    this.xaxisOffset = -13.5;
    // Negative values move to the right (depending on perspective)
    this.yaxisOffset = -28.5;
    // For human height
    this.zaxisOffset = -1;
    // For virus height
    this.zaxisOffsetVirus = -2.5;

    // House Model offsets
    // Move right (+ve) to left (-ve) when North facing
    // this.xaxisOffset = 0;
    // this.yaxisOffset = 0;
    // this.zaxisOffset = 0;
    // // Move up (+ve) and move up (-ve)
    // this.zaxisOffsetVirus = -7;
  }

  load() {
    this._renderCloud(0); // Show the geometries in Forge Viewer
    return true;
  }

  _createShaders() {
    // Is there any way to stop the sprites from changing sizes when zooming in?
    this.vShader = `uniform float size;
        varying vec3 vColor;
        void main() {
            vColor = color;
            vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
            gl_PointSize = size * ( size / (length(mvPosition.xyz) + 0.00001) );
            gl_Position = projectionMatrix * mvPosition;
        }`;
    //The coloring problem is probably here
    // https://threejs.org/examples/?q=att#webgl_custom_attributes_points3
    // http://bl.ocks.org/duhaime/822f81a578b47d6fd0be523e6f7efc78
    // vec4(1.0, 0.0, 0.0, 1.0) to color sprites red
    this.fShader = ` varying vec3 vColor;
        uniform sampler2D sprite;
        void main() {
            gl_FragColor = vec4(vColor, 1.0) * texture2D( sprite, gl_PointCoord );
            if (gl_FragColor.x < 0.2) discard;
        }`;
  }

  _createMaterials() {
    // Material that is supposed to accept textures
    var virusPointMaterial = new THREE.PointCloudMaterial({
      color: 0xff0000,
      size: 6,
      // TEXTURE STILL DOESN'T APPEAR
      //map: ""
    });
    // new THREE.TextureLoader().load( '../img/epidemics.png', function onLoad(tex) {
    //     virusPointMaterial.map = tex;
    //   });
    this.virusPointMaterial = virusPointMaterial;

    // Material rendered with custom shaders and sprites
    this.humanMaterial = new THREE.ShaderMaterial({
      uniforms: {
        size: { type: "f", value: 70 },
        sprite: { type: "t", value: THREE.ImageUtils.loadTexture("../img/sil_10-01.png"),
        },
      },
      vertexShader: this.vShader,
      fragmentShader: this.fShader,
      transparent: true,
      vertexColors: true,
    });

    // Human sprite colors

    // White is unimpacted
    this.whiteBufferColor = new THREE.Color();
    this.whiteBufferColor.setHSL(1.0, 1.0, 1.0);

    // Red is infectious
    this.redBufferColor = new THREE.Color();
    this.redBufferColor.setHSL(0, 1.0, 0.5);

    // Almost red is infected
    this.almostRedBufferColor = new THREE.Color();
    this.almostRedBufferColor.setHSL(0.0, 0.7, 0.4);

    // Orange nearing infection
    this.orangeBufferColor = new THREE.Color();
    this.orangeBufferColor.setHSL(0.1, 1.0, 0.4);

    // Virus particle colors

    // Define the color range for the viral particles
    this.colorScale = d3
      .scaleLinear()
      // Based on min state and max state
      .domain([
        0,
        max_particles * 0.2,
        max_particles * 0.4,
        max_particles * 0.6,
        max_particles * 0.8,
        max_particles,
      ])
      .range([
        "#FFFFFF",
        "#F6BDC0",
        "#F1959B",
        "#F07470",
        "#EA4C46",
        "#DC1C13",
      ]);
  }

  _renderCloud(time) {
    // The visual essentials
    this._createShaders();
    this._createMaterials();

    // Create group and add to overlay (invisible or visible)
    group = this._generateGroupOfPointClouds(time);
    group.visible = this.showGroup === true ? true : false;

    this.viewer.impl.createOverlayScene("custom-scene");
    this.viewer.impl.addOverlay("custom-scene", group);
  }

  _bufferGeometryToPointCloud(m, material) {
    var geometry = new THREE.BufferGeometry();

    // Create end points and add to geometry
    geometry.addAttribute("position", new THREE.BufferAttribute(new Float32Array([1, 1, 1]), 3));

    // Create colors of each end point (vertex) and add to geometry
    var colors = new Float32Array(3);

    // red (infected and source of infection)
    if (m.type == -200) {
      colors[0] = this.redBufferColor.r;
        colors[1] = this.redBufferColor.g;
            colors[2] = this.redBufferColor.b;
    }
    if (m.type == -800) {
      // white (uninfected)
      if (m.inhaled < max_inhaled / 3) {
        colors[0] = this.whiteBufferColor.r;
            colors[1] = this.whiteBufferColor.g;
                colors[2] = this.whiteBufferColor.b;
      }
      // orange (almost infected)
      else if (m.inhaled < max_inhaled / 2) {
        colors[0] = this.orangeBufferColor.r;
            colors[1] = this.orangeBufferColor.g;
                colors[2] = this.orangeBufferColor.b;
      }
      // almost red (infected)
      else {
        colors[0] = this.almostRedBufferColor.r;
            colors[1] = this.almostRedBufferColor.g;
                colors[2] = this.almostRedBufferColor.b;
      }
    }

    geometry.addAttribute("color", new THREE.BufferAttribute(colors, 3));

    geometry.computeBoundingBox();

    geometry.isPoints = true; // gl.POINTS, needed for Forge Viewer

    return this._createPointCloud(geometry, material, this.zaxisOffset, m);
  }

  _createPointCloud(geometry, material, offset, m) {
    var pointCloud = new THREE.PointCloud(geometry, material);

    // Move to correct coordinate
    // x - the amount to translate in the X axis.
    // y - the amount to translate in the Y axis.
    // z - the amount to translate in the Z axis
    pointCloud.applyMatrix(
      new THREE.Matrix4().makeTranslation(
        m.x + this.xaxisOffset,
        m.y + this.yaxisOffset,
        offset
      )
    );

    return pointCloud;
  }

  _geometryToPointCloud(m, material) {
    var geometry = new THREE.Geometry(1, 1, 1);

    var vertex = new THREE.Vector3(0, 0, 0);

    geometry.vertices.push(vertex);

    var pointCloud = this._createPointCloud(geometry, material, this.zaxisOffsetVirus, m);

    pointCloud.material = pointCloud.material.clone(); // Must use for changing colors

    pointCloud.material.color = this._getColor(m.state); // Assign color to point cloud

    return pointCloud;
  }

  _getColor(state) {
    var stringColor = this.colorScale(state); // Convert rgb string from d3
    return new THREE.Color(stringColor);
  }

  _generateGroupOfPointClouds(time) {
    var groupOfPointClouds = new THREE.Group(); // Group to hold various geometries

    for (var i = 0; i < data[time].length; i++) {
      var messages = data[time], m = messages[i];  

      // See if human or sprite
      var pointCloud =
        m.type === -200 || m.type === -800
          ? this._bufferGeometryToPointCloud(m, this.humanMaterial)
          : this._geometryToPointCloud(m, this.virusPointMaterial);

      groupOfPointClouds.add(pointCloud);
    }
    return groupOfPointClouds;
  }

  unload() {
    // Clean our UI elements if we added any
    if (this._group) {
      this._group.removeControl(this._button);
      if (this._group.getNumberOfControls() === 0) {
        this.viewer.toolbar.removeControl(this._group);
      }
    }
    console.log("MixedGroupExtension has been unloaded");
    return true;
  }

  _updatePointCloudGeometry(messages) {
    if (this.resetAll) return; // When reset button is clicked, exit function

    for (var index = 0; index < group.children.length; index++) {
      var pointCloud = group.children[index], m = messages[index];

      // Check if type changed to human (therefore remove particles and add human)
      if ((m.type == -200 || m.type == -800) && m.prev_type != m.type) {
        group.children[index] = this._bufferGeometryToPointCloud(m, this.humanMaterial);
      }

      // Check if type changed to particles (therefore remove human and add particles)
      else if ((m.prev_type == -200 || m.prev_type == -800) && m.type != m.prev_type) {
        pointCloud = this._geometryToPointCloud(m, this.virusPointMaterial);

        // Change visibility
        pointCloud.material.visible = m.state == 0 ? false : true;

        group.children[index] = pointCloud;
      }
      // Edit human characteristics
      else if (m.type != -200 && m.inhaled != m.prev_inhaled && pointCloud.geometry.type == "BufferGeometry") {

        var colors = new Float32Array(3);

        // white
        if (m.inhaled < max_inhaled / 3) {
          colors[0] = this.whiteBufferColor.r;
            colors[1] = this.whiteBufferColor.g;
                colors[2] = this.whiteBufferColor.b;
        }
        // Almost Infected
        else if (m.inhaled < max_inhaled / 2) {
          colors[0] = this.orangeBufferColor.r;
            colors[1] = this.orangeBufferColor.g;
                colors[2] = this.orangeBufferColor.b;
        }
        // Infected
        else {
          colors[0] = this.almostRedBufferColor.r;
            colors[1] = this.almostRedBufferColor.g;
                colors[2] = this.almostRedBufferColor.b;
        }

        group.children[index].geometry.attributes.color.array = colors;
        group.children[index].geometry.attributes.color.needsUpdate = true;
      }
      // Edit virus particle characteristics (animation and color)
      else if (pointCloud.geometry.type == "Geometry") {
        group.children[index].position.x =
          Math.random() *
            (0.2 + m.x + this.xaxisOffset - (m.x + this.xaxisOffset - 0.2)) +
                (m.x + this.xaxisOffset - 0.2);

        group.children[index].position.y =
          Math.random() *
            (0.2 + m.y + this.yaxisOffset - (m.y + this.yaxisOffset - 0.2)) +
                (m.y + this.yaxisOffset - 0.2);

        group.children[index].position.z =
          Math.random() * (this.zaxisOffsetVirus - 2) + 2;

        // Change visibility
        pointCloud.material.visible = m.state == 0 ? false : true;

        // Change color of particles
        group.children[index].material.color = this._getColor(m.state);
      }
    }

    // Show the changes
    this.viewer.impl.invalidate(true, false, true);
  }

  onToolbarCreated() {
    var i;

    // Create a new toolbar group if it doesn't exist
    this._group = this.viewer.toolbar.getControl("MixedGroupExtensionToolbar");
    if (!this._group) {
      this._group = new Autodesk.Viewing.UI.ControlGroup("MixedGroupExtensionToolbar");
      this.viewer.toolbar.addControl(this._group);
    }

    // Reset back to timestep one and remove all visuals
    this._button = new Autodesk.Viewing.UI.Button("Reset");
    this._button.onClick = (ev) => {

      this.resetAll = true;
      
      // Hide all pointclouds
      group.visible = false;
      this.showGroup = false;

      this._removeLegend();
      window.legendOFF = true;

      i = data.length - 1; // So we can shut off "Run Simulation"

      this._renderCloud(0);
    };
    this._button.setToolTip("Reset All");
    this._button.addClass("resetIcon");
    this._group.addControl(this._button);

    // Add the button for 'PointClouds ON/OFF'
    this._button = new Autodesk.Viewing.UI.Button("PointClouds ON/OFF");
    this._button.onClick = (ev) => {
      if (this.showGroup) {
        group.visible = false;
        this.showGroup = false;
      } else {
        group.visible = true;
        this.showGroup = true;
      }

      this.resetAll = false;
    };
    this._button.setToolTip("PointClouds ON/OFF");
    this._button.addClass("pointCloudIcon");
    this._group.addControl(this._button);

    // Add button for legend ON/OFF
    this._button = new Autodesk.Viewing.UI.Button("Legend ON/OFF");
    this._button.onClick = (ev) => {
    
      if (window.legendOFF) {
        window.legendOFF = false;
        if (!this.swapLegend) {
          this._appearLegend();
          this.swapLegend = true;
        } else {
          this._appearLegendTwo();
          this.swapLegend = false;
        }
      } else {
        this._removeLegend();
        window.legendOFF = true;
      }

      this.resetAll = false;
    };
    this._button.setToolTip("Legend ON/OFF");
    this._button.addClass("legendIcon");
    this._group.addControl(this._button);

    // Add a restart button to go back to original point clouds?

    // Add the button for (re)start simulation
    this._button = new Autodesk.Viewing.UI.Button("Run Simulation");
    this._button.onClick = (ev) => {

      if (window.legendOFF) {
        window.legendOFF = false;
        if (!this.swapLegend) {
          this._appearLegend();
          this.swapLegend = true;
        } else {
          this._appearLegendTwo();
          this.swapLegend = false;
        }
      }

      if (!this.showGroup) {
        group.visible = true;
      }

      // Maybe set i to be data.length when we click reset all
      // Last time step is problematic so we do -1 
      i = 0;
      var interval = setInterval(() => {
        if (this.resetAll) window.clearInterval(interval);
        this._updatePointCloudGeometry(data[i]);

        // -1 since the data at the end sometimes gets cut off
        if (++i == data.length - 1) window.clearInterval(interval);
      }, 0.5);

      this.resetAll = false;
    };
    this._button.setToolTip("Run Simulation");
    this._button.addClass("playIcon");
    this._group.addControl(this._button);
  }

  _removeLegend() {
    var svg = d3.select("#legend");
    svg.selectAll("*").remove();
  }

  _appearLegend() {
    // append a defs (for definition) element to your SVG
    var svgLegend = d3.select("#legend").append("svg");
    var defs = svgLegend.append("defs");

    // append a linearGradient element to the defs and give it a unique id
    var linearGradient = defs
      .append("linearGradient")
      .attr("id", "linear-gradient");

    // horizontal gradient
    linearGradient
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "0%");

    // append multiple color stops by using D3's data/enter step
    linearGradient
      .selectAll("stop")
      .data([
        { offset: "0%", color: "#FFFFFF" },
        { offset: "20%", color: "#F6BDC0" },
        { offset: "40%", color: "#F1959B" },
        { offset: "60%", color: "#F07470" },
        { offset: "80%", color: "#EA4C46" },
        { offset: "100%", color: "#DC1C13" },
      ])
      .enter()
      .append("stop")
      .attr("offset", function (d) {
        return d.offset;
      })
      .attr("stop-color", function (d) {
        return d.color;
      });

    // append title
    svgLegend
      .append("text")
      .attr("class", "legendTitle")
      .attr("x", 0)
      .attr("y", 20)
      .style("text-anchor", "mid")
      .text("Virus Particle Count");

    // draw the rectangle and fill with gradient
    svgLegend
      .append("rect")
      .attr("x", 0)
      .attr("y", 30)
      .attr("width", 200)
      .attr("height", 15)
      .style("fill", "url(#linear-gradient)");

    //create tick marks
    var xLeg = d3.scale.ordinal().domain([max_particles]).range([190]);

    var axisLeg = d3.axisBottom(xLeg);

    svgLegend
      .attr("class", "axis")
      .append("g")
      .attr("transform", "translate(10, 40)")
      .call(axisLeg);
  }

  _appearLegendTwo() {
    // append a defs (for definition) element to your SVG
    var svgLegend = d3.select("#legend").append("svg");

    // Use a function instead later
    // https://www.d3-graph-gallery.com/graph/custom_legend.html

    // Handmade legend
    //Title
    svgLegend
      .append("text")
      .attr("x", 0)
      .attr("y", 10)
      .text("Condition")
      .style("font-size", "15px")
      .attr("alignment-baseline", "middle");
    // Items
    svgLegend
      .append("circle")
      .attr("cx", 6)
      .attr("cy", 28)
      .attr("r", 6)
      .style("fill", "#FFFFFF");
    svgLegend
      .append("circle")
      .attr("cx", 6)
      .attr("cy", 48)
      .attr("r", 6)
      .style("fill", "#CC7A00");
    svgLegend
      .append("circle")
      .attr("cx", 6)
      .attr("cy", 68)
      .attr("r", 6)
      .style("fill", "#A61E1E");
    svgLegend
      .append("circle")
      .attr("cx", 6)
      .attr("cy", 88)
      .attr("r", 6)
      .style("fill", "#FF0000");
    svgLegend
      .append("text")
      .attr("x", 20)
      .attr("y", 30)
      .text("Uninfected")
      .style("font-size", "15px")
      .attr("alignment-baseline", "middle");
    svgLegend
      .append("text")
      .attr("x", 20)
      .attr("y", 50)
      .text("Almost Infected")
      .style("font-size", "15px")
      .attr("alignment-baseline", "middle");
    svgLegend
      .append("text")
      .attr("x", 20)
      .attr("y", 70)
      .text("Infected")
      .style("font-size", "15px")
      .attr("alignment-baseline", "middle");
    svgLegend
      .append("text")
      .attr("x", 20)
      .attr("y", 90)
      .text("Carrier")
      .style("font-size", "15px")
      .attr("alignment-baseline", "middle");
  }
}

Autodesk.Viewing.theExtensionManager.registerExtension(
  "MixedGroupExtension",
  MixedGroupExtension
);
