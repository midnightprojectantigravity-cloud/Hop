import React from 'react';
import {
  UI_THEME_OPTIONS,
  type UiColorMode,
  type UiHudDensity,
  type UiMotionMode,
  type UiPreferencesV1,
} from './ui-preferences';

type TextureBlendMode = 'normal' | 'multiply' | 'overlay' | 'soft-light' | 'screen';

type ProceduralTextureControls = {
  baseFrequency: number;
  numOctaves: number;
  seed: number;
  red: number;
  green: number;
  blue: number;
  lightingColor: string;
  surfaceScale: number;
  diffuseConstant: number;
  azimuth: number;
  elevation: number;
  k1: number;
  k2: number;
  k3: number;
  k4: number;
  overlayOpacity: number;
  overlayBlend: TextureBlendMode;
  textureScalePx: number;
  textureRepeat: boolean;
  vignetteStrength: number;
};

type PaletteControls = {
  surfaceApp: string;
  surfaceBoard: string;
  surfacePanel: string;
  surfacePanelMuted: string;
  textPrimary: string;
  textMuted: string;
  borderSubtle: string;
  accentRoyal: string;
  accentDanger: string;
};

interface ThemeManagerScreenProps {
  uiPreferences: UiPreferencesV1;
  onSetColorMode: (mode: UiColorMode) => void;
  onSetMotionMode: (mode: UiMotionMode) => void;
  onSetHudDensity: (density: UiHudDensity) => void;
  onBack: () => void;
}

const DEFAULT_TEXTURE_CONTROLS: ProceduralTextureControls = {
  baseFrequency: 0.038,
  numOctaves: 5,
  seed: 21,
  red: 0.94,
  green: 0.88,
  blue: 0.75,
  lightingColor: '#fff8ea',
  surfaceScale: 1.65,
  diffuseConstant: 0.58,
  azimuth: 42,
  elevation: 58,
  k1: 0.2,
  k2: 0.88,
  k3: 0.14,
  k4: 0,
  overlayOpacity: 0.14,
  overlayBlend: 'multiply',
  textureScalePx: 512,
  textureRepeat: true,
  vignetteStrength: 0.22,
};

const DEFAULT_PALETTE: PaletteControls = {
  surfaceApp: '#f4ecd8',
  surfaceBoard: '#efe4cd',
  surfacePanel: '#f9f2e3',
  surfacePanelMuted: '#efe4cf',
  textPrimary: '#2f261b',
  textMuted: '#806e5a',
  borderSubtle: 'rgba(60, 40, 20, 0.45)',
  accentRoyal: '#275292',
  accentDanger: '#c84f35',
};

type ThemeLabPreset = {
  id: string;
  name: string;
  baseThemeId: UiColorMode;
  controls: ProceduralTextureControls;
  palette: PaletteControls;
  customCssPatch: string;
  updatedAt: number;
};

type SandboxSourceId = `builtin:${UiColorMode}` | `saved:${string}`;

const THEME_LAB_PRESETS_STORAGE_KEY = 'hop_theme_lab_presets_v1';

const THEME_LABELS: Record<UiColorMode, string> = UI_THEME_OPTIONS.reduce(
  (acc, option) => {
    acc[option.id] = option.label;
    return acc;
  },
  {} as Record<UiColorMode, string>
);

const isUiColorMode = (value: unknown): value is UiColorMode =>
  typeof value === 'string' && UI_THEME_OPTIONS.some((theme) => theme.id === value);

const parseBuiltinThemeId = (source: string): UiColorMode | null => {
  if (!source.startsWith('builtin:')) return null;
  const id = source.slice('builtin:'.length);
  return isUiColorMode(id) ? id : null;
};

const parseSavedPresetId = (source: string): string | null => {
  if (!source.startsWith('saved:')) return null;
  const id = source.slice('saved:'.length).trim();
  return id.length > 0 ? id : null;
};

const readPaletteSnapshotFromRoot = (): PaletteControls => ({
  surfaceApp: readCssVar('--surface-app', DEFAULT_PALETTE.surfaceApp),
  surfaceBoard: readCssVar('--surface-board', DEFAULT_PALETTE.surfaceBoard),
  surfacePanel: readCssVar('--surface-panel', DEFAULT_PALETTE.surfacePanel),
  surfacePanelMuted: readCssVar('--surface-panel-muted', DEFAULT_PALETTE.surfacePanelMuted),
  textPrimary: readCssVar('--text-primary', DEFAULT_PALETTE.textPrimary),
  textMuted: readCssVar('--text-muted', DEFAULT_PALETTE.textMuted),
  borderSubtle: readCssVar('--border-subtle', DEFAULT_PALETTE.borderSubtle),
  accentRoyal: readCssVar('--accent-royal', DEFAULT_PALETTE.accentRoyal),
  accentDanger: readCssVar('--accent-danger', DEFAULT_PALETTE.accentDanger),
});

const readPaletteForThemeCopy = (theme: UiColorMode): PaletteControls => {
  if (typeof document === 'undefined') return { ...DEFAULT_PALETTE };
  const root = document.documentElement;
  const previousTheme = root.dataset.theme;
  const rootStyle = root.style;
  const keys: Array<keyof PaletteControls extends infer _K ? string : string> = [
    '--surface-app',
    '--surface-board',
    '--surface-panel',
    '--surface-panel-muted',
    '--text-primary',
    '--text-muted',
    '--border-subtle',
    '--accent-royal',
    '--accent-danger',
  ];
  const previousInlineValues: Record<string, string> = {};

  for (const key of keys) {
    previousInlineValues[key] = rootStyle.getPropertyValue(key);
    rootStyle.removeProperty(key);
  }

  root.dataset.theme = theme;
  const snapshot = readPaletteSnapshotFromRoot();

  if (previousTheme && previousTheme.trim().length > 0) {
    root.dataset.theme = previousTheme;
  } else {
    delete root.dataset.theme;
  }

  for (const key of keys) {
    const prior = previousInlineValues[key];
    if (prior && prior.trim().length > 0) {
      rootStyle.setProperty(key, prior);
    } else {
      rootStyle.removeProperty(key);
    }
  }
  return snapshot;
};

const readThemeLabPresets = (): ThemeLabPreset[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(THEME_LAB_PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is ThemeLabPreset => {
      if (!entry || typeof entry !== 'object') return false;
      if (typeof entry.id !== 'string' || entry.id.trim().length === 0) return false;
      if (typeof entry.name !== 'string') return false;
      if (!isUiColorMode((entry as ThemeLabPreset).baseThemeId)) return false;
      return true;
    });
  } catch {
    return [];
  }
};

const writeThemeLabPresets = (presets: ThemeLabPreset[]): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(THEME_LAB_PRESETS_STORAGE_KEY, JSON.stringify(presets));
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const readCssVar = (name: string, fallback: string): string => {
  if (typeof window === 'undefined') return fallback;
  const computed = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return computed || fallback;
};

const colorLike = (raw: string): boolean =>
  /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)
  || /^rgba?\(/i.test(raw);

const normalizeColorInput = (value: string, fallback: string): string => (colorLike(value) ? value : fallback);

const buildProceduralTextureSvg = (controls: ProceduralTextureControls): string => {
  const values = [
    `0 0 0 0 ${controls.red.toFixed(3)}`,
    `0 0 0 0 ${controls.green.toFixed(3)}`,
    `0 0 0 0 ${controls.blue.toFixed(3)}`,
    '0 0 0 1 0',
  ].join(' ');

  return `
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'>
  <filter id='parchment' x='0%' y='0%' width='100%' height='100%'>
    <feTurbulence
      type='fractalNoise'
      baseFrequency='${controls.baseFrequency.toFixed(4)}'
      numOctaves='${Math.round(controls.numOctaves)}'
      seed='${Math.round(controls.seed)}'
      stitchTiles='stitch'
      result='noise'
    />
    <feColorMatrix
      in='noise'
      type='matrix'
      values='${values}'
      result='coloredNoise'
    />
    <feDiffuseLighting
      in='noise'
      lighting-color='${controls.lightingColor}'
      surfaceScale='${controls.surfaceScale.toFixed(3)}'
      diffuseConstant='${controls.diffuseConstant.toFixed(3)}'
      result='litNoise'
    >
      <feDistantLight
        azimuth='${controls.azimuth.toFixed(2)}'
        elevation='${controls.elevation.toFixed(2)}'
      />
    </feDiffuseLighting>
    <feComposite
      in='litNoise'
      in2='coloredNoise'
      operator='arithmetic'
      k1='${controls.k1.toFixed(3)}'
      k2='${controls.k2.toFixed(3)}'
      k3='${controls.k3.toFixed(3)}'
      k4='${controls.k4.toFixed(3)}'
      result='paper'
    />
    <feComponentTransfer in='paper' result='paperAlpha'>
      <feFuncA type='linear' slope='${controls.overlayOpacity.toFixed(3)}' />
    </feComponentTransfer>
  </filter>
  <rect width='100%' height='100%' filter='url(#parchment)' />
</svg>`.trim();
};

const encodeSvgDataUri = (svg: string): string => `data:image/svg+xml,${encodeURIComponent(svg)}`;

const parseCustomCssVars = (raw: string): Record<string, string> => {
  const parsed: Record<string, string> = {};
  const lines = raw.split('\n');
  for (const line of lines) {
    const match = line.match(/^\s*(--[\w-]+)\s*:\s*([^;]+);?\s*$/);
    if (!match) continue;
    parsed[match[1]] = match[2].trim();
  }
  return parsed;
};

const SliderControl = ({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
}) => (
  <label className="flex flex-col gap-1.5">
    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
      <span>{label}</span>
      <span className="text-[var(--text-primary)] tracking-[0.08em]">{value.toFixed(step < 1 ? 3 : 0)}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="w-full accent-[var(--accent-royal)]"
    />
  </label>
);

const ColorControl = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) => (
  <label className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-2 py-1.5">
    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">{label}</span>
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={normalizeColorInput(value, '#000000')}
        onChange={(event) => onChange(event.target.value)}
        className="h-7 w-7 rounded border border-[var(--border-subtle)] bg-transparent p-0"
      />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-[8.8rem] rounded border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-2 py-1 text-[11px] font-mono text-[var(--text-primary)]"
      />
    </div>
  </label>
);

export const ThemeManagerScreen = ({
  uiPreferences,
  onSetColorMode,
  onSetMotionMode,
  onSetHudDensity,
  onBack,
}: ThemeManagerScreenProps) => {
  const [controls, setControls] = React.useState<ProceduralTextureControls>(DEFAULT_TEXTURE_CONTROLS);
  const [palette, setPalette] = React.useState<PaletteControls>(() => readPaletteForThemeCopy(uiPreferences.colorMode));
  const [customCssPatch, setCustomCssPatch] = React.useState('');
  const [copied, setCopied] = React.useState(false);
  const [statusLine, setStatusLine] = React.useState('');
  const [savedPresets, setSavedPresets] = React.useState<ThemeLabPreset[]>(() => readThemeLabPresets());
  const [sandboxSource, setSandboxSource] = React.useState<SandboxSourceId>(`builtin:${uiPreferences.colorMode}`);
  const [sandboxName, setSandboxName] = React.useState(`${THEME_LABELS[uiPreferences.colorMode]} Copy`);
  const [appThemeDraft, setAppThemeDraft] = React.useState<UiColorMode>(uiPreferences.colorMode);

  const persistPresets = React.useCallback((nextPresets: ThemeLabPreset[]) => {
    setSavedPresets(nextPresets);
    writeThemeLabPresets(nextPresets);
  }, []);

  const loadSourceIntoSandbox = React.useCallback((source: SandboxSourceId) => {
    const builtinTheme = parseBuiltinThemeId(source);
    if (builtinTheme) {
      setSandboxSource(source);
      setSandboxName(`${THEME_LABELS[builtinTheme]} Copy`);
      setControls(DEFAULT_TEXTURE_CONTROLS);
      setPalette(readPaletteForThemeCopy(builtinTheme));
      setCustomCssPatch('');
      setStatusLine(`Loaded ${THEME_LABELS[builtinTheme]} as editable sandbox copy.`);
      return;
    }

    const savedId = parseSavedPresetId(source);
    if (!savedId) return;
    const preset = savedPresets.find((entry) => entry.id === savedId);
    if (!preset) return;
    setSandboxSource(source);
    setSandboxName(preset.name);
    setControls(preset.controls);
    setPalette(preset.palette);
    setCustomCssPatch(preset.customCssPatch);
    setStatusLine(`Loaded saved preset "${preset.name}".`);
  }, [savedPresets]);

  const initializedRef = React.useRef(false);
  React.useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    loadSourceIntoSandbox(`builtin:${uiPreferences.colorMode}`);
  }, [loadSourceIntoSandbox, uiPreferences.colorMode]);

  React.useEffect(() => {
    setAppThemeDraft(uiPreferences.colorMode);
  }, [uiPreferences.colorMode]);

  const textureSvg = React.useMemo(() => buildProceduralTextureSvg(controls), [controls]);
  const textureDataUri = React.useMemo(() => encodeSvgDataUri(textureSvg), [textureSvg]);
  const textureCssUrl = React.useMemo(() => `url("${textureDataUri}")`, [textureDataUri]);
  const customVars = React.useMemo(() => parseCustomCssVars(customCssPatch), [customCssPatch]);

  const sandboxSourceOptions = React.useMemo(
    () => [
      ...UI_THEME_OPTIONS.map((theme) => ({
        id: `builtin:${theme.id}` as SandboxSourceId,
        label: `Base - ${theme.label}`
      })),
      ...savedPresets.map((preset) => ({
        id: `saved:${preset.id}` as SandboxSourceId,
        label: `Saved - ${preset.name}`
      }))
    ],
    [savedPresets]
  );

  const replacementTargetId = React.useMemo(() => {
    const selectedId = parseSavedPresetId(sandboxSource);
    if (selectedId && savedPresets.some((entry) => entry.id === selectedId)) {
      return selectedId;
    }
    return savedPresets[0]?.id ?? null;
  }, [sandboxSource, savedPresets]);

  const replacementTargetName = React.useMemo(() => {
    if (!replacementTargetId) return null;
    return savedPresets.find((entry) => entry.id === replacementTargetId)?.name ?? null;
  }, [replacementTargetId, savedPresets]);

  const canReplaceSelected = replacementTargetId !== null;

  const previewVars = React.useMemo(() => ({
    '--surface-app': palette.surfaceApp,
    '--surface-board': palette.surfaceBoard,
    '--surface-panel': palette.surfacePanel,
    '--surface-panel-muted': palette.surfacePanelMuted,
    '--text-primary': palette.textPrimary,
    '--text-muted': palette.textMuted,
    '--border-subtle': palette.borderSubtle,
    '--accent-royal': palette.accentRoyal,
    '--accent-danger': palette.accentDanger,
    '--surface-texture': textureCssUrl,
    '--surface-texture-overlay-opacity': controls.overlayOpacity.toFixed(3),
    '--surface-texture-overlay-blend': controls.overlayBlend,
    ...customVars,
  } as React.CSSProperties), [controls.overlayBlend, controls.overlayOpacity, customVars, palette, textureCssUrl]);

  const shellStyle = React.useMemo(
    () =>
      ({
        ...previewVars,
        backgroundImage: [
          `radial-gradient(circle at 50% 42%, rgba(255, 255, 255, 0.08), rgba(0, 0, 0, ${Math.max(0, controls.vignetteStrength - 0.04).toFixed(3)}))`,
          'linear-gradient(180deg, var(--surface-app), var(--surface-board))',
        ].join(', '),
        backgroundBlendMode: 'normal, normal',
        backgroundSize: 'cover, cover',
        backgroundRepeat: 'no-repeat, no-repeat',
      } as React.CSSProperties),
    [controls.vignetteStrength, previewVars]
  );

  const globalTextureOverlayStyle = React.useMemo(
    () =>
      ({
        backgroundImage: 'var(--surface-texture)',
        backgroundSize: controls.textureRepeat ? `${controls.textureScalePx}px ${controls.textureScalePx}px` : 'cover',
        backgroundRepeat: controls.textureRepeat ? 'repeat' : 'no-repeat',
        backgroundPosition: '50% 50%',
        mixBlendMode: controls.overlayBlend,
        opacity: controls.overlayOpacity,
      } as React.CSSProperties),
    [controls.overlayBlend, controls.overlayOpacity, controls.textureRepeat, controls.textureScalePx]
  );

  const globalVignetteStyle = React.useMemo(
    () =>
      ({
        backgroundImage: `radial-gradient(circle at 50% 45%, rgba(255,255,255,0.06), rgba(0,0,0,${controls.vignetteStrength.toFixed(3)}))`,
        mixBlendMode: 'multiply',
        opacity: 0.86,
      } as React.CSSProperties),
    [controls.vignetteStrength]
  );

  const previewCanvasStyle = React.useMemo(
    () =>
      ({
        backgroundImage: [
          `radial-gradient(circle at 50% 42%, rgba(255, 255, 255, 0.12), rgba(0, 0, 0, ${controls.vignetteStrength.toFixed(3)}))`,
          'linear-gradient(180deg, var(--surface-app), var(--surface-board))',
          'var(--surface-texture)',
        ].join(', '),
        backgroundBlendMode: `normal, normal, ${controls.overlayBlend}`,
        backgroundSize: `cover, cover, ${controls.textureRepeat ? `${controls.textureScalePx}px ${controls.textureScalePx}px` : 'cover'}`,
        backgroundRepeat: `no-repeat, no-repeat, ${controls.textureRepeat ? 'repeat' : 'no-repeat'}`,
      } as React.CSSProperties),
    [controls.overlayBlend, controls.textureRepeat, controls.textureScalePx, controls.vignetteStrength]
  );

  const exportCss = React.useMemo(() => {
    const customLines = Object.entries(customVars)
      .map(([name, value]) => `  ${name}: ${value};`)
      .join('\n');
    return `:root {
  --surface-texture-procedural: ${textureCssUrl};
  --surface-texture: var(--surface-texture-procedural);
  --surface-texture-overlay-opacity: ${controls.overlayOpacity.toFixed(3)};
  --surface-texture-overlay-blend: ${controls.overlayBlend};
  --surface-app: ${palette.surfaceApp};
  --surface-board: ${palette.surfaceBoard};
  --surface-panel: ${palette.surfacePanel};
  --surface-panel-muted: ${palette.surfacePanelMuted};
  --text-primary: ${palette.textPrimary};
  --text-muted: ${palette.textMuted};
  --border-subtle: ${palette.borderSubtle};
  --accent-royal: ${palette.accentRoyal};
  --accent-danger: ${palette.accentDanger};
${customLines ? `${customLines}\n` : ''}}`;
  }, [controls.overlayBlend, controls.overlayOpacity, customVars, palette, textureCssUrl]);

  const updateControl = React.useCallback(
    <K extends keyof ProceduralTextureControls>(key: K, value: ProceduralTextureControls[K]) => {
      setControls((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const updatePalette = React.useCallback(<K extends keyof PaletteControls>(key: K, value: PaletteControls[K]) => {
    setPalette((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetAll = React.useCallback(() => {
    loadSourceIntoSandbox(sandboxSource);
  }, [loadSourceIntoSandbox, sandboxSource]);

  const saveAsNewPreset = React.useCallback(() => {
    const resolvedName = sandboxName.trim() || 'Untitled Theme';
    const id = `theme-${Date.now()}`;
    const builtinTheme = parseBuiltinThemeId(sandboxSource) ?? uiPreferences.colorMode;
    const nextPreset: ThemeLabPreset = {
      id,
      name: resolvedName,
      baseThemeId: builtinTheme,
      controls,
      palette,
      customCssPatch,
      updatedAt: Date.now()
    };
    const nextPresets = [nextPreset, ...savedPresets];
    persistPresets(nextPresets);
    setSandboxSource(`saved:${id}`);
    setStatusLine(`Saved new preset "${resolvedName}".`);
  }, [controls, customCssPatch, palette, persistPresets, sandboxName, sandboxSource, savedPresets, uiPreferences.colorMode]);

  const replaceSelectedPreset = React.useCallback(() => {
    const selectedId = replacementTargetId;
    if (!selectedId) return;
    const resolvedName = sandboxName.trim() || 'Untitled Theme';
    const builtinTheme = parseBuiltinThemeId(sandboxSource) ?? uiPreferences.colorMode;
    const nextPresets = savedPresets.map((preset) => {
      if (preset.id !== selectedId) return preset;
      return {
        ...preset,
        name: resolvedName,
        baseThemeId: builtinTheme,
        controls,
        palette,
        customCssPatch,
        updatedAt: Date.now()
      };
    });
    persistPresets(nextPresets);
    setSandboxSource(`saved:${selectedId}`);
    setStatusLine(`Replaced preset "${resolvedName}".`);
  }, [controls, customCssPatch, palette, persistPresets, replacementTargetId, sandboxName, sandboxSource, savedPresets, uiPreferences.colorMode]);

  const copyCss = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(exportCss);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }, [exportCss]);

  React.useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const rootStyle = document.documentElement.style;
    const keys = Object.keys(previewVars).filter((key) => key.startsWith('--'));
    const previous: Record<string, string> = {};

    for (const key of keys) {
      previous[key] = rootStyle.getPropertyValue(key);
      const value = (previewVars as Record<string, unknown>)[key];
      rootStyle.setProperty(key, String(value));
    }

    return () => {
      for (const key of keys) {
        const prior = previous[key];
        if (prior && prior.trim().length > 0) {
          rootStyle.setProperty(key, prior);
        } else {
          rootStyle.removeProperty(key);
        }
      }
    };
  }, [previewVars]);

  return (
    <div
      className="relative isolate w-screen h-screen surface-app-material bg-[var(--surface-app)] text-[var(--text-primary)] font-[var(--font-body)] flex flex-col lg:flex-row overflow-hidden"
      style={shellStyle}
    >
      <div className="pointer-events-none absolute inset-0 z-[1]" style={globalTextureOverlayStyle} />
      <div className="pointer-events-none absolute inset-0 z-[2]" style={globalVignetteStyle} />
      <main className="relative z-10 flex-1 min-h-0 p-3 sm:p-4 lg:p-6">
        <div className="h-full rounded-3xl border border-[var(--border-subtle)] overflow-hidden" style={previewCanvasStyle}>
          <header className="px-4 py-3 sm:px-5 sm:py-4 border-b border-[var(--border-subtle)] bg-[rgba(10,8,6,0.14)] backdrop-blur-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h1 className="text-sm sm:text-base font-black uppercase tracking-[0.24em]">Theme Manager / Style Guide</h1>
                <p className="text-[10px] sm:text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Procedural parchment lab with live token output
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onBack}
                  className="min-h-9 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)] text-[10px] font-black uppercase tracking-[0.16em]"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={resetAll}
                  className="min-h-9 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] text-[10px] font-black uppercase tracking-[0.16em]"
                >
                  Reset
                </button>
              </div>
            </div>
          </header>

          <div className="h-[calc(100%-4.5rem)] overflow-y-auto p-3 sm:p-4 lg:p-5 grid grid-cols-1 xl:grid-cols-[1.45fr_1fr] gap-4">
            <section className="space-y-4">
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mb-3">Readability Check</div>
                <h2 className="font-black text-lg tracking-wide">Tactical Artifact Interface</h2>
                <p className="text-sm leading-relaxed text-[color:var(--text-primary)]/90">
                  Tune texture, contrast, and depth to keep hierarchy obvious. Primary actions should read first, context second,
                  decorative material third.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="min-h-10 px-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] text-[11px] font-black uppercase tracking-[0.16em]"
                  >
                    Primary Action
                  </button>
                  <button
                    type="button"
                    className="min-h-10 px-4 rounded-xl border text-[11px] font-black uppercase tracking-[0.16em]"
                    style={{ borderColor: palette.accentRoyal, color: palette.accentRoyal, backgroundColor: 'color-mix(in srgb, var(--accent-royal) 14%, var(--surface-panel))' }}
                  >
                    Accent Button
                  </button>
                  <button
                    type="button"
                    className="min-h-10 px-4 rounded-xl border text-[11px] font-black uppercase tracking-[0.16em]"
                    style={{ borderColor: 'color-mix(in srgb, var(--accent-danger) 52%, transparent)', color: palette.accentDanger, backgroundColor: 'color-mix(in srgb, var(--accent-danger) 14%, var(--surface-panel))' }}
                  >
                    Danger
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mb-2">Skill Tray Sample</div>
                <div className="space-y-3">
                  {[
                    { title: 'Spear Throw', icon: '🔱', selected: false },
                    { title: 'Shield Bash', icon: '🛡️', selected: true },
                    { title: 'Jump', icon: '🦘', selected: false },
                  ].map((skill) => (
                    <button
                      key={skill.title}
                      type="button"
                      className={`skill-card ${skill.selected ? 'skill-card-selected' : ''} relative w-full rounded-2xl p-4 text-left`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="skill-wax-label text-[10px] font-black uppercase tracking-[0.2em]">{skill.selected ? 'Active' : 'Ready'}</span>
                        <span className="text-xs font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">{skill.selected ? 'On' : 'Off'}</span>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <span className="skill-icon-stain text-3xl">{skill.icon}</span>
                        <div className="text-sm font-black uppercase tracking-[0.14em]">{skill.title}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mb-3">Form and Data Density</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">Theme Name</span>
                    <input className="min-h-10 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-3 text-sm" value="Parchment Trial A" readOnly />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">Contrast Index</span>
                    <input className="min-h-10 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-3 text-sm" value="AA+ (est.)" readOnly />
                  </label>
                </div>
                <div className="mt-3 h-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] overflow-hidden">
                  <div className="h-full w-[72%]" style={{ backgroundColor: palette.accentRoyal }} />
                </div>
              </div>
            </section>

            <aside className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-4 flex flex-col gap-3">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Sandbox Status</div>
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-3 py-2">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">Source</div>
                <div className="text-sm font-black uppercase tracking-[0.14em] text-[var(--text-primary)]">
                  {parseBuiltinThemeId(sandboxSource)
                    ? `Base - ${THEME_LABELS[parseBuiltinThemeId(sandboxSource) as UiColorMode]}`
                    : `Saved - ${sandboxName}`}
                </div>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-3 py-2">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">Working Name</div>
                <div className="text-sm font-black uppercase tracking-[0.14em] text-[var(--text-primary)]">{sandboxName || 'Untitled Theme'}</div>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-3 py-2">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">Live Theme</div>
                <div className="text-sm font-black uppercase tracking-[0.14em] text-[var(--text-primary)]">{THEME_LABELS[uiPreferences.colorMode]}</div>
              </div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] pt-1">Texture Diagnostics</div>
              <div className="rounded-lg border border-[var(--border-subtle)] overflow-hidden">
                <div className="px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] bg-[var(--surface-panel-muted)] text-[var(--text-muted)]">
                  Raw procedural texture (no blend)
                </div>
                <div
                  className="h-20"
                  style={{
                    backgroundImage: 'var(--surface-texture)',
                    backgroundSize: controls.textureRepeat ? `${controls.textureScalePx}px ${controls.textureScalePx}px` : 'cover',
                    backgroundRepeat: controls.textureRepeat ? 'repeat' : 'no-repeat',
                    backgroundPosition: '50% 50%',
                  }}
                />
              </div>
            </aside>
          </div>
        </div>
      </main>

      <aside className="relative z-10 w-full lg:w-[420px] shrink-0 border-t lg:border-t-0 lg:border-l border-[var(--border-subtle)] bg-[var(--surface-panel)] overflow-y-auto p-3 sm:p-4 space-y-4">
        <section className="space-y-2">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Sandbox Source</div>
          <label className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-2 py-1.5">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">Load From</span>
            <select
              value={sandboxSource}
              onChange={(event) => setSandboxSource(event.target.value as SandboxSourceId)}
              className="min-h-8 rounded border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-2 text-[10px] font-black uppercase tracking-[0.14em]"
            >
              {sandboxSourceOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => loadSourceIntoSandbox(sandboxSource)}
            className="w-full min-h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] text-[10px] font-black uppercase tracking-[0.16em]"
          >
            Load Copy Into Sandbox
          </button>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">Sandbox Name</span>
            <input
              type="text"
              value={sandboxName}
              onChange={(event) => setSandboxName(event.target.value)}
              className="min-h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-3 text-sm font-semibold"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={saveAsNewPreset}
              className="min-h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] text-[10px] font-black uppercase tracking-[0.16em]"
            >
              Save As New
            </button>
            <button
              type="button"
              disabled={!canReplaceSelected}
              onClick={replaceSelectedPreset}
              className="min-h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] disabled:opacity-45 text-[10px] font-black uppercase tracking-[0.16em]"
            >
              Replace Selected
            </button>
          </div>
          {replacementTargetName && (
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Replace target: {replacementTargetName}
            </div>
          )}
          {statusLine && (
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-2.5 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
              {statusLine}
            </div>
          )}
        </section>

        <section className="space-y-2">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">App Sync (Manual)</div>
          <label className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-2 py-1.5">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">Live Theme</span>
            <select
              value={appThemeDraft}
              onChange={(event) => setAppThemeDraft(event.target.value as UiColorMode)}
              className="min-h-8 rounded border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-2 text-[10px] font-black uppercase tracking-[0.14em]"
            >
              {UI_THEME_OPTIONS.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {theme.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => onSetColorMode(appThemeDraft)}
            className="w-full min-h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] text-[10px] font-black uppercase tracking-[0.16em]"
          >
            Apply Selected Live Theme
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onSetMotionMode(uiPreferences.motionMode === 'snappy' ? 'reduced' : 'snappy')}
              className="min-h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] text-[10px] font-black uppercase tracking-[0.16em]"
            >
              Motion: {uiPreferences.motionMode}
            </button>
            <button
              type="button"
              onClick={() => onSetHudDensity(uiPreferences.hudDensity === 'compact' ? 'comfortable' : 'compact')}
              className="min-h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] text-[10px] font-black uppercase tracking-[0.16em]"
            >
              HUD: {uiPreferences.hudDensity}
            </button>
          </div>
        </section>

        <section className="space-y-2">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Procedural Texture</div>
          <SliderControl label="Base Frequency" value={controls.baseFrequency} min={0.01} max={0.1} step={0.001} onChange={(v) => updateControl('baseFrequency', clamp(v, 0.01, 0.1))} />
          <SliderControl label="Octaves" value={controls.numOctaves} min={1} max={6} step={1} onChange={(v) => updateControl('numOctaves', clamp(Math.round(v), 1, 6))} />
          <SliderControl label="Seed" value={controls.seed} min={1} max={256} step={1} onChange={(v) => updateControl('seed', clamp(Math.round(v), 1, 999))} />
          <SliderControl label="Color R" value={controls.red} min={0.7} max={1} step={0.005} onChange={(v) => updateControl('red', clamp(v, 0.7, 1))} />
          <SliderControl label="Color G" value={controls.green} min={0.65} max={1} step={0.005} onChange={(v) => updateControl('green', clamp(v, 0.65, 1))} />
          <SliderControl label="Color B" value={controls.blue} min={0.5} max={1} step={0.005} onChange={(v) => updateControl('blue', clamp(v, 0.5, 1))} />
          <ColorControl label="Lighting" value={controls.lightingColor} onChange={(v) => updateControl('lightingColor', v)} />
          <SliderControl label="Surface Scale" value={controls.surfaceScale} min={0.2} max={4} step={0.05} onChange={(v) => updateControl('surfaceScale', clamp(v, 0.2, 4))} />
          <SliderControl label="Diffuse Constant" value={controls.diffuseConstant} min={0} max={1} step={0.01} onChange={(v) => updateControl('diffuseConstant', clamp(v, 0, 1))} />
          <SliderControl label="Azimuth" value={controls.azimuth} min={0} max={360} step={1} onChange={(v) => updateControl('azimuth', clamp(v, 0, 360))} />
          <SliderControl label="Elevation" value={controls.elevation} min={0} max={90} step={1} onChange={(v) => updateControl('elevation', clamp(v, 0, 90))} />
        </section>

        <section className="space-y-2">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Composite and Application</div>
          <SliderControl label="Composite K1" value={controls.k1} min={0} max={1} step={0.01} onChange={(v) => updateControl('k1', clamp(v, 0, 1))} />
          <SliderControl label="Composite K2" value={controls.k2} min={0} max={1} step={0.01} onChange={(v) => updateControl('k2', clamp(v, 0, 1))} />
          <SliderControl label="Composite K3" value={controls.k3} min={0} max={1} step={0.01} onChange={(v) => updateControl('k3', clamp(v, 0, 1))} />
          <SliderControl label="Composite K4" value={controls.k4} min={0} max={1} step={0.01} onChange={(v) => updateControl('k4', clamp(v, 0, 1))} />
          <SliderControl label="Overlay Opacity" value={controls.overlayOpacity} min={0.03} max={0.5} step={0.005} onChange={(v) => updateControl('overlayOpacity', clamp(v, 0.03, 0.5))} />
          <SliderControl label="Texture Scale PX" value={controls.textureScalePx} min={128} max={1024} step={16} onChange={(v) => updateControl('textureScalePx', clamp(Math.round(v), 128, 1024))} />
          <SliderControl label="Vignette" value={controls.vignetteStrength} min={0} max={0.6} step={0.01} onChange={(v) => updateControl('vignetteStrength', clamp(v, 0, 0.6))} />
          <label className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-2 py-1.5">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">Blend Mode</span>
            <select
              value={controls.overlayBlend}
              onChange={(event) => updateControl('overlayBlend', event.target.value as TextureBlendMode)}
              className="min-h-8 rounded border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-2 text-[10px] font-black uppercase tracking-[0.14em]"
            >
              <option value="normal">Normal</option>
              <option value="multiply">Multiply</option>
              <option value="overlay">Overlay</option>
              <option value="soft-light">Soft Light</option>
              <option value="screen">Screen</option>
            </select>
          </label>
          <label className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-2 py-1.5">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">Texture Repeat</span>
            <input
              type="checkbox"
              checked={controls.textureRepeat}
              onChange={(event) => updateControl('textureRepeat', event.target.checked)}
              className="h-4 w-4 accent-[var(--accent-royal)]"
            />
          </label>
        </section>

        <section className="space-y-2">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Palette Tokens</div>
          <ColorControl label="Surface App" value={palette.surfaceApp} onChange={(v) => updatePalette('surfaceApp', v)} />
          <ColorControl label="Surface Board" value={palette.surfaceBoard} onChange={(v) => updatePalette('surfaceBoard', v)} />
          <ColorControl label="Surface Panel" value={palette.surfacePanel} onChange={(v) => updatePalette('surfacePanel', v)} />
          <ColorControl label="Panel Muted" value={palette.surfacePanelMuted} onChange={(v) => updatePalette('surfacePanelMuted', v)} />
          <ColorControl label="Text Primary" value={palette.textPrimary} onChange={(v) => updatePalette('textPrimary', v)} />
          <ColorControl label="Text Muted" value={palette.textMuted} onChange={(v) => updatePalette('textMuted', v)} />
          <ColorControl label="Border Subtle" value={palette.borderSubtle} onChange={(v) => updatePalette('borderSubtle', v)} />
          <ColorControl label="Accent Royal" value={palette.accentRoyal} onChange={(v) => updatePalette('accentRoyal', v)} />
          <ColorControl label="Accent Danger" value={palette.accentDanger} onChange={(v) => updatePalette('accentDanger', v)} />
        </section>

        <section className="space-y-2">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Custom CSS Patch</div>
          <textarea
            value={customCssPatch}
            onChange={(event) => setCustomCssPatch(event.target.value)}
            spellCheck={false}
            placeholder="--accent-brass: #b48d50;
--surface-panel-hover: #ebddc5;"
            className="w-full min-h-[88px] rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] p-2 text-[11px] font-mono text-[var(--text-primary)]"
          />
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Export CSS</div>
            <button
              type="button"
              onClick={copyCss}
              className="min-h-8 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] text-[10px] font-black uppercase tracking-[0.16em]"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <textarea
            readOnly
            value={exportCss}
            spellCheck={false}
            className="w-full min-h-[180px] rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] p-2 text-[10px] font-mono text-[var(--text-primary)]"
          />
          <details className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] p-2">
            <summary className="cursor-pointer text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">Raw SVG</summary>
            <textarea
              readOnly
              value={textureSvg}
              spellCheck={false}
              className="mt-2 w-full min-h-[180px] rounded border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-2 text-[10px] font-mono text-[var(--text-primary)]"
            />
          </details>
        </section>
      </aside>
    </div>
  );
};

