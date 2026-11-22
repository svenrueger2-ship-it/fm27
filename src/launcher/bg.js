// Launcher background: a night stadium under floodlights, rendered as a single fragment shader.
// Sweeping volumetric beams, dust in the light, crowd with camera flashes, mown pitch in perspective,
// lens bokeh in the club colour and a "kick-off" transition (uLaunch 0 → 1).
const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
const FRAG = `
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse; uniform vec3 uAcc; uniform vec3 uAcc2; uniform float uLaunch;
float h11(float n){ return fract(sin(n*127.1)*43758.5453); }
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=0.5; } return v; }
// beam from light source s pointing along d; returns intensity at point q
float beam(vec2 q, vec2 s, vec2 d, float spread){
  vec2 v = q - s; float l = length(v); if (l < 0.001) return 0.0;
  float c = dot(v/l, d); float a = smoothstep(1.0 - spread, 1.0, c);
  return a * exp(-l*0.9) * smoothstep(0.0, 0.08, l);
}
void main(){
  vec2 fc = gl_FragCoord.xy;
  vec2 p = (fc - 0.5*uRes) / uRes.y;
  float L = uLaunch;
  p *= 1.0 - 0.35*L*L;                               // camera pushes in on kick-off
  p += uMouse * 0.025 * (1.0 - L);                   // parallax
  float t = uTime;
  float hz = -0.10 + 0.006*sin(t*0.3);               // horizon
  vec3 col = vec3(0.0);
  // sky
  col = mix(vec3(0.010, 0.010, 0.030), vec3(0.030, 0.025, 0.070), smoothstep(0.6, hz, p.y));
  col += uAcc * 0.10 * exp(-abs(p.y - hz - 0.15) * 5.0);
  col += uAcc2 * 0.04 * fbm(p*2.0 + vec2(t*0.02, 0.0)) * smoothstep(hz, 0.6, p.y);
  // stands: a tiered silhouette with a crowd of tiny lights
  float top = hz + 0.20 + 0.015*sin(p.x*6.0) + 0.02*smoothstep(0.55, 0.9, abs(p.x));
  if (p.y > hz && p.y < top) {
    float tier = fract((p.y - hz) / (top - hz) * 6.0);
    vec3 st = vec3(0.025, 0.022, 0.045) * (0.7 + 0.3*tier);
    vec2 g = vec2(p.x * 260.0, (p.y - hz) * 260.0); vec2 gi = floor(g);
    float r = h21(gi);
    float dotm = smoothstep(0.35, 0.0, length(fract(g) - 0.5));
    st += mix(uAcc, uAcc2, step(0.5, h21(gi+7.0))) * 0.35 * dotm * step(0.55, r) * (0.4 + 0.6*noise(vec2(gi.x*0.1, t*0.8)));
    float flash = step(0.9993, h21(gi + floor(t*6.0))) * dotm;   // camera flashes
    st += vec3(1.0) * flash * 3.0;
    col = st;
    col += uAcc * 0.05;
  }
  // roof edge glow
  col += vec3(0.6, 0.7, 1.0) * 0.12 * exp(-abs(p.y - top) * 120.0) * step(hz, p.y);
  // pitch in perspective
  if (p.y < hz) {
    float dz = hz - p.y;
    float z = 0.32 / dz;                         // depth
    float x = p.x * z;
    float stripe = step(0.5, fract(z * 0.9 + 0.25));
    vec3 grass = mix(vec3(0.03, 0.11, 0.05), vec3(0.045, 0.15, 0.065), stripe);
    grass *= 0.75 + 0.5*fbm(vec2(x*3.0, z*3.0));
    float lw = 0.012 * z;
    float lines = 0.0;
    lines += smoothstep(lw, 0.0, abs(abs(x) - 2.4));                        // touchlines
    lines += smoothstep(lw, 0.0, abs(z - 3.2)) * step(abs(x), 2.4);          // halfway
    float cc = length(vec2(x, (z - 3.2) * 1.0));
    lines += smoothstep(lw, 0.0, abs(cc - 0.75));                           // centre circle
    lines += smoothstep(lw*2.0, 0.0, cc) ;                                  // spot
    grass += vec3(0.75) * clamp(lines, 0.0, 1.0) * smoothstep(9.0, 2.0, z);
    // pools of floodlight on the turf
    float pool = exp(-pow(x - 1.4*sin(t*0.13), 2.0)*0.5) * exp(-pow(z-3.0,2.0)*0.15);
    pool += exp(-pow(x + 1.5*cos(t*0.11), 2.0)*0.5) * exp(-pow(z-4.0,2.0)*0.15);
    grass *= 0.55 + 0.9*pool;
    grass = mix(grass, vec3(0.06, 0.06, 0.12) + uAcc*0.05, smoothstep(5.0, 14.0, z)); // haze far away
    col = grass * smoothstep(0.0, 0.02, dz);
  }
  // floodlight towers + beams
  vec3 bcol = vec3(0.85, 0.9, 1.0);
  float beams = 0.0, lamps = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float sx = (fi < 2.0 ? -1.0 : 1.0) * (fi == 0.0 || fi == 3.0 ? 0.98 : 0.52);
    vec2 s = vec2(sx, hz + 0.43 + 0.04*(fi == 0.0 || fi == 3.0 ? 1.0 : 0.0));
    float sw = sin(t * (0.21 + fi*0.03) + fi*1.7) * 0.22;
    vec2 d = normalize(vec2(-sx*0.55 + sw, -0.9));
    float dust = 0.6 + 0.8*fbm(p*7.0 + vec2(t*0.15, -t*0.35) + fi);
    beams += beam(p, s, d, 0.035) * dust;
    // lamp panel: small grid of bright points with bloom
    vec2 q = p - s;
    float panel = smoothstep(0.045, 0.0, abs(q.x)) * smoothstep(0.018, 0.0, abs(q.y));
    lamps += panel * 1.6 + 0.0025 / (dot(q, q) + 0.0004);
    // mast
    float mast = smoothstep(0.004, 0.0, abs(p.x - sx)) * step(hz, p.y) * step(p.y, s.y);
    col = mix(col, vec3(0.05, 0.05, 0.08), mast * 0.9);
  }
  col += bcol * beams * (0.95 + 0.6*L);
  col += bcol * lamps * 0.5;
  // bokeh in club colours
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    vec2 c = vec2(h11(fi)*1.8 - 0.9, h11(fi+3.1)*0.9 - 0.2);
    c += 0.05*vec2(sin(t*0.1 + fi), cos(t*0.13 + fi*2.0));
    float r = 0.04 + 0.07*h11(fi+9.0);
    float b = smoothstep(r, r*0.85, length(p - c)) * (0.5 + 0.5*smoothstep(r*0.5, r, length(p-c)));
    col += mix(uAcc, uAcc2, h11(fi+5.0)) * b * 0.06;
  }
  // kick-off flash
  col += vec3(1.0) * pow(L, 6.0) * 1.2;
  col *= 1.35 + 0.6*L;
  // vignette, grade, grain
  vec2 uv = fc / uRes;
  col *= 0.35 + 0.65 * pow(16.0*uv.x*uv.y*(1.0-uv.x)*(1.0-uv.y), 0.22);
  col = col / (1.0 + col * 0.65);
  col = pow(col, vec3(0.92));
  col += (h21(fc + fract(t)*100.0) - 0.5) * 0.025;
  gl_FragColor = vec4(col, 1.0);
}`;

const hex = (h) => { const n = parseInt(h.replace('#', ''), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };

export function startBackground(canvas, { acc = '#9d6bff', acc2 = '#3aa0ff' } = {}) {
  const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
  const state = { launch: 0, launchTarget: 0, mouse: [0, 0], m: [0, 0], acc: hex(acc), acc2: hex(acc2), paused: false, scale: 1 };
  if (!gl) { canvas.classList.add('no-gl'); return { setColors() {}, kick() {}, setPaused() {}, dispose() {} }; }
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s)); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(prog); gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = (n) => gl.getUniformLocation(prog, n);
  const u = { res: U('uRes'), time: U('uTime'), mouse: U('uMouse'), acc: U('uAcc'), acc2: U('uAcc2'), launch: U('uLaunch') };
  const fit = () => { const dpr = Math.min(window.devicePixelRatio || 1, 1.5) * state.scale; canvas.width = Math.round(canvas.clientWidth * dpr); canvas.height = Math.round(canvas.clientHeight * dpr); gl.viewport(0, 0, canvas.width, canvas.height); };
  fit(); addEventListener('resize', fit);
  const onMove = (e) => { state.mouse = [e.clientX / innerWidth - 0.5, -(e.clientY / innerHeight - 0.5)]; };
  addEventListener('pointermove', onMove);
  // adaptive quality: drop resolution if frames are slow
  let raf, t0 = performance.now(), last = t0, slow = 0;
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const dt = now - last; last = now;
    if (dt > 34 && state.scale > 0.55) { if (++slow > 20) { state.scale -= 0.15; slow = 0; fit(); } } else slow = Math.max(0, slow - 1);
    if (state.paused && state.launchTarget === 0) return;
    state.m[0] += (state.mouse[0] - state.m[0]) * 0.05; state.m[1] += (state.mouse[1] - state.m[1]) * 0.05;
    state.launch += (state.launchTarget - state.launch) * (state.launchTarget ? 0.045 : 0.2);
    gl.uniform2f(u.res, canvas.width, canvas.height); gl.uniform1f(u.time, (now - t0) / 1000);
    gl.uniform2f(u.mouse, state.m[0], state.m[1]); gl.uniform3fv(u.acc, state.acc); gl.uniform3fv(u.acc2, state.acc2); gl.uniform1f(u.launch, state.launch);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  raf = requestAnimationFrame(frame);
  return {
    setColors(a, b) { state.acc = hex(a); state.acc2 = hex(b); },
    kick() { state.launchTarget = 1; },
    reset() { state.launchTarget = 0; },
    setPaused(v) { state.paused = v; },
    dispose() { cancelAnimationFrame(raf); removeEventListener('resize', fit); removeEventListener('pointermove', onMove); },
  };
}
