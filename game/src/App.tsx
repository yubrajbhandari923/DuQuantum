import { useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, N8AO, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { Lab } from './lab/Lab';
import { useGame } from './store';
import { Menu, Manual } from './ui/Menu';
import { Hub } from './ui/Hub';
import { Cutscene } from './ui/Cutscene';
import { LevelFrame } from './ui/LevelFrame';
import { Blueprint, Notebook, Settings } from './ui/Overlays';
import { Ending } from './ui/Ending';
import Sandbox from './levels/Sandbox';
import { Tutor } from './tutor/Tutor';
import './styles/theme.css';
import './styles/ui.css';

/** Once per session: drop to the low preset when WebGL is software-rendered or seconds 2 to 6 average under 28 fps. */
function AutoQuality() {
  const gl = useThree((s) => s.gl);
  const n = useRef({ t: 0, f: 0, done: false });
  useFrame((_, dt) => {
    const s = n.current, g = useGame.getState();
    if (s.done) return;
    if (s.t === 0) {
      const c = gl.getContext(), e = c.getExtension('WEBGL_debug_renderer_info');
      if (/swiftshader|llvmpipe|software/i.test(String(e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : ''))) { s.done = true; if (g.settings.quality === 'high') g.setSettings({ quality: 'low' }); return; }
    }
    s.t += dt; if (s.t > 2 && s.t < 6) s.f++;
    if (s.t >= 6) { s.done = true; if (s.f / 4 < 28 && g.settings.quality === 'high') g.setSettings({ quality: 'low' }); }
  });
  return null;
}

export default function App() {
  const { screen, panel, go, settings } = useGame();
  const low = settings.quality === 'low';
  return (
    <div className="sle">
      <Canvas camera={{ fov: 68, near: 0.1, far: 40 }} dpr={low ? 1 : [1, 1.75]} gl={{ antialias: !low }} shadows={!low}>
        <Lab quality={settings.quality} />
        <AutoQuality />
        {!low && (
          <EffectComposer multisampling={0}>
            <N8AO halfRes aoRadius={0.8} intensity={2.2} distanceFalloff={0.6} />
            <Bloom intensity={0.55} luminanceThreshold={0.95} luminanceSmoothing={0.2} mipmapBlur />
            <Vignette offset={0.28} darkness={0.72} />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          </EffectComposer>
        )}
      </Canvas>
      {screen === 'menu' && <Menu />}
      {screen === 'manual' && <Manual />}
      {screen === 'cutscene' && <Cutscene />}
      {screen === 'hub' && <Hub />}
      {screen === 'level' && <LevelFrame />}
      {screen === 'ending' && <Ending />}
      {screen === 'sandbox' && <Sandbox />}
      {panel === 'select' && <Blueprint />}
      {panel === 'notebook' && <Notebook />}
      {panel === 'settings' && <Settings />}
      <Tutor />
    </div>
  );
}
