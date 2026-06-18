// scene.js — Three.js scene wiring everything together.

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { buildGate } from "./gate.js";
import { buildLogo } from "./logo.js";
import { Dialer, Phase } from "./dialer.js";

export class SGCScene {
  constructor(glCanvas, screen) {
    this.glCanvas = glCanvas;
    this.S = screen;
    this.renderer = new THREE.WebGLRenderer({
      canvas: glCanvas, antialias: true, alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene = new THREE.Scene();
    // Orthographic camera in PIXEL space (top-left origin like the HUD canvas) so the
    // WebGL gate lines up 1:1 with the HUD. Bounds are set in resize().
    this.camera = new THREE.OrthographicCamera(0, 1, 0, 1, -1000, 1000);
    this.camera.position.set(0, 0, 10);

    // lights for the 3D logo
    this.scene.add(new THREE.AmbientLight(0x335577, 0.8));
    const key = new THREE.DirectionalLight(0x9fe8ff, 1.4);
    key.position.set(2, 3, 4); this.scene.add(key);

    this.gateGroup = new THREE.Group();
    this.scene.add(this.gateGroup);

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this.params = {
      palette: "cyan", bloom: 0.9, logoSpin: 0.5, binarySpeed: 1, speed: 1,
      tilt: 0.0,
    };
    this.hooks = {};
    this._setupComposer();
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  _setupComposer() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), this.params.bloom, 0.6, 0.2);
    this.composer.addPass(this.bloom);
  }

  async load(svgUrl) {
    // Gate — geometry has outer radius ≈ 1.0 world unit; we position + scale it in
    // pixel space each frame via the Screen mapper (see _placeGate / resize).
    this.gate = await buildGate(svgUrl, { palette: this.params.palette });
    this.gateGroup.add(this.gate.group);
    this._placeGate();

    // Event horizon (puddle) — hidden until kawoosh.
    this._buildEventHorizon();

    // 3D logo in its own corner (rendered via a second small viewport overlay in the HUD bay).
    this.logo = buildLogo(0x7fd4ff);
    this.logoScene = new THREE.Scene();
    this.logoScene.add(new THREE.AmbientLight(0x223a4a, 0.7));
    const lKey = new THREE.DirectionalLight(0xffffff, 2.0); lKey.position.set(2, 3, 4);
    this.logoScene.add(lKey);
    const lRim = new THREE.DirectionalLight(0x7fd4ff, 1.8); lRim.position.set(-3, -1, 2);
    this.logoScene.add(lRim);
    const lFill = new THREE.PointLight(0xbfefff, 1.2, 0); lFill.position.set(0, 0, 3);
    this.logoScene.add(lFill);
    this.logoScene.add(this.logo);
    this.logoCam = new THREE.PerspectiveCamera(38, 1, 0.1, 10);
    this.logoCam.position.set(0, 0, 2.6);

    // Dialer
    this.dialer = new Dialer(this.gate, {
      onChevronLock: (i, glyph) => this.hooks.onChevronLock?.(i, glyph),
      onPhase: (p) => this.hooks.onPhase?.(p),
      onKawoosh: () => this.hooks.onKawoosh?.(),
      onReset: () => this.hooks.onReset?.(),
    });
    this.dialer.timing && (this.dialer.speed = this.params.speed);

    return this;
  }

  _buildEventHorizon() {
    const geo = new THREE.CircleGeometry(1.0, 64);
    this.ehUniforms = {
      uTime: { value: 0 },
      uProgress: { value: 0 },          // 0 idle → 1 active
      uColor: { value: new THREE.Color(0x6fc8ff) },
      uKawoosh: { value: 0 },           // spike during kawoosh
    };
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: this.ehUniforms,
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }
      `,
      fragmentShader: /* glsl */`
        varying vec2 vUv;
        uniform float uTime, uProgress, uKawoosh;
        uniform vec3 uColor;
        // cheap value noise
        float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        float noise(vec2 p){
          vec2 i=floor(p), f=fract(p);
          float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
          vec2 u=f*f*(3.0-2.0*f);
          return mix(a,b,u.x)+(c-a)*u.y*(1.0-u.x)+(d-b)*u.x*u.y;
        }
        void main(){
          vec2 p = vUv*2.0-1.0;
          float r = length(p);
          if(r>1.0){ discard; }
          float ang = atan(p.y,p.x);
          float ripple = noise(vec2(r*6.0 - uTime*0.8, ang*2.0));
          float ripple2 = noise(vec2(r*12.0 + uTime*1.2, ang*3.0));
          float surf = 0.5 + 0.5*ripple*ripple2;
          // kawoosh: bright bulge from center
          float k = smoothstep(uKawoosh-0.2, uKawoosh, 1.0-r) * (uKawoosh>0.0?1.0:0.0);
          vec3 col = uColor * (0.35 + 0.75*surf);
          col += vec3(0.7,0.9,1.0) * k * 1.6;
          float edge = smoothstep(1.0, 0.85, r);
          float a = uProgress * (0.55 + 0.45*surf) * edge + k;
          gl_FragColor = vec4(col, a);
        }
      `,
    });
    this.eventHorizon = new THREE.Mesh(geo, mat);
    // unit circle; positioned/scaled to the gate's event-horizon radius in _placeGate
    this.eventHorizon.position.z = -0.05;
    this.gateGroup.add(this.eventHorizon);
  }

  // Position + scale the gate (and event horizon) in pixel space using the Screen mapper,
  // so the WebGL gate lines up exactly with the HUD's expected gate region.
  _placeGate() {
    if (!this.gate) return;
    const g = this.S.gate(this._gateCenter || [0.464, 0.4775], this._gateR || 0.218);
    // gate geometry outer radius ≈ 1.0, built Y-up; camera is Y-down (pixel space), so
    // flip Y in scale to render upright while keeping pixel alignment.
    this.gate.group.scale.set(g.R, -g.R, g.R);
    this.gateGroup.position.set(g.cx, g.cy, 0);
    if (this.eventHorizon) this.eventHorizon.scale.set(g.R * 0.66, g.R * 0.66, 1);
  }

  // called by main once layout is known
  setGateTarget(center, rOuter) {
    this._gateCenter = center; this._gateR = rOuter; this._placeGate();
  }

  // --- interaction ---
  setPointer(clientX, clientY) {
    const r = this.glCanvas.getBoundingClientRect();
    // pixel-space ortho camera: NDC maps directly from canvas px (Y-down camera, so no flip)
    this.pointer.x = ((clientX - r.left) / r.width) * 2 - 1;
    this.pointer.y = -((clientY - r.top) / r.height) * 2 + 1;
  }

  // returns glyph index under pointer, or -1
  pickGlyph(clientX, clientY) {
    this.setPointer(clientX, clientY);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const meshes = [];
    for (const g of this.gate.glyphMeshes) g.traverse((o) => { if (o.isMesh) { o.userData._glyph = g; meshes.push(o); } });
    const hits = this.raycaster.intersectObjects(meshes, false);
    if (hits.length) return hits[0].object.userData._glyph.userData.index;
    return -1;
  }

  setPalette(p) {
    this.params.palette = p;
    this.gate.setPalette(p);
    const hex = p === "red" ? 0xff5a44 : 0x7fd4ff;
    this.logo.userData.setColor(hex);
    this.ehUniforms.uColor.value.setHex(p === "red" ? 0xff6a55 : 0x6fc8ff);
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.S.resize(w, h);
    // Orthographic bounds in pixel space, Y-down (top-left origin) to match the HUD canvas.
    this.camera.left = 0; this.camera.right = w;
    this.camera.top = 0; this.camera.bottom = h;
    this.camera.updateProjectionMatrix();
    this._placeGate();
  }

  update(dt) {
    this.dialer.speed = this.params.speed;
    this.dialer.update(dt);
    // glyph lock animations (illuminate-and-flip)
    if (this.gate.updateGlyphAnims) this.gate.updateGlyphAnims(dt, this.gate.palette);
    if (this.gate.updateHeroGlyph) this.gate.updateHeroGlyph(dt);
    // logo spin
    if (this.logo) {
      this.logo.rotation.y += dt * this.params.logoSpin * Math.PI;
      this.logo.rotation.x = Math.sin(this.logo.rotation.y * 0.5) * 0.18; // gentle wobble showing depth
    }
    // event horizon state
    const p = this.dialer.phase;
    const active = p === Phase.ACTIVE;
    const kaw = this.dialer.kawooshProgress();
    this.ehUniforms.uTime.value += dt;
    this.ehUniforms.uProgress.value += ((active || p === Phase.KAWOOSH ? 1 : 0) - this.ehUniforms.uProgress.value) * Math.min(1, dt * 3);
    this.ehUniforms.uKawoosh.value = (p === Phase.KAWOOSH) ? kaw : (active ? 0 : 0);
    this.bloom.strength = this.params.bloom;
  }

  render() {
    this.composer.render();
    // draw the logo in its corner using a scissored viewport
    this._renderLogoCorner();
  }

  // logo bay rect in viewport pixels (left-anchored via Screen)
  _logoBayPx() {
    const S = this.S;
    const ref = (this._logoBayRef || [[0.02, 0.025], [0.132, 0.09]]);
    const r = S.anchored({ ref, anchorX: "left" });
    // inset a little so the emblem sits inside the bay border
    const pad = Math.min(r.w, r.h) * 0.16;
    return { x: r.x + 6 + pad, y: r.y + pad, w: r.w - pad * 2, h: r.h - pad * 2 };
  }

  _renderLogoCorner() {
    if (!this.logo) return;
    const r = this.renderer;
    const H = window.innerHeight, W = window.innerWidth;
    const b = this._logoBayPx();
    // WebGL viewport origin is bottom-left → convert y
    const vx = b.x, vy = H - (b.y + b.h), vw = b.w, vh = b.h;
    if (vw <= 0 || vh <= 0) return;
    // Render to the default framebuffer (composer left its own target bound).
    r.setRenderTarget(null);
    r.autoClear = false;
    r.setScissorTest(true);
    r.setViewport(vx, vy, vw, vh);
    r.setScissor(vx, vy, vw, vh);
    // clear just this region's depth so the emblem draws on top
    r.clearDepth();
    this.logoCam.aspect = vw / vh; this.logoCam.updateProjectionMatrix();
    r.render(this.logoScene, this.logoCam);
    r.setScissorTest(false);
    r.setViewport(0, 0, W, H);
    r.autoClear = true;
  }

  isLogoClick(clientX, clientY) {
    const b = this._logoBayPx();
    return clientX >= b.x - 8 && clientX <= b.x + b.w + 8 &&
           clientY >= b.y - 8 && clientY <= b.y + b.h + 8;
  }

  // result-box glyph paths for the HUD (filled glyph 'd' strings in 100x100 space)
  resultGlyphPaths(glyphsModule) {
    const out = [];
    for (let i = 0; i < this.dialer.lockedCount; i++) {
      const gi = this.dialer.address[i];
      const name = glyphsModule.GLYPH_ORDER[gi];
      out[i] = glyphsModule.GLYPHS[name].paths;
    }
    return out;
  }
}
