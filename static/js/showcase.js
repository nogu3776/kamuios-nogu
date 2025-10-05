import installLiveReloadGuard from './live-reload-guard.js';
import showcaseTemplate from './templates/showcase-ui.js';

installLiveReloadGuard({ alwaysBlockReload: true });

const API_BASE = '/api/mcp';
const SHOWCASE_API_BASE = '/api/showcase';
const HISTORY_API_ENDPOINT = `${SHOWCASE_API_BASE}/history`;
const TEMPLATES_API_ENDPOINT = `${SHOWCASE_API_BASE}/templates`;
const RELOAD_RELEASE_DELAY_MS = 15000;

function isShowcaseSyncDisabled() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.__kcDisableShowcaseSync);
}

let reloadReleaseTimer = null;
let beforeUnloadHandler = null;

function setReloadBlock(active, { delayMs = RELOAD_RELEASE_DELAY_MS, release = true, manual = false } = {}) {
  if (typeof window === 'undefined') return;

  if (!beforeUnloadHandler) {
    beforeUnloadHandler = (event) => {
      if (!window.__kcBlockManualReload) return;
      event.preventDefault();
      event.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', beforeUnloadHandler, { capture: true });
  }

  if (reloadReleaseTimer) {
    clearTimeout(reloadReleaseTimer);
    reloadReleaseTimer = null;
  }

  if (active) {
    window.__kcBlockReload = true;
    window.__kcBlockManualReload = Boolean(manual);
    return;
  }

  if (!release) {
    window.__kcBlockReload = true;
    window.__kcBlockManualReload = Boolean(manual);
    return;
  }

  const delay = Number.isFinite(delayMs) ? Math.max(0, delayMs) : RELOAD_RELEASE_DELAY_MS;
  if (delay <= 0) {
    window.__kcBlockReload = false;
    window.__kcBlockManualReload = false;
    return;
  }
  reloadReleaseTimer = window.setTimeout(() => {
    window.__kcBlockReload = false;
    window.__kcBlockManualReload = false;
    reloadReleaseTimer = null;
  }, delay);
}

if (typeof window !== 'undefined') {
  window.__kcAllowReload = (delayMs = 0) => {
    setReloadBlock(false, { release: true, delayMs });
  };
}
const DEFAULT_ACTIVE_CATEGORY = 'image';
const ALL_CATEGORY_ID = 'all';
const ALL_CATEGORY_LABEL = 'ALL';

const CATEGORY_DEFINITIONS = [
  { id: 'image', label: 'IMAGE', prefixes: ['t2i', 'i2i'] },
  { id: 'video', label: 'VIDEO', prefixes: ['t2v', 'i2v', 'r2v', 's2v', 'a2v', 'v2v'] },
  { id: '3d', label: '3D', prefixes: ['i2i3d'] },
  { id: 'sound', label: 'SOUND', prefixes: ['v2a', 'v2sfx', 't2a', 't2s', 'tts', 't2m'] },
  { id: 'other', label: 'OTHER', prefixes: ['t2visual', 'file', 'train', 'misc'] }
];

const CATEGORY_DEFINITION_MAP = new Map(CATEGORY_DEFINITIONS.map((def) => [def.id, def]));
const PREFIX_TO_CATEGORY = new Map();
CATEGORY_DEFINITIONS.forEach((def) => {
  (def.prefixes || []).forEach((prefix) => {
    PREFIX_TO_CATEGORY.set(prefix, def.id);
  });
});
const TYPE_PREFIX_TO_CATEGORY = PREFIX_TO_CATEGORY;

const SUPPORTED_CATEGORIES = CATEGORY_DEFINITIONS.map((def) => def.id);
const CATEGORY_LABELS = Object.fromEntries([
  [ALL_CATEGORY_ID, ALL_CATEGORY_LABEL],
  ...CATEGORY_DEFINITIONS.map((def) => [def.id, def.label])
]);

const PREFIXES_REQUIRING_MEDIA = new Set(['i2i', 'i2v', 'r2v', 'a2v', 'i2i3d']);

const MEDIA_FILTERS = [
  { id: 'all', label: 'all' },
  { id: 'image', label: 'image' },
  { id: 'video', label: 'video' },
  { id: '3d', label: '3d' },
  { id: 'sound', label: 'sound' }
];

function createDefaultHistoryFilters() {
  return {
    category: ALL_CATEGORY_ID,
    prefix: 'all'
  };
}

function sanitizeHistoryFilters(raw) {
  const defaults = createDefaultHistoryFilters();
  const filters = { ...defaults };
  if (!raw || typeof raw !== 'object') {
    return filters;
  }

  if (typeof raw.category === 'string') {
    const candidate = raw.category.trim().toLowerCase();
    if (candidate === ALL_CATEGORY_ID) {
      filters.category = ALL_CATEGORY_ID;
    } else if (candidate === 'other') {
      filters.category = 'other';
    } else if (isSupportedCategory(candidate)) {
      filters.category = candidate;
    }
  }

  if (typeof raw.prefix === 'string') {
    const candidate = raw.prefix.trim().toLowerCase();
    if (!candidate || candidate === 'all') {
      filters.prefix = 'all';
    } else if (candidate === 'other') {
      filters.prefix = 'other';
    } else {
      const normalized = normalizeTypeToken(candidate);
      filters.prefix = normalized || 'all';
    }
  }

  return filters;
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff', 'tif', 'heic', 'heif']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'mkv', 'webm', 'avi', 'm4v', 'wmv']);
const AUDIO_EXTENSIONS = new Set(['wav', 'mp3', 'aac', 'flac', 'ogg', 'm4a', 'aiff', 'wma', 'opus', 'mid', 'midi']);
const THREED_EXTENSIONS = new Set(['obj', 'fbx', 'stl', 'glb', 'gltf', 'ply', 'usdz', 'usd', 'blend', '3ds', 'dae', 'stp', 'step', 'igs', 'iges', 'vrm']);

const MIME_EXTENSION_OVERRIDES = Object.freeze({
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/pjpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/x-matroska': 'mkv',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/ogg': 'ogg',
  'audio/flac': 'flac',
  'audio/aac': 'aac',
  'audio/x-m4a': 'm4a',
  'audio/mp4': 'm4a',
  'model/gltf-binary': 'glb',
  'model/gltf+json': 'gltf',
  'model/gltf': 'gltf',
  'model/obj': 'obj',
  'model/stl': 'stl',
  'model/vnd.usdz+zip': 'usdz',
  'model/vnd.usd+zip': 'usd',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
  'application/octet-stream': '',
  'application/x-tar': 'tar'
});

const MEDIA_HINTS = {
  sound: new Set([
    'sound', 'audio', 'music', 'voice', 'speech', 'sfx', 'fx', 'vocals', 'binaural',
    'wav', 'mp3', 'ogg', 'flac', 'm4a', 'aac', 'aiff', 'wma', 'opus', 'mid', 'midi',
    't2a', 't2s', 'tts', 't2m'
  ]),
  video: new Set([
    'video', 'vid', 'clip', 'movie', 'mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v', 'mpg',
    'mpeg', 'mp2', 'gifv', 't2v', 'i2v', 'v2v', 'r2v', 's2v', 'a2v'
  ]),
  '3d': new Set([
    '3d', 'mesh', 'model', 'geometry', 'pointcloud', 'glb', 'gltf', 'fbx', 'obj', 'stl',
    'ply', 'usd', 'usdz', 'blend', '3ds', 'dae', 'stp', 'step', 'igs', 'iges', 'vrm', 'cad'
  ]),
  image: new Set([
    'image', 'img', 'photo', 'picture', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp',
    'bitmap', 'tiff', 'tif', 'heic', 'heif', 'svg', 'psd', 'render', 'still'
  ])
};

const MEDIA_FILTER_PRIORITY = ['3d', 'image', 'video', 'sound'];

const MEDIA_SELECTION_TYPE_ORDER = ['image', 'video', 'sound', '3d', 'other'];

const MEDIA_INPUT_ALLOWED_TYPES = new Set(['image', 'video', 'sound', '3d']);

const MEDIA_HINT_LOOKUP = (() => {
  const map = new Map();
  Object.entries(MEDIA_HINTS).forEach(([key, set]) => {
    set.forEach((token) => {
      map.set(token, key);
    });
  });
  return map;
})();

const PREVIEWABLE_3D_EXTENSIONS = new Set(['glb', 'gltf', 'usdz', 'usd', 'vrm']);
const MODEL_VIEWER_MODULE_URL = 'https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js';
const MODEL_VIEWER_SCRIPT_ATTR = 'data-kc-model-viewer';
let modelViewerLoadPromise = null;

const SOUND_TEXT_PARAM_KEYS = new Set([
  'text',
  'lyrics',
  'lyrics_prompt',
  'lyricsprompt',
  'speech_text',
  'speechtext',
  'script',
  'voice_text',
  'voice_text_prompt'
]);

const PROMPT_GENERATOR_ENDPOINT = '/api/prompt/generate';
const PROMPT_GENERATOR_DEFAULT_MODE = 'enhance';
const PROMPT_GENERATOR_DEFAULT_TYPE = 't2i';
const PROMPT_GENERATOR_MODES = [
  { id: 'expand', label: '水平展開' },
  { id: 'enhance', label: 'エンハンス' }
];
const PROMPT_GENERATOR_MAX_SUGGESTIONS = 8;
const PROMPT_GENERATOR_DEFAULT_VARIANTS = 3;
const PROMPT_GENERATOR_STATUS_TIMEOUT_MS = 3200;

const PROMPT_GENERATOR_LYRICS_ENABLED_TYPES = new Set(['t2a', 't2m']);
const PROMPT_GENERATOR_LYRICS_LANGUAGE_OPTIONS = ['ja', 'en'];
const PROMPT_GENERATOR_LYRICS_KEYWORD_LIMIT = 8;
const PROMPT_GENERATOR_LYRICS_CHAR_MIN = 60;
const PROMPT_GENERATOR_LYRICS_CHAR_MAX = 1600;
const PROMPT_GENERATOR_LYRICS_KEYWORDS_MAX_LENGTH = 240;
const PROMPT_GENERATOR_LYRICS_STRUCTURE_MAX_LENGTH = 360;
const PROMPT_GENERATOR_LYRICS_SECTION_LIMIT = 12;
const PROMPT_GENERATOR_LYRICS_DEFAULTS = {
  enabled: false,
  structure: '[Intro]\n[Verse 1]\n[Pre-Chorus]\n[Chorus]\n[Verse 2]\n[Bridge]\n[Outro]',
  charTarget: 240,
  language: 'ja',
  includeSectionLabels: true,
  keywords: ''
};
const PROMPT_GENERATOR_LYRICS_LEGACY_MAP = {
  verse_chorus: '[Intro]\n[Verse 1]\n[Chorus]\n[Verse 2]\n[Chorus]',
  verse_chorus_bridge: '[Intro]\n[Verse 1]\n[Chorus]\n[Verse 2]\n[Bridge]\n[Chorus]',
  verse_chorus_outro: '[Intro]\n[Verse 1]\n[Chorus]\n[Verse 2]\n[Chorus]\n[Outro]',
  verse_chorus_bridge_outro: '[Intro]\n[Verse 1]\n[Chorus]\n[Verse 2]\n[Bridge]\n[Chorus]\n[Outro]',
  verse_only: '[Intro]\n[Verse 1]\n[Verse 2]\n[Verse 3]'
};

const PROMPT_GENERATOR_SOUND_TEXT_ENABLED_TYPES = new Set(['t2s', 'tts']);
const PROMPT_GENERATOR_SOUND_TEXT_AUTO_TYPES = new Set(['t2s', 'tts']);
const PROMPT_GENERATOR_SOUND_TEXT_CHAR_MIN = 40;
const PROMPT_GENERATOR_SOUND_TEXT_CHAR_MAX = 800;
const PROMPT_GENERATOR_SOUND_TEXT_KEYWORDS_MAX_LENGTH = 200;
const PROMPT_GENERATOR_SOUND_TEXT_NOTES_MAX_LENGTH = 360;
const PROMPT_GENERATOR_SOUND_TEXT_KEYWORD_LIMIT = 10;
const PROMPT_GENERATOR_SOUND_TEXT_DEFAULTS = {
  enabled: false,
  charTarget: 180,
  language: 'ja',
  keywords: '',
  notes: ''
};

const PROMPT_KEY_EXCLUDE_TOKENS = new Set(['negative', 'anti', 'avoid']);

const PROMPT_GENERATOR_CATEGORY_OPTIONS = [
  { id: ALL_CATEGORY_ID, label: ALL_CATEGORY_LABEL },
  ...CATEGORY_DEFINITIONS.map((def) => ({ id: def.id, label: def.label }))
];

const PROMPT_GENERATOR_TYPE_OPTIONS = (() => {
  const seen = new Set();
  const options = [];
  CATEGORY_DEFINITIONS.forEach((def) => {
    def.prefixes.forEach((prefix) => {
      const normalized = normalizeTypeToken(prefix);
      if (!normalized || seen.has(normalized)) return;
      options.push({
        id: normalized,
        label: prefix.toUpperCase(),
        category: def.id
      });
      seen.add(normalized);
    });
  });
  if (!seen.has('other')) {
    options.push({ id: 'other', label: 'OTHER', category: 'other' });
    seen.add('other');
  }
  options.sort((a, b) => a.id.localeCompare(b.id));
  return options;
})();

function buildGuidanceModes({ enhanceEn, enhanceJa, expandEn, expandJa }) {
  const enhancePack = {
    en: enhanceEn,
    ja: enhanceJa
  };
  const expandPack = {
    en: expandEn || enhanceEn,
    ja: expandJa || enhanceJa
  };
  return {
    enhance: enhancePack,
    expand: expandPack
  };
}

const PROMPT_GENERATOR_GUIDANCE_BY_TYPE = new Map([
  ['t2i', buildGuidanceModes({
    enhanceEn: 'Text-to-image enhancement. Describe composition, key subjects, camera or lens choices, lighting, colour palette, materials, and mood in precise English detail. Avoid negative prompt syntax and keep instructions affirmative.',
    enhanceJa: '静止画のクオリティを高める。構図・主要被写体・レンズやカメラ設定・照明・色調・質感・空気感を英語できめ細かく記述し、ネガティブな文法は使わない。',
    expandEn: 'Text-to-image exploration. Produce conceptually diverse prompts that reinterpret the base idea across different genres, perspectives, compositions, and lighting setups. Each prompt should feel distinct yet relevant.',
    expandJa: '静止画の水平展開。ベースのテーマを保ちながら、ジャンル・視点・構図・照明・表現手法を変えて印象の異なる案を提示する。各案は関連性を保ちつつ明確に差別化する。'
  })],
  ['i2i', buildGuidanceModes({
    enhanceEn: 'Image-to-image enhancement. Respect the source image while clearly stating the exact elements to refine: structure, style, colours, materials, lighting, and post-processing.',
    enhanceJa: '入力画像を活かしながら強化。輪郭・スタイル・色調・素材・ライティング・後処理など、調整したい要素を具体的に指示する。',
    expandEn: 'Image-to-image exploration. Suggest multiple creative reinterpretations of the source, experimenting with new art directions, moods, materials, or storytelling angles while keeping key identities recognisable.',
    expandJa: '入力画像の水平展開。雰囲気や質感、ストーリーの切り口を変えた複数案を示し、元の特徴を保ちながら大胆に発想を広げる。'
  })],
  ['t2v', buildGuidanceModes({
    enhanceEn: 'Text-to-video enhancement. Specify scene structure, camera movements, pacing, transitions, lighting design, materials, duration, and emotional tone with cinematic precision.',
    enhanceJa: 'テキストから映像を詳細化。シーン構成、カメラワーク、テンポ、カット間の繋ぎ、照明、質感、尺、感情の流れを映画的に描写する。',
    expandEn: 'Text-to-video exploration. Propose several distinct video directions that reinterpret the idea with different genres, visual languages, camera strategies, and pacing structures.',
    expandJa: 'テキストから映像を水平展開。ジャンルや映像言語、カメラ手法、テンポ構成を変え、コンセプトを別視点で表現する複数案を用意する。'
  })],
  ['i2v', buildGuidanceModes({
    enhanceEn: 'Image/keyframe to video enhancement. Detail the narrative between start and end visuals, transitional moments, motion arcs, lighting evolution, and atmosphere continuity.',
    enhanceJa: 'キーイメージから映像を強化。開始と終了の意図、トランジション、モーションの流れ、ライティング変化、空気感の継続性を具体化する。',
    expandEn: 'Image/keyframe to video exploration. Present alternative motion paths, storytelling beats, camera journeys, and lighting moods that reinterpret how the start/end imagery develops.',
    expandJa: 'キーイメージを基点に水平展開。モーションルートやストーリー展開、カメラの移動、光の設計を変えて多面的なバリエーションを示す。'
  })],
  ['v2v', buildGuidanceModes({
    enhanceEn: 'Video-to-video enhancement. Capture notable traits of the source while defining target style, effects, compositing layers, motion adjustments, and colour grading.',
    enhanceJa: '既存動画を高品質化。元の特徴を押さえつつ、狙うスタイル、エフェクト、合成レイヤー、モーション調整、カラーグレーディングを設計する。',
    expandEn: 'Video-to-video exploration. Outline contrasting reinterpretations of the footage—different genres, visual treatments, motion energy, and editing rhythms—to broaden creative directions.',
    expandJa: '既存動画を水平展開。ジャンルや演出、動きの熱量、編集リズムを変化させ、複数のビジュアル方向性を提案する。'
  })],
  ['r2v', buildGuidanceModes({
    enhanceEn: 'Reference-driven video enhancement. List the qualities to inherit from references, specify cinematic goals, motion design, and differentiation points between generated options.',
    enhanceJa: '参照駆動の映像を強化。参照から継承する質感を列挙し、映像の狙い、モーション設計、各案の差別化ポイントを明示する。',
    expandEn: 'Reference-driven video exploration. Combine references in novel ways, proposing distinct narrative arcs, compositions, lighting schemes, and pacing variations for each candidate.',
    expandJa: '参照駆動の水平展開。複数の参照を組み合わせつつ、物語の展開、構図、照明、テンポを変えた代替案を提示する。'
  })],
  ['s2v', buildGuidanceModes({
    enhanceEn: 'Sound-to-video enhancement. Sync visual beats to audio structure, defining scene choreography, rhythm, palette, lighting, and energy shifts in detail.',
    enhanceJa: '音声起点の映像を強化。音の展開に合わせたシーン構成、リズム、カラーパレット、照明、エネルギー変化を詳細に指示する。',
    expandEn: 'Sound-to-video exploration. Offer varied visual narratives that interpret the audio through different genres, tempos, visual motifs, and pacing strategies.',
    expandJa: '音声起点の水平展開。音源を別ジャンル・テンポ・モチーフで解釈し、複数の映像ストーリーラインを提示する。'
  })],
  ['a2v', buildGuidanceModes({
    enhanceEn: 'Audio-to-video enhancement. Align tempo, beat, and mood with clear visual motifs, colour design, motion style, transition timing, and finishing touches.',
    enhanceJa: '音声ベースの映像を強化。テンポやビートに対応するモチーフ、色設計、モーションスタイル、トランジションのタイミングを明確化する。',
    expandEn: 'Audio-to-video exploration. Produce contrasting visual treatments of the same audio by altering genre, motif, camera grammar, pacing, and climax expression.',
    expandJa: '音声ベースの水平展開。同じ音源をジャンル・モチーフ・カメラ文法・テンポ・クライマックスの見せ方で差別化した複数案を作る。'
  })],
  ['i2i3d', buildGuidanceModes({
    enhanceEn: 'Image-to-3D enhancement. Detail geometry, proportions, materials, surface detail, topology, usage context, and lighting rig requirements.',
    enhanceJa: '画像から3D化を強化。形状・プロポーション・マテリアル・ディテール密度・トポロジー・用途・ライティング条件を具体的に示す。',
    expandEn: 'Image-to-3D exploration. Suggest multiple 3D interpretations—alternative forms, scales, material treatments, and lighting moods—derived from the source concept.',
    expandJa: '画像から3Dを水平展開。形状やスケール、質感、ライトセットを変えた複数の立体化アプローチを提案する。'
  })],
  ['t2a', buildGuidanceModes({
    enhanceEn: 'Text-to-audio enhancement. Define tempo, time signature, genre, instrumentation, melodic/harmonic direction, mix, and production details.',
    enhanceJa: 'テキストから音を強化。テンポ、拍子、ジャンル、編成、メロディー/ハーモニーの方向性、ミックスや処理を明記する。',
    expandEn: 'Text-to-audio exploration. Provide divergent musical concepts covering distinct genres, rhythms, instrumentations, and emotional palettes derived from the theme.',
    expandJa: 'テキスト音声の水平展開。テーマを元にジャンル・リズム・編成・感情表現を変えた複数の楽曲案を提案する。'
  })],
  ['t2s', buildGuidanceModes({
    enhanceEn: 'Text-to-singing/expressive speech enhancement. Specify character identity, emotional tone, articulation, rhythm, accent, dynamics, and performance nuances.',
    enhanceJa: '歌声・音声合成を強化。キャラクター性、感情、発音スタイル、リズム、アクセント、ダイナミクス、ニュアンスを詳細に記述する。',
    expandEn: 'Text-to-singing exploration. Imagine distinct vocal interpretations—different personas, emotions, delivery styles, and production treatments—for comparative options.',
    expandJa: '歌声・音声の水平展開。人物像や感情、発声スタイル、音響処理を変えた複数のボーカル案を生成する。'
  })],
  ['tts', buildGuidanceModes({
    enhanceEn: 'Text-to-speech enhancement. Describe precise voice timbre, speed, intonation contour, emotional cues, enunciation, and pacing adjustments.',
    enhanceJa: '音声読み上げを強化。声質、スピード、イントネーション、感情表現、発音、間の取り方を具体的に定義する。',
    expandEn: 'Text-to-speech exploration. Offer contrasting voice personas—different timbres, energy levels, accents, and speaking styles—suited to the goal.',
    expandJa: '音声読み上げの水平展開。目的に合わせ、声質・エネルギー・アクセント・話し方の異なる複数のナレーション案を提示する。'
  })],
  ['t2m', buildGuidanceModes({
    enhanceEn: 'Text-to-music or SFX enhancement. Outline structure, tempo, instrumentation, texture, mood, and sonic embellishments with production notes.',
    enhanceJa: '音楽/効果音を強化。構成、テンポ、使用音源、質感、ムード、音響処理や装飾を詳細に書き込む。',
    expandEn: 'Text-to-music exploration. Generate varied sound concepts—alternate tempos, instrument sets, rhythmic patterns, and emotional arcs for the scenario.',
    expandJa: '音楽/効果音の水平展開。テンポや編成、リズム、感情曲線を変えた複数のサウンド案を提案する。'
  })],
  ['v2a', buildGuidanceModes({
    enhanceEn: 'Video-to-audio enhancement. Detail ambience, foley, musical cues, timing, layering, and spatial design synced to visual transitions.',
    enhanceJa: '映像から音を強化。環境音、フォーリー、音楽キュー、タイミング、レイヤー構成、空間演出を映像の変化と同期させて指示する。',
    expandEn: 'Video-to-audio exploration. Suggest alternate soundtracks—changing mood, instrumentation, spatial depth, and pacing—to reinterpret the same visuals.',
    expandJa: '映像音声の水平展開。同じ映像に異なるムードや編成、空間感、テンポを持たせたサウンドデザイン案を複数提示する。'
  })],
  ['v2sfx', buildGuidanceModes({
    enhanceEn: 'Video sound-effects enhancement. Enumerate actions needing sound, specify texture, distance, reverb, layering, and mix balance precisely.',
    enhanceJa: '映像効果音を強化。効果音が必要なアクションを洗い出し、質感・距離感・残響・レイヤー構成・ミックスのバランスを詳細に示す。',
    expandEn: 'Video sound-effects exploration. Provide creative alternates—stylised, realistic, exaggerated, or minimal treatments—for the same sequence.',
    expandJa: '映像効果音の水平展開。同じシーンに対し、写実的・誇張・スタイライズなど異なる演出方針の効果音案を提案する。'
  })],
  ['t2visual', buildGuidanceModes({
    enhanceEn: 'Text-to-visual-document enhancement. Define purpose, layout, hierarchy, colour system, annotation depth, typography, and export requirements.',
    enhanceJa: 'ビジュアル資料を強化。目的、レイアウト、情報階層、配色、注釈レベル、タイポグラフィ、書き出し仕様を明文化する。',
    expandEn: 'Text-to-visual-document exploration. Suggest multiple presentation angles—different structures, story flows, visual metaphors, and palette systems.',
    expandJa: 'ビジュアル資料の水平展開。構成やストーリー展開、ビジュアルメタファー、配色体系を変えた複数の案を提案する。'
  })],
  ['misc', buildGuidanceModes({
    enhanceEn: 'Other modalities enhancement. Clarify objectives, target style, constraints, expected output format, and measurable success criteria.',
    enhanceJa: 'その他用途の強化。目的、スタイル、制約、期待する出力形式、成功指標を明確に記述する。',
    expandEn: 'Other modalities exploration. Produce alternative takes that reinterpret the goal with different styles, audiences, or delivery formats.',
    expandJa: 'その他用途の水平展開。スタイルやターゲット、提供形式を変えて複数の方向性を打ち出す。'
  })],
  ['train', buildGuidanceModes({
    enhanceEn: 'Training/fine-tuning enhancement. Summarise objectives, data traits, attributes to emphasise, evaluation metrics, risks, and constraints.',
    enhanceJa: '学習・ファインチューニングの強化。目的、データ特性、重視する属性、評価指標、リスク、制約を整理する。',
    expandEn: 'Training/fine-tuning exploration. Suggest varied dataset focuses, augmentation ideas, and evaluation strategies to approach the goal differently.',
    expandJa: '学習・ファインチューニングの水平展開。データ強調点や拡張案、評価戦略を変えた複数アプローチを提示する。'
  })],
  ['file', buildGuidanceModes({
    enhanceEn: 'File utility enhancement. Document input/output formats, quality requirements, edge cases, validation steps, and safety considerations.',
    enhanceJa: 'ファイル/ユーティリティ処理を強化。入出力仕様、品質要件、例外ケース、検証手順、安全面の注意をまとめる。',
    expandEn: 'File utility exploration. Offer different workflows or automation ideas addressing the same task from multiple technical angles.',
    expandJa: 'ファイル/ユーティリティ処理の水平展開。同じ課題に対し、異なるワークフローや自動化パターンを提案する。'
  })]
]);

const PROMPT_GENERATOR_GUIDANCE_BY_CATEGORY = new Map([
  ['image', buildGuidanceModes({
    enhanceEn: 'Image generation enhancement. Describe subjects, composition, materials, colour palette, lighting, and lens/render settings in clear English; keep directives affirmative.',
    enhanceJa: '画像生成の強化。被写体、構図、質感、配色、光源、レンズ/レンダー条件を英語で明確に指示し、肯定的な表現でまとめる。',
    expandEn: 'Image generation exploration. Provide alternative visual directions varying in genre, medium, atmosphere, camera language, and lighting concepts.',
    expandJa: '画像生成の水平展開。ジャンルや画材、空気感、カメラ表現、ライティング発想を変えた別方向の案を作る。'
  })],
  ['video', buildGuidanceModes({
    enhanceEn: 'Video generation enhancement. Detail multi-cut structure, camera work, motion style, timing, lighting, and stylistic goals.',
    enhanceJa: '映像生成の強化。カット構成、カメラワーク、モーション、タイミング、照明、スタイルを具体化する。',
    expandEn: 'Video generation exploration. Suggest contrasted story flows, cinematic genres, motion energies, and editing rhythms for the concept.',
    expandJa: '映像生成の水平展開。ストーリーの流れや映画ジャンル、動きの熱量、編集リズムを変えた代替案を出す。'
  })],
  ['sound', buildGuidanceModes({
    enhanceEn: 'Sound generation enhancement. Specify tempo, groove, genre, instrumentation, mood, layer mix, and audio processing details.',
    enhanceJa: 'サウンド生成の強化。テンポ、グルーヴ、ジャンル、編成、ムード、レイヤー構成、音響処理を明確化する。',
    expandEn: 'Sound generation exploration. Offer different sonic directions—genres, rhythms, textures, and emotional arcs—for the same brief.',
    expandJa: 'サウンド生成の水平展開。同じ要件を様々なジャンル・リズム・質感・感情曲線で表現する案を提示する。'
  })],
  ['3d', buildGuidanceModes({
    enhanceEn: '3D asset enhancement. Define geometry, scale, materials, detail level, intended use, and lighting conditions.',
    enhanceJa: '3Dアセットの強化。形状、スケール、マテリアル、ディテール密度、用途、照明条件を詳細に記す。',
    expandEn: '3D asset exploration. Present alternative forms, proportions, materials, and lighting rigs that reinterpret the concept.',
    expandJa: '3Dアセットの水平展開。形状やプロポーション、質感、ライトセットを変えた多彩な案を提供する。'
  })],
  ['other', buildGuidanceModes({
    enhanceEn: 'Other modalities enhancement. Clarify purpose, desired style, constraints, output format, and evaluation criteria.',
    enhanceJa: 'その他の成果物を強化。目的、スタイル、制約、出力形式、評価指標を明確化する。',
    expandEn: 'Other modalities exploration. Devise alternative routes that reposition the goal for different audiences, styles, or delivery media.',
    expandJa: 'その他の成果物を水平展開。ターゲットやスタイル、提供メディアを変えた別案を企画する。'
  })]
]);

const PROMPT_GENERATOR_VARIANT_OPTIONS = Array.from({ length: PROMPT_GENERATOR_MAX_SUGGESTIONS }, (_, index) => index + 1);
const PROMPT_GENERATOR_FLOAT_MARGIN = 16;
const PROMPT_GENERATOR_FLOAT_OFFSET = 12;

const PROMPT_GENERATOR_TYPE_CATEGORY_MAP = (() => {
  const map = new Map();
  PROMPT_GENERATOR_TYPE_OPTIONS.forEach((option) => {
    map.set(option.id, option.category);
  });
  map.set('other', 'other');
  return map;
})();

function normalizeGuidancePack(entry, { mode = PROMPT_GENERATOR_DEFAULT_MODE } = {}) {
  if (!entry) return null;
  if (typeof entry === 'string') {
    const trimmed = entry.trim();
    if (!trimmed) return null;
    return { en: trimmed, ja: trimmed };
  }
  if (entry && typeof entry === 'object') {
    const en = typeof entry.en === 'string' && entry.en.trim() ? entry.en.trim() : '';
    const ja = typeof entry.ja === 'string' && entry.ja.trim() ? entry.ja.trim() : '';
    if (en || ja) {
      return {
        en: en || ja,
        ja: ja || en
      };
    }
    const normalizedMode = normalizePromptGeneratorMode(mode);
    const nested = entry[normalizedMode] || entry.default || entry.enhance || entry.expand;
    if (nested && nested !== entry) {
      return normalizeGuidancePack(nested, { mode: normalizedMode });
    }
  }
  return null;
}

function getDefaultPromptGeneratorGuidancePack(type, category, mode = PROMPT_GENERATOR_DEFAULT_MODE) {
  const normalizedType = normalizeTypeToken(type);
  if (normalizedType && PROMPT_GENERATOR_GUIDANCE_BY_TYPE.has(normalizedType)) {
    const pack = normalizeGuidancePack(PROMPT_GENERATOR_GUIDANCE_BY_TYPE.get(normalizedType), { mode });
    if (pack) return pack;
  }
  const inferredCategory = normalizeCategory(
    category
      || (normalizedType ? PROMPT_GENERATOR_TYPE_CATEGORY_MAP.get(normalizedType) : '')
      || DEFAULT_ACTIVE_CATEGORY
  );
  if (PROMPT_GENERATOR_GUIDANCE_BY_CATEGORY.has(inferredCategory)) {
    const pack = normalizeGuidancePack(PROMPT_GENERATOR_GUIDANCE_BY_CATEGORY.get(inferredCategory), { mode });
    if (pack) return pack;
  }
  return {
    en: 'Provide detailed instructions about the goal, preferred style, constraints, and desired outputs.',
    ja: '生成したい内容の目的、スタイル、制約、期待する出力を具体的に記述してください。'
  };
}

const MEDIA_PARAM_KEYWORDS = {
  image: new Set([
    'image', 'images', 'img', 'picture', 'photo', 'thumbnail', 'thumb',
    'reference_image', 'input_image', 'init_image', 'mask', 'background', 'texture', 'screenshot'
  ]),
  video: new Set([
    'video', 'videos', 'clip', 'clips', 'movie', 'movies', 'animation', 'footage', 'sequence', 'trailer', 'replay'
  ]),
  sound: new Set([
    'audio', 'audios', 'sound', 'sounds', 'voice', 'voices', 'speech', 'music', 'sfx', 'fx', 'track', 'tracks', 'song', 'songs', 'vocals'
  ])
};

const MEDIA_PARAM_STRONG_TOKENS = {
  image: new Set(['mask', 'masks', 'background', 'texture', 'screenshot', 'thumbnail', 'thumb', 'reference', 'sprite', 'input', 'init']),
  video: new Set(['clip', 'clips', 'movie', 'movies', 'animation', 'footage', 'sequence', 'trailer', 'replay']),
  sound: new Set(['track', 'tracks', 'song', 'songs', 'audio', 'sound', 'voice', 'voices', 'music']),
  '3d': new Set(['mesh', 'meshes', 'model', 'models', 'geometry', 'pointcloud'])
};

const MEDIA_PARAM_SIZE_TOKENS = new Set([
  'size', 'sizes', 'resolution', 'resolutions', 'dimension', 'dimensions', 'width', 'height'
]);

const MEDIA_PARAM_EXCLUDE_TOKENS = new Set([
  'prompt', 'prompts', 'caption', 'captions', 'text', 'texts', 'script', 'scripts',
  'language', 'languages', 'output', 'outputs', 'style', 'styles', 'quality', 'qualities',
  'mode', 'modes', 'speed', 'speeds', 'name', 'names', 'title', 'titles', 'temperature', 'temperatures'
]);

const MEDIA_PARAM_CONFIG_TOKENS = new Set([
  'format', 'formats', 'option', 'options', 'choice', 'choices', 'preset', 'presets',
  'variant', 'variants', 'setting', 'settings', 'config', 'configs'
]);

function detectPreviewable3dExtension(entry) {
  if (!entry) return '';
  const candidates = [];
  if (typeof entry === 'string') {
    candidates.push(entry);
  } else if (typeof entry === 'object') {
    if (entry.fileName) candidates.push(entry.fileName);
    if (entry.filename) candidates.push(entry.filename);
    if (entry.path) candidates.push(entry.path);
    if (entry.url) candidates.push(entry.url);
    if (entry.imageUrl) candidates.push(entry.imageUrl);
    if (entry.webPath) candidates.push(entry.webPath);
  }
  for (const candidate of candidates) {
    const ext = extractFileExtension(candidate);
    if (ext && PREVIEWABLE_3D_EXTENSIONS.has(ext)) {
      return ext;
    }
  }
  return '';
}

function isPreviewable3dEntry(entry) {
  if (!entry) return false;
  if (entry.filterType && entry.filterType !== '3d') {
    // filterType is authoritative when populated
    if (entry.filterType === 'other') {
      return Boolean(detectPreviewable3dExtension(entry));
    }
    return false;
  }
  return Boolean(detectPreviewable3dExtension(entry));
}

function resolveHistory3dThumbnail(entry, result) {
  const candidates = [];
  const pushCandidate = (value) => {
    if (!value && value !== 0) return;
    const normalized = normalizeShowcaseAssetUrl(value);
    if (!normalized) return;
    const token = normalized.split('?')[0].split('#')[0];
    if (!token || token.lastIndexOf('.') === -1) return;
    const ext = token.slice(token.lastIndexOf('.') + 1).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(ext)) return;
    if (!candidates.includes(normalized)) {
      candidates.push(normalized);
    }
  };

  pushCandidate(result?.thumbnailUrl);
  pushCandidate(result?.previewUrl);

  const results = Array.isArray(entry?.results) ? entry.results : [];
  if (results.length) {
    const targetRequest = (result?.requestId || '').trim();
    const targetEngine = (result?.engineId || '').trim();
    const targetPrefix = (result?.filePrefix || result?.savedFile?.prefix || '').trim().toLowerCase();
    results.forEach((item) => {
      if (!item || item === result) return;
      const candidateUrl = item.imageUrl || '';
      if (!candidateUrl) return;
      const mediaType = resolveMediaEntryType({
        filterType: item.filterType || item.type || '',
        type: item.type || '',
        url: candidateUrl,
        path: item.fileName || ''
      });
      if (mediaType !== 'image') return;
      const sameRequest = targetRequest && item.requestId && item.requestId === targetRequest;
      const sameEngine = targetEngine && item.engineId && item.engineId === targetEngine;
      const candidatePrefix = (item.filePrefix || item.savedFile?.prefix || '').trim().toLowerCase();
      const samePrefix = targetPrefix && candidatePrefix && candidatePrefix === targetPrefix;
      if (!(sameRequest || sameEngine || samePrefix)) return;
      pushCandidate(candidateUrl);
    });
  }

  return candidates[0] || '';
}

function ensureModelViewerReady() {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.customElements && window.customElements.get('model-viewer')) {
    return Promise.resolve(true);
  }
  if (modelViewerLoadPromise) {
    return modelViewerLoadPromise;
  }
  const existing = document.querySelector(`script[${MODEL_VIEWER_SCRIPT_ATTR}]`);
  if (existing) {
    modelViewerLoadPromise = new Promise((resolve) => {
      if (existing.dataset.loaded === 'true') {
        resolve(Boolean(window.customElements?.get('model-viewer')));
        return;
      }
      existing.addEventListener('load', () => {
        existing.dataset.loaded = 'true';
        resolve(Boolean(window.customElements?.get('model-viewer')));
      }, { once: true });
      existing.addEventListener('error', () => {
        resolve(false);
      }, { once: true });
    });
    return modelViewerLoadPromise;
  }
  modelViewerLoadPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = MODEL_VIEWER_MODULE_URL;
    script.crossOrigin = 'anonymous';
    script.setAttribute(MODEL_VIEWER_SCRIPT_ATTR, 'true');
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve(Boolean(window.customElements?.get('model-viewer')));
    }, { once: true });
    script.addEventListener('error', (err) => {
      console.error('[Showcase] model-viewer script load failed', err);
      resolve(false);
    }, { once: true });
    document.head.appendChild(script);
  });
  return modelViewerLoadPromise;
}

function createModelViewerElement(src, { alt = '3D preview', variant = 'card' } = {}) {
  const viewer = document.createElement('model-viewer');
  viewer.src = src;
  viewer.alt = alt || '3D preview';
  viewer.setAttribute('shadow-intensity', '0.6');
  viewer.setAttribute('camera-controls', '');
  viewer.setAttribute('auto-rotate', '');
  viewer.setAttribute('interaction-prompt', 'none');
  viewer.setAttribute('touch-action', 'none');
  viewer.setAttribute('exposure', '1');
  if (variant === 'card') {
    viewer.className = 'kc-result-card__model';
    viewer.setAttribute('disable-zoom', '');
  } else if (variant === 'lightbox') {
    viewer.className = 'kc-lightbox__model';
    viewer.removeAttribute('disable-zoom');
  } else if (variant === 'history') {
    viewer.className = 'kc-history-card__model';
    viewer.setAttribute('disable-zoom', '');
  } else if (variant === 'input') {
    viewer.className = 'irs-source-card__model';
    viewer.setAttribute('disable-zoom', '');
  } else if (variant === 'modal') {
    viewer.className = 'kc-results-modal__model';
  }
  return viewer;
}

function render3dDownloadMessage(container, url, variant = 'card') {
  const message = document.createElement('div');
  let className = 'kc-result-card__placeholder';
  if (variant === 'history') {
    className = 'kc-history-card__placeholder';
  } else if (variant === 'lightbox') {
    className = 'kc-lightbox__message';
  } else if (variant === 'modal') {
    className = 'kc-result-card__placeholder';
  } else if (variant === 'input') {
    className = 'irs-source-card__placeholder';
  }
  message.className = `${className} kc-placeholder--3d-download`;
  const line = document.createElement('span');
  line.textContent = '3Dプレビューに未対応のファイルです。';
  const br = document.createElement('br');
  const link = document.createElement('a');
  link.href = url;
  link.textContent = 'ダウンロード';
  link.setAttribute('download', '');
  message.innerHTML = '';
  message.append(line, br, link, document.createTextNode(' してご確認ください。'));
  container.classList.add('is-3d');
  container.classList.remove('kc-3d-host');
  container.innerHTML = '';
  container.append(message);
}

function mount3dPreview(container, { src, alt, variant = 'card' } = {}) {
  if (!container || !src) return;
  container.classList.add('is-3d', 'kc-3d-host');
  container.innerHTML = '';
  const placeholder = document.createElement('div');
  if (variant === 'history') {
    placeholder.className = 'kc-history-card__placeholder';
  } else if (variant === 'lightbox') {
    placeholder.className = 'kc-lightbox__message';
  } else if (variant === 'modal') {
    placeholder.className = 'kc-result-card__placeholder';
  } else if (variant === 'input') {
    placeholder.className = 'irs-source-card__placeholder';
  } else {
    placeholder.className = 'kc-result-card__placeholder';
  }
  placeholder.textContent = '3Dプレビューを読み込み中...';
  container.append(placeholder);
  ensureModelViewerReady().then((ready) => {
    if (!container.isConnected) return;
    if (!ready) {
      render3dDownloadMessage(container, src, variant);
      return;
    }
    const viewer = createModelViewerElement(src, { alt, variant });
    viewer.classList.add('kc-model-viewer');
    viewer.style.width = '100%';
    viewer.style.height = '100%';
    viewer.style.minWidth = '0';
    viewer.style.minHeight = '0';
    const dismissPoster = () => {
      if (typeof viewer.dismissPoster === 'function') {
        try {
          viewer.dismissPoster();
        } catch (err) {
          // ignore poster dismissal failures
        }
      }
    };
    const markReady = () => {
      viewer.classList.add('is-ready');
      dismissPoster();
    };
    viewer.addEventListener('load', markReady, { once: true });
    viewer.addEventListener('model-visibility', (event) => {
      if (event?.detail?.visible) {
        markReady();
      }
    });
    viewer.addEventListener('error', () => {
      viewer.classList.remove('is-ready');
    });
    container.innerHTML = '';
    container.append(viewer);
    requestAnimationFrame(() => {
      dismissPoster();
    });
  }).catch((err) => {
    console.error('[Showcase] model-viewer init error', err);
    if (!container.isConnected) return;
    render3dDownloadMessage(container, src, variant);
  });
}

const DOC_URL_OVERRIDES = Object.freeze({});

const ENGINE_PARAMETER_OPTION_HINTS = Object.freeze({
  't2v-kamui-kling-video-v25-turbo-pro': {
    duration: {
      options: [
        { value: '5', label: '5 秒' },
        { value: '10', label: '10 秒' }
      ]
    },
    aspect_ratio: {
      options: [
        { value: '16:9', label: '16:9 (横長)' },
        { value: '9:16', label: '9:16 (縦長)' },
        { value: '1:1', label: '1:1 (正方形)' }
      ]
    }
  },
  'a2v-kamui-veed-fabric-1-0': {
    resolution: {
      options: [
        { value: '480p', label: '480p' },
        { value: '720p', label: '720p' }
      ],
      default: '480p'
    }
  },
  'i2i3d-kamui-tripo3d-image-to-3d': {
    style: {
      options: [
        { value: 'default', label: 'Default' }
      ],
      default: 'default'
    }
  }
});

const ENGINE_PARAMETER_REQUIRED_HINTS = Object.freeze({
  'v2v-kamui-hunyuan-video-foley': ['text_prompt']
});

const ENGINE_PARAMETER_OPTION_SUPPRESS = Object.freeze({
  'v2v-kamui-hunyuan-video-foley': new Set(['text_prompt'])
});

const DOC_METADATA_ENDPOINT = '/data/kamui-code/doc-metadata.json';

const MEDIA_PARAM_ID_TOKENS = new Set(['id', 'ids', 'identifier', 'identifiers']);

const MEDIA_PARAM_INDICATOR_TOKENS = new Set([
  'url', 'urls', 'uri', 'uris', 'href', 'hrefs', 'path', 'paths', 'file', 'files',
  'filename', 'filenames', 'asset', 'assets', 'source', 'sources', 'clip', 'clips',
  'track', 'tracks', 'thumbnail', 'thumbnails', 'thumb', 'thumbs',
  'mask', 'masks', 'base64', 'data', 'payload', 'attachment', 'attachments',
  '3d', 'mesh', 'meshes'
]);

const MEDIA_PARAM_LOCATOR_TOKENS = new Set([
  'url', 'urls', 'uri', 'uris', 'href', 'hrefs', 'path', 'paths'
]);

const MEDIA_PARAM_BADGE_EXCLUDE_TOKENS = new Set([
  'prompt', 'prompts', 'caption', 'captions', 'text', 'texts', 'language', 'languages',
  'output', 'outputs', 'script', 'scripts', 'subtitle', 'subtitles', 'transcript', 'transcripts',
  'default', 'defaults', 'title', 'titles', 'name', 'names', 'description', 'descriptions',
  'tone', 'tones', 'style', 'styles'
]);

const MEDIA_TYPE_DISPLAY = {
  image: { label: 'IMAGE' },
  video: { label: 'VIDEO' },
  sound: { label: 'SOUND' },
  '3d': { label: '3D' },
  other: { label: 'OTHER' }
};

const MEDIA_SLOT_START_TOKENS = Object.freeze([
  'start',
  'first',
  'initial',
  'begin',
  'source',
  'input',
  'intro',
  'init'
]);

const MEDIA_SLOT_END_TOKENS = Object.freeze([
  'end',
  'ending',
  'last',
  'final',
  'target',
  'destination',
  'dest',
  'output',
  'outro'
]);

function normalizeMediaGroupType(rawType) {
  if (!rawType && rawType !== 0) return 'other';
  const value = String(rawType).trim().toLowerCase();
  if (!value) return 'other';
  if (value === 'audio') return 'sound';
  if (MEDIA_TYPE_DISPLAY[value]) return value;
  return 'other';
}

function tokenizeKey(key) {
  if (!key && key !== 0) return [];
  return String(key)
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);
}

function inferMediaTypeFromParameter(key, schema = {}) {
  if (!key) return '';
  const tokens = tokenizeKey(key);
  if (!tokens.length) return '';

  const tokenSet = new Set(tokens);
  if (tokens.some((token) => MEDIA_PARAM_SIZE_TOKENS.has(token))) {
    return '';
  }
  const hasExcludedToken = tokens.some((token) => MEDIA_PARAM_EXCLUDE_TOKENS.has(token));
  const hasIndicatorToken = tokens.some((token) => MEDIA_PARAM_INDICATOR_TOKENS.has(token));
  const hasIdOnly = tokens.some((token) => MEDIA_PARAM_ID_TOKENS.has(token)) && !hasIndicatorToken;

  if (hasIdOnly) {
    return '';
  }

  if ((tokenSet.has('prompt') || tokenSet.has('prompts') || tokenSet.has('caption') || tokenSet.has('captions')
    || tokenSet.has('language') || tokenSet.has('languages') || tokenSet.has('output') || tokenSet.has('outputs'))
    && !hasIndicatorToken) {
    return '';
  }

  const cleanedTokens = tokens.filter((token) => !MEDIA_PARAM_EXCLUDE_TOKENS.has(token));
  const cleanedSet = new Set(cleanedTokens);

  const directMatch = (type) => {
    const keywords = MEDIA_PARAM_KEYWORDS[type];
    if (!keywords) return false;
    return cleanedTokens.some((token) => keywords.has(token));
  };

  const matchesSound = directMatch('sound');
  const matchesVideo = directMatch('video');
  const matchesImage = directMatch('image');
  const hasConfigToken = tokens.some((token) => MEDIA_PARAM_CONFIG_TOKENS.has(token));
  const hasLocatorToken = tokens.some((token) => MEDIA_PARAM_LOCATOR_TOKENS.has(token));

  const has3dGeometryTokens = cleanedSet.has('3d') || cleanedSet.has('mesh') || cleanedSet.has('meshes');
  const hasModelGeometryTokens = cleanedSet.has('model') || cleanedSet.has('models') || cleanedSet.has('geometry');
  let inferred = '';
  let inferredByGeometry = false;
  if (matchesSound) {
    const hasSoundIndicator = tokenSet.has('audio') || tokenSet.has('sound') || tokenSet.has('music')
      || tokenSet.has('track') || tokenSet.has('tracks') || tokenSet.has('clip') || tokenSet.has('clips')
      || tokenSet.has('sample') || tokenSet.has('samples') || tokenSet.has('url') || tokenSet.has('file');
    inferred = hasSoundIndicator ? 'sound' : '';
  } else if (matchesVideo) {
    inferred = 'video';
  } else if (matchesImage) {
    inferred = 'image';
  } else if (has3dGeometryTokens || (hasModelGeometryTokens && hasIndicatorToken)) {
    inferred = '3d';
    inferredByGeometry = true;
  }

  const descriptorText = [
    String(schema.title || ''),
    String(schema.description || ''),
    String(schema.contentMediaType || ''),
    String(schema.format || '')
  ]
    .map((chunk) => chunk.toLowerCase())
    .join(' ');

  const pickFromDescriptor = (value) => {
    if (!value) return '';
    if (value.includes('video/')) return 'video';
    if (value.includes('image/')) return 'image';
    if (value.includes('audio/') || value.includes('sound/')) return 'sound';
    if (value.includes('model') || value.includes('mesh') || value.includes('3d')) return '3d';
    return '';
  };

  const contentType = String(schema.contentMediaType || schema.mediaType || '').toLowerCase();
  const format = String(schema.format || '').toLowerCase();

  const descriptorCandidate = pickFromDescriptor(contentType)
    || (format.includes('video') ? 'video' : '')
    || (format.includes('image') ? 'image' : '')
    || ((format.includes('audio') || format.includes('sound')) ? 'sound' : '')
    || ((format.includes('model') || format.includes('mesh') || format.includes('3d')) ? '3d' : '');

  const descriptorHasAssetCore = /(url|uri|href|path|upload|source|clip|clips|track|tracks|asset|base64|data|payload|attachment)/.test(descriptorText);
  const descriptorMentionsFile = descriptorText.includes('file');
  const descriptorImpliesUpload = /(upload|provide|supply|input)/.test(descriptorText);
  const descriptorHasAssetToken = descriptorHasAssetCore || (descriptorMentionsFile && descriptorImpliesUpload);
  const schemaImpliesLocator = Boolean(format && (format.includes('uri') || format.includes('url')));
  const schemaImplies3dAsset = Boolean(contentType && /(model|mesh|3d)/.test(contentType));
  const descriptorSupportsAsset = descriptorHasAssetToken || schemaImpliesLocator || schemaImplies3dAsset;

  if (!inferred) {
    inferred = descriptorCandidate;
  }

  if (inferred === 'sound' && !hasIndicatorToken) {
    const hasSoundDescriptor = /audio|sound|music|track/.test(descriptorText) || format.includes('audio') || format.includes('sound');
    const hasSoundToken = tokenSet.has('audio') || tokenSet.has('sound') || tokenSet.has('music')
      || tokenSet.has('track') || tokenSet.has('tracks') || tokenSet.has('clip') || tokenSet.has('clips');
    if (!hasSoundDescriptor && !hasSoundToken) {
      inferred = '';
    }
  }

  if (inferred && !hasIndicatorToken) {
    const strongTokens = MEDIA_PARAM_STRONG_TOKENS[inferred] || new Set();
    const hasStrongToken = cleanedTokens.some((token) => strongTokens.has(token));
    const descriptorImpliesAsset = descriptorSupportsAsset || descriptorCandidate === inferred;
    if (!hasStrongToken && !descriptorImpliesAsset) {
      inferred = '';
    }
  }

  if (inferred && hasExcludedToken && !hasIndicatorToken && (tokenSet.has('prompt') || tokenSet.has('caption'))) {
    inferred = '';
  }

  if (!inferred && hasIndicatorToken) {
    const matchByDescription = (type) => {
      const keywords = MEDIA_PARAM_KEYWORDS[type];
      if (!keywords) return false;
      return Array.from(keywords).some((keyword) => descriptorText.includes(keyword));
    };
    if (matchByDescription('video')) {
      inferred = 'video';
    } else if (matchByDescription('image')) {
      inferred = 'image';
    } else if (matchByDescription('sound')) {
      inferred = 'sound';
    } else if ((descriptorText.includes('model') || descriptorText.includes('mesh') || descriptorText.includes('3d'))
      && (hasLocatorToken || descriptorSupportsAsset || !hasConfigToken)) {
      inferred = '3d';
      inferredByGeometry = true;
    }
  }

  if (inferredByGeometry) {
    const hasAssetEvidence = hasLocatorToken || descriptorSupportsAsset || descriptorCandidate === '3d';
    if (!hasAssetEvidence || (hasConfigToken && !descriptorSupportsAsset && descriptorCandidate !== '3d')) {
      inferred = '';
    }
  }

  if (!inferred) return '';
  if (!MEDIA_INPUT_ALLOWED_TYPES.has(inferred)) return 'other';
  return inferred;
}

function detectPromptKeyFromProperties(properties) {
  if (!properties || typeof properties !== 'object') return '';
  if (Object.prototype.hasOwnProperty.call(properties, 'prompt')) {
    return 'prompt';
  }

  const keys = Object.keys(properties);
  for (const key of keys) {
    if (!key && key !== 0) continue;
    if (String(key).toLowerCase() === 'prompt') {
      return key;
    }
  }

  let bestCandidate = '';
  let bestScore = Number.POSITIVE_INFINITY;
  keys.forEach((key) => {
    if (!key && key !== 0) return;
    const tokens = tokenizeKey(key);
    if (!tokens.includes('prompt')) return;
    if (tokens.some((token) => PROMPT_KEY_EXCLUDE_TOKENS.has(token))) return;
    const score = tokens.length;
    if (score < bestScore) {
      bestCandidate = key;
      bestScore = score;
    }
  });

  return bestCandidate;
}

function analyzeEngineParameters(meta) {
  const result = {
    mediaParams: {
      image: [],
      video: [],
      sound: [],
      other: []
    },
    soundTextKeys: [],
    requiredSoundTextKeys: [],
    requiredMediaTypes: new Set(),
    promptKey: '',
    requiresPrompt: false,
    requiresSoundText: false
  };

  const submitParams = meta?.tools?.submit?.parameters;
  const props = submitParams?.properties || {};
  const requiredKeys = Array.isArray(submitParams?.required)
    ? new Set(submitParams.required.map((key) => String(key)))
    : new Set();

  const manualRequired = ENGINE_PARAMETER_REQUIRED_HINTS[meta?.id];
  if (Array.isArray(manualRequired)) {
    manualRequired.forEach((key) => {
      if (key || key === 0) {
        requiredKeys.add(String(key));
      }
    });
  }

  const soundKeys = new Set();
  const requiredSoundKeys = new Set();
  if (Array.isArray(meta?.soundTextKeys)) {
    meta.soundTextKeys.forEach((key) => {
      if (key || key === 0) {
        soundKeys.add(key);
      }
    });
  }
  if (Array.isArray(meta?.requiredSoundTextKeys)) {
    meta.requiredSoundTextKeys.forEach((key) => {
      if (key || key === 0) {
        soundKeys.add(key);
        requiredSoundKeys.add(key);
      }
    });
  }
  const promptKey = detectPromptKeyFromProperties(props);
  if (promptKey) {
    result.promptKey = promptKey;
    const lowerPromptKey = promptKey.toLowerCase();
    if (Array.isArray(submitParams?.required)) {
      const requires = submitParams.required.some(
        (key) => String(key).toLowerCase() === lowerPromptKey
      );
      if (requires) {
        result.requiresPrompt = true;
      }
    }
    if (!result.requiresPrompt && Array.isArray(manualRequired)) {
      const matchesManual = manualRequired.some(
        (key) => String(key).toLowerCase() === lowerPromptKey
      );
      if (matchesManual) {
        result.requiresPrompt = true;
      }
    }
    if (!result.requiresPrompt) {
      const promptSchema = props?.[promptKey];
      if (promptSchema && typeof promptSchema === 'object') {
        if (typeof promptSchema.minLength === 'number' && promptSchema.minLength > 0) {
          result.requiresPrompt = true;
        } else if (typeof promptSchema.minItems === 'number' && promptSchema.minItems > 0) {
          result.requiresPrompt = true;
        } else if (promptSchema.required === true) {
          result.requiresPrompt = true;
        }
      }
    }
  }

  Object.entries(props).forEach(([key, schema]) => {
    if (promptKey && key === promptKey) {
      return;
    }
    const normalizedKey = String(key).toLowerCase();
    if (SOUND_TEXT_PARAM_KEYS.has(normalizedKey)) {
      soundKeys.add(key);
      const schemaObject = schema && typeof schema === 'object' ? schema : null;
      let isRequired = requiredKeys.has(key);
      if (!isRequired && schemaObject) {
        if (schemaObject.required === true) {
          isRequired = true;
        } else if (typeof schemaObject.minLength === 'number' && schemaObject.minLength > 0) {
          isRequired = true;
        } else if (typeof schemaObject.minItems === 'number' && schemaObject.minItems > 0) {
          isRequired = true;
        }
      }
      if (isRequired) {
        requiredSoundKeys.add(key);
      }
      return;
    }

    const inferredType = inferMediaTypeFromParameter(key, schema);
    if (inferredType) {
      const typeKey = normalizeMediaGroupType(inferredType);
      if (!result.mediaParams[typeKey]) {
        result.mediaParams[typeKey] = [];
      }
      const info = {
        key,
        required: requiredKeys.has(key)
      };
      result.mediaParams[typeKey].push(info);
      if (info.required) {
        result.requiredMediaTypes.add(typeKey);
      }
      return;
    }

    const fallbackTokens = tokenizeKey(key);
    if (fallbackTokens.includes('file') && fallbackTokens.includes('url')) {
      result.mediaParams.other.push({ key, required: requiredKeys.has(key) });
    }
  });

  result.soundTextKeys = Array.from(soundKeys);
  result.requiredSoundTextKeys = Array.from(requiredSoundKeys);
  if (requiredSoundKeys.size > 0 || meta?.requiresSoundText === true) {
    result.requiresSoundText = true;
  }
  return result;
}

function getPromptKey(meta) {
  if (!meta) return '';
  if (typeof meta.promptKey === 'string' && meta.promptKey) {
    return meta.promptKey;
  }
  const props = meta?.tools?.submit?.parameters?.properties;
  const detected = detectPromptKeyFromProperties(props);
  if (detected && typeof meta === 'object') {
    meta.promptKey = detected;
  }
  return detected || '';
}

function engineRequiresPrompt(meta) {
  if (!meta) return false;
  if (meta.requiresPrompt === true) {
    return true;
  }
  const submitParams = meta?.tools?.submit?.parameters;
  if (!submitParams) {
    return Boolean(meta?.requiresPrompt);
  }
  const promptKey = getPromptKey(meta);
  if (!promptKey) {
    return Boolean(meta?.requiresPrompt);
  }
  const lowerPromptKey = String(promptKey).toLowerCase();
  const manualRequired = ENGINE_PARAMETER_REQUIRED_HINTS[meta?.id];
  if (Array.isArray(submitParams.required)) {
    const requires = submitParams.required.some((key) => String(key).toLowerCase() === lowerPromptKey);
    if (requires) {
      meta.requiresPrompt = true;
      return true;
    }
  }
  if (Array.isArray(manualRequired)) {
    const matchesManual = manualRequired.some((key) => String(key).toLowerCase() === lowerPromptKey);
    if (matchesManual) {
      meta.requiresPrompt = true;
      return true;
    }
  }
  const schema = submitParams.properties?.[promptKey];
  if (schema && typeof schema === 'object') {
    if (typeof schema.minLength === 'number' && schema.minLength > 0) {
      meta.requiresPrompt = true;
      return true;
    }
    if (typeof schema.minItems === 'number' && schema.minItems > 0) {
      meta.requiresPrompt = true;
      return true;
    }
    if (schema.required === true) {
      meta.requiresPrompt = true;
      return true;
    }
  }
  return Boolean(meta?.requiresPrompt);
}

function engineRequiresSoundText(meta, entry = null) {
  const fallback = entry && typeof entry === 'object' ? entry : {};
  const source = meta || fallback;
  if (!source) return false;
  if (source.requiresSoundText === true || fallback.requiresSoundText === true) {
    return true;
  }
  if (source.requiresSoundText === false || fallback.requiresSoundText === false) {
    return false;
  }

  const requiredSoundKeys = new Set();
  if (Array.isArray(source.requiredSoundTextKeys)) {
    source.requiredSoundTextKeys.forEach((key) => {
      if (key || key === 0) {
        requiredSoundKeys.add(String(key).toLowerCase());
      }
    });
  }
  if (Array.isArray(fallback.requiredSoundTextKeys)) {
    fallback.requiredSoundTextKeys.forEach((key) => {
      if (key || key === 0) {
        requiredSoundKeys.add(String(key).toLowerCase());
      }
    });
  }
  if (requiredSoundKeys.size > 0) {
    return true;
  }

  const collectSoundKeys = () => {
    const keys = new Set();
    const enqueue = (key) => {
      if (key || key === 0) {
        keys.add(String(key));
      }
    };
    if (Array.isArray(source.soundTextKeys)) {
      source.soundTextKeys.forEach(enqueue);
    }
    if (Array.isArray(fallback.soundTextKeys)) {
      fallback.soundTextKeys.forEach(enqueue);
    }
    if (source.soundTextKey) enqueue(source.soundTextKey);
    if (fallback.soundTextKey) enqueue(fallback.soundTextKey);
    return Array.from(keys);
  };

  const soundKeys = collectSoundKeys();
  if (!soundKeys.length) {
    return false;
  }

  const submitParams = source?.tools?.submit?.parameters
    || fallback?.tools?.submit?.parameters
    || null;
  const requiredSet = new Set();
  if (Array.isArray(submitParams?.required)) {
    submitParams.required.forEach((key) => {
      if (key || key === 0) {
        requiredSet.add(String(key).toLowerCase());
      }
    });
  }
  if (soundKeys.some((key) => requiredSet.has(String(key).toLowerCase()))) {
    return true;
  }

  const properties = submitParams?.properties;
  if (!properties || typeof properties !== 'object') {
    return false;
  }

  const findSchemaForKey = (propKey) => {
    if (Object.prototype.hasOwnProperty.call(properties, propKey)) {
      return properties[propKey];
    }
    const lower = String(propKey).toLowerCase();
    const entries = Object.entries(properties);
    for (const [candidate, schema] of entries) {
      if (String(candidate).toLowerCase() === lower) {
        return schema;
      }
    }
    return null;
  };

  for (const key of soundKeys) {
    const schema = findSchemaForKey(key);
    if (!schema || typeof schema !== 'object') {
      continue;
    }
    if (schema.required === true) {
      return true;
    }
    if (typeof schema.minLength === 'number' && schema.minLength > 0) {
      return true;
    }
    if (typeof schema.minItems === 'number' && schema.minItems > 0) {
      return true;
    }
  }

  return false;
}

function groupMediaEntriesByType(mediaList) {
  const groups = new Map();
  mediaList.forEach((entry) => {
    const type = normalizeMediaGroupType(entry?.filterType || entry?.mediaType || entry?.type);
    if (!groups.has(type)) {
      groups.set(type, []);
    }
    groups.get(type).push(entry);
  });
  return groups;
}

function deriveMediaOrderKey(entry) {
  if (!entry) return '';
  if (entry.path) return String(entry.path);
  if (entry.url) return String(entry.url);
  if (typeof entry === 'string') return entry;
  return '';
}

function assignMediaOrderLookup(entry, type, order, pathMap, urlMap) {
  const info = {
    order,
    type: normalizeMediaGroupType(type)
  };
  const key = deriveMediaOrderKey(entry);
  if (key) {
    pathMap.set(key, info);
  }
  if (entry?.url) {
    urlMap.set(String(entry.url), info);
  }
  return info;
}

function getMediaSelectionOrderInfo(entry) {
  if (!entry) return null;
  const pathKey = entry.path ? String(entry.path) : deriveMediaOrderKey(entry);
  const map = state.media.orderByPath;
  if (pathKey && map instanceof Map && map.has(pathKey)) {
    return map.get(pathKey);
  }
  const urlKey = entry.url ? String(entry.url) : '';
  const fallback = state.media.orderByUrl;
  if (urlKey && fallback instanceof Map && fallback.has(urlKey)) {
    return fallback.get(urlKey);
  }
  return null;
}

function collectMediaParameterMetaForType(selectedEngines, type) {
  const entries = new Map();
  selectedEngines.forEach((engine) => {
    const meta = getEngineMeta(engine.id);
    const params = meta?.mediaParams?.[type];
    if (!Array.isArray(params)) return;
    params.forEach((param) => {
      if (!param || !param.key) return;
      const key = param.key;
      if (!shouldDisplayMediaParamBadge(key, type, meta)) {
        return;
      }
      const tokens = tokenizeKey(key);
      if (tokens.some((token) => MEDIA_PARAM_BADGE_EXCLUDE_TOKENS.has(token))) {
        return;
      }
      if (!entries.has(key)) {
        entries.set(key, {
          key,
          required: Boolean(param.required)
        });
      } else if (param.required) {
        const current = entries.get(key);
        current.required = true;
      }
    });
  });
  return Array.from(entries.values()).filter((entry) => Boolean(entry.required));
}

function deriveMediaSlotLabel(type, slot) {
  const baseLabel = MEDIA_TYPE_DISPLAY[type]?.label || type.toUpperCase();
  const tokens = slot?.tokens instanceof Set ? slot.tokens : new Set();
  const hasToken = (...candidates) => candidates.some((token) => tokens.has(token));
  const totalSlots = typeof slot?.totalSlots === 'number' ? slot.totalSlots : 0;
  const isStartCandidate = Boolean(slot?.isStartCandidate);
  const isEndCandidate = Boolean(slot?.isEndCandidate);
  const hasAnyEndCandidate = Boolean(slot?.hasAnyEndCandidate);
  const hasAnyStartCandidate = Boolean(slot?.hasAnyStartCandidate);
  const slotIndex = typeof slot?.index === 'number' ? slot.index : -1;

  const isVisualMedia = type === 'image' || type === 'video';
  if (isVisualMedia) {
    const startLabel = 'START';
    const endLabel = 'END';
    if (isEndCandidate || hasToken(...MEDIA_SLOT_END_TOKENS)) {
      return endLabel;
    }
    if (isStartCandidate || hasToken(...MEDIA_SLOT_START_TOKENS)) {
      return startLabel;
    }
    if (hasAnyEndCandidate && totalSlots >= 2 && slotIndex === 0) {
      return startLabel;
    }
    if (hasAnyStartCandidate && totalSlots >= 2 && slotIndex === totalSlots - 1) {
      return endLabel;
    }
  }

  if (slotIndex > 0) {
    return `${baseLabel} #${slotIndex + 1}`;
  }
  return baseLabel;
}

function shouldDisplayMediaSlot(slot) {
  if (!slot) return true;
  if (slot.required) return true;
  if (slot.isStartCandidate || slot.isEndCandidate) {
    return true;
  }
  if (typeof slot.index === 'number' && slot.index <= 0) {
    return true;
  }
  return false;
}

function computeMediaSlotDefinitions(selectedEngines = Array.from(state.selected.values())) {
  const definitions = new Map();
  selectedEngines.forEach((engine) => {
    if (!engine || !engine.id) return;
    const meta = getEngineMeta(engine.id);
    if (!meta) return;
    const paramsByType = meta.mediaParams || {};
    const engineRequiresMedia = meta?.requiresMedia === true;
    Object.entries(paramsByType).forEach(([rawType, params]) => {
      if (!Array.isArray(params) || !params.length) return;
      const type = normalizeMediaGroupType(rawType);
      if (!definitions.has(type)) {
        definitions.set(type, []);
      }
      const slots = definitions.get(type);
      params.forEach((param, idx) => {
        if (!param) return;
        const tokensForParam = Array.isArray(param.tokens)
          ? param.tokens.map((token) => String(token || '').toLowerCase()).filter(Boolean)
          : tokenizeKey(param.key);
        const isStartParam = tokensForParam.some((token) => MEDIA_SLOT_START_TOKENS.includes(token));
        const isEndParam = tokensForParam.some((token) => MEDIA_SLOT_END_TOKENS.includes(token));
        const isRequiredParam = Boolean(param.required);
        if (!engineRequiresMedia && !isRequiredParam && !isStartParam && !isEndParam) {
          return;
        }
        if (!slots[idx]) {
          slots[idx] = {
            type,
            index: idx,
            originalIndex: idx,
            keys: new Set(),
            tokens: new Set(),
            required: false
          };
        }
        const slot = slots[idx];
        if (param.key) {
          slot.keys.add(param.key);
          tokensForParam.forEach((token) => slot.tokens.add(token));
        }
        if (isRequiredParam) {
          slot.required = true;
        }
        if (isStartParam) {
          slot.isStartCandidate = true;
        }
        if (isEndParam) {
          slot.isEndCandidate = true;
        }
      });
    });
  });

  definitions.forEach((slots, type) => {
    if (!Array.isArray(slots)) {
      definitions.set(type, []);
      return;
    }
    const filtered = slots.filter(Boolean).map((slot) => {
      const tokens = slot.tokens instanceof Set ? new Set(slot.tokens) : new Set();
      const startCandidate = MEDIA_SLOT_START_TOKENS.some((token) => tokens.has(token));
      const endCandidate = MEDIA_SLOT_END_TOKENS.some((token) => tokens.has(token));
      return {
        ...slot,
        tokens,
        isStartCandidate: startCandidate,
        isEndCandidate: endCandidate,
        originalIndex: typeof slot.originalIndex === 'number' ? slot.originalIndex : slot.index || 0
      };
    });
    const computePriority = (slot) => {
      if (type === 'image' || type === 'video') {
        if (slot.isStartCandidate) {
          return 0;
        }
        if (slot.isEndCandidate) {
          return 2;
        }
      }
      return 1;
    };
    filtered.sort((a, b) => {
      const diff = computePriority(a) - computePriority(b);
      if (diff) return diff;
      return (a.originalIndex || 0) - (b.originalIndex || 0);
    });
    const totalSlots = filtered.length;
    const hasAnyStartCandidate = filtered.some((slot) => slot.isStartCandidate);
    const hasAnyEndCandidate = filtered.some((slot) => slot.isEndCandidate);
    const normalized = filtered.map((slot, idx) => {
      const tokens = slot.tokens instanceof Set ? slot.tokens : new Set();
      const decorated = {
        ...slot,
        type,
        index: idx,
        slotId: `${type}:${idx}`,
        tokens,
        totalSlots,
        hasAnyStartCandidate,
        hasAnyEndCandidate
      };
      const slotVisible = shouldDisplayMediaSlot(decorated);
      return {
        ...decorated,
        label: deriveMediaSlotLabel(type, decorated),
        visible: slotVisible,
        hidden: !slotVisible
      };
    });
    definitions.set(type, normalized);
  });

  return definitions;
}

function getMediaSlotAssignments(slotDefinitions) {
  const assignments = new Map();
  const extrasByType = new Map();
  const mediaList = getSelectedMediaList();
  const grouped = groupMediaEntriesByType(mediaList);

  slotDefinitions.forEach((slots, type) => {
    const entries = grouped.get(type) || [];
    slots.forEach((slot, idx) => {
      if (entries[idx]) {
        assignments.set(slot.slotId, entries[idx]);
      }
    });
    if (entries.length > slots.length) {
      extrasByType.set(type, entries.slice(slots.length));
    }
  });

  grouped.forEach((entries, type) => {
    if (!slotDefinitions.has(type)) {
      extrasByType.set(type, entries.slice());
    }
  });

  return { assignments, extrasByType };
}

function buildSelectedMediaFromSlots(slotDefinitions, assignments, extrasByType = new Map()) {
  const result = [];
  const handledTypes = new Set();

  MEDIA_SELECTION_TYPE_ORDER.forEach((type) => {
    handledTypes.add(type);
    const slots = slotDefinitions.get(type) || [];
    slots.forEach((slot) => {
      const entry = assignments.get(slot.slotId);
      if (!entry) return;
      const normalizedType = normalizeMediaGroupType(entry.filterType || type);
      result.push({
        ...entry,
        filterType: normalizedType,
        slotId: slot.slotId
      });
    });
    const extras = extrasByType.get(type) || [];
    extras.forEach((entry) => {
      result.push({
        ...entry,
        filterType: normalizeMediaGroupType(entry.filterType || type)
      });
    });
  });

  extrasByType.forEach((entries, type) => {
    if (handledTypes.has(type)) return;
    entries.forEach((entry) => {
      result.push({
        ...entry,
        filterType: normalizeMediaGroupType(entry.filterType || type)
      });
    });
  });

  return result;
}

function findSlotDefinitionById(slotDefinitions, slotId) {
  if (!slotId) return null;
  for (const [type, slots] of slotDefinitions.entries()) {
    const match = slots.find((slot) => slot.slotId === slotId);
    if (match) {
      return match;
    }
  }
  return null;
}

function findNextEmptySlotId(slotDefinitions, assignments, currentSlotId = '', typeFilter = '') {
  const orderedSlots = [];
  slotDefinitions.forEach((slots, type) => {
    if (typeFilter && type !== typeFilter) {
      return;
    }
    slots.forEach((slot) => {
      orderedSlots.push(slot.slotId);
    });
  });
  if (!orderedSlots.length) return '';
  const startIndex = currentSlotId ? orderedSlots.indexOf(currentSlotId) : -1;
  const orderedSearch = startIndex >= 0
    ? orderedSlots.slice(startIndex + 1).concat(orderedSlots.slice(0, startIndex + 1))
    : orderedSlots;
  const next = orderedSearch.find((slotId) => !assignments.has(slotId));
  return next || '';
}

function resolveActiveMediaSlot(slotDefinitions, assignments) {
  const orderedSlots = [];
  slotDefinitions.forEach((slots) => {
    slots.forEach((slot) => orderedSlots.push(slot.slotId));
  });
  if (!orderedSlots.length) {
    if (state.media.activeSlot) {
      state.media.activeSlot = '';
    }
    return '';
  }
  let next = state.media.activeSlot && orderedSlots.includes(state.media.activeSlot)
    ? state.media.activeSlot
    : '';
  if (!next) {
    next = orderedSlots.find((slotId) => !assignments.has(slotId)) || orderedSlots[0];
  }
  if (state.media.activeSlot !== next) {
    state.media.activeSlot = next;
  }
  return next;
}

function createMediaSelectionPayload(item, forcedType = '') {
  if (!item || (!item.path && !item.url)) {
    return null;
  }
  const resolvedType = resolveMediaEntryType(item);
  const enforcedType = forcedType ? normalizeMediaGroupType(forcedType) : '';
  if (enforcedType && enforcedType !== normalizeMediaGroupType(resolvedType)) {
    return null;
  }
  const type = enforcedType || resolvedType;
  if (!type || type === 'other') {
    return null;
  }
  const mediaUrl = item.url || item.absolute || item.webPath || '';
  const thumbUrl = item.thumbUrl || item.thumbnail || (type === 'image' ? mediaUrl : '');
  const path = item.path || mediaUrl;
  if (!path) {
    return null;
  }
  const extension = item.ext || extractFileExtension(path) || extractFileExtension(mediaUrl);
  return {
    path,
    name: item.name || extractFilename(path),
    url: mediaUrl,
    thumbUrl,
    filterType: type,
    mime: item.mime || '',
    ext: extension || ''
  };
}

function assignMediaToSlot(slotId, item, options = {}) {
  if (!slotId || !item) return false;
  const slotDefinitions = options.slotDefinitions || computeMediaSlotDefinitions();
  const slot = findSlotDefinitionById(slotDefinitions, slotId);
  if (!slot) return false;
  const { assignments, extrasByType } = options.assignmentsData || getMediaSlotAssignments(slotDefinitions);
  const payload = createMediaSelectionPayload(item, slot.type);
  if (!payload) return false;
  assignments.set(slot.slotId, payload);

  if (extrasByType.has(slot.type)) {
    const filteredExtras = extrasByType.get(slot.type)
      .filter((entry) => entry.path !== payload.path && entry.url !== payload.url);
    extrasByType.set(slot.type, filteredExtras);
  }

  const nextList = buildSelectedMediaFromSlots(slotDefinitions, assignments, extrasByType);
  const nextSlot = findNextEmptySlotId(slotDefinitions, assignments, slot.slotId, slot.type);
  state.media.activeSlot = nextSlot || slot.slotId;
  setSelectedMediaList(nextList);
  return true;
}

function shouldDisplayMediaParamBadge(key, type, engineMeta) {
  if (!key) return false;
  if (type === 'other') return false;
  const tokens = tokenizeKey(key);
  if (!tokens.length) return false;
  const hasIndicatorToken = tokens.some((token) => MEDIA_PARAM_INDICATOR_TOKENS.has(token));
  if (!hasIndicatorToken && tokens.some((token) => MEDIA_PARAM_BADGE_EXCLUDE_TOKENS.has(token))) {
    return false;
  }
  const schema = engineMeta?.tools?.submit?.parameters?.properties?.[key];
  const inferred = normalizeMediaGroupType(inferMediaTypeFromParameter(key, schema));
  if (!inferred || inferred === 'other') {
    return false;
  }
  return inferred === type;
}

function getSoundTextParamKeys(meta) {
  if (!meta) return [];
  if (Array.isArray(meta.soundTextKeys) && meta.soundTextKeys.length) return meta.soundTextKeys;
  if (meta.soundTextKey) return [meta.soundTextKey];
  return ['text'];
}

function tokenizeMediaValue(value) {
  if (!value && value !== 0) return [];
  return String(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);
}

function deriveMediaFilterTags(source) {
  const tokens = new Set();
  const enqueue = (payload) => {
    if (!payload && payload !== 0) return;
    tokenizeMediaValue(payload).forEach((token) => tokens.add(token));
  };

  if (Array.isArray(source?.filterTags)) {
    source.filterTags.forEach(enqueue);
  }
  enqueue(source?.filterType);
  enqueue(source?.category);
  enqueue(source?.kind);
  enqueue(source?.type);
  enqueue(source?.mediaType);
  enqueue(source?.mime);
  enqueue(source?.ext);
  enqueue(source?.name);
  enqueue(source?.path);
  if (Array.isArray(source?.tags)) {
    source.tags.forEach(enqueue);
  }
  if (Array.isArray(source?.labels)) {
    source.labels.forEach(enqueue);
  }

  const tags = new Set();
  tokens.forEach((token) => {
    const mapped = MEDIA_HINT_LOOKUP.get(token);
    if (mapped) {
      tags.add(mapped);
    }
    if (AUDIO_EXTENSIONS.has(token)) tags.add('sound');
    if (VIDEO_EXTENSIONS.has(token)) tags.add('video');
    if (THREED_EXTENSIONS.has(token)) tags.add('3d');
    if (IMAGE_EXTENSIONS.has(token)) tags.add('image');
  });

  return Array.from(tags);
}

function selectPrimaryMediaFilter(tags) {
  if (!tags || !tags.length) return 'other';
  for (const candidate of MEDIA_FILTER_PRIORITY) {
    if (tags.includes(candidate)) return candidate;
  }
  return tags[0];
}

function attachHoverPlayback(media, { resetOnLeave = false, extraTargets = [] } = {}) {
  if (!(media instanceof HTMLMediaElement)) return;

  const handleEnter = () => {
    const controlsState = getBatchControlsState();
    if (controlsState?.hoverLock) return;
    if (!media.paused) return;
    const playPromise = media.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {});
    }
  };

  const handleLeave = () => {
    const controlsState = getBatchControlsState();
    if (controlsState?.hoverLock) return;
    try {
      media.pause();
      if (resetOnLeave) {
        media.currentTime = 0;
      }
    } catch (err) {
      console.warn('[Showcase] failed to pause hover media', err);
    }
  };

  const targets = [media];
  if (Array.isArray(extraTargets) && extraTargets.length) {
    extraTargets.forEach((target) => {
      if (target && typeof target.addEventListener === 'function' && !targets.includes(target)) {
        targets.push(target);
      }
    });
  }

  targets.forEach((target) => {
    target.addEventListener('mouseenter', handleEnter);
    target.addEventListener('mouseleave', handleLeave);
    target.addEventListener('focus', handleEnter);
    target.addEventListener('blur', handleLeave);
  });
}

const SHOWCASE_MEDIA_RETRY_LIMIT = 5;
const SHOWCASE_MEDIA_RETRY_BASE_DELAY_MS = 600;
const SHOWCASE_MEDIA_RETRY_MAX_DELAY_MS = 6000;

function isMediaElementReady(media) {
  if (!(media instanceof HTMLMediaElement)) return true;
  if (media.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return true;
  if (Number.isFinite(media.duration) && media.duration > 0) return true;
  if (media.buffered && media.buffered.length > 0) return true;
  return false;
}

function buildCacheBustedMediaUrl(src, attempt) {
  if (!src || typeof src !== 'string') return src;
  const stamp = `${Date.now()}-${attempt}`;
  try {
    if (typeof URL === 'function' && typeof window !== 'undefined' && window.location) {
      const url = new URL(src, window.location.origin);
      url.searchParams.set('_cb', stamp);
      if (url.origin === window.location.origin) {
        return `${url.pathname}${url.search}${url.hash}`;
      }
      return url.toString();
    }
  } catch (err) {
    // ignore and fallback to manual concatenation
  }
  const separator = src.includes('?') ? '&' : '?';
  return `${src}${separator}_cb=${stamp}`;
}

function bindShowcaseMediaLifecycle(media, { src, mediaType = 'media', context = 'general' } = {}) {
  if (!(media instanceof HTMLMediaElement)) return;
  if (media.dataset.showcaseMediaLifecycle === 'bound' || media.dataset.showcaseMediaLifecycle === 'ready') {
    return;
  }

  const originalSrc = src || media.getAttribute('src') || media.currentSrc || '';
  if (!originalSrc) return;

  media.dataset.showcaseMediaLifecycle = 'bound';
  media.dataset.showcaseMediaRetryCount = '0';

  let disposed = false;
  let pendingRetry = false;
  let attemptCount = 0;
  const timers = new Set();

  const clearTimers = () => {
    timers.forEach((id) => clearTimeout(id));
    timers.clear();
  };

  const registerTimer = (callback, delay) => {
    const id = setTimeout(() => {
      timers.delete(id);
      callback();
    }, delay);
    timers.add(id);
    return id;
  };

  const readyEvents = ['loadedmetadata', 'loadeddata', 'canplay', 'canplaythrough'];
  const failureEvents = ['error', 'stalled', 'emptied'];

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    clearTimers();
    readyEvents.forEach((evt) => media.removeEventListener(evt, handleReady));
    failureEvents.forEach((evt) => media.removeEventListener(evt, handleFailure));
    media.removeEventListener('play', handlePlayCheck);
    media.dataset.showcaseMediaLifecycle = disposed ? 'disposed' : 'ready';
    delete media.dataset.showcaseMediaRetryCount;
  };

  const handleReady = () => {
    if (disposed) return;
    media.dataset.showcaseMediaLifecycle = 'ready';
    delete media.dataset.showcaseMediaRetryCount;
    clearTimers();
    readyEvents.forEach((evt) => media.removeEventListener(evt, handleReady));
    failureEvents.forEach((evt) => media.removeEventListener(evt, handleFailure));
    media.removeEventListener('play', handlePlayCheck);
    disposed = true;
  };

  const scheduleRetry = (reason) => {
    if (disposed || pendingRetry) return;
    if (typeof document !== 'undefined' && !document.contains(media)) {
      cleanup();
      return;
    }
    if (isMediaElementReady(media)) {
      handleReady();
      return;
    }
    if (attemptCount >= SHOWCASE_MEDIA_RETRY_LIMIT) {
      console.warn('[Showcase] media failed to load after retries', {
        src: originalSrc,
        mediaType,
        context,
        reason
      });
      clearTimers();
      failureEvents.forEach((evt) => media.removeEventListener(evt, handleFailure));
      media.removeEventListener('play', handlePlayCheck);
      media.dataset.showcaseMediaLifecycle = 'failed';
      delete media.dataset.showcaseMediaRetryCount;
      return;
    }
    attemptCount += 1;
    media.dataset.showcaseMediaRetryCount = String(attemptCount);
    pendingRetry = true;
    const delay = Math.min(
      SHOWCASE_MEDIA_RETRY_BASE_DELAY_MS * Math.pow(2, attemptCount - 1),
      SHOWCASE_MEDIA_RETRY_MAX_DELAY_MS
    );

    registerTimer(() => {
      pendingRetry = false;
      if (disposed) return;
      if (typeof document !== 'undefined' && !document.contains(media)) {
        cleanup();
        return;
      }

      const nextSrc = buildCacheBustedMediaUrl(originalSrc, attemptCount);
      const wasPlaying = !media.paused;
      const resumeTime = wasPlaying ? media.currentTime : 0;

      try {
        media.pause();
      } catch (err) {
        console.warn('[Showcase] failed to pause media before retry', err);
      }

      try {
        media.src = nextSrc;
        media.load();
      } catch (err) {
        console.warn('[Showcase] failed to reload media', err);
      }

      if (wasPlaying) {
        const resume = () => {
          media.removeEventListener('canplay', resume);
          if (disposed) return;
          try {
            if (resumeTime > 0 && media.seekable && media.seekable.length) {
              const end = media.seekable.end(media.seekable.length - 1);
              media.currentTime = Math.min(resumeTime, end);
            } else if (resumeTime > 0) {
              media.currentTime = resumeTime;
            }
          } catch (err) {
            console.warn('[Showcase] failed to restore playback position', err);
          }
          media.play().catch(() => {});
        };
        media.addEventListener('canplay', resume, { once: true });
      }

      registerTimer(() => {
        if (!disposed && !isMediaElementReady(media)) {
          scheduleRetry('post-retry-check');
        }
      }, Math.max(delay, 1200));
    }, delay);
  };

  const handleFailure = (evt) => {
    scheduleRetry(evt?.type || 'failure');
  };

  const handlePlayCheck = () => {
    if (!isMediaElementReady(media)) {
      scheduleRetry('play');
    }
  };

  readyEvents.forEach((evt) => media.addEventListener(evt, handleReady, { once: true }));
  failureEvents.forEach((evt) => media.addEventListener(evt, handleFailure));
  media.addEventListener('play', handlePlayCheck);

  if (!isMediaElementReady(media)) {
    registerTimer(() => {
      if (!disposed && !isMediaElementReady(media)) {
        scheduleRetry('initial');
      }
    }, 800);
  } else {
    handleReady();
  }
}

function collectShowcaseMedia() {
  if (typeof document === 'undefined') return [];
  const selector = [
    '.kc-result-card__video',
    '.kc-results-modal__video',
    '.kc-lightbox__video',
    '.kc-result-card__audio',
    '.kc-results-modal__audio',
    '.kc-lightbox__audio'
  ].join(',');
  return Array.from(document.querySelectorAll(selector)).filter(
    (node) => node instanceof HTMLMediaElement
  );
}

function getBatchControlsState() {
  if (!state.batchControls) {
    state.batchControls = {
      isPlaying: false,
      loopEnabled: true,
      hoverLock: false,
      groups: []
    };
  }
  return state.batchControls;
}

function applyLoopSettingToMedia(media) {
  if (!(media instanceof HTMLMediaElement)) return;
  const controlsState = getBatchControlsState();
  const loopEnabled = Boolean(controlsState.loopEnabled);
  media.loop = loopEnabled;
  if (loopEnabled) {
    media.setAttribute('loop', '');
  } else {
    media.removeAttribute('loop');
  }
}

function handleBatchMediaPlaybackChange() {
  const mediaElements = collectShowcaseMedia();
  const anyPlaying = mediaElements.some((media) => !media.paused && !media.ended);
  const controlsState = getBatchControlsState();
  controlsState.isPlaying = anyPlaying;
  if (!anyPlaying) {
    controlsState.hoverLock = false;
  }
  updateBatchControlVisuals();
}

function ensureBatchMediaBindings() {
  const mediaElements = collectShowcaseMedia();
  mediaElements.forEach((media) => {
    if (!(media instanceof HTMLMediaElement)) return;
    applyLoopSettingToMedia(media);
    if (media.dataset.batchControlsBound === 'true') return;
    media.dataset.batchControlsBound = 'true';
    media.addEventListener('play', handleBatchMediaPlaybackChange);
    media.addEventListener('pause', handleBatchMediaPlaybackChange);
    media.addEventListener('ended', handleBatchMediaPlaybackChange);
  });
}

function pruneBatchControlGroups() {
  const controlsState = getBatchControlsState();
  controlsState.groups = controlsState.groups.filter((group) => {
    if (!group) return false;
    const nodes = [group.rewindBtn, group.toggleBtn, group.forwardBtn, group.loopBtn];
    return nodes.some((node) => node && document.contains(node));
  });
}

function updateBatchControlVisuals() {
  ensureBatchMediaBindings();
  pruneBatchControlGroups();
  const controlsState = getBatchControlsState();
  const mediaElements = collectShowcaseMedia();
  const hasMedia = mediaElements.length > 0;
  if (!hasMedia) {
    controlsState.isPlaying = false;
  }

  controlsState.groups.forEach((group) => {
    const {
      rewindBtn,
      toggleBtn,
      forwardBtn,
      loopBtn
    } = group;
    const disable = !hasMedia;

    if (rewindBtn) {
      rewindBtn.disabled = disable;
      rewindBtn.setAttribute('aria-disabled', String(disable));
    }
    if (forwardBtn) {
      forwardBtn.disabled = disable;
      forwardBtn.setAttribute('aria-disabled', String(disable));
    }
    if (toggleBtn) {
      toggleBtn.disabled = disable;
      toggleBtn.setAttribute('aria-disabled', String(disable));
      toggleBtn.textContent = controlsState.isPlaying ? '⏸' : '▶';
      const toggleLabel = controlsState.isPlaying
        ? '全てのメディアを一時停止'
        : '全てのメディアを再生';
      toggleBtn.title = toggleLabel;
      toggleBtn.setAttribute('aria-label', toggleLabel);
      toggleBtn.classList.toggle('is-playing', controlsState.isPlaying && !disable);
      toggleBtn.dataset.state = controlsState.isPlaying ? 'pause' : 'play';
    }
    if (loopBtn) {
      loopBtn.disabled = disable;
      loopBtn.setAttribute('aria-disabled', String(disable));
      if (controlsState.loopEnabled) {
        loopBtn.textContent = '🔁';
        loopBtn.title = 'ループ再生を無効';
        loopBtn.setAttribute('aria-label', 'ループ再生を無効');
      } else {
        loopBtn.textContent = '1×';
        loopBtn.title = 'ループ再生を有効';
        loopBtn.setAttribute('aria-label', 'ループ再生を有効');
      }
    }
  });
}

function registerBatchControlGroup({ rewindBtn, toggleBtn, forwardBtn, loopBtn }) {
  const buttons = [rewindBtn, toggleBtn, forwardBtn, loopBtn];
  if (buttons.some((btn) => !(btn instanceof HTMLButtonElement))) {
    return;
  }

  const controlsState = getBatchControlsState();
  if (!controlsState.groups.some((group) => group.toggleBtn === toggleBtn)) {
    controlsState.groups.push({ rewindBtn, toggleBtn, forwardBtn, loopBtn });
  }

  if (rewindBtn && !rewindBtn.dataset.batchControlButtonBound) {
    rewindBtn.dataset.batchControlButtonBound = 'true';
    rewindBtn.addEventListener('click', (evt) => {
      evt.preventDefault();
      rewindAllShowcaseMedia();
    });
  }
  if (forwardBtn && !forwardBtn.dataset.batchControlButtonBound) {
    forwardBtn.dataset.batchControlButtonBound = 'true';
    forwardBtn.addEventListener('click', (evt) => {
      evt.preventDefault();
      skipAllShowcaseMediaToEnd();
    });
  }
  if (toggleBtn && !toggleBtn.dataset.batchControlButtonBound) {
    toggleBtn.dataset.batchControlButtonBound = 'true';
    toggleBtn.addEventListener('click', (evt) => {
      evt.preventDefault();
      togglePlayPauseAllShowcaseMedia();
    });
  }
  if (loopBtn && !loopBtn.dataset.batchControlButtonBound) {
    loopBtn.dataset.batchControlButtonBound = 'true';
    loopBtn.addEventListener('click', (evt) => {
      evt.preventDefault();
      toggleLoopModeForShowcaseMedia();
    });
  }

  updateBatchControlVisuals();
}

function playAllShowcaseMedia({ reset = false } = {}) {
  const mediaElements = collectShowcaseMedia();
  const controlsState = getBatchControlsState();
  mediaElements.forEach((media) => {
    try {
      if (reset) {
        media.currentTime = 0;
      }
      const playPromise = media.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          handleBatchMediaPlaybackChange();
        });
      }
    } catch (err) {
      console.warn('[Showcase] failed to play media', err);
    }
  });
  if (mediaElements.length) {
    controlsState.isPlaying = true;
    controlsState.hoverLock = true;
  } else {
    controlsState.isPlaying = false;
    controlsState.hoverLock = false;
  }
  updateBatchControlVisuals();
}

function pauseAllShowcaseMedia({ reset = false } = {}) {
  const mediaElements = collectShowcaseMedia();
  mediaElements.forEach((media) => {
    try {
      media.pause();
      if (reset) {
        media.currentTime = 0;
      }
    } catch (err) {
      console.warn('[Showcase] failed to pause media', err);
    }
  });
  const controlsState = getBatchControlsState();
  controlsState.isPlaying = false;
  controlsState.hoverLock = false;
  updateBatchControlVisuals();
}

function rewindAllShowcaseMedia() {
  pauseAllShowcaseMedia({ reset: true });
}

function skipAllShowcaseMediaToEnd() {
  const mediaElements = collectShowcaseMedia();
  mediaElements.forEach((media) => {
    try {
      const hasDuration = Number.isFinite(media.duration) && media.duration > 0;
      if (hasDuration) {
        media.currentTime = media.duration;
      } else if (media.seekable && media.seekable.length) {
        media.currentTime = media.seekable.end(media.seekable.length - 1);
      }
      media.pause();
    } catch (err) {
      console.warn('[Showcase] failed to seek media', err);
    }
  });
  const controlsState = getBatchControlsState();
  controlsState.isPlaying = false;
  controlsState.hoverLock = false;
  updateBatchControlVisuals();
}

function togglePlayPauseAllShowcaseMedia() {
  const controlsState = getBatchControlsState();
  if (controlsState.isPlaying) {
    pauseAllShowcaseMedia({ reset: false });
  } else {
    playAllShowcaseMedia({ reset: false });
  }
}

function toggleLoopModeForShowcaseMedia() {
  const controlsState = getBatchControlsState();
  controlsState.loopEnabled = !controlsState.loopEnabled;
  const mediaElements = collectShowcaseMedia();
  mediaElements.forEach((media) => {
    applyLoopSettingToMedia(media);
  });
  updateBatchControlVisuals();
}

const CATEGORY_TYPE_FILTERS = {
  image: ['t2i', 'i2i'],
  video: ['t2v', 'i2v', 'r2v', 's2v', 'a2v', 'v2v'],
  '3d': ['i2i3d'],
  sound: ['v2a', 'v2sfx', 't2a', 't2s', 'tts', 't2m'],
  other: ['t2visual', 'file', 'train', 'misc']
};

const ALL_TYPE_FILTERS = Array.from(new Set(Object.values(CATEGORY_TYPE_FILTERS).flat())).sort();

const CATEGORY_OVERRIDES = {};

const MEDIA_CACHE_TTL_MS = 60000;

const BADGE_THEME_PREFIX = 'kc-theme--';
const BADGE_THEME_MAP = new Map([
  ['t2i', 't2i'],
  ['i2i', 'i2i'],
  ['t2v', 't2v'],
  ['i2v', 'i2v'],
  ['r2v', 'r2v'],
  ['s2v', 's2v'],
  ['a2v', 'a2v'],
  ['v2v', 'v2v'],
  ['v2a', 'v2a'],
  ['v2sfx', 'v2sfx'],
  ['t2a', 't2a'],
  ['t2s', 't2s'],
  ['tts', 'tts'],
  ['t2m', 't2m'],
  ['i2i3d', 'i2i3d'],
  ['t2visual', 't2visual'],
  ['file', 'file'],
  ['train', 'train'],
  ['misc', 'misc']
]);

const CATEGORY_THEME_MAP = {
  image: 'image',
  text: 'image',
  img: 'image',
  images: 'image',
  video: 'video',
  sound: 'sound',
  '3d': '3d',
  other: 'other',
  all: 'all'
};

function normalizeThemeToken(token) {
  if (token === undefined || token === null) return '';
  return String(token).trim().toLowerCase();
}

function resolveBadgeTheme(tokens, fallbackCategory) {
  const queue = Array.isArray(tokens) ? tokens : [tokens];

  for (const token of queue) {
    const literal = normalizeThemeToken(token);
    if (!literal) continue;
    if (BADGE_THEME_MAP.has(literal)) {
      return BADGE_THEME_MAP.get(literal);
    }
    if (Object.prototype.hasOwnProperty.call(CATEGORY_THEME_MAP, literal)) {
      return CATEGORY_THEME_MAP[literal];
    }
    const normalizedType = normalizeTypeToken(literal);
    if (normalizedType && BADGE_THEME_MAP.has(normalizedType)) {
      return BADGE_THEME_MAP.get(normalizedType);
    }
    const normalizedCategory = normalizeCategory(literal);
    if (Object.prototype.hasOwnProperty.call(CATEGORY_THEME_MAP, normalizedCategory)) {
      return CATEGORY_THEME_MAP[normalizedCategory];
    }
  }

  const fallbacks = Array.isArray(fallbackCategory) ? fallbackCategory : [fallbackCategory];
  for (const candidate of fallbacks) {
    const literal = normalizeThemeToken(candidate);
    if (!literal) continue;
    if (BADGE_THEME_MAP.has(literal)) {
      return BADGE_THEME_MAP.get(literal);
    }
    if (Object.prototype.hasOwnProperty.call(CATEGORY_THEME_MAP, literal)) {
      return CATEGORY_THEME_MAP[literal];
    }
    const normalizedCategory = normalizeCategory(literal);
    if (Object.prototype.hasOwnProperty.call(CATEGORY_THEME_MAP, normalizedCategory)) {
      return CATEGORY_THEME_MAP[normalizedCategory];
    }
  }

  return '';
}

function clearBadgeTheme(target) {
  if (!target || !target.classList) return;
  Array.from(target.classList).forEach((cls) => {
    if (cls && cls.startsWith(BADGE_THEME_PREFIX)) {
      target.classList.remove(cls);
    }
  });
  if (target.dataset && Object.prototype.hasOwnProperty.call(target.dataset, 'kcTheme')) {
    delete target.dataset.kcTheme;
  }
}

function applyBadgeTheme(target, tokens, options = {}) {
  if (!target || !target.classList) return '';
  const { fallbackCategory = '' } = options;
  const theme = resolveBadgeTheme(tokens, fallbackCategory);
  clearBadgeTheme(target);
  if (theme) {
    target.classList.add(`${BADGE_THEME_PREFIX}${theme}`);
    if (target.dataset) {
      target.dataset.kcTheme = theme;
    }
  }
  return theme;
}

const state = {
  categories: [],
  enginesByCategory: new Map(),
  engineIndex: new Map(),
  enginesLoading: new Set(),
  selected: new Map(),
  inputs: new Map(),
  history: [],
  historyActiveId: null,
  historyFilters: createDefaultHistoryFilters(),
  historyManualSelection: false,
  engineCategoryInitialized: false,
  activeEngineCategory: ALL_CATEGORY_ID,
  categoryTabs: {},
  prompt: '',
  soundText: '',
  engineSearchKeyword: '',
  filePrefix: '',
  isRunning: false,
  resultsByCategory: {},
  activeCategory: DEFAULT_ACTIVE_CATEGORY,
  templates: [],
  scanPath: '',
  backendOrigin: '',
  templateDefaults: [],
  templateCustom: [],
  templateHidden: new Set(),
  templateMenuFilters: {
    category: ALL_CATEGORY_ID,
    type: 'all',
    query: ''
  },
  docMetadata: new Map(),
  media: {
    items: [],
    filtered: [],
    isLoading: false,
    error: '',
    selected: [],
    activeSlot: '',
    lastLoadedAt: 0,
    searchKeyword: '',
    sortMode: 'name',
    typeFilter: 'all',
    orderByPath: new Map(),
    orderByUrl: new Map()
  },
  promptGenerator: {
    mode: 'enhance',
    loading: false,
    error: '',
    message: '',
    suggestions: [],
    lastPrompt: '',
    lastMode: 'enhance',
    requestId: 0,
    showPanel: false,
    variantCount: PROMPT_GENERATOR_DEFAULT_VARIANTS,
    selectedCategory: '',
    selectedType: '',
    guidanceByType: {},
    activeGuidance: '',
    categoryDirty: false,
    typeDirty: false,
    guidanceDirty: false
  },
  jobs: new Map(),
  jobPollers: new Map(),
  currentJobId: '',
  currentRunResults: new Map(),
  completedEngineKeys: new Set(),
  currentHistoryEntryId: '',
  currentJobEngines: [],
  activeJobSnapshot: null,
  engineDisplayOrder: new Map(),
  batchControls: {
    isPlaying: false,
    loopEnabled: true,
    groups: []
  },
  showFailures: true,
  showInputs: true,
  showParameters: true,
  resultsPromptExpanded: false,
  resultsFileFilter: 'all'
};
state.promptGenerator.mode = PROMPT_GENERATOR_DEFAULT_MODE;
state.promptGenerator.lastMode = PROMPT_GENERATOR_DEFAULT_MODE;


SUPPORTED_CATEGORIES.forEach((category) => {
  state.categoryTabs[category] = 'engine';
  state.resultsByCategory[category] = [];
});

let activeLightbox = null;
let activeParamsPopover = null;
let paramsPopoverCloseTimer = null;
let activePromptPopover = null;
let activeResultsModal = null;
let activeTemplateMenu = null;
let templateMenuCloseTimer = null;
let activeTemplateModal = null;
let activePromptModal = null;
let promptGeneratorStatusTimer = null;
let promptGeneratorMenuState = null;
let promptGeneratorHostElement = null;

const HISTORY_STORAGE_KEY = 'kc-showcase-history-v1';
const TEMPLATE_STORAGE_KEY = 'kc-showcase-templates-v1';
const FILE_PREFIX_STORAGE_KEY = 'kc-showcase-file-prefix-v1';
const FAILURE_VISIBILITY_STORAGE_KEY = 'kc-showcase-show-failures';
const INPUT_VISIBILITY_STORAGE_KEY = 'kc-showcase-show-inputs';
const PARAM_VISIBILITY_STORAGE_KEY = 'kc-showcase-show-params';
const RESULTS_FILE_FILTER_STORAGE_KEY = 'kc-showcase-results-file-filter';
const TEMPLATE_LIMIT = Number.POSITIVE_INFINITY;
const MAX_HISTORY_ENTRIES = Number.POSITIVE_INFINITY;
const PROMPT_PLACEHOLDER = 'プロンプトを入力してください';
const SOUND_TEXT_PLACEHOLDER = '音声テキストを入力してください';
const PROMPT_MIN_HEIGHT = 36;
const PROMPT_MAX_HEIGHT = 520;
const JOB_POLL_INTERVAL_MS = 2500;
const JOB_POLL_ERROR_DELAY_MS = 5000;
const PARAMS_POPOVER_HIDE_DELAY_MS = 420;

function isSupportedCategory(category) {
  return SUPPORTED_CATEGORIES.includes(category);
}

function categoryLabel(category) {
  if (!category && category !== 0) return '';
  if (String(category).toLowerCase() === ALL_CATEGORY_ID) return ALL_CATEGORY_LABEL;
  return CATEGORY_LABELS[category] || category || '';
}

function normalizeCategory(category) {
  if (!category) return DEFAULT_ACTIVE_CATEGORY;
  const lower = String(category).toLowerCase();
  if (lower === ALL_CATEGORY_ID) return ALL_CATEGORY_ID;
  if (lower === 'text') return 'image';
  if (lower === 'img' || lower === 'images') return 'image';
  if (isSupportedCategory(lower)) return lower;
  if (['audio', 'speech', 'music'].includes(lower)) return 'sound';
  if (lower === 'misc' || lower === 'other') return 'other';
  return 'other';
}

function normalizeTemplateEntry(entry, fallbackCategory = DEFAULT_ACTIVE_CATEGORY) {
  if (!entry) return null;
  const clone = { ...entry };
  const typeCandidates = [clone.type, clone.sourceCategory, clone.category];
  let normalizedType = '';
  for (const candidate of typeCandidates) {
    const normalized = normalizeTypeToken(candidate);
    if (normalized) {
      normalizedType = normalized;
      break;
    }
  }
  const categoryCandidate = clone.category || normalizedType || fallbackCategory;
  const normalizedCategory = normalizeCategory(categoryCandidate);
  clone.category = normalizedCategory;
  clone.type = normalizedType;
  if (typeof clone.filePrefix === 'string') {
    clone.filePrefix = clone.filePrefix.trim();
  } else {
    clone.filePrefix = '';
  }
  if (typeof clone.memo === 'string') {
    clone.memo = clone.memo.trim();
  } else {
    clone.memo = '';
  }
  if (typeof clone.soundText === 'string') {
    clone.soundText = clone.soundText.trim();
  } else {
    clone.soundText = '';
  }
  return clone;
}

function ensureTemplateMenuFilters() {
  const defaults = {
    category: ALL_CATEGORY_ID,
    type: 'all',
    query: ''
  };
  if (!state.templateMenuFilters || typeof state.templateMenuFilters !== 'object') {
    state.templateMenuFilters = { ...defaults };
  }
  const filters = state.templateMenuFilters;
  let category = filters.category;
  if (category === undefined || category === null || category === '') {
    category = state.activeEngineCategory || ALL_CATEGORY_ID;
  }
  if (!category) {
    category = ALL_CATEGORY_ID;
  }
  const normalizedCategory = String(category).toLowerCase() === ALL_CATEGORY_ID
    ? ALL_CATEGORY_ID
    : normalizeCategory(category);
  filters.category = normalizedCategory || ALL_CATEGORY_ID;

  let type = typeof filters.type === 'string' ? filters.type.trim().toLowerCase() : 'all';
  if (!type) {
    type = 'all';
  }
  if (type !== 'all' && type !== 'other') {
    const normalizedType = normalizeTypeToken(type);
    filters.type = normalizedType || 'all';
  } else {
    filters.type = type;
  }

  if (typeof filters.query !== 'string') {
    filters.query = '';
  }

  return filters;
}

function isAllCategory(category) {
  if (!category && category !== 0) return false;
  return String(category).toLowerCase() === ALL_CATEGORY_ID;
}

function resolveCategoryCandidate(...candidates) {
  for (const candidate of candidates) {
    if (!candidate && candidate !== 0) continue;
    const normalized = normalizeCategory(candidate);
    if (normalized && normalized !== 'other') {
      return normalized;
    }
  }
  return 'other';
}

function inferCategoryFromTokens(tokens, fallback = 'other') {
  const evaluated = new Set();
  tokens.forEach((token) => {
    if (!token && token !== 0) return;
    const lower = String(token).toLowerCase();
    if (!lower) return;
    evaluated.add(lower);
    if (TYPE_PREFIX_TO_CATEGORY.has(lower)) {
      evaluated.add(TYPE_PREFIX_TO_CATEGORY.get(lower));
    }
  });

  const fromPrefixes = Array.from(evaluated).find((candidate) => TYPE_PREFIX_TO_CATEGORY.has(candidate));
  if (fromPrefixes) {
    return TYPE_PREFIX_TO_CATEGORY.get(fromPrefixes);
  }

  const resolved = resolveCategoryCandidate(...evaluated);
  if (resolved && resolved !== 'other') {
    return resolved;
  }

  const normalizedFallback = normalizeCategory(fallback);
  return normalizedFallback === 'other' ? DEFAULT_ACTIVE_CATEGORY : normalizedFallback;
}

function normalizeTypeToken(token) {
  if (token === undefined || token === null) return '';
  const lower = String(token).trim().toLowerCase();
  if (!lower) return '';
  if (TYPE_PREFIX_TO_CATEGORY.has(lower)) return lower;
  return '';
}

function resolveTypePrefix(tokens, fallback = '') {
  for (const token of tokens) {
    const normalized = normalizeTypeToken(token);
    if (normalized) {
      return normalized;
    }
  }
  const fallbackNormalized = normalizeTypeToken(fallback);
  return fallbackNormalized || '';
}

function requiresMediaForPrefix(prefix) {
  if (!prefix) return false;
  return PREFIXES_REQUIRING_MEDIA.has(String(prefix).toLowerCase());
}

function extractEnginePrefix(value) {
  if (!value) return '';
  const match = String(value).toLowerCase().match(/^([a-z0-9]+)-/);
  return match ? match[1] : '';
}

function normalizeMediaSelection() {
  if (Array.isArray(state.media.selected)) {
    return state.media.selected;
  }
  if (state.media.selected && typeof state.media.selected === 'object') {
    state.media.selected = [state.media.selected];
  } else {
    state.media.selected = [];
  }
  return state.media.selected;
}

function getSelectedMediaList() {
  return normalizeMediaSelection();
}

function setSelectedMediaList(entries) {
  state.media.selected = Array.isArray(entries) ? entries.slice() : [];
  if (!state.media.selected.length) {
    state.media.activeSlot = '';
  }
  applySelectedMediaToEngineInputs();
}

function deriveMediaBindingValue(entry) {
  if (!entry) return '';
  const candidates = [];
  if (entry.path) {
    candidates.push(String(entry.path));
  }
  if (entry.url) {
    const rawUrl = String(entry.url);
    if (typeof window !== 'undefined') {
      try {
        const resolved = new URL(rawUrl, window.location.origin);
        if (resolved.origin === window.location.origin) {
          candidates.push(resolved.pathname + resolved.search);
        } else {
          candidates.push(rawUrl);
        }
      } catch (err) {
        candidates.push(rawUrl);
      }
    } else {
      candidates.push(rawUrl);
    }
  }
  for (const candidate of candidates) {
    const normalized = String(candidate || '').trim();
    if (normalized) return normalized;
  }
  return '';
}

function applySelectedMediaToEngineInputs() {
  const mediaList = getSelectedMediaList();
  const grouped = groupMediaEntriesByType(mediaList);

  state.selected.forEach((entry, id) => {
    const meta = getEngineMeta(id);
    if (!meta) return;
    const paramsByType = meta.mediaParams || {};
    const store = ensureEngineInputs(meta);
    if (!store) return;
    if (!store.__autoMediaAssignments || typeof store.__autoMediaAssignments !== 'object') {
      store.__autoMediaAssignments = {};
    }
    const autoMap = store.__autoMediaAssignments;

    Object.entries(paramsByType).forEach(([rawType, params]) => {
      if (!Array.isArray(params) || !params.length) return;
      const type = normalizeMediaGroupType(rawType);
      const list = grouped.get(type) || [];
      params.forEach((param, index) => {
        if (!param || !param.key) return;
        const targetEntry = list[index] || list[0];
        const key = param.key;
        if (targetEntry) {
          const nextValue = deriveMediaBindingValue(targetEntry);
          if (!nextValue) return;
          const currentValue = store[key];
          const lastAuto = autoMap[key];
          const canOverwrite = currentValue === undefined
            || currentValue === null
            || currentValue === ''
            || currentValue === lastAuto;
          if (!canOverwrite && currentValue !== nextValue) {
            return;
          }
          store[key] = nextValue;
          autoMap[key] = nextValue;
        } else if (autoMap[key]) {
          if (store[key] === autoMap[key]) {
            delete store[key];
          }
          delete autoMap[key];
        }
      });
    });
  });
}

function fallbackSlotLabel(type, key, index = 0) {
  const baseLabel = MEDIA_TYPE_DISPLAY[type]?.label || type.toUpperCase();
  const tokens = tokenizeKey(key);
  const hasStartToken = tokens.some((token) => MEDIA_SLOT_START_TOKENS.includes(token));
  const hasEndToken = tokens.some((token) => MEDIA_SLOT_END_TOKENS.includes(token));
  const isVisualMedia = type === 'image' || type === 'video';
  if (isVisualMedia) {
    const startLabel = 'START';
    const endLabel = 'END';
    if (hasEndToken) return endLabel;
    if (hasStartToken) return startLabel;
    if (index === 0) return startLabel;
    if (index === 1) return endLabel;
  }
  if (index > 0) {
    return `${baseLabel} #${index + 1}`;
  }
  return baseLabel;
}

function formatSlotLabelForDisplay(rawLabel, slotType = '', index = 0, total = 0) {
  const normalized = typeof rawLabel === 'string' ? rawLabel.trim() : '';
  const slotUpper = normalized.toUpperCase();
  if (slotUpper === 'START_IMAGE' || slotUpper === 'START_VIDEO' || slotUpper === 'START') {
    return 'START';
  }
  if (slotUpper === 'END_IMAGE' || slotUpper === 'END_VIDEO' || slotUpper === 'END') {
    return 'END';
  }
  if (!normalized && slotType) {
    return slotType.toUpperCase();
  }
  if (!normalized && !slotType) {
    return 'INPUT';
  }
  const visualTypes = new Set(['IMAGE', 'VIDEO']);
  const typeUpper = slotType ? String(slotType).toUpperCase() : '';
  if (visualTypes.has(slotUpper) || visualTypes.has(typeUpper)) {
    if (total >= 2) {
      if (index === 0) return 'START';
      if (index === total - 1) return 'END';
    }
  }
  const match = slotUpper.match(/^(IMAGE|VIDEO)\s*#(\d+)$/);
  if (match && total >= 2) {
    const number = Number(match[2]);
    if (number === 1) return 'START';
    if (number === 2 && total === 2) return 'END';
    if (index === total - 1) return 'END';
  }
  return normalized || (slotType ? slotType.toUpperCase() : 'INPUT');
}

function sanitizeMediaEntryForPayload(entry, defaultType = '') {
  if (!entry) return null;
  const resolvedName = entry.name || extractFilename(entry.path || entry.url || '');
  return {
    path: entry.path || '',
    url: entry.url || '',
    name: resolvedName,
    thumbUrl: entry.thumbUrl || '',
    filterType: normalizeMediaGroupType(entry.filterType || entry.type || defaultType),
    mime: entry.mime || '',
    ext: entry.ext || ''
  };
}

function buildMediaAssignmentsForEngine(meta, slotDefinitions, groupedMedia) {
  const assignments = [];
  if (!meta) return assignments;
  const paramsByType = meta.mediaParams || {};
  Object.entries(paramsByType).forEach(([rawType, params]) => {
    if (!Array.isArray(params) || !params.length) return;
    const type = normalizeMediaGroupType(rawType);
    const entries = groupedMedia.get(type) || [];
    const slots = slotDefinitions.get(type) || [];
    params.forEach((param, index) => {
      if (!param || !param.key) return;
      const mediaEntry = entries[index] || entries[0];
      if (!mediaEntry) return;
      let slot = null;
      if (slots.length) {
        slot = slots.find((slotDef) => slotDef && slotDef.keys instanceof Set && slotDef.keys.has(param.key))
          || slots[index]
          || null;
      }
      const slotId = slot?.slotId || `${type}:${index}`;
      const slotLabel = slot?.label || fallbackSlotLabel(type, param.key, index);
      const slotIndex = Number.isFinite(slot?.index) ? slot.index : index;
      const sanitizedMedia = sanitizeMediaEntryForPayload(mediaEntry, type);
      if (!sanitizedMedia) return;
      assignments.push({
        slotId,
        slotLabel,
        slotIndex,
        type,
        paramKey: param.key,
        required: Boolean(param.required),
        media: sanitizedMedia
      });
    });
  });
  return assignments;
}

function formatParameterValue(value) {
  if (value === undefined || value === null) return '';
  const MAX_LENGTH = 240;
  const toString = (input) => {
    if (input === undefined || input === null) return '';
    if (typeof input === 'string') return input;
    if (typeof input === 'number' || typeof input === 'boolean') return String(input);
    if (Array.isArray(input)) {
      return input
        .map((item) => toString(item))
        .filter((item) => item && item.trim().length)
        .join(', ');
    }
    try {
      return JSON.stringify(input);
    } catch (err) {
      return '[unserializable]';
    }
  };
  const text = toString(value) || '';
  if (text.length <= MAX_LENGTH) return text;
  return `${text.slice(0, MAX_LENGTH)}… (${text.length} chars)`;
}

function toggleMediaSelection(item) {
  if (!item) return;

  const slotDefinitions = computeMediaSlotDefinitions();
  const targetType = resolveMediaEntryType(item);
  const slotsForType = slotDefinitions.get(targetType) || [];
  const baseLabel = MEDIA_TYPE_DISPLAY[targetType]?.label || targetType.toUpperCase();
  const useSlotLayout = slotsForType.length > 1
    || (slotsForType.length === 1 && slotsForType[0]?.label !== baseLabel);

  if (useSlotLayout) {
    const assignmentsData = getMediaSlotAssignments(slotDefinitions);
    const activeSlotId = state.media.activeSlot;
    const activeSlot = findSlotDefinitionById(slotDefinitions, activeSlotId);
    if (activeSlot && activeSlot.type === targetType) {
      const handled = assignMediaToSlot(activeSlot.slotId, item, {
        slotDefinitions,
        assignmentsData
      });
      if (handled) return;
    }
    const fallbackSlotId = findNextEmptySlotId(
      slotDefinitions,
      assignmentsData.assignments,
      activeSlotId && activeSlot?.type === targetType ? activeSlotId : '',
      targetType
    );
    if (fallbackSlotId) {
      const handled = assignMediaToSlot(fallbackSlotId, item, {
        slotDefinitions,
        assignmentsData
      });
      if (handled) return;
    }
  }

  if (!item.path) return;

  const list = getSelectedMediaList().slice();
  const index = list.findIndex((entry) => entry.path === item.path);
  if (index >= 0) {
    list.splice(index, 1);
  } else {
    const payload = createMediaSelectionPayload(item);
    if (!payload) return;
    list.push(payload);
  }
  setSelectedMediaList(list);
}

function clearMissingMediaSelections(validPaths = new Set()) {
  const normalized = new Set([...validPaths].filter(Boolean));
  const list = getSelectedMediaList();
  if (!list.length) return;
  const filtered = list.filter((entry) => normalized.has(entry.path));
  if (filtered.length !== list.length) {
    setSelectedMediaList(filtered);
  }
}

function isJobTerminal(status) {
  const normalized = String(status || '').toLowerCase();
  return normalized === 'completed' || normalized === 'failed' || normalized === 'cancelled';
}

function translateJobStatus(status) {
  const normalized = String(status || '').toLowerCase();
  switch (normalized) {
    case 'pending':
      return '待機中';
    case 'running':
      return '実行中...';
    case 'completed':
      return '完了';
    case 'failed':
      return '失敗';
    case 'cancelled':
      return 'キャンセル済み';
    case 'cancelling':
      return 'キャンセル中...';
    default:
      return '状況確認中';
  }
}

function translateEngineStatus(engine) {
  const normalized = String(engine?.status || '').toLowerCase();
  switch (normalized) {
    case 'pending':
      return '待機中';
    case 'running':
      return '実行中...';
    case 'completed':
      return '完了';
    case 'failed':
      return '失敗';
    case 'cancelled':
      return 'キャンセル済み';
    case 'cancelling':
      return 'キャンセル中...';
    default:
      return '不明';
  }
}

function stopJobPolling(jobId) {
  if (!jobId) return;
  const timer = state.jobPollers.get(jobId);
  if (timer) {
    clearTimeout(timer);
    state.jobPollers.delete(jobId);
  }
}

function stopAllJobPollers() {
  state.jobPollers.forEach((timer, jobId) => {
    clearTimeout(timer);
    state.jobPollers.delete(jobId);
  });
}

function scheduleJobPoll(jobId, delay = JOB_POLL_INTERVAL_MS) {
  if (!jobId) return;
  stopJobPolling(jobId);
  const safeDelay = Math.max(250, Number(delay) || JOB_POLL_INTERVAL_MS);
  const timer = setTimeout(() => {
    state.jobPollers.delete(jobId);
    fetchAndHandleJob(jobId);
  }, safeDelay);
  state.jobPollers.set(jobId, timer);
}

async function fetchAndHandleJob(jobId) {
  try {
    const response = await fetchJson(`${API_BASE}/jobs/${encodeURIComponent(jobId)}`);
    const job = response?.job;
    if (!job || !job.id) {
      throw new Error('ジョブ情報を取得できませんでした');
    }
    handleJobUpdate(job);
    if (!isJobTerminal(job.status)) {
      scheduleJobPoll(jobId, JOB_POLL_INTERVAL_MS);
    }
  } catch (err) {
    console.error('[Showcase] job poll failed', err);
    scheduleJobPoll(jobId, JOB_POLL_ERROR_DELAY_MS);
  }
}

function startJobPolling(jobId, { immediate = true } = {}) {
  if (!jobId) return;
  stopJobPolling(jobId);
  if (immediate) {
    fetchAndHandleJob(jobId);
  } else {
    scheduleJobPoll(jobId, JOB_POLL_INTERVAL_MS);
  }
}

async function requestCancelJob(jobId) {
  if (!jobId) return;
  try {
    const response = await fetchJson(`${API_BASE}/jobs/${encodeURIComponent(jobId)}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    if (response?.job) {
      handleJobUpdate(response.job);
    }
    startJobPolling(jobId, { immediate: true });
  } catch (err) {
    console.error('[Showcase] job cancel failed', err);
  }
}

async function requestCancelEngine(jobId, engineId) {
  if (!jobId || !engineId) return;
  try {
    const response = await fetchJson(`${API_BASE}/jobs/${encodeURIComponent(jobId)}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ engineId })
    });
    if (response?.job) {
      handleJobUpdate(response.job);
    }
    startJobPolling(jobId, { immediate: true });
  } catch (err) {
    console.error('[Showcase] engine cancel failed', err);
  }
}

function ensureCurrentRunCategory(category) {
  const normalized = normalizeCategory(category || DEFAULT_ACTIVE_CATEGORY);
  if (!state.currentRunResults.has(normalized)) {
    state.currentRunResults.set(normalized, []);
  }
  return state.currentRunResults.get(normalized);
}

function convertEngineOutput(engineOutput, job = null, jobEngineSnapshot = null) {
  if (!engineOutput || typeof engineOutput !== 'object') return null;
  const engineId = engineOutput.id;
  if (!engineId) return null;
  const engineMeta = getEngineMeta(engineId);
  const selectedMeta = state.selected.get(engineId);
  const rawItemCategory = normalizeCategory(engineOutput.category);
  const engineCategory = normalizeCategory(engineMeta?.category);
  const selectedCategory = normalizeCategory(selectedMeta?.category);
  const derivedPrefix = extractEnginePrefix(engineId);
  const typePrefix = resolveTypePrefix([
    engineOutput.type,
    engineOutput.kind,
    engineMeta?.sourceCategory,
    derivedPrefix,
    engineOutput.category
  ], derivedPrefix);
  let category = inferCategoryFromTokens([
    rawItemCategory,
    engineCategory,
    selectedCategory,
    engineMeta?.sourceCategory,
    typePrefix
  ], DEFAULT_ACTIVE_CATEGORY);
  if (!category || category === 'other') {
    category = DEFAULT_ACTIVE_CATEGORY;
  }
  const metaInfo = selectedMeta || {
    label: engineMeta?.label || deriveEngineLabel(engineId),
    category,
    requiresMedia: engineMeta?.requiresMedia || false
  };
  const typeToken = typePrefix || resolveTypePrefix([
    category,
    rawItemCategory,
    engineCategory,
    selectedCategory
  ]);
  const sourceCategory = typeToken || '';
  const result = engineOutput.result || {};
  const savedFiles = Array.isArray(result.savedFiles) ? result.savedFiles : [];
  const logs = Array.isArray(result.logs) ? result.logs.map((entry) => String(entry || '')).filter(Boolean) : [];
  const statusHistory = Array.isArray(result.statusHistory)
    ? result.statusHistory.map((entry) => String(entry || '')).filter(Boolean)
    : [];
  const jobEngine = jobEngineSnapshot || (job && Array.isArray(job.engines)
    ? job.engines.find((engine) => engine.id === engineId)
    : null);
  const engineInputSnapshot = jobEngine?.input && typeof jobEngine.input === 'object'
    ? jobEngine.input
    : {};
  const rawAssignments = Array.isArray(jobEngine?.mediaAssignments)
    ? jobEngine.mediaAssignments
    : [];
  const rawJobMedia = Array.isArray(jobEngine?.media)
    ? jobEngine.media
    : [];
  const primaryAssignments = rawAssignments
    .map((assignment, idx) => {
      if (!assignment) return null;
      const sanitized = sanitizeMediaEntryForPayload(assignment.media || assignment, assignment.type || assignment.media?.filterType || '');
      if (!sanitized) return null;
      const slotType = normalizeMediaGroupType(assignment.slotType || assignment.type || sanitized.filterType || '');
      const slotIndex = Number.isFinite(assignment.slotIndex) ? assignment.slotIndex : idx;
      const slotId = assignment.slotId || `${slotType}:${slotIndex}`;
      const slotLabel = assignment.slotLabel || fallbackSlotLabel(slotType, assignment.paramKey || '', slotIndex);
      return {
        slotId,
        slotLabel,
        slotType,
        slotIndex,
        paramKey: assignment.paramKey || '',
        required: Boolean(assignment.required),
        media: sanitized
      };
    })
    .filter(Boolean);
  const fallbackAssignments = (!primaryAssignments.length && rawJobMedia.length)
    ? rawJobMedia.map((entry, idx) => {
        const sanitized = sanitizeMediaEntryForPayload(entry, entry.filterType || entry.type || '');
        if (!sanitized) return null;
        const slotType = normalizeMediaGroupType(entry.slotType || entry.filterType || entry.type || sanitized.filterType || '');
        const slotIndex = Number.isFinite(entry.slotIndex) ? entry.slotIndex : idx;
        const slotId = entry.slotId || `${slotType}:${slotIndex}`;
        const slotLabel = entry.slotLabel || fallbackSlotLabel(slotType, entry.paramKey || '', slotIndex);
        return {
          slotId,
          slotLabel,
          slotType,
          slotIndex,
          paramKey: entry.paramKey || '',
          required: Boolean(entry.required),
          media: sanitized
        };
      }).filter(Boolean)
    : [];
  const inputMedia = primaryAssignments.length ? primaryAssignments : fallbackAssignments;
  const parameterEntries = Object.entries(engineInputSnapshot)
    .filter(([key]) => key && !String(key).startsWith('__'))
    .map(([key, value]) => {
      const formatted = formatParameterValue(value);
      if (!formatted) return null;
      return { key, value: formatted };
    })
    .filter(Boolean);
  const snapshotInputMedia = () => inputMedia.map((assignment) => ({
    ...assignment,
    media: { ...assignment.media }
  }));
  const snapshotParameters = () => parameterEntries.map((entry) => ({ ...entry }));
  const records = [];

  if (engineOutput.success && savedFiles.length) {
    savedFiles.forEach((saved, index) => {
      const savedIndex = Number.isFinite(saved?.index) ? Number(saved.index) : index;
      const savedTotal = Number.isFinite(saved?.total) ? Number(saved.total) : savedFiles.length;
      const mediaUrl = saved ? buildImageUrl(saved) : '';
      const mediaType = mediaUrl
        ? resolveMediaEntryType({
            filterType: saved?.filterType || saved?.mediaType || typeToken,
            type: typeToken || '',
            url: mediaUrl,
            path: saved?.fileName || saved?.filename || ''
          })
        : resolveMediaEntryType({ filterType: typeToken || '', type: typeToken || '' });
      records.push({
        label: metaInfo.label || result.label || engineId,
        engineId,
        status: result.status || 'COMPLETED',
        requestId: result.requestId || '',
        durationMs: result.durationMs || 0,
        imageUrl: mediaUrl,
        logFile: result.logFile || '',
        logs,
        statusHistory,
        fileName: saved?.fileName || saved?.filename || '',
        category,
        sourceCategory,
        type: typeToken || '',
        typePrefixes: sourceCategory ? [sourceCategory] : [],
        savedFile: saved || null,
        savedFileIndex: savedIndex,
        savedFilesCount: savedTotal,
        displayOrder: resolveEngineDisplayOrder(engineId, category),
        filePrefix: result.filePrefix || saved?.prefix || '',
        timestamp: result.completedAt || result.timestamp || saved?.timestamp || '',
        error: '',
        filterType: mediaType,
        inputMedia: snapshotInputMedia(),
        inputParameters: snapshotParameters()
      });
    });
  } else {
    const fallbackType = resolveMediaEntryType({ filterType: typeToken || '', type: typeToken || '' });
    records.push({
      label: metaInfo.label || result.label || engineId,
      engineId,
      status: engineOutput.success ? (result.status || 'NO_RESULT') : 'ERROR',
      requestId: result.requestId || '',
      durationMs: result.durationMs || 0,
      imageUrl: '',
      logFile: result.logFile || '',
      logs,
      statusHistory,
      fileName: '',
      category,
      sourceCategory,
      type: typeToken || '',
      typePrefixes: sourceCategory ? [sourceCategory] : [],
      savedFile: null,
      savedFileIndex: 0,
      savedFilesCount: savedFiles.length,
      displayOrder: resolveEngineDisplayOrder(engineId, category),
      filePrefix: result.filePrefix || '',
      timestamp: result.completedAt || result.timestamp || '',
      error: engineOutput.success
        ? '生成結果を取得できませんでした'
        : (engineOutput.error || '不明なエラーが発生しました'),
      filterType: fallbackType,
      inputMedia: snapshotInputMedia(),
      inputParameters: snapshotParameters()
    });
  }

  return { category, records };
}

function integrateEngineOutput(job, engine) {
  if (!engine || !engine.output) return false;
  const converted = convertEngineOutput(engine.output, job, engine);
  if (!converted) return false;
  const { category, records } = converted;
  if (!records.length) return false;
  const isSuccess = engine?.output?.success === true;
  const hasPreview = records.some((record) => Boolean(record.imageUrl));
  if (isSuccess && !hasPreview) {
    return false;
  }
  const bucket = ensureCurrentRunCategory(category);
  bucket.push(...records);
  state.resultsByCategory[category] = bucket.map((item) => ({ ...item }));
  state.activeCategory = category;
  const resultsContainer = document.getElementById('kc-results');
  if (resultsContainer) {
    renderResults(resultsContainer);
  }
  const entry = ensureHistoryEntryForCurrentRun({
    prompt: job?.prompt || state.prompt,
    category,
    jobId: job?.id || ''
  });
  syncHistoryEntryFromCurrentResults(entry, {
    prompt: job?.prompt || state.prompt,
    category
  });
  saveHistoryToStorage();
  renderHistory();
  return true;
}

function finalizeCurrentJob(job) {
  if (!job || !job.id) return;
  stopJobPolling(job.id);
  state.jobs.set(job.id, job);
  const statusLabel = document.getElementById('kc-results-status');
  if (statusLabel) {
    statusLabel.textContent = translateJobStatus(job.status);
  }

  const aggregated = flattenCurrentRunResults();
  if (aggregated.length) {
    const categories = Array.from(state.currentRunResults.keys());
    const primaryCategory = categories[0] || aggregated[0]?.category || DEFAULT_ACTIVE_CATEGORY;
    const entry = ensureHistoryEntryForCurrentRun({
      prompt: job.prompt || state.prompt,
      category: primaryCategory,
      jobId: job.id
    });
    syncHistoryEntryFromCurrentResults(entry, {
      prompt: job.prompt || state.prompt,
      category: primaryCategory
    });
    state.activeCategory = primaryCategory;
    state.historyActiveId = entry.id;
    renderHistory();
    const resultsContainer = document.getElementById('kc-results');
    if (resultsContainer) {
      renderResults(resultsContainer);
    }
    saveHistoryToStorage();
  }

  state.currentRunResults = new Map();
  state.completedEngineKeys = new Set();
  state.currentHistoryEntryId = '';
  if (state.currentJobId === job.id) {
    state.currentJobId = '';
  }
  state.activeJobSnapshot = null;
  state.currentJobEngines = [];
  state.engineDisplayOrder = new Map();
  state.isRunning = false;
  setReloadBlock(false, { release: false });
  renderCategories();
  updateRunButtonState();
}

function handleJobUpdate(job) {
  if (!job || !job.id) return;
  const previousJob = state.activeJobSnapshot && state.activeJobSnapshot.id === job.id
    ? state.activeJobSnapshot
    : null;
  const previousStatusMap = new Map();
  if (previousJob && Array.isArray(previousJob.engines)) {
    previousJob.engines.forEach((engine) => {
      if (engine && engine.id) {
        previousStatusMap.set(engine.id, engine.status || '');
      }
    });
  }
  const previousJobStatus = previousJob ? previousJob.status : '';
  state.jobs.set(job.id, job);
  state.activeJobSnapshot = job;
  const engines = Array.isArray(job.engines) ? job.engines : [];
  let shouldRerender = !previousJob;
  state.currentJobEngines = engines.map((engine) => {
    const currentStatus = engine?.status || 'pending';
    if (engine && engine.id) {
      const previousStatus = previousStatusMap.get(engine.id) || '';
      if (previousStatus !== currentStatus) {
        shouldRerender = true;
      }
    }
    return {
      id: engine?.id,
      label: engine?.label || '',
      displayLabel: engine?.displayLabel || engine?.label || '',
      category: engine?.category || DEFAULT_ACTIVE_CATEGORY,
      status: currentStatus
    };
  });
  if (!(state.engineDisplayOrder instanceof Map)) {
    state.engineDisplayOrder = new Map();
  }
  engines.forEach((engine, idx) => {
    if (!engine || !engine.id) return;
    if (!state.engineDisplayOrder.has(engine.id)) {
      state.engineDisplayOrder.set(engine.id, {
        order: idx,
        category: normalizeCategory(engine.category || DEFAULT_ACTIVE_CATEGORY)
      });
    }
  });
  const statusLabel = document.getElementById('kc-results-status');
  if (statusLabel) {
    statusLabel.textContent = translateJobStatus(job.status);
  }
  engines.forEach((engine) => {
    const key = `${job.id}:${engine.id}`;
    if (engine.output && !state.completedEngineKeys.has(key) && (engine.status === 'completed' || engine.status === 'failed' || engine.status === 'cancelled')) {
      const integrated = integrateEngineOutput(job, engine);
      if (integrated) {
        state.completedEngineKeys.add(key);
        shouldRerender = true;
      }
    }
  });
  if (previousJobStatus !== job.status) {
    shouldRerender = true;
  }
  const resultsContainer = document.getElementById('kc-results');
  if (shouldRerender && resultsContainer) {
    renderResults(resultsContainer);
  }
  if (isJobTerminal(job.status)) {
    finalizeCurrentJob(job);
  }
}

function detectMediaFilterType(file) {
  if (!file) return 'other';
  const tags = deriveMediaFilterTags(file);
  if (!tags.length) return 'other';
  return selectPrimaryMediaFilter(tags);
}

function knownTypesForCategory(category) {
  const normalized = (category || '').toLowerCase();
  if (!normalized || normalized === 'all') {
    return ALL_TYPE_FILTERS;
  }
  return CATEGORY_TYPE_FILTERS[normalized] || ALL_TYPE_FILTERS;
}

function getTypeFilterOptions(category) {
  const normalized = (category || '').toLowerCase();
  const options = [{ id: 'all', label: 'ALL' }];
  const list = knownTypesForCategory(normalized);
  list.forEach((item) => {
    const label = item.toUpperCase();
    options.push({ id: item, label });
  });
  if (normalized === 'all') {
    options.push({ id: 'other', label: 'OTHER' });
  }
  return options;
}

function templateMatchesCategory(template, activeCategory) {
  if (!template) return false;
  const category = normalizeCategory(activeCategory || DEFAULT_ACTIVE_CATEGORY);
  if (category === ALL_CATEGORY_ID) {
    return true;
  }

  const raw = (template.category || '').trim();
  const normalizedTemplateCategory = raw.toLowerCase();
  const isOtherCategory = category === 'other';

  const allowedTypes = new Set(knownTypesForCategory(category));
  const normalizedTemplateType = normalizeTypeToken(template.type);
  if (normalizedTemplateType) {
    if (allowedTypes.has(normalizedTemplateType)) {
      return true;
    }
  }

  if (isOtherCategory) {
    if (!normalizedTemplateCategory) {
      return false;
    }
    if (normalizedTemplateCategory === 'all') {
      return false;
    }
    if (normalizedTemplateCategory === 'other') {
      return true;
    }

    const normalizedTokenForOther = normalizeTypeToken(normalizedTemplateCategory);
    if (normalizedTokenForOther && CATEGORY_TYPE_FILTERS.other.includes(normalizedTokenForOther)) {
      return true;
    }

    const inferredOther = normalizeCategory(normalizedTemplateCategory);
    return inferredOther === 'other';
  }

  if (!raw) {
    return true;
  }

  if (normalizedTemplateCategory === 'all') {
    return true;
  }

  if (normalizedTemplateCategory === category) {
    return true;
  }

  const normalizedCategoryFromTemplate = normalizeCategory(normalizedTemplateCategory);
  if (normalizedCategoryFromTemplate === category) {
    return true;
  }

  if (!allowedTypes.size) {
    return normalizedTemplateCategory === category;
  }

  const normalizedToken = normalizeTypeToken(normalizedTemplateCategory);
  if (normalizedToken && allowedTypes.has(normalizedToken)) {
    return true;
  }

  if (allowedTypes.has(normalizedTemplateCategory)) {
    return true;
  }

  return false;
}

function categorizeServerMeta(meta) {
  if (!meta) return 'other';
  if (meta.id && CATEGORY_OVERRIDES[meta.id]) {
    const override = CATEGORY_OVERRIDES[meta.id];
    if (CATEGORY_DEFINITION_MAP.has(override)) {
      return override;
    }
  }
  const source = (meta.category || '').toLowerCase();
  if (PREFIX_TO_CATEGORY.has(source)) {
    return PREFIX_TO_CATEGORY.get(source);
  }
  const inferred = extractEnginePrefix(meta.id || meta.label || '');
  if (PREFIX_TO_CATEGORY.has(inferred)) {
    return PREFIX_TO_CATEGORY.get(inferred);
  }
  return 'other';
}

function ensureCategoryCollections(category) {
  const cat = normalizeCategory(category);
  if (!Object.prototype.hasOwnProperty.call(state.categoryTabs, cat)) {
    state.categoryTabs[cat] = 'engine';
  }
  if (!Object.prototype.hasOwnProperty.call(state.resultsByCategory, cat)) {
    state.resultsByCategory[cat] = [];
  }
}

function schemaTypes(schema) {
  if (!schema || schema.type === undefined || schema.type === null) return [];
  return Array.isArray(schema.type) ? schema.type : [schema.type];
}

function normalizeOptionValue(schema, raw) {
  if (!schema) return raw;
  const types = schemaTypes(schema);
  if (!types.length) return raw;

  if (types.includes('object') || types.includes('array')) {
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}'))
        || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          return JSON.parse(trimmed);
        } catch (err) {
          return raw;
        }
      }
    }
    return raw;
  }

  if (types.includes('boolean')) {
    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'string') {
      if (/^(true|false)$/i.test(raw.trim())) {
        return raw.trim().toLowerCase() === 'true';
      }
    }
  }

  if (types.includes('integer') || types.includes('number')) {
    if (typeof raw === 'number') {
      return types.includes('integer') ? Math.trunc(raw) : raw;
    }
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (trimmed) {
        const parsed = Number(trimmed);
        if (!Number.isNaN(parsed)) {
          return types.includes('integer') ? Math.trunc(parsed) : parsed;
        }
      }
    }
    return raw;
  }

  if (typeof raw === 'string') {
    return raw.trim();
  }
  return raw;
}

function coerceParameterValue(schema, raw) {
  if (raw === undefined || raw === null) return raw;
  if (typeof raw !== 'string') return raw;

  const types = schemaTypes(schema);
  const trimmed = raw.trim();

  if (!types.length) {
    return raw;
  }

  if (trimmed === '') {
    if (types.includes('string') && types.length === 1) {
      return '';
    }
    return undefined;
  }

  if (types.includes('integer') || types.includes('number')) {
    const num = Number(trimmed);
    if (!Number.isNaN(num)) {
      return types.includes('integer') ? Math.trunc(num) : num;
    }
  }

  if (types.includes('boolean')) {
    if (/^(true|false)$/i.test(trimmed)) {
      return trimmed.toLowerCase() === 'true';
    }
  }

  if (types.includes('object') || types.includes('array')) {
    if ((trimmed.startsWith('{') && trimmed.endsWith('}'))
      || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        return JSON.parse(trimmed);
      } catch (err) {
        // fall through to raw return
      }
    }
  }

  return raw;
}

function formatParameterValueForInput(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (err) {
      return '';
    }
  }
  return String(value);
}

function isSameParameterValue(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a === 'object' && a && b) {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch (err) {
      return false;
    }
  }
  return false;
}

function templateMatchesFilters(template, filters) {
  if (!template) return false;
  const effective = (filters && typeof filters === 'object') ? filters : ensureTemplateMenuFilters();
  const category = effective.category;
  if (!templateMatchesCategory(template, category)) {
    return false;
  }
  const typeFilter = effective.type;
  if (typeFilter && typeFilter !== 'all') {
    const templateType = normalizeTypeToken(template.type);
    if (typeFilter === 'other') {
      const templateCategory = normalizeCategory(template.category);
      if (templateCategory !== 'other') {
        return false;
      }
    } else {
      const normalizedType = normalizeTypeToken(typeFilter);
      if (!normalizedType) {
        return false;
      }
      if (templateType !== normalizedType) {
        return false;
      }
    }
  }
  const query = effective.query;
  if (query && query.trim()) {
    const normalizedQuery = query.trim().toLowerCase();
    const haystackParts = [];
    if (template.name) haystackParts.push(template.name);
    if (template.prompt) haystackParts.push(template.prompt);
    if (template.memo) haystackParts.push(template.memo);
    if (template.soundText) haystackParts.push(template.soundText);
    if (template.filePrefix) haystackParts.push(template.filePrefix);
    if (template.id) haystackParts.push(template.id);
    if (template.description) haystackParts.push(template.description);
    if (Array.isArray(template.tags) && template.tags.length) {
      haystackParts.push(template.tags.join(' '));
    }
    const haystack = haystackParts.join(' ').toLowerCase();
    if (!haystack.includes(normalizedQuery)) {
      return false;
    }
  }
  return true;
}

const ENUM_RANGE_EXPANSION_LIMIT = 200;
const ENUM_OPTION_LIMIT = 100;

function extractEnumOptions(schema, parameterName = '') {
  if (!schema) return [];

  const options = [];
  const seen = new Set();
  const types = schemaTypes(schema);

  // URL パラメータは description からのオプション抽出をスキップ
  const isUrlParameter = parameterName.endsWith('_url') || parameterName.endsWith('_uri');

  const pushOption = (rawValue, label) => {
    if (options.length >= ENUM_OPTION_LIMIT) return;
    const value = normalizeOptionValue(schema, rawValue);
    if (value === undefined || value === null) return;
    const key = typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (seen.has(key)) return;
    seen.add(key);
    options.push({ value, label: label || formatParameterValueForInput(value) });
  };

  if (Array.isArray(schema.enum) && schema.enum.length) {
    schema.enum.forEach((value, index) => {
      const label = (schema.enumTitles && schema.enumTitles[index])
        || (schema.enumNames && schema.enumNames[index])
        || formatParameterValueForInput(value);
      pushOption(value, label);
    });
  }

  const variants = Array.isArray(schema.oneOf) && schema.oneOf.length
    ? schema.oneOf
    : (Array.isArray(schema.anyOf) ? schema.anyOf : null);
  if (variants) {
    variants.forEach((variant) => {
      if (!variant) return;
      if (Object.prototype.hasOwnProperty.call(variant, 'const')) {
        pushOption(variant.const, variant.title || variant.description);
        return;
      }
      if (Array.isArray(variant.enum) && variant.enum.length) {
        pushOption(variant.enum[0], variant.title || variant.description);
      }
    });
  }

  if (Array.isArray(schema.examples)) {
    schema.examples.forEach((example) => {
      pushOption(example);
    });
  }

  // image_size のような、文字列プリセットまたはオブジェクトを許容するパラメータは
  // descriptionからプリセットを抽出する必要がある
  // 例: "square_hd, square, portrait_4_3" などの文字列プリセットがdescriptionに含まれる
  const hasStringPresetInDescription = schema.description && /\b[a-z_]+\s*,\s*[a-z_]+/i.test(schema.description);
  const allowDescriptionExtraction = !isUrlParameter
    && (types.length === 0
      || hasStringPresetInDescription
      || (!types.includes('number') && !types.includes('integer') && !types.includes('array') && !types.includes('object')));

  if (allowDescriptionExtraction) {
    const addOptionsFromText = (text) => {
      if (!text) return;
      let normalized = text.replace(/(?:default|defaults?)\s*(?:[:：]|=)\s*[^,、。．]+/gi, '');
      normalized = normalized.replace(/(?:default|defaults?)\s+(?:is|are)\s+[^,、。．]+/gi, '');
      normalized = normalized.replace(/\bor\b/gi, ',');
      normalized = normalized.replace(/\band\b/gi, ',');
      normalized = normalized.replace(/[\/]/g, ',');
      normalized.split(/[,、]/).map((item) => item.trim()).forEach((rawToken) => {
        if (!rawToken) return;
        if (/^default[:：]/i.test(rawToken)) return;
        if (rawToken.includes('{') || rawToken.includes('}')) return;
        let token = rawToken.replace(/^(?:about|around|approximately)\s+/i, '');
        token = token.replace(/\bseconds?\b/gi, 's');
        token = token.replace(/\bsecs?\b/gi, 's');
        token = token.replace(/\bminutes?\b/gi, 'm');
        token = token.replace(/\bmins?\b/gi, 'm');
        token = token.replace(/\bhours?\b/gi, 'h');
        token = token.replace(/\bframes?\b/gi, 'f');
        token = token.replace(/\s*-\s*/g, '-');
        token = token.replace(/\s+/g, ' ').trim();
        if (/^-?\d+\.$/.test(token)) {
          token = token.slice(0, -1);
        }
        token = token.replace(/[。．。、，,;；:：]+$/g, '');
        const unitMatch = token.match(/^(-?\d+(?:\.\d+)?)\s*([a-zA-Z]{1,4})$/);
        if (unitMatch) {
          token = `${unitMatch[1]}${unitMatch[2].toLowerCase()}`;
        }
        if (/\s/.test(token) && !token.includes('_')) return;
        if (/^\+\$/i.test(token)) return;
        const rangeMatch = token.match(/^(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)$/);
        if (rangeMatch) {
          const start = Number(rangeMatch[1]);
          const end = Number(rangeMatch[2]);
          if (!Number.isNaN(start) && !Number.isNaN(end)) {
            const rangeSize = Math.floor(Math.abs(end - start)) + 1;
            if (rangeSize <= ENUM_RANGE_EXPANSION_LIMIT) {
              const step = start <= end ? 1 : -1;
              for (let value = start; step > 0 ? value <= end : value >= end; value += step) {
                pushOption(value);
              }
            }
          }
          return;
        }
        pushOption(token);
      });
    };

    const descriptions = collectSchemaDescriptions(schema);
    const optionRegexes = [
      /options?\s*[:：]\s*([^。．\n]+)/gi,
      /options?\s+(?:include|are|available)\s+([^。．\n]+)/gi
    ];

    descriptions.forEach((description) => {
      if (typeof description !== 'string' || !description) return;
      const parenRegex = /\(([^)]+)\)/g;
      let parenMatch;
      while ((parenMatch = parenRegex.exec(description)) !== null) {
        addOptionsFromText(parenMatch[1]);
      }

      optionRegexes.forEach((regex) => {
        regex.lastIndex = 0;
        let optionMatch;
        while ((optionMatch = regex.exec(description)) !== null) {
          addOptionsFromText(optionMatch[1]);
        }
      });
    });
  }

  return options;
}

function createEnumOptionKey(value) {
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function mergeManualParameterOptions(existing, manual, schema) {
  const base = Array.isArray(existing) ? existing.slice() : [];
  if (!Array.isArray(manual) || !manual.length) {
    return base;
  }
  const seen = new Set(base.map((option) => createEnumOptionKey(option.value)));
  manual.forEach((candidate) => {
    if (!candidate) return;
    const rawValue = Object.prototype.hasOwnProperty.call(candidate, 'value')
      ? candidate.value
      : candidate;
    const normalizedValue = normalizeOptionValue(schema, rawValue);
    const key = createEnumOptionKey(normalizedValue);
    if (seen.has(key)) return;
    const label = candidate && typeof candidate === 'object' && candidate.label
      ? candidate.label
      : formatParameterValueForInput(normalizedValue);
    base.push({ value: normalizedValue, label });
    seen.add(key);
  });
  return base;
}

function getManualParameterOptions(engineMeta, paramKey, schema) {
  if (!engineMeta || !engineMeta.id || !paramKey) {
    return [];
  }
  const hints = ENGINE_PARAMETER_OPTION_HINTS[engineMeta.id];
  if (!hints) return [];
  const raw = hints[paramKey];
  if (!raw) return [];
  let items;
  if (Array.isArray(raw)) {
    items = raw;
  } else if (raw && typeof raw === 'object' && Array.isArray(raw.options)) {
    items = raw.options;
  } else {
    items = [raw];
  }
  return mergeManualParameterOptions([], items, schema);
}

function getManualParameterDefault(engineMeta, paramKey, schema) {
  if (!engineMeta || !engineMeta.id || !paramKey) {
    return undefined;
  }
  const hints = ENGINE_PARAMETER_OPTION_HINTS[engineMeta.id];
  if (!hints) return undefined;
  const raw = hints[paramKey];
  if (!raw || typeof raw !== 'object') return undefined;
  if (!Object.prototype.hasOwnProperty.call(raw, 'default')) return undefined;
  return normalizeOptionValue(schema, raw.default);
}

function cloneParameterDefault(value) {
  if (Array.isArray(value)) {
    return value.map((item) => cloneParameterDefault(item));
  }
  if (value && typeof value === 'object') {
    const copy = {};
    Object.keys(value).forEach((key) => {
      copy[key] = cloneParameterDefault(value[key]);
    });
    return copy;
  }
  return value;
}

function getSchemaDefaultValue(schema) {
  if (!schema) return undefined;
  if (Object.prototype.hasOwnProperty.call(schema, 'default')) {
    return schema.default;
  }
  if (Object.prototype.hasOwnProperty.call(schema, 'const')) {
    return schema.const;
  }
  if (Array.isArray(schema.enum) && schema.enum.length === 1) {
    return schema.enum[0];
  }
  return undefined;
}

function sanitizeDefaultToken(token) {
  if (typeof token !== 'string') return '';
  return token
    .trim()
    .replace(/^["'`]/, '')
    .replace(/["'`]+$/, '')
    .replace(/[。．。、，,;；:：.!?]+$/g, '')
    .trim();
}

function extractDefaultTokensFromText(text) {
  if (typeof text !== 'string' || !text.trim()) return [];
  const normalized = text.replace(/[\u3000\u00A0]/g, ' ');
  const patterns = [
    /defaults?\s*(?:to|is|are|at)\s*([^.,;。．，、]+)/gi,
    /default(?:\s+value)?\s*(?:=|:)?\s*([^.,;。．，、]+)/gi,
    /デフォルト[：:]?\s*([^。,．，、]+)/gi
  ];
  const tokens = [];
  patterns.forEach((regex) => {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(normalized)) !== null) {
      const candidate = sanitizeDefaultToken(match[1]);
      if (candidate) {
        tokens.push(candidate);
      }
    }
  });
  return tokens;
}

function deriveDefaultFromDescriptions(schema, options) {
  const descriptions = collectSchemaDescriptions(schema);
  if (!descriptions.length) return undefined;
  for (const description of descriptions) {
    const tokens = extractDefaultTokensFromText(description);
    if (!tokens.length) continue;
    for (const token of tokens) {
      const normalized = normalizeOptionValue(schema, token);
      if (normalized === undefined || normalized === null || normalized === '') continue;
      if (Array.isArray(options) && options.length) {
        let matched = options.find((option) => isSameParameterValue(option.value, normalized));
        if (!matched && typeof normalized === 'string') {
          const lower = normalized.toLowerCase();
          matched = options.find((option) => typeof option.value === 'string' && option.value.toLowerCase() === lower);
        }
        if (matched) {
          return cloneParameterDefault(matched.value);
        }
      } else {
        return cloneParameterDefault(normalized);
      }
    }
  }
  return undefined;
}

function deriveParameterDefault(engineMeta, paramKey, schema, options) {
  const schemaDefault = getSchemaDefaultValue(schema);
  if (schemaDefault !== undefined) {
    return cloneParameterDefault(schemaDefault);
  }

  const manualDefault = getManualParameterDefault(engineMeta, paramKey, schema);
  if (manualDefault !== undefined) {
    return cloneParameterDefault(manualDefault);
  }

  const types = schemaTypes(schema);
  if (types.includes('boolean')) {
    return undefined;
  }

  if (Array.isArray(options) && options.length) {
    const descriptionDefault = deriveDefaultFromDescriptions(schema, options);
    if (descriptionDefault !== undefined) {
      return descriptionDefault;
    }
    if (options.length === 1) {
      return cloneParameterDefault(options[0].value);
    }
  }

  return undefined;
}

function ensureParameterDefaults(submitParams, store) {
  if (!submitParams || !submitParams.properties || !store) return;
  Object.entries(submitParams.properties).forEach(([key, schema]) => {
    const defaultValue = getSchemaDefaultValue(schema);
    if (defaultValue === undefined) {
      return;
    }
    const current = store[key];
    if (current === undefined || current === null || (typeof current === 'string' && current === '')) {
      store[key] = cloneParameterDefault(defaultValue);
    }
  });
}

function containsCjkCharacters(text) {
  if (!text) return false;
  return /[\u3040-\u30FF\u3400-\u9FFF\uF900-\uFAFF]/.test(text);
}

function normalizeDescriptionCandidate(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed || '';
}

function collectSchemaDescriptions(schema) {
  if (!schema || typeof schema !== 'object') return [];
  const results = [];
  const push = (value) => {
    const text = normalizeDescriptionCandidate(value);
    if (!text) return;
    if (results.includes(text)) return;
    results.push(text);
  };

  const englishCandidates = [
    schema.descriptionEn,
    schema.descriptionEN,
    schema.description_en,
    schema.description_en_us,
    schema.description_en_US,
    schema.descriptionEnglish,
    schema['description:en'],
    schema['description:en-us'],
    schema['description:en_US'],
    schema.markdownDescription,
    schema.markdown_description,
    schema.longDescription,
    schema.long_description,
    schema.originalDescription,
    schema.original_description,
    schema['x-original-description'],
    schema.xOriginalDescription,
    schema.descriptionDefault,
    schema.description_default,
    schema.defaultDescription,
    schema.default_description
  ];

  englishCandidates.forEach(push);

  const nestedSources = [
    schema.descriptions,
    schema.i18n,
    schema.localization,
    schema.localizedDescriptions,
    schema.metadata && schema.metadata.description,
    schema.meta && schema.meta.description
  ];
  nestedSources.forEach((source) => {
    if (!source || typeof source !== 'object') return;
    const keys = ['en', 'en-us', 'en_US', 'en-GB', 'en-gb'];
    keys.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        push(source[key]);
      }
    });
  });

  push(schema.description);
  push(schema.title);
  push(schema.summary);
  push(schema.help);
  push(schema.note);

  return results;
}

function extractAsciiSegment(text) {
  if (typeof text !== 'string') return '';
  const ascii = text
    .replace(/[\u3000\u00A0]/g, ' ')
    .replace(/[^\x20-\x7E]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!ascii) return '';
  return /[A-Za-z0-9]/.test(ascii) ? ascii : '';
}

function resolveParameterDescription(schema) {
  if (!schema) return '';
  const descriptions = collectSchemaDescriptions(schema);
  if (!descriptions.length) return '';

  const englishPreferred = descriptions.find((text) => text && !containsCjkCharacters(text) && /[A-Za-z]/.test(text));
  if (englishPreferred) return englishPreferred;

  const nonCjk = descriptions.find((text) => text && !containsCjkCharacters(text));
  if (nonCjk) return nonCjk;

  for (const text of descriptions) {
    const ascii = extractAsciiSegment(text);
    if (ascii) {
      return ascii;
    }
  }

  return descriptions[0] || '';
}

function adjustPromptFieldHeight(field, { force = false } = {}) {
  if (!field) return;
  const manual = field.dataset.manualResize === 'true';
  if (manual && !force) return;
  const min = Number(field.dataset.minHeight) || PROMPT_MIN_HEIGHT;
  const max = Number(field.dataset.maxHeight) || PROMPT_MAX_HEIGHT;
  field.dataset.autoResizing = 'true';
  field.style.height = 'auto';
  const next = Math.min(Math.max(field.scrollHeight, min), max);
  field.style.height = `${next}px`;
  field.dataset.lastObservedHeight = String(next);
  window.setTimeout(() => {
    if (field.dataset.autoResizing === 'true') {
      delete field.dataset.autoResizing;
    }
  }, 0);
  if (force) {
    delete field.dataset.manualResize;
  }
}

function syncPromptPreview() {
  const promptField = document.getElementById('kc-prompt');
  if (!promptField) return;
  const value = state.prompt || '';
  if (promptField.value !== value) {
    promptField.value = value;
  }
  promptField.placeholder = PROMPT_PLACEHOLDER;
  if (promptField.hasAttribute('readonly')) {
    promptField.removeAttribute('readonly');
  }
  promptField.readOnly = false;
  promptField.disabled = false;
  adjustPromptFieldHeight(promptField);
  updatePromptGeneratorControls();
}

function getSelectedSoundEngines() {
  const list = [];
  if (!(state.selected instanceof Map)) return list;
  state.selected.forEach((entry, id) => {
    const fallback = entry && typeof entry === 'object' ? entry : {};
    const meta = getEngineMeta(id) || { ...fallback, id };
    const category = normalizeCategory(meta?.category || fallback?.category || '');
    if (category === 'sound') {
      list.push({ id, meta, entry: fallback });
    }
  });
  return list;
}

function applySoundTextToInputs(text, { selectedEngines = null } = {}) {
  const targets = Array.isArray(selectedEngines) ? selectedEngines : getSelectedSoundEngines();
  const normalizedText = typeof text === 'string' ? text : '';
  targets.forEach(({ id, meta }) => {
    const engineMeta = meta && meta.id ? meta : { id };
    const store = ensureEngineInputs(engineMeta);
    if (store) {
      const keys = getSoundTextParamKeys(engineMeta);
      const appliedKeys = new Set();
      keys.forEach((key) => {
        appliedKeys.add(key);
        store[key] = normalizedText;
      });
      if (!appliedKeys.size && normalizedText) {
        store.text = normalizedText;
      }
    }
  });
}

function syncSoundTextField({ preferExisting = true } = {}) {
  const wrapper = document.getElementById('kc-sound-text-field');
  const input = document.getElementById('kc-sound-text');
  if (!wrapper || !input) return;

  const soundEngines = getSelectedSoundEngines();
  const shouldShow = soundEngines.length > 0;
  const wasHidden = wrapper.hidden;
  wrapper.hidden = !shouldShow;
  wrapper.classList.toggle('is-visible', shouldShow);

  if (!shouldShow) {
    if (!wasHidden) {
      updateRunButtonState();
    }
    delete input.dataset.manualResize;
    input.style.height = '';
    return;
  }

  let nextValue = state.soundText || '';
  if (preferExisting && (!nextValue || !nextValue.trim())) {
    for (const { meta } of soundEngines) {
      const store = ensureEngineInputs(meta);
      if (!store) continue;
      const keys = getSoundTextParamKeys(meta);
      for (const key of keys) {
        const candidate = typeof store[key] === 'string' ? store[key] : '';
        if (candidate && candidate.trim()) {
          nextValue = candidate;
          break;
        }
      }
      if (nextValue && nextValue.trim()) {
        break;
      }
    }
  }

  if (state.soundText !== nextValue) {
    state.soundText = nextValue;
  }

  input.placeholder = SOUND_TEXT_PLACEHOLDER;
  if (input.value !== state.soundText) {
    input.value = state.soundText;
  }

  applySoundTextToInputs(state.soundText, { selectedEngines: soundEngines });
  attachPromptResizeHandlers(input);
  adjustPromptFieldHeight(input);
  updateRunButtonState();
}

function normalizePromptGeneratorMode(mode) {
  const normalized = String(mode || '').trim().toLowerCase();
  const match = PROMPT_GENERATOR_MODES.find((def) => def.id === normalized);
  return match ? match.id : PROMPT_GENERATOR_DEFAULT_MODE;
}

function updatePromptGeneratorModeButtons() {
  const container = document.getElementById('kc-prompt-generator');
  if (!container) return;
  const buttons = container.querySelectorAll('[data-role="prompt-generator-mode"]');
  const activeMode = normalizePromptGeneratorMode(state.promptGenerator?.mode);
  buttons.forEach((btn) => {
    if (!(btn instanceof HTMLElement)) return;
    const buttonMode = normalizePromptGeneratorMode(btn.dataset.mode);
    const isActive = buttonMode === activeMode;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function updatePromptGeneratorStatus() {
  const statusEl = document.getElementById('kc-prompt-generator-status');
  if (!statusEl) return;
  const generatorState = state.promptGenerator || {};
  const { loading, error, message } = generatorState;
  statusEl.classList.remove('is-error', 'is-success');
  if (loading) {
    statusEl.hidden = false;
    statusEl.textContent = 'Geminiがプロンプトを生成しています…';
    return;
  }
  if (error) {
    statusEl.hidden = false;
    statusEl.classList.add('is-error');
    statusEl.textContent = error;
    return;
  }
  if (message) {
    statusEl.hidden = false;
    statusEl.classList.add('is-success');
    statusEl.textContent = message;
    return;
  }
  statusEl.textContent = '';
  statusEl.hidden = true;
}

function ensurePromptGeneratorState() {
  if (!state.promptGenerator || typeof state.promptGenerator !== 'object') {
    state.promptGenerator = {
      mode: PROMPT_GENERATOR_DEFAULT_MODE,
      loading: false,
      error: '',
      message: '',
      suggestions: [],
      lastPrompt: '',
      lastMode: PROMPT_GENERATOR_DEFAULT_MODE,
      requestId: 0,
      showPanel: false,
      variantCount: PROMPT_GENERATOR_DEFAULT_VARIANTS,
      selectedCategory: DEFAULT_ACTIVE_CATEGORY,
      selectedType: PROMPT_GENERATOR_DEFAULT_TYPE,
      guidanceByType: {},
      activeGuidance: '',
      categoryDirty: false,
      typeDirty: false,
      guidanceDirty: false,
      guidanceTranslationsByType: {},
      activeGuidanceTranslation: '',
      guidanceTranslationDirty: false,
      lastSelectionToken: '',
      lyricsEnabled: PROMPT_GENERATOR_LYRICS_DEFAULTS.enabled,
      lyricsStructure: PROMPT_GENERATOR_LYRICS_DEFAULTS.structure,
      lyricsCharTarget: PROMPT_GENERATOR_LYRICS_DEFAULTS.charTarget,
      lyricsLanguage: PROMPT_GENERATOR_LYRICS_DEFAULTS.language,
      lyricsIncludeSectionLabels: PROMPT_GENERATOR_LYRICS_DEFAULTS.includeSectionLabels,
      lyricsKeywords: PROMPT_GENERATOR_LYRICS_DEFAULTS.keywords,
      soundTextEnabled: PROMPT_GENERATOR_SOUND_TEXT_DEFAULTS.enabled,
      soundTextCharTarget: PROMPT_GENERATOR_SOUND_TEXT_DEFAULTS.charTarget,
      soundTextLanguage: PROMPT_GENERATOR_SOUND_TEXT_DEFAULTS.language,
      soundTextKeywords: PROMPT_GENERATOR_SOUND_TEXT_DEFAULTS.keywords,
      soundTextNotes: PROMPT_GENERATOR_SOUND_TEXT_DEFAULTS.notes
    };
  }
  if (!state.promptGenerator.guidanceByType || typeof state.promptGenerator.guidanceByType !== 'object') {
    state.promptGenerator.guidanceByType = {};
  }
  if (!state.promptGenerator.guidanceTranslationsByType || typeof state.promptGenerator.guidanceTranslationsByType !== 'object') {
    state.promptGenerator.guidanceTranslationsByType = {};
  }
  if (typeof state.promptGenerator.lyricsEnabled !== 'boolean') {
    state.promptGenerator.lyricsEnabled = PROMPT_GENERATOR_LYRICS_DEFAULTS.enabled;
  }
  if (typeof state.promptGenerator.lyricsStructure !== 'string') {
    state.promptGenerator.lyricsStructure = PROMPT_GENERATOR_LYRICS_DEFAULTS.structure;
  } else {
    state.promptGenerator.lyricsStructure = normalizeLyricsStructure(state.promptGenerator.lyricsStructure);
  }
  if (!Number.isFinite(Number(state.promptGenerator.lyricsCharTarget))) {
    state.promptGenerator.lyricsCharTarget = PROMPT_GENERATOR_LYRICS_DEFAULTS.charTarget;
  } else {
    const clamped = clampLyricsCharTarget(state.promptGenerator.lyricsCharTarget);
    state.promptGenerator.lyricsCharTarget = Number.isFinite(clamped)
      ? clamped
      : PROMPT_GENERATOR_LYRICS_DEFAULTS.charTarget;
  }
  if (!state.promptGenerator.lyricsLanguage) {
    state.promptGenerator.lyricsLanguage = PROMPT_GENERATOR_LYRICS_DEFAULTS.language;
  }
  if (typeof state.promptGenerator.lyricsIncludeSectionLabels !== 'boolean') {
    state.promptGenerator.lyricsIncludeSectionLabels = PROMPT_GENERATOR_LYRICS_DEFAULTS.includeSectionLabels;
  }
  if (typeof state.promptGenerator.lyricsKeywords !== 'string') {
    state.promptGenerator.lyricsKeywords = PROMPT_GENERATOR_LYRICS_DEFAULTS.keywords;
  }
  if (typeof state.promptGenerator.soundTextEnabled !== 'boolean') {
    state.promptGenerator.soundTextEnabled = PROMPT_GENERATOR_SOUND_TEXT_DEFAULTS.enabled;
  }
  if (!Number.isFinite(Number(state.promptGenerator.soundTextCharTarget))) {
    state.promptGenerator.soundTextCharTarget = PROMPT_GENERATOR_SOUND_TEXT_DEFAULTS.charTarget;
  } else {
    const clampedVoice = clampSoundTextCharTarget(state.promptGenerator.soundTextCharTarget);
    state.promptGenerator.soundTextCharTarget = Number.isFinite(clampedVoice)
      ? clampedVoice
      : PROMPT_GENERATOR_SOUND_TEXT_DEFAULTS.charTarget;
  }
  if (!state.promptGenerator.soundTextLanguage) {
    state.promptGenerator.soundTextLanguage = PROMPT_GENERATOR_SOUND_TEXT_DEFAULTS.language;
  } else {
    state.promptGenerator.soundTextLanguage = normalizeSoundTextLanguage(state.promptGenerator.soundTextLanguage);
  }
  if (typeof state.promptGenerator.soundTextKeywords !== 'string') {
    state.promptGenerator.soundTextKeywords = PROMPT_GENERATOR_SOUND_TEXT_DEFAULTS.keywords;
  } else {
    state.promptGenerator.soundTextKeywords = sanitizeSoundTextKeywords(state.promptGenerator.soundTextKeywords);
  }
  if (typeof state.promptGenerator.soundTextNotes !== 'string') {
    state.promptGenerator.soundTextNotes = PROMPT_GENERATOR_SOUND_TEXT_DEFAULTS.notes;
  } else {
    state.promptGenerator.soundTextNotes = sanitizeSoundTextNotes(state.promptGenerator.soundTextNotes);
  }
  return state.promptGenerator;
}

function normalizeLyricsStructure(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const legacy = PROMPT_GENERATOR_LYRICS_LEGACY_MAP[trimmed.toLowerCase()];
  if (legacy) return legacy;
  const sanitized = trimmed
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
  return sanitized.slice(0, PROMPT_GENERATOR_LYRICS_STRUCTURE_MAX_LENGTH);
}

function normalizeLyricsLanguage(value) {
  if (typeof value !== 'string') return PROMPT_GENERATOR_LYRICS_DEFAULTS.language;
  const normalized = value.trim().toLowerCase();
  return PROMPT_GENERATOR_LYRICS_LANGUAGE_OPTIONS.includes(normalized)
    ? normalized
    : PROMPT_GENERATOR_LYRICS_DEFAULTS.language;
}

function extractLyricsSections(structureText) {
  if (typeof structureText !== 'string' || !structureText.trim()) return [];
  const tokens = [];
  structureText
    .replace(/\r\n/g, '\n')
    .split(/\n+/)
    .forEach((line) => {
      if (!line) return;
      line.split(/[,、]+/).forEach((segment) => {
        const raw = segment.trim();
        if (!raw) return;
        const bracketMatch = raw.match(/^\[(.*)]$/);
        const normalized = (bracketMatch ? bracketMatch[1] : raw).trim();
        if (normalized) {
          tokens.push(normalized);
        }
      });
    });
  return tokens.slice(0, PROMPT_GENERATOR_LYRICS_SECTION_LIMIT);
}

function clampLyricsCharTarget(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const clamped = Math.max(
    PROMPT_GENERATOR_LYRICS_CHAR_MIN,
    Math.min(PROMPT_GENERATOR_LYRICS_CHAR_MAX, Math.trunc(numeric))
  );
  return clamped;
}

function sanitizeLyricsKeywordsInput(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.slice(0, PROMPT_GENERATOR_LYRICS_KEYWORDS_MAX_LENGTH);
  return trimmed.replace(/\s+$/g, '');
}

function splitLyricsKeywords(value) {
  if (typeof value !== 'string') return [];
  return value
    .split(/[\n,;]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, PROMPT_GENERATOR_LYRICS_KEYWORD_LIMIT);
}

function normalizeSoundTextLanguage(value) {
  if (typeof value !== 'string') return PROMPT_GENERATOR_SOUND_TEXT_DEFAULTS.language;
  const normalized = value.trim().toLowerCase();
  return normalized === 'en' ? 'en' : 'ja';
}

function clampSoundTextCharTarget(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const clamped = Math.max(
    PROMPT_GENERATOR_SOUND_TEXT_CHAR_MIN,
    Math.min(PROMPT_GENERATOR_SOUND_TEXT_CHAR_MAX, Math.trunc(numeric))
  );
  return clamped;
}

function sanitizeSoundTextKeywords(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.slice(0, PROMPT_GENERATOR_SOUND_TEXT_KEYWORDS_MAX_LENGTH);
  return trimmed.replace(/\s+$/g, '');
}

function sanitizeSoundTextNotes(value) {
  if (typeof value !== 'string') return '';
  return value.slice(0, PROMPT_GENERATOR_SOUND_TEXT_NOTES_MAX_LENGTH).trimStart();
}

function splitSoundTextKeywords(value) {
  if (typeof value !== 'string') return [];
  return value
    .split(/[\n,;、]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, PROMPT_GENERATOR_SOUND_TEXT_KEYWORD_LIMIT);
}

function assembleVoiceScriptContext(generatorState) {
  const voiceScript = {
    enabled: Boolean(generatorState?.soundTextEnabled)
  };
  const language = normalizeSoundTextLanguage(generatorState?.soundTextLanguage);
  if (language) {
    voiceScript.language = language;
    generatorState.soundTextLanguage = language;
  }
  const charTarget = clampSoundTextCharTarget(generatorState?.soundTextCharTarget);
  if (Number.isFinite(charTarget)) {
    voiceScript.charTarget = charTarget;
    generatorState.soundTextCharTarget = charTarget;
  }
  if (generatorState?.soundTextKeywords) {
    const rawKeywords = sanitizeSoundTextKeywords(generatorState.soundTextKeywords);
    generatorState.soundTextKeywords = rawKeywords;
    if (rawKeywords) {
      voiceScript.keywordsText = rawKeywords;
    }
    const keywords = splitSoundTextKeywords(rawKeywords);
    if (keywords.length) {
      voiceScript.keywords = keywords;
    }
  }
  if (generatorState?.soundTextNotes) {
    const notes = sanitizeSoundTextNotes(generatorState.soundTextNotes);
    generatorState.soundTextNotes = notes;
    if (notes) {
      voiceScript.notes = notes;
    }
  }
  return voiceScript;
}

function isSoundTextEnabledType(type) {
  const normalized = type === 'other' ? 'other' : normalizeTypeToken(type || '');
  return PROMPT_GENERATOR_SOUND_TEXT_ENABLED_TYPES.has(normalized);
}

function resolvePromptGeneratorCategoryForType(generatorState) {
  if (!generatorState) return DEFAULT_ACTIVE_CATEGORY;
  const selectedCategory = normalizeCategory(generatorState.selectedCategory || '');
  if (selectedCategory === 'sound') {
    return 'sound';
  }
  const inferredCategory = generatorState.selectedType
    ? PROMPT_GENERATOR_TYPE_CATEGORY_MAP.get(generatorState.selectedType)
    : '';
  if (inferredCategory) {
    const normalized = normalizeCategory(inferredCategory);
    if (normalized === 'sound') {
      return 'sound';
    }
    return normalized;
  }
  return selectedCategory;
}

function shouldDisplaySoundTextOptions() {
  const generatorState = ensurePromptGeneratorState();
  const effectiveCategory = resolvePromptGeneratorCategoryForType(generatorState);
  if (effectiveCategory !== 'sound') {
    return false;
  }
  const normalizedType = normalizeTypeToken(generatorState.selectedType || '');
  if (normalizedType) {
    return PROMPT_GENERATOR_SOUND_TEXT_ENABLED_TYPES.has(normalizedType);
  }
  if (!(state.selected instanceof Map) || state.selected.size === 0) {
    return false;
  }
  let show = false;
  state.selected.forEach((entry, id) => {
    if (show) return;
    const meta = state.engineIndex.get(id) || entry || {};
    let typeKey = normalizeTypeToken(determineEngineTypeKey(meta));
    if (!typeKey && entry && entry !== meta) {
      typeKey = normalizeTypeToken(determineEngineTypeKey(entry));
    }
    if (typeKey && PROMPT_GENERATOR_SOUND_TEXT_ENABLED_TYPES.has(typeKey)) {
      show = true;
    }
  });
  return show;
}

function shouldAutoEnableSoundText() {
  if (!shouldDisplaySoundTextOptions()) {
    return false;
  }
  const generatorState = ensurePromptGeneratorState();
  const normalizedType = normalizeTypeToken(generatorState.selectedType || '');
  if (normalizedType && PROMPT_GENERATOR_SOUND_TEXT_AUTO_TYPES.has(normalizedType)) {
    return true;
  }
  if (!(state.selected instanceof Map) || state.selected.size === 0) {
    return false;
  }
  let required = false;
  state.selected.forEach((entry, id) => {
    if (required) return;
    const meta = state.engineIndex.get(id) || entry || {};
    if (engineRequiresSoundText(meta, entry)) {
      required = true;
    }
  });
  return required;
}

function isLyricsEnabledType(type) {
  const normalized = type === 'other' ? 'other' : normalizeTypeToken(type || '');
  return PROMPT_GENERATOR_LYRICS_ENABLED_TYPES.has(normalized);
}

function shouldDisplayLyricsOptions() {
  const generatorState = ensurePromptGeneratorState();
  const effectiveCategory = resolvePromptGeneratorCategoryForType(generatorState);
  if (effectiveCategory !== 'sound') {
    return false;
  }
  const normalizedType = normalizeTypeToken(generatorState.selectedType || '');
  if (normalizedType) {
    return isLyricsEnabledType(normalizedType);
  }
  if (!(state.selected instanceof Map) || state.selected.size === 0) {
    return false;
  }
  let show = false;
  state.selected.forEach((entry, id) => {
    if (show) return;
    const meta = state.engineIndex.get(id) || entry || {};
    let typeKey = normalizeTypeToken(determineEngineTypeKey(meta));
    if (!typeKey && entry && entry !== meta) {
      typeKey = normalizeTypeToken(determineEngineTypeKey(entry));
    }
    if (typeKey && isLyricsEnabledType(typeKey)) {
      show = true;
    }
  });
  return show;
}

function setPromptGeneratorLyricsEnabled(enabled) {
  const generatorState = ensurePromptGeneratorState();
  const next = Boolean(enabled);
  if (generatorState.lyricsEnabled === next) return;
  generatorState.lyricsEnabled = next;
  if (!next) {
    generatorState.lyricsCharTarget = PROMPT_GENERATOR_LYRICS_DEFAULTS.charTarget;
    generatorState.lyricsKeywords = PROMPT_GENERATOR_LYRICS_DEFAULTS.keywords;
  }
  syncPromptGeneratorLyricsControls();
}

function setPromptGeneratorLyricsStructure(structure) {
  const generatorState = ensurePromptGeneratorState();
  const normalized = normalizeLyricsStructure(structure);
  generatorState.lyricsStructure = normalized;
  syncPromptGeneratorLyricsControls();
}

function setPromptGeneratorLyricsLanguage(language) {
  const generatorState = ensurePromptGeneratorState();
  generatorState.lyricsLanguage = normalizeLyricsLanguage(language);
  syncPromptGeneratorLyricsControls();
}

function setPromptGeneratorLyricsIncludeSections(include) {
  const generatorState = ensurePromptGeneratorState();
  generatorState.lyricsIncludeSectionLabels = Boolean(include);
  syncPromptGeneratorLyricsControls();
}

function setPromptGeneratorLyricsCharTarget(value) {
  const generatorState = ensurePromptGeneratorState();
  const clamped = clampLyricsCharTarget(value);
  generatorState.lyricsCharTarget = Number.isFinite(clamped)
    ? clamped
    : PROMPT_GENERATOR_LYRICS_DEFAULTS.charTarget;
  syncPromptGeneratorLyricsControls();
}

function setPromptGeneratorLyricsKeywords(value) {
  const generatorState = ensurePromptGeneratorState();
  generatorState.lyricsKeywords = sanitizeLyricsKeywordsInput(value);
  syncPromptGeneratorLyricsControls();
}

function syncPromptGeneratorLyricsControls() {
  const generatorState = ensurePromptGeneratorState();
  const container = document.getElementById('kc-prompt-generator-lyrics');
  if (!container) return;
  const toggle = document.getElementById('kc-prompt-generator-lyrics-toggle');
  const fields = document.getElementById('kc-prompt-generator-lyrics-fields');
  const structureField = document.getElementById('kc-prompt-generator-lyrics-structure');
  const languageSelect = document.getElementById('kc-prompt-generator-lyrics-language');
  const charInput = document.getElementById('kc-prompt-generator-lyrics-chars');
  const keywordsInput = document.getElementById('kc-prompt-generator-lyrics-keywords');
  const sectionsToggle = document.getElementById('kc-prompt-generator-lyrics-sections');

  const show = shouldDisplayLyricsOptions();
  container.hidden = !show;
  container.style.display = show ? '' : 'none';
  container.classList.toggle('is-active', show);
  container.setAttribute('aria-hidden', show ? 'false' : 'true');

  if (!show) {
    if (toggle instanceof HTMLInputElement) {
      toggle.checked = false;
      toggle.disabled = true;
    }
    if (fields) {
      fields.hidden = true;
      fields.setAttribute('aria-hidden', 'true');
    }
    return;
  }

  const active = generatorState.lyricsEnabled === true;

  if (toggle instanceof HTMLInputElement) {
    toggle.disabled = false;
    toggle.checked = active;
  }
  if (fields) {
    fields.hidden = !active;
    fields.setAttribute('aria-hidden', active ? 'false' : 'true');
  }

  const controls = [structureField, languageSelect, charInput, keywordsInput, sectionsToggle]
    .filter((el) => el instanceof HTMLInputElement
      || el instanceof HTMLSelectElement
      || el instanceof HTMLTextAreaElement);
  controls.forEach((el) => {
    el.disabled = !active;
  });

  if (!active) {
    return;
  }

  if (structureField instanceof HTMLTextAreaElement || structureField instanceof HTMLInputElement) {
    structureField.value = normalizeLyricsStructure(generatorState.lyricsStructure);
  }
  if (languageSelect instanceof HTMLSelectElement) {
    const desired = normalizeLyricsLanguage(generatorState.lyricsLanguage);
    languageSelect.value = desired;
  }
  if (charInput instanceof HTMLInputElement) {
    charInput.value = Number.isFinite(generatorState.lyricsCharTarget)
      ? String(generatorState.lyricsCharTarget)
      : '';
  }
  if (keywordsInput instanceof HTMLInputElement) {
    keywordsInput.value = generatorState.lyricsKeywords || '';
  }
  if (sectionsToggle instanceof HTMLInputElement) {
    sectionsToggle.checked = generatorState.lyricsIncludeSectionLabels !== false;
  }
}

function setPromptGeneratorSoundTextEnabled(enabled) {
  const generatorState = ensurePromptGeneratorState();
  const next = Boolean(enabled);
  if (generatorState.soundTextEnabled === next) return;
  generatorState.soundTextEnabled = next;
  if (!next) {
    generatorState.soundTextCharTarget = PROMPT_GENERATOR_SOUND_TEXT_DEFAULTS.charTarget;
    generatorState.soundTextKeywords = PROMPT_GENERATOR_SOUND_TEXT_DEFAULTS.keywords;
    generatorState.soundTextNotes = PROMPT_GENERATOR_SOUND_TEXT_DEFAULTS.notes;
  }
  syncPromptGeneratorSoundTextControls();
}

function setPromptGeneratorSoundTextLanguage(language) {
  const generatorState = ensurePromptGeneratorState();
  generatorState.soundTextLanguage = normalizeSoundTextLanguage(language);
  syncPromptGeneratorSoundTextControls();
}

function setPromptGeneratorSoundTextCharTarget(value) {
  const generatorState = ensurePromptGeneratorState();
  const clamped = clampSoundTextCharTarget(value);
  generatorState.soundTextCharTarget = Number.isFinite(clamped)
    ? clamped
    : PROMPT_GENERATOR_SOUND_TEXT_DEFAULTS.charTarget;
  syncPromptGeneratorSoundTextControls();
}

function setPromptGeneratorSoundTextKeywords(value) {
  const generatorState = ensurePromptGeneratorState();
  generatorState.soundTextKeywords = sanitizeSoundTextKeywords(value);
  syncPromptGeneratorSoundTextControls();
}

function setPromptGeneratorSoundTextNotes(value) {
  const generatorState = ensurePromptGeneratorState();
  generatorState.soundTextNotes = sanitizeSoundTextNotes(value);
  syncPromptGeneratorSoundTextControls();
}

function syncPromptGeneratorSoundTextControls() {
  const generatorState = ensurePromptGeneratorState();
  const container = document.getElementById('kc-prompt-generator-soundtext');
  if (!container) return;
  const toggle = document.getElementById('kc-prompt-generator-soundtext-toggle');
  const fields = document.getElementById('kc-prompt-generator-soundtext-fields');
  const languageSelect = document.getElementById('kc-prompt-generator-soundtext-language');
  const charInput = document.getElementById('kc-prompt-generator-soundtext-chars');
  const keywordsInput = document.getElementById('kc-prompt-generator-soundtext-keywords');
  const notesField = document.getElementById('kc-prompt-generator-soundtext-notes');

  const show = shouldDisplaySoundTextOptions();
  const autoRequired = show ? shouldAutoEnableSoundText() : false;
  if (autoRequired && generatorState.soundTextEnabled !== true) {
    generatorState.soundTextEnabled = true;
  }
  container.hidden = !show;
  container.style.display = show ? '' : 'none';
  container.classList.toggle('is-active', show);
  container.setAttribute('aria-hidden', show ? 'false' : 'true');

  if (!show) {
    if (toggle instanceof HTMLInputElement) {
      toggle.checked = false;
      toggle.disabled = true;
      toggle.dataset.autoRequired = 'false';
    }
    if (fields) {
      fields.hidden = true;
      fields.setAttribute('aria-hidden', 'true');
    }
    return;
  }

  const active = generatorState.soundTextEnabled === true;

  if (toggle instanceof HTMLInputElement) {
    toggle.disabled = false;
    toggle.dataset.autoRequired = autoRequired ? 'true' : 'false';
    toggle.checked = active;
  }
  if (fields) {
    fields.hidden = !active;
    fields.setAttribute('aria-hidden', active ? 'false' : 'true');
  }

  const controls = [languageSelect, charInput, keywordsInput, notesField]
    .filter((el) => el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement);
  controls.forEach((el) => {
    el.disabled = !active;
  });

  if (!active) {
    return;
  }

  if (languageSelect instanceof HTMLSelectElement) {
    const desired = normalizeSoundTextLanguage(generatorState.soundTextLanguage);
    languageSelect.value = desired;
  }
  if (charInput instanceof HTMLInputElement) {
    charInput.value = Number.isFinite(generatorState.soundTextCharTarget)
      ? String(generatorState.soundTextCharTarget)
      : '';
  }
  if (keywordsInput instanceof HTMLInputElement) {
    keywordsInput.value = generatorState.soundTextKeywords || '';
  }
  if (notesField instanceof HTMLTextAreaElement) {
    notesField.value = generatorState.soundTextNotes || '';
  }
}

function getPromptGeneratorGuidanceKey(type, mode) {
  const normalizedMode = normalizePromptGeneratorMode(mode);
  const normalizedType = type === 'other' ? 'other' : (normalizeTypeToken(type) || 'other');
  return `${normalizedMode}::${normalizedType}`;
}

function getPromptGeneratorHost() {
  if (promptGeneratorHostElement && document.body.contains(promptGeneratorHostElement)) {
    return promptGeneratorHostElement;
  }
  const host = document.getElementById('kc-prompt-generator-host');
  if (host) {
    promptGeneratorHostElement = host;
    return host;
  }
  const panel = document.getElementById('kc-prompt-generator');
  if (panel && panel.parentElement) {
    const placeholder = document.createElement('div');
    placeholder.className = 'kc-prompt-generator-host';
    placeholder.id = 'kc-prompt-generator-host';
    panel.parentElement.insertBefore(placeholder, panel);
    placeholder.append(panel);
    promptGeneratorHostElement = placeholder;
    return placeholder;
  }
  return null;
}

function positionPromptGeneratorMenu(panel, anchor) {
  if (!panel || !anchor) return;
  const anchorRect = anchor.getBoundingClientRect();
  const margin = PROMPT_GENERATOR_FLOAT_MARGIN;
  const offset = PROMPT_GENERATOR_FLOAT_OFFSET;

  panel.style.maxHeight = `calc(100vh - ${margin * 2}px)`;
  let width = panel.getBoundingClientRect().width;
  if (!width) {
    width = Math.min(560, window.innerWidth - margin * 2);
    panel.style.width = `${width}px`;
  }
  width = panel.getBoundingClientRect().width || width || Math.min(560, window.innerWidth - margin * 2);

  let left = anchorRect.right - width;
  if (left < margin) {
    left = margin;
  }
  if (left + width > window.innerWidth - margin) {
    left = Math.max(margin, window.innerWidth - margin - width);
  }

  let top = anchorRect.bottom + offset;
  let height = panel.getBoundingClientRect().height;
  if (!height) {
    height = panel.scrollHeight;
  }
  if (top + height > window.innerHeight - margin) {
    const above = anchorRect.top - offset - height;
    if (above >= margin) {
      top = above;
    } else {
      top = Math.max(margin, window.innerHeight - margin - Math.min(height, window.innerHeight - margin * 2));
    }
  }

  panel.style.left = `${Math.round(left)}px`;
  panel.style.top = `${Math.round(top)}px`;
}

function openPromptGeneratorMenu(anchor) {
  const panel = document.getElementById('kc-prompt-generator');
  const host = getPromptGeneratorHost();
  if (!panel || !anchor || !host) return;

  if (promptGeneratorMenuState
    && promptGeneratorMenuState.anchor === anchor
    && document.body.contains(panel)) {
    positionPromptGeneratorMenu(panel, anchor);
    return;
  }

  closePromptGeneratorMenu({ preserveState: true });

  panel.hidden = false;
  panel.setAttribute('aria-hidden', 'false');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.classList.add('kc-prompt-generator--floating');
  panel.classList.remove('is-open');
  panel.style.visibility = 'hidden';
  panel.style.pointerEvents = 'none';
  document.body.append(panel);

  const reposition = () => {
    positionPromptGeneratorMenu(panel, anchor);
  };

  reposition();
  panel.style.visibility = '';
  panel.style.pointerEvents = '';
  window.requestAnimationFrame(() => {
    panel.classList.add('is-open');
    try {
      panel.focus({ preventScroll: true });
    } catch (err) {
      // フォーカス不可の場合は無視
    }
  });

  const onOutsideClick = (evt) => {
    if (!panel.contains(evt.target) && evt.target !== anchor) {
      setPromptGeneratorPanelVisible(false);
    }
  };
  const onKeyDown = (evt) => {
    if (evt.key === 'Escape') {
      evt.preventDefault();
      setPromptGeneratorPanelVisible(false);
    }
  };
  const onViewportChange = () => {
    reposition();
  };

  document.addEventListener('mousedown', onOutsideClick);
  document.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', onViewportChange, { passive: true });
  window.addEventListener('scroll', onViewportChange, { passive: true, capture: true });

  anchor.classList.add('is-active');
  anchor.setAttribute('aria-expanded', 'true');

  promptGeneratorMenuState = {
    anchor,
    host,
    onOutsideClick,
    onKeyDown,
    onViewportChange
  };
}

function closePromptGeneratorMenu({ preserveState = false } = {}) {
  const panel = document.getElementById('kc-prompt-generator');
  const menuState = promptGeneratorMenuState;
  if (menuState) {
    document.removeEventListener('mousedown', menuState.onOutsideClick);
    document.removeEventListener('keydown', menuState.onKeyDown);
    window.removeEventListener('resize', menuState.onViewportChange);
    window.removeEventListener('scroll', menuState.onViewportChange, true);
    if (menuState.anchor) {
      menuState.anchor.classList.remove('is-active');
      menuState.anchor.setAttribute('aria-expanded', 'false');
    }
  }
  if (panel) {
    panel.classList.remove('is-open');
    panel.classList.remove('kc-prompt-generator--floating');
    panel.removeAttribute('role');
    panel.removeAttribute('aria-modal');
    panel.style.visibility = '';
    panel.style.pointerEvents = '';
    panel.style.top = '';
    panel.style.left = '';
    panel.style.width = '';
    panel.style.maxHeight = '';
    panel.hidden = true;
    panel.setAttribute('aria-hidden', 'true');
    const host = getPromptGeneratorHost();
    if (host) {
      host.append(panel);
    }
  }
  promptGeneratorMenuState = null;
  if (!preserveState) {
    const generatorState = ensurePromptGeneratorState();
    generatorState.showPanel = false;
  }
}

function syncPromptGeneratorPanelVisibility({ anchor } = {}) {
  const generatorState = ensurePromptGeneratorState();
  const toggle = document.getElementById('kc-prompt-generator-toggle');
  const isVisible = Boolean(generatorState.showPanel);
  if (toggle) {
    toggle.setAttribute('aria-expanded', isVisible ? 'true' : 'false');
    toggle.classList.toggle('is-active', isVisible);
  }

  if (isVisible) {
    const targetAnchor = anchor || promptGeneratorMenuState?.anchor || toggle;
    if (targetAnchor) {
      openPromptGeneratorMenu(targetAnchor);
    }
    return;
  }

  closePromptGeneratorMenu({ preserveState: true });
}

function setPromptGeneratorPanelVisible(visible, { anchor } = {}) {
  const generatorState = ensurePromptGeneratorState();
  const next = Boolean(visible);
  if (generatorState.showPanel === next) {
    syncPromptGeneratorPanelVisibility({ anchor });
    return;
  }
  generatorState.showPanel = next;
  if (next) {
    refreshPromptGeneratorDefaults();
  }
  syncPromptGeneratorPanelVisibility({ anchor });
  if (next) {
    syncPromptGeneratorSelectors({ refreshOptions: true });
    syncPromptGeneratorGuidanceField();
  }
}

function togglePromptGeneratorPanel(anchor) {
  const generatorState = ensurePromptGeneratorState();
  setPromptGeneratorPanelVisible(!generatorState.showPanel, { anchor });
}

function resolvePromptGeneratorGuidanceForType(type, category, mode) {
  const generatorState = ensurePromptGeneratorState();
  const normalizedType = type === 'other' ? 'other' : normalizeTypeToken(type);
  const guidanceKey = getPromptGeneratorGuidanceKey(normalizedType || 'other', mode || generatorState.mode);
  if (guidanceKey) {
    const stored = generatorState.guidanceByType?.[guidanceKey];
    if (typeof stored === 'string' && stored.trim()) {
      return stored;
    }
  }
  return getDefaultPromptGeneratorGuidancePack(normalizedType, category, mode || generatorState.mode).en;
}

function resolvePromptGeneratorGuidanceTranslationForType(type, category, mode) {
  const generatorState = ensurePromptGeneratorState();
  const normalizedType = type === 'other' ? 'other' : normalizeTypeToken(type);
  const guidanceKey = getPromptGeneratorGuidanceKey(normalizedType || 'other', mode || generatorState.mode);
  if (guidanceKey) {
    const stored = generatorState.guidanceTranslationsByType?.[guidanceKey];
    if (typeof stored === 'string' && stored.trim()) {
      return stored;
    }
  }
  return getDefaultPromptGeneratorGuidancePack(normalizedType, category, mode || generatorState.mode).ja;
}

function applyPromptGeneratorGuidanceForCurrentType({ force = false } = {}) {
  const generatorState = ensurePromptGeneratorState();
  const type = generatorState.selectedType;
  const category = generatorState.selectedCategory;
  const mode = normalizePromptGeneratorMode(generatorState.mode);
  const nextGuidance = resolvePromptGeneratorGuidanceForType(type, category, mode) || '';
  const nextTranslation = resolvePromptGeneratorGuidanceTranslationForType(type, category, mode) || '';
  if (force || !generatorState.guidanceDirty) {
    setPromptGeneratorGuidance(nextGuidance, { fromUser: false, persist: true });
  }
  if (force || !generatorState.guidanceTranslationDirty) {
    setPromptGeneratorGuidanceTranslation(nextTranslation, { fromUser: false, persist: true });
  }
}

function setPromptGeneratorGuidance(text, { fromUser = false, persist = true } = {}) {
  const generatorState = ensurePromptGeneratorState();
  const sanitized = typeof text === 'string' ? text.trim() : '';
  generatorState.activeGuidance = sanitized;
  if (fromUser) {
    generatorState.guidanceDirty = true;
  } else {
    generatorState.guidanceDirty = false;
  }
  if (persist) {
    const rawType = generatorState.selectedType || '';
    const activeType = rawType === 'other' ? 'other' : normalizeTypeToken(rawType);
    const key = getPromptGeneratorGuidanceKey(activeType || 'other', generatorState.mode);
    if (key) {
      generatorState.guidanceByType[key] = sanitized;
    }
  }
  if (!fromUser) {
    syncPromptGeneratorGuidanceField();
  }
}

function setPromptGeneratorGuidanceTranslation(text, { fromUser = false, persist = true } = {}) {
  const generatorState = ensurePromptGeneratorState();
  const sanitized = typeof text === 'string' ? text.trim() : '';
  generatorState.activeGuidanceTranslation = sanitized;
  if (fromUser) {
    generatorState.guidanceTranslationDirty = true;
  } else {
    generatorState.guidanceTranslationDirty = false;
  }
  if (persist) {
    const rawType = generatorState.selectedType || '';
    const activeType = rawType === 'other' ? 'other' : normalizeTypeToken(rawType);
    const key = getPromptGeneratorGuidanceKey(activeType || 'other', generatorState.mode);
    if (key) {
      generatorState.guidanceTranslationsByType[key] = sanitized;
    }
  }
  if (!fromUser) {
    syncPromptGeneratorGuidanceField();
  }
}

function setPromptGeneratorCategory(category, { fromUser = false } = {}) {
  const generatorState = ensurePromptGeneratorState();
  const normalized = category ? normalizeCategory(category) : '';
  if (generatorState.selectedCategory === normalized) {
    if (fromUser) generatorState.categoryDirty = true;
    return;
  }
  generatorState.selectedCategory = normalized;
  if (fromUser) {
    generatorState.categoryDirty = true;
  } else if (!normalized) {
    generatorState.categoryDirty = false;
  }
  if (!fromUser && !generatorState.typeDirty && generatorState.selectedType) {
    const inferred = PROMPT_GENERATOR_TYPE_CATEGORY_MAP.get(generatorState.selectedType);
    if (inferred && inferred !== normalized) {
      // keep category aligned with type unless user explicitly changed it later
      generatorState.selectedCategory = inferred;
    }
  }
  let typeAdjusted = false;
  const allowedTypes = getPromptGeneratorTypeOptionsForCategory(generatorState.selectedCategory);
  if (allowedTypes.length) {
    const hasCurrent = allowedTypes.some((option) => option.id === generatorState.selectedType);
    if (!hasCurrent) {
      const fallbackType = allowedTypes[0]?.id || '';
      if (fallbackType && fallbackType !== generatorState.selectedType) {
        setPromptGeneratorType(fallbackType, { fromUser: false });
        typeAdjusted = true;
      }
    }
  }
  if (!typeAdjusted) {
    applyPromptGeneratorGuidanceForCurrentType({ force: fromUser });
    syncPromptGeneratorSelectors();
  } else {
    syncPromptGeneratorSelectors();
  }
}

function setPromptGeneratorType(type, { fromUser = false } = {}) {
  const generatorState = ensurePromptGeneratorState();
  const normalized = type === 'other' ? 'other' : normalizeTypeToken(type);
  const previousTypeRaw = generatorState.selectedType || '';
  const previousNormalized = previousTypeRaw === 'other' ? 'other' : normalizeTypeToken(previousTypeRaw);
  if (previousNormalized) {
    const previousKey = getPromptGeneratorGuidanceKey(previousNormalized, generatorState.mode);
    if (typeof generatorState.activeGuidance === 'string') {
      generatorState.guidanceByType[previousKey] = generatorState.activeGuidance;
    }
    if (typeof generatorState.activeGuidanceTranslation === 'string') {
      generatorState.guidanceTranslationsByType[previousKey] = generatorState.activeGuidanceTranslation;
    }
  }
  if (previousNormalized === normalized) {
    if (fromUser) generatorState.typeDirty = true;
    return;
  }
  generatorState.selectedType = normalized;
  if (fromUser) {
    generatorState.typeDirty = true;
  } else if (!normalized) {
    generatorState.typeDirty = false;
  }
  if (!generatorState.categoryDirty) {
    const inferredCategory = normalized ? PROMPT_GENERATOR_TYPE_CATEGORY_MAP.get(normalized) : '';
    if (inferredCategory) {
      generatorState.selectedCategory = inferredCategory;
    }
  }
  applyPromptGeneratorGuidanceForCurrentType({ force: true });
  syncPromptGeneratorSelectors();
}

function setPromptGeneratorVariantCount(count) {
  const generatorState = ensurePromptGeneratorState();
  const numeric = Number(count);
  const clamped = Number.isFinite(numeric)
    ? Math.min(Math.max(Math.trunc(numeric), 1), PROMPT_GENERATOR_MAX_SUGGESTIONS)
    : PROMPT_GENERATOR_DEFAULT_VARIANTS;
  if (generatorState.variantCount === clamped) {
    syncPromptGeneratorSelectors();
    return;
  }
  generatorState.variantCount = clamped;
  syncPromptGeneratorSelectors();
}

function syncPromptGeneratorSelectors({ refreshOptions = false } = {}) {
  const generatorState = ensurePromptGeneratorState();
  const categorySelect = document.getElementById('kc-prompt-generator-category');
  const typeSelect = document.getElementById('kc-prompt-generator-type');
  const variantSelect = document.getElementById('kc-prompt-generator-variants');
  if (categorySelect instanceof HTMLSelectElement) {
    if (refreshOptions || categorySelect.options.length !== PROMPT_GENERATOR_CATEGORY_OPTIONS.length) {
      const fragment = document.createDocumentFragment();
      PROMPT_GENERATOR_CATEGORY_OPTIONS.forEach((option) => {
        const opt = document.createElement('option');
        opt.value = option.id;
        opt.textContent = option.label;
        fragment.append(opt);
      });
      categorySelect.replaceChildren(fragment);
    }
    const desiredCategory = generatorState.selectedCategory && PROMPT_GENERATOR_CATEGORY_OPTIONS
      .some((option) => option.id === generatorState.selectedCategory)
      ? generatorState.selectedCategory
      : DEFAULT_ACTIVE_CATEGORY;
    if (generatorState.selectedCategory !== desiredCategory) {
      generatorState.selectedCategory = desiredCategory;
    }
    if (categorySelect.value !== desiredCategory) {
      categorySelect.value = desiredCategory;
    }
  }
  if (typeSelect instanceof HTMLSelectElement) {
    const allowedTypes = getPromptGeneratorTypeOptionsForCategory(generatorState.selectedCategory);
    const fragment = document.createDocumentFragment();
    allowedTypes.forEach((option) => {
      const opt = document.createElement('option');
      opt.value = option.id;
      opt.textContent = option.label;
      fragment.append(opt);
    });
    typeSelect.replaceChildren(fragment);
    const allowedIds = allowedTypes.map((option) => option.id);
    const fallbackType = allowedIds[0] || '';
    if (!allowedIds.includes(generatorState.selectedType)) {
      generatorState.selectedType = fallbackType;
      generatorState.typeDirty = false;
      generatorState.guidanceDirty = false;
      generatorState.guidanceTranslationDirty = false;
      applyPromptGeneratorGuidanceForCurrentType({ force: true });
    }
    const targetType = generatorState.selectedType || fallbackType || '';
    if (typeSelect.value !== targetType) {
      typeSelect.value = targetType;
    }
  }
  if (variantSelect instanceof HTMLSelectElement) {
    if (refreshOptions && variantSelect.options.length === 0) {
      const fragment = document.createDocumentFragment();
      PROMPT_GENERATOR_VARIANT_OPTIONS.forEach((num) => {
        const opt = document.createElement('option');
        opt.value = String(num);
        opt.textContent = `${num}`;
        fragment.append(opt);
      });
      variantSelect.append(fragment);
    }
    const value = String(generatorState.variantCount || PROMPT_GENERATOR_DEFAULT_VARIANTS);
    if (variantSelect.value !== value) {
      variantSelect.value = value;
    }
  }
  syncPromptGeneratorLyricsControls();
  syncPromptGeneratorSoundTextControls();
}

function syncPromptGeneratorGuidanceField() {
  const generatorState = ensurePromptGeneratorState();
  const inputEn = document.getElementById('kc-prompt-generator-guidance-en');
  if (inputEn instanceof HTMLTextAreaElement) {
    const valueEn = generatorState.activeGuidance || '';
    if (!(document.activeElement === inputEn && generatorState.guidanceDirty)) {
      if (inputEn.value !== valueEn) {
        inputEn.value = valueEn;
      }
    }
  }
  const inputJa = document.getElementById('kc-prompt-generator-guidance-ja');
  if (inputJa instanceof HTMLTextAreaElement) {
    const valueJa = generatorState.activeGuidanceTranslation || '';
    if (!(document.activeElement === inputJa && generatorState.guidanceTranslationDirty)) {
      if (inputJa.value !== valueJa) {
        inputJa.value = valueJa;
      }
    }
  }
}

function derivePromptGeneratorDefaultsFromSelection() {
  const result = {
    category: DEFAULT_ACTIVE_CATEGORY,
    type: PROMPT_GENERATOR_DEFAULT_TYPE,
    engineLabel: '',
    engineId: ''
  };
  if (!(state.selected instanceof Map) || state.selected.size === 0) {
    return result;
  }
  const firstEntry = state.selected.values().next().value;
  if (!firstEntry) {
    return result;
  }
  const meta = getEngineMeta(firstEntry.id) || firstEntry || {};
  result.engineId = meta.id || firstEntry.id || '';
  result.engineLabel = meta.displayLabel || meta.label || deriveEngineLabel(result.engineId) || result.engineId || '';
  const prefixCandidates = [
    extractEnginePrefix(meta.id),
    extractEnginePrefix(meta.label),
    extractEnginePrefix(meta.displayLabel),
    determineEngineTypeKey(meta)
  ];
  for (const candidate of prefixCandidates) {
    const normalized = normalizeTypeToken(candidate);
    if (normalized) {
      result.type = normalized;
      break;
    }
  }
  const inferredCategory = meta.category
    || PROMPT_GENERATOR_TYPE_CATEGORY_MAP.get(result.type)
    || state.activeEngineCategory
    || DEFAULT_ACTIVE_CATEGORY;
  result.category = normalizeCategory(inferredCategory || DEFAULT_ACTIVE_CATEGORY);
  if (!result.type && result.category && result.category !== 'other') {
    const fallbackType = PROMPT_GENERATOR_TYPE_OPTIONS.find((option) => option.category === result.category);
    if (fallbackType) {
      result.type = fallbackType.id;
    }
  }
  return result;
}

function buildPromptGeneratorSelectionToken() {
  if (!(state.selected instanceof Map) || state.selected.size === 0) {
    return '__none__';
  }
  const ids = Array.from(state.selected.keys())
    .map((id) => (id === undefined || id === null ? '' : String(id).trim()))
    .filter(Boolean)
    .sort();
  return ids.length ? ids.join('|') : '__empty__';
}

function refreshPromptGeneratorDefaults({ force = false } = {}) {
  const generatorState = ensurePromptGeneratorState();
  const defaults = derivePromptGeneratorDefaultsFromSelection();
  const selectionToken = buildPromptGeneratorSelectionToken();
  const previousTypeRaw = generatorState.selectedType || '';
  const previousNormalized = previousTypeRaw === 'other' ? 'other' : normalizeTypeToken(previousTypeRaw);
  const currentMode = normalizePromptGeneratorMode(generatorState.mode);
  if (previousNormalized) {
    const previousKey = getPromptGeneratorGuidanceKey(previousNormalized, currentMode);
    if (typeof generatorState.activeGuidance === 'string') {
      generatorState.guidanceByType[previousKey] = generatorState.activeGuidance;
    }
    if (typeof generatorState.activeGuidanceTranslation === 'string') {
      generatorState.guidanceTranslationsByType[previousKey] = generatorState.activeGuidanceTranslation;
    }
  }

  const selectionChanged = generatorState.lastSelectionToken !== selectionToken;
  if (selectionChanged) {
    generatorState.lastSelectionToken = selectionToken;
    generatorState.categoryDirty = false;
    generatorState.typeDirty = false;
    generatorState.guidanceDirty = false;
    generatorState.guidanceTranslationDirty = false;
  }

  const shouldForce = force || selectionChanged;

  if (shouldForce || !generatorState.categoryDirty) {
    generatorState.selectedCategory = defaults.category || '';
  }
  if (shouldForce || !generatorState.typeDirty) {
    generatorState.selectedType = defaults.type || '';
  }

  applyPromptGeneratorGuidanceForCurrentType({ force: shouldForce });
  syncPromptGeneratorSelectors({ refreshOptions: true });
  syncPromptGeneratorGuidanceField();
}

function getPromptGeneratorTypeOptionsForCategory(category) {
  const normalized = normalizeCategory(category || DEFAULT_ACTIVE_CATEGORY);
  if (normalized === ALL_CATEGORY_ID) {
    return PROMPT_GENERATOR_TYPE_OPTIONS.slice();
  }
  return PROMPT_GENERATOR_TYPE_OPTIONS.filter((option) => option.category === normalized);
}

function getPromptGeneratorCategoryFallback() {
  const generatorState = ensurePromptGeneratorState();
  if (generatorState.selectedCategory) {
    return generatorState.selectedCategory;
  }
  const defaults = derivePromptGeneratorDefaultsFromSelection();
  return defaults.category || '';
}

function getPromptGeneratorTypeFallback() {
  const generatorState = ensurePromptGeneratorState();
  if (generatorState.selectedType) {
    return generatorState.selectedType;
  }
  const defaults = derivePromptGeneratorDefaultsFromSelection();
  return defaults.type || '';
}
function updatePromptGeneratorControls() {
  const generatorState = ensurePromptGeneratorState();
  const runButton = document.getElementById('kc-prompt-generate');
  if (runButton instanceof HTMLButtonElement) {
    const { loading } = generatorState;
    runButton.disabled = Boolean(loading);
    runButton.setAttribute('aria-busy', loading ? 'true' : 'false');
    runButton.textContent = loading ? '生成中…' : 'プロンプト生成';
  }
  updatePromptGeneratorModeButtons();
  updatePromptGeneratorStatus();
  syncPromptGeneratorPanelVisibility();
  syncPromptGeneratorSelectors();
  syncPromptGeneratorLyricsControls();
  syncPromptGeneratorSoundTextControls();
  syncPromptGeneratorGuidanceField();
}

function schedulePromptGeneratorMessageClear() {
  if (typeof window === 'undefined') return;
  if (promptGeneratorStatusTimer) {
    window.clearTimeout(promptGeneratorStatusTimer);
    promptGeneratorStatusTimer = null;
  }
  if (state.promptGenerator?.loading) return;
  promptGeneratorStatusTimer = window.setTimeout(() => {
    if (state.promptGenerator?.loading) return;
    state.promptGenerator.message = '';
    updatePromptGeneratorStatus();
    promptGeneratorStatusTimer = null;
  }, PROMPT_GENERATOR_STATUS_TIMEOUT_MS);
}

function normalizeSuggestionTemplate(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const template = {};
  if (typeof entry.name === 'string' && entry.name.trim()) {
    template.name = entry.name.trim();
  }
  if (typeof entry.category === 'string' && entry.category.trim()) {
    template.category = entry.category.trim();
  }
  if (typeof entry.type === 'string' && entry.type.trim()) {
    template.type = entry.type.trim();
  }
  if (typeof entry.filePrefix === 'string' && entry.filePrefix.trim()) {
    template.filePrefix = entry.filePrefix.trim();
  }
  if (typeof entry.soundText === 'string' && entry.soundText.trim()) {
    template.soundText = entry.soundText.trim();
  }
  if (typeof entry.memo === 'string' && entry.memo.trim()) {
    template.memo = entry.memo.trim();
  }
  if (Array.isArray(entry.tags)) {
    const tags = entry.tags
      .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
      .filter(Boolean)
      .slice(0, 4);
    if (tags.length) {
      template.tags = tags;
    }
  }
  return Object.keys(template).length ? template : null;
}

function normalizeSuggestionLyricsEntry(entry) {
  if (!entry) return null;
  if (typeof entry === 'string') {
    const text = entry.trim();
    if (!text) return null;
    return { text: text.length > 6000 ? text.slice(0, 6000) : text };
  }
  if (typeof entry !== 'object') return null;
  const baseText = typeof entry.text === 'string'
    ? entry.text
    : (typeof entry.body === 'string'
        ? entry.body
        : (Array.isArray(entry.lines) ? entry.lines.join('\n') : ''));
  const text = typeof baseText === 'string' ? baseText.trim() : '';
  if (!text) return null;
  const normalized = {
    text: text.length > 6000 ? text.slice(0, 6000) : text
  };
  if (typeof entry.structure === 'string' && entry.structure.trim()) {
    normalized.structure = entry.structure.trim();
  }
  if (typeof entry.language === 'string' && entry.language.trim()) {
    normalized.language = entry.language.trim();
  }
  if (typeof entry.length === 'string' && entry.length.trim()) {
    normalized.length = entry.length.trim();
  }
  if (typeof entry.includeSectionLabels === 'boolean') {
    normalized.includeSectionLabels = entry.includeSectionLabels;
  }
  if (Array.isArray(entry.sections)) {
    const sections = entry.sections
      .map((section) => (typeof section === 'string' ? section.trim() : ''))
      .filter(Boolean)
      .slice(0, 12);
    if (sections.length) {
      normalized.sections = sections;
    }
  }
  if (typeof entry.summary === 'string' && entry.summary.trim()) {
    normalized.summary = entry.summary.trim();
  }
  return normalized;
}

function normalizeVoiceScriptSuggestion(entry) {
  if (!entry) return null;
  if (typeof entry === 'string') {
    const text = entry.trim();
    return text ? { text } : null;
  }
  if (typeof entry !== 'object') return null;
  const textCandidate = entry.text || entry.body || entry.script || entry.content || '';
  const text = typeof textCandidate === 'string' ? textCandidate.trim() : '';
  if (!text) return null;
  const result = { text };
  if (typeof entry.language === 'string' && entry.language.trim()) {
    result.language = entry.language.trim().toLowerCase();
  }
  const charTarget = clampSoundTextCharTarget(entry.charTarget ?? entry.characterTarget);
  if (Number.isFinite(charTarget)) {
    result.charTarget = charTarget;
  }
  if (Array.isArray(entry.keywords)) {
    const keywords = entry.keywords
      .map((keyword) => (typeof keyword === 'string' ? keyword.trim() : ''))
      .filter(Boolean)
      .slice(0, PROMPT_GENERATOR_SOUND_TEXT_KEYWORD_LIMIT);
    if (keywords.length) {
      result.keywords = keywords;
    }
  }
  if (typeof entry.keywordsText === 'string' && entry.keywordsText.trim()) {
    result.keywordsText = sanitizeSoundTextKeywords(entry.keywordsText);
  }
  if (typeof entry.notes === 'string' && entry.notes.trim()) {
    result.notes = sanitizeSoundTextNotes(entry.notes);
  }
  return result;
}

function normalizePromptSuggestion(entry, index = 0) {
  if (!entry) return null;
  if (typeof entry === 'string') {
    const trimmed = entry.trim();
    if (!trimmed) return null;
    return {
      label: `案${index + 1}`,
      prompt: trimmed,
      description: ''
    };
  }
  if (typeof entry !== 'object') return null;
  const prompt = typeof entry.prompt === 'string' ? entry.prompt.trim() : '';
  if (!prompt) return null;
  const label = typeof entry.label === 'string' && entry.label.trim()
    ? entry.label.trim()
    : (typeof entry.title === 'string' && entry.title.trim() ? entry.title.trim() : `案${index + 1}`);
  const description = typeof entry.description === 'string' ? entry.description.trim()
    : (typeof entry.notes === 'string' ? entry.notes.trim() : '');
  const tags = Array.isArray(entry.tags)
    ? entry.tags.map((tag) => (typeof tag === 'string' ? tag.trim() : '')).filter(Boolean).slice(0, 4)
    : [];
  const translation = (() => {
    if (typeof entry.translation === 'string' && entry.translation.trim()) {
      return entry.translation.trim();
    }
    if (typeof entry.translationJa === 'string' && entry.translationJa.trim()) {
      return entry.translationJa.trim();
    }
    if (typeof entry.translation_ja === 'string' && entry.translation_ja.trim()) {
      return entry.translation_ja.trim();
    }
    if (typeof entry.promptJa === 'string' && entry.promptJa.trim()) {
      return entry.promptJa.trim();
    }
    if (typeof entry.prompt_ja === 'string' && entry.prompt_ja.trim()) {
      return entry.prompt_ja.trim();
    }
    if (typeof entry.japanese === 'string' && entry.japanese.trim()) {
      return entry.japanese.trim();
    }
    return '';
  })();
  const template = normalizeSuggestionTemplate(entry.template);
  if (template && !template.memo && translation) {
    template.memo = translation;
  }
  const enrichedTemplate = template || {};
  const fallbackCategory = getPromptGeneratorCategoryFallback() || '';
  const fallbackType = getPromptGeneratorTypeFallback() || '';
  if (!enrichedTemplate.category) {
    enrichedTemplate.category = entry.category
      || (entry.meta && entry.meta.category)
      || fallbackCategory;
  }
  if (!enrichedTemplate.type) {
    enrichedTemplate.type = entry.type
      || (entry.meta && entry.meta.type)
      || fallbackType;
  }
  const normalizedTemplateCategory = enrichedTemplate.category
    ? normalizeCategory(enrichedTemplate.category)
    : '';
  const normalizedTemplateType = enrichedTemplate.type
    ? normalizeTypeToken(enrichedTemplate.type)
    : '';
  const entryCategoryNormalized = entry.category ? normalizeCategory(entry.category) : '';
  const entryTypeNormalized = normalizeTypeToken(entry.type);
  const metaCategoryNormalized = entry.meta && entry.meta.category
    ? normalizeCategory(entry.meta.category)
    : '';
  const metaTypeNormalized = entry.meta && entry.meta.type
    ? normalizeTypeToken(entry.meta.type)
    : '';
  const fallbackTypeNormalized = normalizeTypeToken(fallbackType);
  const supportsSoundText = [
    normalizedTemplateCategory,
    entryCategoryNormalized,
    metaCategoryNormalized
  ].some((value) => value === 'sound')
    || [
      normalizedTemplateType,
      entryTypeNormalized,
      metaTypeNormalized,
      fallbackTypeNormalized
    ].some((value) => PROMPT_GENERATOR_SOUND_TEXT_ENABLED_TYPES.has(value));
  const result = { label, prompt, description };
  if (tags.length) {
    result.tags = tags;
  }
  if (enrichedTemplate && Object.keys(enrichedTemplate).length) {
    result.template = enrichedTemplate;
  }
  if (enrichedTemplate.category) {
    result.category = enrichedTemplate.category;
  }
  if (enrichedTemplate.type) {
    result.type = enrichedTemplate.type;
  }
  result.supportsSoundText = supportsSoundText;
  if (translation) {
    result.translation = translation;
  }
  const lyricsEntry = entry.lyrics
    || entry.lyricsText
    || entry.songLyrics
    || (entry.meta && entry.meta.lyrics);
  const normalizedLyrics = normalizeSuggestionLyricsEntry(lyricsEntry);
  if (normalizedLyrics) {
    result.lyrics = normalizedLyrics;
  }
  const voiceScriptEntry = entry.voiceScript
    || entry.voice_text
    || entry.voiceScriptText
    || (entry.meta && entry.meta.voiceScript)
    || (entry.meta && entry.meta.soundText);
  const normalizedVoiceScript = normalizeVoiceScriptSuggestion(voiceScriptEntry);
  if (supportsSoundText && normalizedVoiceScript) {
    result.voiceScript = normalizedVoiceScript;
    if (normalizedVoiceScript.text) {
      result.soundText = normalizedVoiceScript.text;
    }
  } else if (supportsSoundText && typeof entry.soundText === 'string' && entry.soundText.trim()) {
    result.soundText = entry.soundText.trim();
  }
  return result;
}

function renderPromptGeneratorResults() {
  const container = document.getElementById('kc-prompt-generator-results');
  if (!container) return;
  const suggestions = Array.isArray(state.promptGenerator?.suggestions)
    ? state.promptGenerator.suggestions
    : [];
  container.innerHTML = '';
  if (!suggestions.length) {
    return;
  }
  suggestions.forEach((suggestion, index) => {
    if (!suggestion || typeof suggestion.prompt !== 'string') return;
    const item = document.createElement('div');
    item.className = 'kc-prompt-generator__item';

    const header = document.createElement('div');
    header.className = 'kc-prompt-generator__item-header';

    const title = document.createElement('span');
    title.className = 'kc-prompt-generator__item-title';
    const label = suggestion.label || `案${index + 1}`;
    title.textContent = `${index + 1}. ${label}`;
    header.appendChild(title);

    const actions = document.createElement('div');
    actions.className = 'kc-prompt-generator__item-actions';

    const supportsSoundText = suggestion.supportsSoundText === true;
    const soundTextContent = supportsSoundText
      ? (() => {
          if (suggestion.soundText && typeof suggestion.soundText === 'string') {
            return suggestion.soundText.trim();
          }
          if (suggestion.voiceScript && typeof suggestion.voiceScript.text === 'string') {
            return suggestion.voiceScript.text.trim();
          }
          return '';
        })()
      : '';
    const hasSoundText = supportsSoundText && Boolean(soundTextContent);

    const applyBtn = document.createElement('button');
    applyBtn.type = 'button';
    applyBtn.className = 'kc-prompt-generator__action kc-prompt-generator__action--primary';
    applyBtn.textContent = '採用';
    applyBtn.dataset.action = 'apply';
    applyBtn.dataset.index = String(index);
    actions.appendChild(applyBtn);

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'kc-prompt-generator__action';
    copyBtn.textContent = 'コピー';
    copyBtn.dataset.action = 'copy';
    copyBtn.dataset.index = String(index);
    actions.appendChild(copyBtn);

    const templateBtn = document.createElement('button');
    templateBtn.type = 'button';
    templateBtn.className = 'kc-prompt-generator__action';
    templateBtn.textContent = 'テンプレに追加';
    templateBtn.dataset.action = 'template';
    templateBtn.dataset.index = String(index);
    actions.appendChild(templateBtn);

    if (suggestion.lyrics && typeof suggestion.lyrics.text === 'string' && suggestion.lyrics.text.trim()) {
      const copyLyricsBtn = document.createElement('button');
      copyLyricsBtn.type = 'button';
      copyLyricsBtn.className = 'kc-prompt-generator__action';
      copyLyricsBtn.textContent = '歌詞コピー';
      copyLyricsBtn.dataset.action = 'copy-lyrics';
      copyLyricsBtn.dataset.index = String(index);
      actions.appendChild(copyLyricsBtn);
    }
    if (hasSoundText) {
      const copySoundBtn = document.createElement('button');
      copySoundBtn.type = 'button';
      copySoundBtn.className = 'kc-prompt-generator__action';
      copySoundBtn.textContent = '音声テキストコピー';
      copySoundBtn.dataset.action = 'copy-sound-text';
      copySoundBtn.dataset.index = String(index);
      actions.appendChild(copySoundBtn);
    }

    header.appendChild(actions);
    item.appendChild(header);

    if (suggestion.description) {
      const desc = document.createElement('p');
      desc.className = 'kc-prompt-generator__item-description';
      desc.textContent = suggestion.description;
      item.appendChild(desc);
    }

    const textBlock = document.createElement('div');
    textBlock.className = 'kc-prompt-generator__text';
    textBlock.textContent = suggestion.prompt;
    item.appendChild(textBlock);

    if (hasSoundText) {
      const voiceBlock = document.createElement('div');
      voiceBlock.className = 'kc-prompt-generator__soundtext-block';

      const voiceTitle = document.createElement('div');
      voiceTitle.className = 'kc-prompt-generator__soundtext-title';
      voiceTitle.textContent = '音声テキスト案';

      const voiceBody = document.createElement('pre');
      voiceBody.className = 'kc-prompt-generator__soundtext-text';
      voiceBody.textContent = soundTextContent;

      voiceBlock.append(voiceTitle, voiceBody);
      item.appendChild(voiceBlock);
    }

    if (suggestion.lyrics && typeof suggestion.lyrics.text === 'string' && suggestion.lyrics.text.trim()) {
      const lyricsBlock = document.createElement('div');
      lyricsBlock.className = 'kc-prompt-generator__lyrics-block';

      const lyricsTitle = document.createElement('div');
      lyricsTitle.className = 'kc-prompt-generator__lyrics-title';
      lyricsTitle.textContent = '歌詞案';

      const lyricsBody = document.createElement('pre');
      lyricsBody.className = 'kc-prompt-generator__lyrics-text';
      lyricsBody.textContent = suggestion.lyrics.text;

      lyricsBlock.append(lyricsTitle, lyricsBody);
      item.appendChild(lyricsBlock);
    }

    if (suggestion.translation) {
      const translationWrap = document.createElement('div');
      translationWrap.className = 'kc-prompt-generator__translation';

      const translationLabel = document.createElement('div');
      translationLabel.className = 'kc-prompt-generator__translation-label';
      translationLabel.textContent = '日本語訳';

      const translationBody = document.createElement('div');
      translationBody.className = 'kc-prompt-generator__translation-body';
      translationBody.textContent = suggestion.translation;

      translationWrap.append(translationLabel, translationBody);
      item.appendChild(translationWrap);
    }

    container.appendChild(item);
  });
}

function setPromptGeneratorMode(mode) {
  const normalized = normalizePromptGeneratorMode(mode);
  const generatorState = ensurePromptGeneratorState();
  const previousMode = normalizePromptGeneratorMode(generatorState.mode);
  if (previousMode === normalized) {
    updatePromptGeneratorModeButtons();
    return;
  }
  const currentType = generatorState.selectedType || PROMPT_GENERATOR_DEFAULT_TYPE;
  const previousKey = getPromptGeneratorGuidanceKey(currentType, previousMode);
  if (typeof generatorState.activeGuidance === 'string') {
    generatorState.guidanceByType[previousKey] = generatorState.activeGuidance;
  }
  if (typeof generatorState.activeGuidanceTranslation === 'string') {
    generatorState.guidanceTranslationsByType[previousKey] = generatorState.activeGuidanceTranslation;
  }
  generatorState.mode = normalized;
  generatorState.lastMode = normalized;
  generatorState.message = '';
  generatorState.guidanceDirty = false;
  generatorState.guidanceTranslationDirty = false;
  applyPromptGeneratorGuidanceForCurrentType({ force: true });
  updatePromptGeneratorControls();
}

async function copyPromptSuggestion(index) {
  const suggestions = Array.isArray(state.promptGenerator?.suggestions)
    ? state.promptGenerator.suggestions
    : [];
  const entry = suggestions[index];
  if (!entry || !entry.prompt) return;
  const text = entry.prompt;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    state.promptGenerator.message = 'クリップボードにコピーしました';
    state.promptGenerator.error = '';
    updatePromptGeneratorStatus();
    schedulePromptGeneratorMessageClear();
  } catch (err) {
    console.warn('[Showcase] failed to copy prompt', err);
    state.promptGenerator.error = 'クリップボードへコピーできませんでした';
    state.promptGenerator.message = '';
    updatePromptGeneratorStatus();
  }
}

async function copyPromptLyrics(index) {
  const suggestions = Array.isArray(state.promptGenerator?.suggestions)
    ? state.promptGenerator.suggestions
    : [];
  const entry = suggestions[index];
  const lyricsText = entry?.lyrics && typeof entry.lyrics.text === 'string' ? entry.lyrics.text : '';
  if (!lyricsText.trim()) return;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(lyricsText);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = lyricsText;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    state.promptGenerator.message = '歌詞をクリップボードにコピーしました';
    state.promptGenerator.error = '';
    updatePromptGeneratorStatus();
    schedulePromptGeneratorMessageClear();
  } catch (err) {
    console.warn('[Showcase] failed to copy lyrics', err);
    state.promptGenerator.error = '歌詞をコピーできませんでした';
    state.promptGenerator.message = '';
    updatePromptGeneratorStatus();
  }
}

async function copyPromptSoundText(index) {
  const suggestions = Array.isArray(state.promptGenerator?.suggestions)
    ? state.promptGenerator.suggestions
    : [];
  const entry = suggestions[index];
  const soundText = (() => {
    if (entry?.soundText && typeof entry.soundText === 'string') {
      return entry.soundText;
    }
    if (entry?.voiceScript && typeof entry.voiceScript.text === 'string') {
      return entry.voiceScript.text;
    }
    return '';
  })();
  if (!soundText || !soundText.trim()) return;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(soundText);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = soundText;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    state.promptGenerator.message = '音声テキストをコピーしました';
    state.promptGenerator.error = '';
    updatePromptGeneratorStatus();
    schedulePromptGeneratorMessageClear();
  } catch (err) {
    console.warn('[Showcase] failed to copy sound text', err);
    state.promptGenerator.error = '音声テキストをコピーできませんでした';
    state.promptGenerator.message = '';
    updatePromptGeneratorStatus();
  }
}

function collectPromptGeneratorContext() {
  const generatorState = ensurePromptGeneratorState();
  const defaults = derivePromptGeneratorDefaultsFromSelection();
  const context = {
    activeCategory: state.activeEngineCategory || DEFAULT_ACTIVE_CATEGORY,
    activeCategoryLabel: categoryLabel(state.activeEngineCategory || DEFAULT_ACTIVE_CATEGORY),
    engineCount: 0,
    engineTypes: [],
    engineCategories: [],
    requiresMedia: false,
    requiresPrompt: false,
    requiresSoundText: false,
    requiredMediaTypes: [],
    engines: [],
    selectedCategory: generatorState.selectedCategory || defaults.category || '',
    selectedType: generatorState.selectedType || defaults.type || '',
    primaryEngineLabel: defaults.engineLabel || '',
    primaryEngineId: defaults.engineId || '',
    mode: normalizePromptGeneratorMode(generatorState.mode),
    requestedVariantCount: generatorState.variantCount || PROMPT_GENERATOR_DEFAULT_VARIANTS
  };
  if (generatorState.activeGuidance) {
    context.guidance = generatorState.activeGuidance;
  }
  if (generatorState.activeGuidanceTranslation) {
    context.guidanceTranslation = generatorState.activeGuidanceTranslation;
  }
  if (context.selectedCategory) {
    context.selectedCategoryLabel = categoryLabel(context.selectedCategory);
  }
  const canShowSoundText = shouldDisplaySoundTextOptions();

  if (shouldDisplayLyricsOptions() && generatorState.lyricsEnabled) {
    const lyrics = {
      enabled: true,
      language: normalizeLyricsLanguage(generatorState.lyricsLanguage),
      includeSectionLabels: generatorState.lyricsIncludeSectionLabels !== false
    };
    const structureNotes = normalizeLyricsStructure(generatorState.lyricsStructure);
    if (structureNotes) {
      lyrics.structure = structureNotes;
      const sections = extractLyricsSections(structureNotes);
      if (sections.length) {
        lyrics.sections = sections;
      }
    }
    lyrics.format = lyrics.includeSectionLabels ? 'structured' : 'plain';
    const charTarget = clampLyricsCharTarget(generatorState.lyricsCharTarget);
    if (Number.isFinite(charTarget)) {
      lyrics.charTarget = charTarget;
    }
    if (generatorState.lyricsKeywords) {
      const rawKeywords = sanitizeLyricsKeywordsInput(generatorState.lyricsKeywords);
      const keywords = splitLyricsKeywords(rawKeywords);
      generatorState.lyricsKeywords = rawKeywords;
      if (rawKeywords) {
        lyrics.keywordsText = rawKeywords;
      }
      if (keywords.length) {
        lyrics.keywords = keywords;
      }
    }
    context.lyrics = lyrics;
  }
  const hasSelection = state.selected instanceof Map && state.selected.size > 0;

  if (hasSelection) {
    const typeSet = new Set();
    const categorySet = new Set();
    const requiredMediaTypeSet = new Set();
    const engines = [];
    let requiresMedia = false;
    let requiresPrompt = false;
    let requiresSoundText = false;

    state.selected.forEach((entry, id) => {
      const meta = state.engineIndex.get(id) || entry || {};
      const typeToken = determineEngineTypeKey(meta);
      if (typeToken && typeToken !== 'other') {
        typeSet.add(typeToken);
      }
      const engineCategory = normalizeCategory(meta.category || entry.category || context.activeCategory);
      if (engineCategory) {
        categorySet.add(engineCategory);
      }
      const engineRequiresMedia = meta.requiresMedia === true || entry?.requiresMedia === true;
      if (engineRequiresMedia) {
        requiresMedia = true;
      }
      const requiredMediaTypes = Array.isArray(meta.requiredMediaTypes)
        ? meta.requiredMediaTypes
        : Array.isArray(entry?.requiredMediaTypes)
          ? entry.requiredMediaTypes
          : [];
      requiredMediaTypes.forEach((rawType) => {
        const normalized = normalizeMediaGroupType(rawType) || (typeof rawType === 'string' ? rawType.toLowerCase() : '');
        if (normalized) {
          requiredMediaTypeSet.add(normalized);
        }
      });
      if (engineRequiresPrompt(meta)) {
        requiresPrompt = true;
      }
      if (engineRequiresSoundText(meta, entry)) {
        requiresSoundText = true;
      }
      const promptKey = getPromptKey(meta);
      const soundKeys = Array.isArray(meta.soundTextKeys) && meta.soundTextKeys.length
        ? meta.soundTextKeys
        : (Array.isArray(entry?.soundTextKeys) ? entry.soundTextKeys : []);
      engines.push({
        id,
        label: entry?.label || meta.displayLabel || meta.label || deriveEngineLabel(id),
        type: typeToken,
        category: engineCategory,
        requiresMedia: engineRequiresMedia,
        requiredMediaTypes,
        promptKey,
        soundTextKeys: (soundKeys || []).slice(0, 6)
      });
    });

    context.engineCount = state.selected.size;
    context.engineTypes = Array.from(typeSet);
    context.engineCategories = Array.from(categorySet);
    context.requiresMedia = requiresMedia;
    context.requiresPrompt = requiresPrompt;
    context.requiresSoundText = requiresSoundText;
    context.requiredMediaTypes = Array.from(requiredMediaTypeSet);
    context.engines = engines.slice(0, 8);
  }

  const autoRequired = canShowSoundText ? shouldAutoEnableSoundText() : false;
  const shouldAttachVoiceScript = canShowSoundText
    && (generatorState.soundTextEnabled === true || context.requiresSoundText || autoRequired);
  if (shouldAttachVoiceScript) {
    if (generatorState.soundTextEnabled !== true) {
      generatorState.soundTextEnabled = true;
    }
    const voiceScript = assembleVoiceScriptContext(generatorState);
    voiceScript.enabled = true;
    context.voiceScript = voiceScript;
  }

  if (!context.selectedCategory) {
    context.selectedCategory = defaults.category || '';
  }
  if (!context.selectedType) {
    context.selectedType = defaults.type || '';
  }
  if (context.selectedCategory) {
    context.selectedCategoryLabel = categoryLabel(context.selectedCategory);
  }
  return context;
}

function applyPromptSuggestion(index) {
  const suggestions = Array.isArray(state.promptGenerator?.suggestions)
    ? state.promptGenerator.suggestions
    : [];
  const entry = suggestions[index];
  if (!entry || !entry.prompt) return;
  state.prompt = entry.prompt;
  const templateData = (entry.template && typeof entry.template === 'object') ? entry.template : null;
  if (templateData && typeof templateData.filePrefix === 'string' && templateData.filePrefix.trim()) {
    setFilePrefix(templateData.filePrefix, { persist: true });
  }
  const soundTextCandidate = (() => {
    if (entry.soundText && typeof entry.soundText === 'string' && entry.soundText.trim()) {
      return entry.soundText.trim();
    }
    if (entry.voiceScript && typeof entry.voiceScript.text === 'string' && entry.voiceScript.text.trim()) {
      return entry.voiceScript.text.trim();
    }
    if (templateData && typeof templateData.soundText === 'string' && templateData.soundText.trim()) {
      return templateData.soundText.trim();
    }
    return '';
  })();
  if (entry.supportsSoundText === true && soundTextCandidate) {
    state.soundText = soundTextCandidate;
    applySoundTextToInputs(state.soundText);
    syncSoundTextField({ preferExisting: false });
  }
  setPromptGeneratorPanelVisible(false);
  syncPromptPreview();
  updateRunButtonState();
  updatePromptGeneratorControls();
  state.promptGenerator.message = `${entry.label || `案${index + 1}`} をプロンプトに反映しました`;
  state.promptGenerator.error = '';
  schedulePromptGeneratorMessageClear();
}

function addPromptSuggestionToTemplate(index) {
  const suggestions = Array.isArray(state.promptGenerator?.suggestions)
    ? state.promptGenerator.suggestions
    : [];
  const entry = suggestions[index];
  if (!entry || !entry.prompt) return;
  const templateData = (entry.template && typeof entry.template === 'object') ? entry.template : {};
  const memoFallback = templateData.memo || entry.translation || entry.description || '';
  addTemplateFromPrompt({
    prompt: entry.prompt,
    name: templateData.name,
    label: entry.label,
    category: templateData.category,
    type: templateData.type,
    filePrefix: templateData.filePrefix,
    memo: memoFallback,
    soundText: templateData.soundText,
    template: templateData,
    title: '候補からテンプレートを作成'
  });
  setPromptGeneratorPanelVisible(false);
  state.promptGenerator.message = `${entry.label || `案${index + 1}`} をテンプレート追加画面に読み込みました`;
  state.promptGenerator.error = '';
  updatePromptGeneratorStatus();
  schedulePromptGeneratorMessageClear();
}

async function triggerPromptGeneration() {
  if (!state.promptGenerator) return;
  if (state.promptGenerator.loading) return;
  const prompt = (state.prompt || '').trim();
  if (!prompt) {
    state.promptGenerator.error = 'プロンプトを入力してください';
    state.promptGenerator.message = '';
    updatePromptGeneratorStatus();
    return;
  }
  const requestId = (state.promptGenerator.requestId || 0) + 1;
  state.promptGenerator.requestId = requestId;
  state.promptGenerator.loading = true;
  state.promptGenerator.error = '';
  state.promptGenerator.message = '';
  updatePromptGeneratorControls();

  try {
    const generatorState = ensurePromptGeneratorState();
    const variantCount = Math.min(
      Math.max(generatorState.variantCount || PROMPT_GENERATOR_DEFAULT_VARIANTS, 1),
      PROMPT_GENERATOR_MAX_SUGGESTIONS
    );
    if (generatorState.selectedType && generatorState.activeGuidance) {
      const key = getPromptGeneratorGuidanceKey(generatorState.selectedType, generatorState.mode);
      generatorState.guidanceByType[key] = generatorState.activeGuidance;
    }
    const payload = {
      prompt,
      mode: normalizePromptGeneratorMode(state.promptGenerator.mode),
      variantCount,
      context: collectPromptGeneratorContext()
    };
    const response = await fetchJson(PROMPT_GENERATOR_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const suggestions = Array.isArray(response?.suggestions)
      ? response.suggestions.map((entry, index) => normalizePromptSuggestion(entry, index)).filter(Boolean)
      : [];
    state.promptGenerator.suggestions = suggestions.slice(0, variantCount);
    state.promptGenerator.lastPrompt = prompt;
    state.promptGenerator.lastMode = normalizePromptGeneratorMode(state.promptGenerator.mode);
    if (state.promptGenerator.suggestions.length) {
      state.promptGenerator.message = `${state.promptGenerator.suggestions.length}件の候補を生成しました`;
      state.promptGenerator.error = '';
      renderPromptGeneratorResults();
      updatePromptGeneratorStatus();
      schedulePromptGeneratorMessageClear();
    } else {
      state.promptGenerator.error = '候補を取得できませんでした';
      state.promptGenerator.message = '';
      renderPromptGeneratorResults();
      updatePromptGeneratorStatus();
    }
  } catch (err) {
    console.error('[Showcase] prompt generation failed', err);
    let message = 'プロンプト生成に失敗しました';
    if (err && typeof err.message === 'string') {
      message = err.message;
      const jsonMatch = message.match(/\{[\s\S]*\}$/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed && typeof parsed.error === 'string') {
            message = parsed.error;
          }
        } catch (parseErr) {
          console.warn('[Showcase] failed to parse prompt generator error payload', parseErr);
        }
      }
    }
    state.promptGenerator.error = message;
    state.promptGenerator.message = '';
    renderPromptGeneratorResults();
    updatePromptGeneratorStatus();
  } finally {
    if (state.promptGenerator.requestId === requestId) {
      state.promptGenerator.loading = false;
    }
    updatePromptGeneratorControls();
  }
}

function handlePromptGeneratorClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const role = target.dataset.role;
  if (role === 'prompt-generator-mode') {
    event.preventDefault();
    setPromptGeneratorMode(target.dataset.mode || PROMPT_GENERATOR_DEFAULT_MODE);
    updatePromptGeneratorControls();
    return;
  }
  const action = target.dataset.action;
  if (!action) return;
  const index = Number(target.dataset.index);
  if (!Number.isFinite(index)) return;
  event.preventDefault();
  if (action === 'apply') {
    applyPromptSuggestion(index);
  } else if (action === 'copy') {
    copyPromptSuggestion(index);
  } else if (action === 'template') {
    addPromptSuggestionToTemplate(index);
  } else if (action === 'copy-lyrics') {
    copyPromptLyrics(index);
  } else if (action === 'copy-sound-text') {
    copyPromptSoundText(index);
  }
}

function syncFilePrefixField() {
  const field = document.getElementById('kc-file-prefix');
  if (!field) return;
  const value = state.filePrefix || '';
  if (field.value !== value) {
    field.value = value;
  }
}

function updateVisibilityToggleButton(button, { active, icon, labelOn, labelOff }) {
  if (!(button instanceof HTMLButtonElement)) return;
  const isActive = Boolean(active);
  button.classList.toggle('is-active', isActive);
  button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  if (typeof icon === 'string') {
    button.textContent = icon;
  }
  const ariaLabel = isActive
    ? `${labelOn}（ボタンで非表示に切り替え）`
    : `${labelOff}（ボタンで表示に切り替え）`;
  button.setAttribute('aria-label', ariaLabel);
  button.title = ariaLabel;
}

function syncInputToggle() {
  const toggleButton = document.getElementById('kc-results-input-toggle');
  if (!(toggleButton instanceof HTMLButtonElement)) return;
  const showing = state.showInputs !== false;
  updateVisibilityToggleButton(toggleButton, {
    active: showing,
    icon: '📥',
    labelOn: 'INPUTメディアを表示中',
    labelOff: 'INPUTメディアは非表示'
  });
}

function syncParameterToggle() {
  const toggleButton = document.getElementById('kc-results-params-toggle');
  if (!(toggleButton instanceof HTMLButtonElement)) return;
  const showing = state.showParameters !== false;
  updateVisibilityToggleButton(toggleButton, {
    active: showing,
    icon: '⚙️',
    labelOn: 'パラメータを表示中',
    labelOff: 'パラメータは非表示'
  });
}

function syncFailureToggle() {
  const toggleButton = document.getElementById('kc-results-failure-toggle');
  if (!(toggleButton instanceof HTMLButtonElement)) return;
  const showing = Boolean(state.showFailures);
  updateVisibilityToggleButton(toggleButton, {
    active: showing,
    icon: '🚫',
    labelOn: 'Failure結果を表示中',
    labelOff: 'Failure結果は非表示'
  });
}

function setFilePrefix(value, { persist = true } = {}) {
  const next = typeof value === 'string' ? value.trim() : '';
  state.filePrefix = next;
  syncFilePrefixField();
  if (persist) {
    try {
      localStorage.setItem(FILE_PREFIX_STORAGE_KEY, next);
    } catch (err) {
      console.warn('[Showcase] failed to persist file prefix', err);
    }
  }
}

function attachPromptResizeHandlers(field) {
  if (!field || field.dataset.resizeHandlersAttached === 'true') return;
  let startHeight = null;

  const handlePointerDown = () => {
    startHeight = field.offsetHeight;
  };

  const handlePointerUp = () => {
    if (startHeight !== null) {
      const diff = Math.abs(field.offsetHeight - startHeight);
      if (diff > 1) {
        field.dataset.manualResize = 'true';
      }
      startHeight = null;
    }
  };

  const handleMouseDown = handlePointerDown;
  const handleMouseUp = handlePointerUp;

  const resetToAuto = () => {
    delete field.dataset.manualResize;
    adjustPromptFieldHeight(field, { force: true });
  };

  field.addEventListener('pointerdown', handlePointerDown);
  field.addEventListener('pointerup', handlePointerUp);
  field.addEventListener('pointerleave', () => {
    startHeight = null;
  });
  field.addEventListener('mousedown', handleMouseDown);
  field.addEventListener('mouseup', handleMouseUp);
  window.addEventListener('pointerup', handlePointerUp, true);
  window.addEventListener('mouseup', handleMouseUp, true);
  field.addEventListener('dblclick', resetToAuto);

  if (typeof ResizeObserver !== 'undefined' && !field.__kcResizeObserver) {
    try {
      if (!field.dataset.lastObservedHeight) {
        field.dataset.lastObservedHeight = String(field.offsetHeight || field.scrollHeight || PROMPT_MIN_HEIGHT);
      }
      const observer = new ResizeObserver((entries) => {
        entries.forEach((entry) => {
          if (field.dataset.autoResizing === 'true') return;
          if (!entry || !entry.contentRect) return;
          const height = entry.contentRect.height;
          if (!Number.isFinite(height)) return;
          const previous = Number(field.dataset.lastObservedHeight || 0);
          field.dataset.lastObservedHeight = String(height);
          if (Math.abs(height - previous) < 1) return;
          field.dataset.manualResize = 'true';
        });
      });
      observer.observe(field);
      field.__kcResizeObserver = observer;
      field.dataset.resizeObserverAttached = 'true';
    } catch (err) {
      console.warn('[Showcase] failed to attach prompt ResizeObserver', err);
    }
  }

  field.dataset.resizeHandlersAttached = 'true';
}

function renderEngineTabs() {
  const container = document.getElementById('kc-engine-tabs');
  if (!container) return;
  container.innerHTML = '';
  if (!state.categories.length) {
    updateEngineTabVisibility();
    return;
  }
  const tabs = [{ id: ALL_CATEGORY_ID, label: ALL_CATEGORY_LABEL }, ...state.categories];
  tabs.forEach((category) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'kc-panel-tab';
    const isActive = category.id === state.activeEngineCategory;
    applyBadgeTheme(tab, category.id, { fallbackCategory: category.id });
    if (isActive) {
      tab.classList.add('is-active');
    }
    tab.textContent = String(category.label || categoryLabel(category.id)).toUpperCase();
    tab.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    tab.addEventListener('click', () => {
      if (state.activeEngineCategory !== category.id) {
        setActiveEngineCategory(category.id);
      }
    });
    container.append(tab);
  });
  updateEngineTabVisibility();
}

function renderEngineSubTabs() {
  const container = document.getElementById('kc-engine-subtabs');
  if (!container) return;
  container.innerHTML = '';
  const activeCategory = state.activeEngineCategory;
  ensureCategoryCollections(activeCategory);
  if (!state.categoryTabs[activeCategory]) {
    state.categoryTabs[activeCategory] = 'engine';
  }

  const subtabs = [
    { id: 'engine', label: 'MCP' },
    { id: 'media', label: 'INPUT' }
  ];

  subtabs.forEach((info) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'kc-panel-tab kc-panel-tab--sub';
    if (state.categoryTabs[activeCategory] === info.id) {
      tab.classList.add('is-active');
    }
    tab.textContent = info.label;
    tab.addEventListener('click', () => {
      if (state.categoryTabs[activeCategory] === info.id) return;
      state.categoryTabs[activeCategory] = info.id;
      if (info.id === 'media' && state.media.items.length === 0 && !state.media.isLoading) {
        loadMediaLibrary().catch((err) => console.error('[Showcase] media load failed', err));
      } else {
        renderCategories();
      }
      renderEngineSubTabs();
      closeTemplateMenu();
      closeTemplateModal();
      updateRunButtonState();
    });
    container.append(tab);
  });
  updateEngineTabVisibility();
}

function updateEngineTabVisibility() {
  const mainTabs = document.getElementById('kc-engine-tabs');
  const subTabs = document.getElementById('kc-engine-subtabs');
  const controls = mainTabs?.parentElement;
  const showMain = Boolean(mainTabs && state.categories.length > 1);
  const showSub = Boolean(subTabs && subTabs.children && subTabs.children.length);
  if (mainTabs) {
    mainTabs.style.display = showMain ? 'inline-flex' : 'none';
    mainTabs.classList.toggle('kc-panel-tabs--hidden', !showMain);
  }
  if (subTabs) {
    subTabs.style.display = showSub ? 'inline-flex' : 'none';
  }
  if (controls) {
    if (controls.classList.contains('kc-engine-toolbar')) {
      controls.classList.toggle('kc-engine-toolbar--tabs-hidden', !showMain);
    } else {
      controls.style.display = (showMain || showSub) ? 'flex' : 'none';
    }
  }
}

function determineEngineTypeKey(engine, allowedTypes = null) {
  if (!engine) return 'other';
  const token = resolveTypePrefix([
    engine.sourceCategory,
    extractEnginePrefix(engine.id),
    extractEnginePrefix(engine.label),
    engine.category
  ]);
  let key = token ? token.toLowerCase() : 'other';
  if (allowedTypes && allowedTypes.size && key !== 'other' && !allowedTypes.has(key)) {
    key = 'other';
  }
  if (!key) return 'other';
  return key;
}

function getEnginesInCategory(categoryId) {
  const normalized = normalizeCategory(categoryId);
  const payload = state.enginesByCategory.get(normalized);
  if (Array.isArray(payload)) {
    return payload;
  }
  if (normalized === ALL_CATEGORY_ID) {
    const aggregated = state.enginesByCategory.get(ALL_CATEGORY_ID);
    return Array.isArray(aggregated) ? aggregated : [];
  }
  return [];
}

function engineMatchesSearch(engine, tokens) {
  if (!tokens || !tokens.length) return true;
  if (!engine || typeof engine !== 'object') return false;
  const baseLabels = [engine.displayLabel, engine.label, engine.id]
    .filter((value) => typeof value === 'string' && value.trim().length)
    .map((value) => value.trim().toLowerCase());
  if (!baseLabels.length) return false;
  return tokens.every((token) => {
    const normalized = token.toLowerCase();
    return baseLabels.some((label) => label.includes(normalized));
  });
}

function filterEnginesByKeyword(list, keyword) {
  if (!Array.isArray(list) || !list.length) {
    return [];
  }
  const normalized = typeof keyword === 'string' ? keyword.trim().toLowerCase() : '';
  if (!normalized) {
    return list.slice();
  }
  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (!tokens.length) {
    return list.slice();
  }
  return list.filter((engine) => engineMatchesSearch(engine, tokens));
}

function createEngineSearchControls() {
  const controls = document.createElement('div');
  controls.className = 'kc-engine-controls kc-engine-controls--toolbar';
  controls.setAttribute('role', 'search');

  const searchWrap = document.createElement('div');
  searchWrap.className = 'kc-engine-search irs-search';
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.placeholder = 'MCPを検索';
  searchInput.setAttribute('aria-label', 'MCPを検索');
  searchInput.id = 'kc-engine-search-input';
  searchInput.autocomplete = 'off';
  searchInput.value = state.engineSearchKeyword;
  searchInput.addEventListener('input', () => {
    const { selectionStart, selectionEnd } = searchInput;
    state.engineSearchKeyword = searchInput.value;
    renderCategories();
    requestAnimationFrame(() => {
      const nextInput = document.getElementById('kc-engine-search-input');
      if (!nextInput) return;
      nextInput.focus();
      if (typeof selectionStart === 'number' && typeof selectionEnd === 'number') {
        try {
          nextInput.setSelectionRange(selectionStart, selectionEnd);
        } catch (err) {
          try {
            const length = nextInput.value.length;
            nextInput.setSelectionRange(length, length);
          } catch (innerErr) {
            // ignore selection fallback errors
          }
        }
      }
    });
  });
  searchWrap.appendChild(searchInput);
  controls.append(searchWrap);
  return controls;
}

function selectEnginesInCategory(categoryId) {
  const list = getEnginesInCategory(categoryId);
  if (!list.length) return false;
  let changed = false;
  list.forEach((engine) => {
    if (!engine || !engine.id) return;
    if (state.selected.has(engine.id)) return;
    ensureEngineInputs(engine);
    state.selected.set(engine.id, {
      id: engine.id,
      label: engine.displayLabel || engine.label || deriveEngineLabel(engine.id),
      category: engine.category || normalizeCategory(categoryId),
      requiresMedia: Boolean(engine.requiresMedia),
      requiredMediaTypes: Array.isArray(engine.requiredMediaTypes)
        ? engine.requiredMediaTypes.slice()
        : [],
      requiresPrompt: engineRequiresPrompt(engine),
      requiresSoundText: engineRequiresSoundText(engine),
      promptKey: engine.promptKey || getPromptKey(engine),
      soundTextKeys: Array.isArray(engine.soundTextKeys) ? engine.soundTextKeys.slice() : [],
      requiredSoundTextKeys: Array.isArray(engine.requiredSoundTextKeys)
        ? engine.requiredSoundTextKeys.slice()
        : [],
      documentationUrl: engine.documentationUrl || '',
      docSummaryEn: engine.docSummaryEn || '',
      docSummaryJa: engine.docSummaryJa || ''
    });
    changed = true;
  });
  if (changed) {
    applySelectedMediaToEngineInputs();
  }
  return changed;
}

function getSelectedEnginesForCategory(categoryId) {
  const normalized = normalizeCategory(categoryId);
  const entries = [];
  state.selected.forEach((value, id) => {
    const meta = state.engineIndex.get(id) || value || {};
    const rawCategory = meta.category || value?.category;
    const engineCategory = normalizeCategory(rawCategory || DEFAULT_ACTIVE_CATEGORY);
    if (normalized === ALL_CATEGORY_ID || engineCategory === normalized) {
      entries.push({ id, meta });
    }
  });
  return entries;
}

function clearEnginesInCategory(categoryId) {
  const targets = getSelectedEnginesForCategory(categoryId);
  if (!targets.length) return false;
  targets.forEach(({ id }) => {
    state.selected.delete(id);
  });
  return true;
}

function renderEngineStats({
  isLoading = false,
  engines = [],
  filteredEngines = null,
  categoryId = state.activeEngineCategory,
  searchKeyword = state.engineSearchKeyword,
  visible = true
} = {}) {
  const container = document.getElementById('kc-engine-stats');
  if (!container) return;

  container.innerHTML = '';
  container.style.display = visible ? 'flex' : 'none';
  if (!visible) {
    return;
  }
  container.classList.add('kc-engine-stats--enhanced');

  const statsWrap = document.createElement('div');
  statsWrap.className = 'kc-engine-stats__tags';
  container.append(statsWrap);

  if (isLoading) {
    statsWrap.textContent = '読み込み中…';
    return;
  }

  const baseList = Array.isArray(engines) ? engines : [];
  if (!baseList.length) {
    const empty = document.createElement('span');
    empty.className = 'kc-engine-stat__total';
    empty.textContent = 'MCP数: 0';
    statsWrap.append(empty);
    return;
  }

  const displayList = Array.isArray(filteredEngines)
    ? filteredEngines
    : baseList;

  const normalizedCategory = normalizeCategory(categoryId);
  const allowedTypes = new Set(knownTypesForCategory(normalizedCategory));
  const counts = new Map();

  displayList.forEach((engine) => {
    const key = determineEngineTypeKey(engine, allowedTypes);
    const isSelected = engine && state.selected.has(engine.id);
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
      if (isSelected) existing.selected += 1;
    } else {
      counts.set(key, {
        key,
        label: key === 'other' ? 'OTHER' : key.toUpperCase(),
        count: 1,
        selected: isSelected ? 1 : 0
      });
    }
  });

  const fragment = document.createDocumentFragment();
  const selectedInCategory = getSelectedEnginesForCategory(normalizedCategory);
  const selectedCount = selectedInCategory.length;
  const totalEnginesInCategory = baseList.length;
  const visibleCount = displayList.length;
  const hasSelection = selectedCount > 0;
  const allSelected = totalEnginesInCategory > 0 && selectedCount === totalEnginesInCategory;
  const hasPartialSelection = hasSelection && !allSelected;

  const allTag = document.createElement('span');
  allTag.className = 'kc-engine-stat__tag kc-engine-stat__tag--all';
  allTag.textContent = 'ALL';
  allTag.classList.toggle('is-active', allSelected);
  allTag.classList.toggle('is-partial', hasPartialSelection);
  allTag.setAttribute('role', 'button');
  allTag.setAttribute('tabindex', '0');
  const ariaPressed = allSelected ? 'true' : (hasPartialSelection ? 'mixed' : 'false');
  allTag.setAttribute('aria-pressed', ariaPressed);

  if (allSelected) {
    applyBadgeTheme(allTag, normalizedCategory || ALL_CATEGORY_ID, {
      fallbackCategory: normalizedCategory || ALL_CATEGORY_ID
    });
    allTag.classList.add('kc-engine-stat__tag--themed');
  } else {
    clearBadgeTheme(allTag);
    allTag.classList.remove('kc-engine-stat__tag--themed');
  }
  const handleAllToggle = (evt) => {
    evt.preventDefault();
    const enginesContainer = document.getElementById('kc-engines');
    const previousScrollTop = enginesContainer ? enginesContainer.scrollTop : 0;
    const changed = allSelected
      ? clearEnginesInCategory(normalizedCategory)
      : selectEnginesInCategory(normalizedCategory);
    if (!changed) return;
    renderCategories();
    if (enginesContainer) {
      requestAnimationFrame(() => {
        enginesContainer.scrollTop = previousScrollTop;
      });
    }
    updateRunButtonState();
  };
  allTag.addEventListener('click', handleAllToggle);
  allTag.addEventListener('keydown', (evt) => {
    if (evt.key === 'Enter' || evt.key === ' ') {
      evt.preventDefault();
      handleAllToggle(evt);
    }
  });
  fragment.append(allTag);

  Array.from(counts.values())
    .sort((a, b) => a.label.localeCompare(b.label))
    .forEach((bucket) => {
      const tag = document.createElement('span');
      tag.className = 'kc-engine-stat__tag';
      const isActive = bucket.selected > 0;
      tag.setAttribute('role', 'button');
      tag.setAttribute('tabindex', '0');
      tag.classList.toggle('is-active', isActive);
      tag.setAttribute('aria-pressed', isActive ? 'true' : 'false');

      if (isActive) {
        applyBadgeTheme(tag, bucket.key, { fallbackCategory: normalizedCategory });
        tag.classList.add('kc-engine-stat__tag--themed');
      } else {
        clearBadgeTheme(tag);
        tag.classList.remove('kc-engine-stat__tag--themed');
      }

      const label = document.createElement('span');
      label.className = 'kc-engine-stat__label';
      label.textContent = bucket.label;

      const value = document.createElement('span');
      value.className = 'kc-engine-stat__value';
      value.textContent = bucket.count;

      tag.append(label, value);
      const handleToggle = (evt) => {
        evt.preventDefault();
        toggleEnginesByType(bucket.key, normalizedCategory);
      };
      tag.addEventListener('click', handleToggle);
      tag.addEventListener('keydown', (evt) => {
        if (evt.key === 'Enter' || evt.key === ' ') {
          evt.preventDefault();
          handleToggle(evt);
        }
      });
      fragment.append(tag);
    });

  statsWrap.append(fragment);
}

function renderSelectionSummary() {
  const root = document.getElementById('kc-selection-summary');
  const mcpContainer = document.getElementById('kc-selected-mcp');
  const mediaContainer = document.getElementById('kc-selected-media');
  const metrics = document.getElementById('kc-selection-metrics');
  const mcpActions = document.getElementById('kc-selected-mcp-actions');
  const mediaActions = document.getElementById('kc-selected-media-actions');
  if (!root || !mcpContainer || !mediaContainer) return;

  mcpContainer.innerHTML = '';
  mediaContainer.innerHTML = '';
  if (mcpActions) mcpActions.innerHTML = '';
  if (mediaActions) mediaActions.innerHTML = '';

  const selectedEngines = Array.from(state.selected.values());
  const mediaList = getSelectedMediaList();

  syncSoundTextField();

  if (metrics) {
    const totalEngines = state.engineIndex.size || 0;
    const selectedLabel = selectedEngines.length.toLocaleString('ja-JP');
    const totalLabel = totalEngines.toLocaleString('ja-JP');
    metrics.innerHTML = [
      `<span class="kc-selection-summary__metrics-current">選択中MCP <strong>${selectedLabel}</strong></span>`,
      `<span class="kc-selection-summary__metrics-total">&nbsp;/ 合計 <strong>${totalLabel}</strong></span>`
    ].join('');
    metrics.setAttribute('aria-label', `選択中MCP ${selectedLabel} 件 / 合計 ${totalLabel} 件`);
  }

  const buildActionButton = (label, title, handler, disabled = false) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'kc-selection-summary__action';
    btn.textContent = label;
    if (title) btn.title = title;
    btn.disabled = disabled;
    if (!disabled) {
      btn.addEventListener('click', (evt) => {
        evt.preventDefault();
        handler();
      });
    }
    return btn;
  };

  if (mcpActions) {
    const hasSelection = selectedEngines.length > 0;
    const clearBtn = buildActionButton(
      '全解除',
      '選択中のMCPを全て解除',
      () => clearAllSelections(),
      !hasSelection
    );
    mcpActions.append(clearBtn);
  }

  if (selectedEngines.length) {
    const list = document.createElement('div');
    list.className = 'kc-selection-mcp-list';

    selectedEngines.forEach((entry) => {
      const item = document.createElement('div');
      item.className = 'kc-selection-mcp-item';
      item.textContent = entry.displayLabel || entry.label || deriveEngineLabel(entry.id) || entry.id || '-';
      list.append(item);
    });

    mcpContainer.append(list);
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'kc-selection-placeholder';
    placeholder.textContent = '未選択';
    mcpContainer.append(placeholder);
  }

  const groupedMedia = groupMediaEntriesByType(mediaList);
  const orderByPath = new Map();
  const orderByUrl = new Map();
  const slotDefinitions = computeMediaSlotDefinitions(selectedEngines);
  const slotAssignmentsData = getMediaSlotAssignments(slotDefinitions);
  const activeSlotId = resolveActiveMediaSlot(slotDefinitions, slotAssignmentsData.assignments);
  const typeOrder = MEDIA_SELECTION_TYPE_ORDER;
  const groupsRoot = document.createElement('div');
  groupsRoot.className = 'kc-selection-media-groups';
  let groupsRendered = 0;

  const createTile = (item, order, typeLabel, globalIndex) => {
    const tile = document.createElement('div');
    tile.className = 'kc-selection-media-tile';
    tile.setAttribute('role', 'listitem');

    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'kc-selection-media-thumb';
    thumbWrap.dataset.type = typeLabel;
    const orderBadge = document.createElement('span');
    orderBadge.className = 'kc-selection-media-order';
    orderBadge.classList.add(`kc-selection-media-order--${typeLabel}`);
    orderBadge.textContent = String(order);
    orderBadge.setAttribute('aria-label', `${(MEDIA_TYPE_DISPLAY[typeLabel]?.label || typeLabel).toUpperCase()} #${order}`);

    const appendVideoPreview = (video) => {
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'metadata';
      video.autoplay = false;
      video.setAttribute('playsinline', '');
      video.setAttribute('muted', '');
      video.addEventListener('loadeddata', () => {
        try {
          video.currentTime = 0;
          video.pause();
        } catch (err) {
          // ignore seek errors
        }
      });
      thumbWrap.append(video);
    };

    if (item.filterType === 'video' && item.url) {
      const video = document.createElement('video');
      video.src = item.url;
      if (item.thumbUrl) {
        video.poster = item.thumbUrl;
      }
      appendVideoPreview(video);
    } else if (item.thumbUrl) {
      const img = document.createElement('img');
      img.src = item.thumbUrl;
      img.alt = item.name || item.path;
      thumbWrap.append(img);
    } else if (item.url && item.filterType === 'image') {
      const img = document.createElement('img');
      img.src = item.url;
      img.alt = item.name || item.path;
      img.loading = 'lazy';
      thumbWrap.append(img);
    } else {
      const badge = document.createElement('span');
      badge.className = 'kc-selection-media-ext';
      badge.textContent = (item.ext || item.filterType || '').toUpperCase() || '?';
      thumbWrap.append(badge);
    }

    thumbWrap.append(orderBadge);

    const identifier = item.path || item.url || `${typeLabel}-${order}`;
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'kc-selection-media-remove';
    removeBtn.setAttribute('aria-label', `${item.name || item.path || '選択中のメディア'}を解除`);
    removeBtn.title = 'このメディアを解除';
    removeBtn.innerHTML = '<span aria-hidden="true">×</span>';
    removeBtn.addEventListener('click', (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      removeSelectedMediaEntry(item, globalIndex, identifier);
    });
    thumbWrap.append(removeBtn);

    tile.dataset.mediaType = typeLabel;
    tile.append(thumbWrap);

    const name = document.createElement('span');
    name.className = 'kc-selection-media-name';
    name.textContent = item.name || item.path || `メディア${order}`;
    tile.append(name);

    return tile;
  };

  typeOrder.forEach((type) => {
    const items = groupedMedia.get(type) || [];
    const slots = slotDefinitions.get(type) || [];
    const baseLabel = MEDIA_TYPE_DISPLAY[type]?.label || type.toUpperCase();
    const useSlotLayout = slots.length > 1 || (slots.length === 1 && slots[0]?.label !== baseLabel);
    const paramMeta = collectMediaParameterMetaForType(selectedEngines, type);
    const extras = slotAssignmentsData.extrasByType.get(type) || [];

    if (!useSlotLayout && !items.length && !paramMeta.length) {
      return;
    }
    if (useSlotLayout && !slots.length && !items.length && !paramMeta.length) {
      return;
    }

    const group = document.createElement('section');
    group.className = 'kc-selection-media-group';

    const header = document.createElement('div');
    header.className = 'kc-selection-media-group__header';

    const title = document.createElement('span');
    title.className = 'kc-selection-media-group__title';
    title.textContent = baseLabel;
    header.append(title);

    if (paramMeta.length) {
      const paramsWrap = document.createElement('div');
      paramsWrap.className = 'kc-selection-media-group__params';
      paramMeta.sort((a, b) => a.key.localeCompare(b.key));
      paramMeta.forEach((param) => {
        const badge = document.createElement('span');
        badge.className = 'kc-selection-media-param';
        badge.textContent = param.key;
        if (param.required) {
          badge.classList.add('is-required');
          badge.setAttribute('title', `${param.key} は必須入力です`);
        }
        paramsWrap.append(badge);
      });
      header.append(paramsWrap);
    }

    group.append(header);

    let orderCounter = 0;

    if (useSlotLayout) {
      const slotsContainer = document.createElement('div');
      slotsContainer.className = 'kc-selection-media-slots';
      slots.forEach((slot) => {
        const entry = slotAssignmentsData.assignments.get(slot.slotId);
        const shouldRenderSlot = slot?.visible !== false || entry;
        if (!shouldRenderSlot) {
          return;
        }

        const slotElement = document.createElement('div');
        slotElement.className = 'kc-selection-media-slot';
        if (slot?.visible === false) {
          slotElement.classList.add('kc-selection-media-slot--additional');
        }
        slotElement.dataset.slotId = slot.slotId;
        slotElement.setAttribute('role', 'button');
        slotElement.setAttribute('tabindex', '0');
        const isActive = activeSlotId === slot.slotId;
        slotElement.classList.toggle('is-active', isActive);
        slotElement.setAttribute('aria-pressed', isActive ? 'true' : 'false');

        const slotLabel = document.createElement('div');
        slotLabel.className = 'kc-selection-media-slot__label';
        const fallbackLabel = MEDIA_TYPE_DISPLAY[type]?.label || type.toUpperCase();
        const baseLabel = typeof slot.label === 'string' && slot.label.trim()
          ? slot.label
          : fallbackLabel;
        const labelText = slot?.visible === false
          ? `${fallbackLabel} (追加)`
          : baseLabel;
        slotLabel.textContent = labelText;
        if (slot.required) {
          const badge = document.createElement('span');
          badge.className = 'kc-selection-media-slot__badge';
          badge.textContent = '必須';
          slotLabel.append(badge);
        }
        slotElement.append(slotLabel);

        const slotBody = document.createElement('div');
        slotBody.className = 'kc-selection-media-slot__body';
        if (entry) {
          const globalIndex = mediaList.indexOf(entry);
          orderCounter += 1;
          assignMediaOrderLookup(entry, type, orderCounter, orderByPath, orderByUrl);
          const tile = createTile(entry, orderCounter, type, globalIndex);
          slotBody.append(tile);
        } else {
          const placeholder = document.createElement('div');
          placeholder.className = 'kc-selection-placeholder kc-selection-placeholder--slot';
          placeholder.textContent = '未選択';
          slotBody.append(placeholder);
        }
        slotElement.append(slotBody);

        const activateSlot = () => {
          if (state.media.activeSlot !== slot.slotId) {
            state.media.activeSlot = slot.slotId;
            renderSelectionSummary();
          }
        };

        slotElement.addEventListener('click', (evt) => {
          if (evt.target.closest('.kc-selection-media-remove')) return;
          activateSlot();
        });
        slotElement.addEventListener('keydown', (evt) => {
          if (evt.key === 'Enter' || evt.key === ' ') {
            evt.preventDefault();
            activateSlot();
          }
        });

        slotsContainer.append(slotElement);
      });

      group.append(slotsContainer);

      if (extras.length) {
        const extrasTrack = document.createElement('div');
        extrasTrack.className = 'kc-selection-media-track kc-selection-media-track--extras';
        extrasTrack.setAttribute('role', 'list');
        extras.forEach((item) => {
          const globalIndex = mediaList.indexOf(item);
          orderCounter += 1;
          assignMediaOrderLookup(item, type, orderCounter, orderByPath, orderByUrl);
          const tile = createTile(item, orderCounter, type, globalIndex);
          extrasTrack.append(tile);
        });
        group.append(extrasTrack);
      }
    } else if (items.length) {
      const track = document.createElement('div');
      track.className = 'kc-selection-media-track';
      track.setAttribute('role', 'list');
      items.forEach((item, index) => {
        const globalIndex = mediaList.indexOf(item);
        orderCounter += 1;
        assignMediaOrderLookup(item, type, orderCounter, orderByPath, orderByUrl);
        const tile = createTile(item, orderCounter, type, globalIndex);
        track.append(tile);
      });
      group.append(track);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'kc-selection-placeholder kc-selection-placeholder--inline';
      placeholder.textContent = '未選択';
      group.append(placeholder);
    }

    groupsRoot.append(group);
    groupsRendered += 1;
  });

  state.media.orderByPath = orderByPath;
  state.media.orderByUrl = orderByUrl;

  if (groupsRendered > 0) {
    mediaContainer.append(groupsRoot);
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'kc-selection-placeholder';
    placeholder.textContent = '未選択';
    mediaContainer.append(placeholder);
  }

  if (mediaActions) {
    const hasSelection = mediaList.length > 0;
    const clearBtn = buildActionButton(
      '全解除',
      '選択中のメディアを全て解除',
      () => clearAllMediaSelections(),
      !hasSelection
    );
    mediaActions.append(clearBtn);
  }

  const hasAnySelection = selectedEngines.length > 0 || mediaList.length > 0;
  root.classList.toggle('is-empty', !hasAnySelection);

  refreshPromptGeneratorDefaults();
  updatePromptGeneratorControls();
}


function toggleEnginesByType(typeKey, categoryId = state.activeEngineCategory) {
  const normalizedCategory = normalizeCategory(categoryId);
  let activeList = getEnginesInCategory(normalizedCategory);
  const keyword = state.engineSearchKeyword.trim();
  if (keyword) {
    activeList = filterEnginesByKeyword(activeList, keyword);
  }

  if (!activeList.length) return;

  const allowedTypes = new Set(knownTypesForCategory(normalizedCategory));
  const targetKey = (typeKey || '').toString().toLowerCase();
  const matchingEngines = activeList.filter((engine) => {
    const key = determineEngineTypeKey(engine, allowedTypes);
    if (targetKey === 'other') {
      return key === 'other';
    }
    return key === targetKey;
  });

  if (!matchingEngines.length) return;

  const hasUnselected = matchingEngines.some((engine) => !state.selected.has(engine.id));
  const enginesContainer = document.getElementById('kc-engines');
  const previousScrollTop = enginesContainer ? enginesContainer.scrollTop : 0;

  matchingEngines.forEach((engine) => {
    if (!engine || !engine.id) return;
    if (hasUnselected) {
      if (state.selected.has(engine.id)) return;
      ensureEngineInputs(engine);
      state.selected.set(engine.id, {
        id: engine.id,
        label: engine.displayLabel || engine.label || deriveEngineLabel(engine.id),
        category: engine.category || normalizedCategory,
        requiresMedia: Boolean(engine.requiresMedia),
        requiredMediaTypes: Array.isArray(engine.requiredMediaTypes)
          ? engine.requiredMediaTypes.slice()
          : [],
        requiresPrompt: engineRequiresPrompt(engine),
        requiresSoundText: engineRequiresSoundText(engine),
        promptKey: engine.promptKey || getPromptKey(engine),
        soundTextKeys: Array.isArray(engine.soundTextKeys) ? engine.soundTextKeys.slice() : [],
        requiredSoundTextKeys: Array.isArray(engine.requiredSoundTextKeys)
          ? engine.requiredSoundTextKeys.slice()
          : [],
        documentationUrl: engine.documentationUrl || '',
        docSummaryEn: engine.docSummaryEn || '',
        docSummaryJa: engine.docSummaryJa || ''
      });
    } else {
      state.selected.delete(engine.id);
    }
  });

  if (hasUnselected) {
    applySelectedMediaToEngineInputs();
  }

  renderCategories();
  if (enginesContainer) {
    requestAnimationFrame(() => {
      enginesContainer.scrollTop = previousScrollTop;
    });
  }
  updateRunButtonState();
}

function setActiveEngineCategory(category, options = {}) {
  const { skipHistorySync = false, skipEngineLoad = false } = options;
  const cat = normalizeCategory(category);
  const changed = state.activeEngineCategory !== cat;
  state.activeEngineCategory = cat;
  ensureCategoryCollections(cat);
  if (changed) {
    closeTemplateMenu();
    closeTemplateModal();
    closePromptModal();
  }
  renderEngineTabs();
  renderEngineSubTabs();
  renderCategories();
  updateRunButtonState();
  if (!skipEngineLoad && !isAllCategory(cat) && !state.enginesByCategory.has(cat)) {
    loadEnginesForCategory(cat);
  }
  if (state.categoryTabs[cat] === 'media'
    && state.media.items.length === 0
    && !state.media.isLoading) {
    loadMediaLibrary().catch((err) => console.error('[Showcase] media load failed', err));
  }
  if (changed) {
    const resultsContainer = document.getElementById('kc-results');
    if (resultsContainer) renderResults(resultsContainer);
  }
  if (!skipHistorySync) {
    renderHistory();
  }
}

function buildEngineOrderMap(categoryId) {
  const map = new Map();
  const normalized = normalizeCategory(categoryId);
  const primaryList = state.enginesByCategory.get(normalized);
  if (Array.isArray(primaryList)) {
    primaryList.forEach((meta, index) => {
      if (meta?.id && !map.has(meta.id)) {
        map.set(meta.id, index);
      }
    });
  }
  if (normalized !== ALL_CATEGORY_ID) {
    const fallbackList = state.enginesByCategory.get(ALL_CATEGORY_ID);
    if (Array.isArray(fallbackList)) {
      const offset = map.size;
      fallbackList.forEach((meta, index) => {
        if (meta?.id && !map.has(meta.id)) {
          map.set(meta.id, offset + index);
        }
      });
    }
  }
  return map;
}

function createDisplayOrderMap(categoryId) {
  const normalized = normalizeCategory(categoryId);
  const orderMap = new Map();

  if (state.engineDisplayOrder instanceof Map && state.engineDisplayOrder.size > 0) {
    state.engineDisplayOrder.forEach((meta, engineId) => {
      if (!meta || typeof meta.order !== 'number') return;
      const engineCategory = normalizeCategory(meta.category || normalized);
      if (normalized === ALL_CATEGORY_ID || engineCategory === normalized) {
        if (!orderMap.has(engineId)) {
          orderMap.set(engineId, meta.order);
        }
      }
    });
  }

  const fallbackOrder = buildEngineOrderMap(normalized);
  fallbackOrder.forEach((value, key) => {
    if (!orderMap.has(key)) {
      orderMap.set(key, value);
    }
  });

  return orderMap;
}

function getEntryOrderValue(entry, normalizedCategory, orderMap) {
  if (!entry) return Number.MAX_SAFE_INTEGER;
  if (Number.isFinite(entry.displayOrder)) return entry.displayOrder;
  const engineId = entry.engineId;
  if (engineId && orderMap && orderMap.has(engineId)) {
    const order = orderMap.get(engineId);
    entry.displayOrder = order;
    return order;
  }
  if (engineId && state.engineDisplayOrder instanceof Map && state.engineDisplayOrder.has(engineId)) {
    const meta = state.engineDisplayOrder.get(engineId);
    if (meta && typeof meta.order === 'number') {
      entry.displayOrder = meta.order;
      return meta.order;
    }
  }
  return Number.MAX_SAFE_INTEGER;
}

function resolveEngineDisplayOrder(engineId, category) {
  if (!engineId) return Number.MAX_SAFE_INTEGER;
  if (state.engineDisplayOrder instanceof Map && state.engineDisplayOrder.has(engineId)) {
    const meta = state.engineDisplayOrder.get(engineId);
    if (meta && typeof meta.order === 'number') {
      return meta.order;
    }
  }
  const normalized = normalizeCategory(category || DEFAULT_ACTIVE_CATEGORY);
  const fallbackOrder = buildEngineOrderMap(normalized);
  if (fallbackOrder.has(engineId)) {
    return fallbackOrder.get(engineId);
  }
  return Number.MAX_SAFE_INTEGER;
}

function compareResultEntries(left, right, normalizedCategory, orderMap) {
  const leftOrder = getEntryOrderValue(left, normalizedCategory, orderMap);
  const rightOrder = getEntryOrderValue(right, normalizedCategory, orderMap);
  if (leftOrder !== rightOrder) return leftOrder - rightOrder;
  const leftLabel = (formatEngineLabel(left) || '').toLowerCase();
  const rightLabel = (formatEngineLabel(right) || '').toLowerCase();
  if (leftLabel !== rightLabel) return leftLabel.localeCompare(rightLabel);
  const leftTimestamp = normalizeFileTimestamp(left?.timestamp);
  const rightTimestamp = normalizeFileTimestamp(right?.timestamp);
  if (leftTimestamp !== rightTimestamp) return leftTimestamp - rightTimestamp;
  return 0;
}

function sortEntriesInPlace(entries, normalizedCategory, orderMap) {
  if (!Array.isArray(entries) || entries.length <= 1) {
    return entries;
  }
  const effectiveMap = orderMap || createDisplayOrderMap(normalizedCategory);
  entries.sort((left, right) => compareResultEntries(left, right, normalizedCategory, effectiveMap));
  return entries;
}

function sortResultsForDisplay(results, categoryId) {
  if (!Array.isArray(results) || results.length <= 1) {
    return Array.isArray(results) ? results.slice() : [];
  }
  const normalized = normalizeCategory(categoryId);
  const cloned = results.slice();
  sortEntriesInPlace(cloned, normalized, createDisplayOrderMap(normalized));
  return cloned;
}

function getCurrentResults() {
  const activeEntry = getActiveHistoryEntry();
  const categoryId = normalizeCategory(activeEntry?.category || state.activeCategory);
  if (activeEntry && Array.isArray(activeEntry.results)) {
    return sortResultsForDisplay(activeEntry.results, categoryId);
  }
  const fallback = normalizeCategory(state.activeCategory);
  const results = state.resultsByCategory[fallback] || [];
  return sortResultsForDisplay(results, fallback);
}

function splitResultsByFailure(entries) {
  const list = Array.isArray(entries) ? entries : [];
  const visible = [];
  let failureCount = 0;
  list.forEach((entry) => {
    if (entry && entry.error) {
      failureCount += 1;
      if (state.showFailures) {
        visible.push(entry);
      }
      return;
    }
    visible.push(entry);
  });
  return {
    visible,
    hidden: state.showFailures ? 0 : failureCount,
    failureCount,
    total: list.length
  };
}

function getEngineMeta(engineId) {
  return state.engineIndex.get(engineId) || null;
}

function deriveEngineLabel(source, fallback = '') {
  const build = (value) => {
    if (!value) return '';
    const normalized = String(value).trim().toLowerCase();
    if (!normalized) return '';
    const parts = normalized.split('-').filter(Boolean);
    if (!parts.length) return normalized;
    const prefix = parts[0];
    const restParts = parts.slice(1);
    if (restParts[0] === 'kamui') {
      restParts.shift();
    }
    const rest = restParts.join('-');
    return rest ? `${prefix}-${rest}` : prefix;
  };
  return build(source) || build(fallback) || (source || fallback || '').toString().toLowerCase();
}

function formatEngineLabel(entry) {
  if (!entry) return '-';
  const rawId = entry.engineId || '';
  const rawLabel = entry.label || '';
  const fromId = deriveEngineLabel(rawId, rawLabel);
  if (fromId && fromId !== rawId) return fromId;
  const fromLabel = deriveEngineLabel(rawLabel, rawLabel);
  if (fromLabel && fromLabel !== rawLabel) return fromLabel;
  return (rawLabel || rawId || '-').toLowerCase();
}

function collectResultTypes(entry) {
  if (!entry) return [];
  const tokens = new Set();
  const addToken = (token) => {
    const normalized = normalizeTypeToken(token);
    if (normalized) tokens.add(normalized);
  };
  addToken(entry.type);
  addToken(entry.sourceCategory);
  if (Array.isArray(entry.typePrefixes)) {
    entry.typePrefixes.forEach(addToken);
  }
  if (Array.isArray(entry.sourceCategories)) {
    entry.sourceCategories.forEach(addToken);
  }
  addToken(extractEnginePrefix(entry.engineId || entry.label || ''));
  return Array.from(tokens);
}

function inferExtensionFromMime(mime) {
  if (!mime && mime !== 0) return '';
  const normalized = String(mime).trim().toLowerCase();
  if (!normalized) return '';
  const base = normalized.split(';')[0];
  if (Object.prototype.hasOwnProperty.call(MIME_EXTENSION_OVERRIDES, base)) {
    return MIME_EXTENSION_OVERRIDES[base] || '';
  }
  const suffix = base.includes('/') ? base.split('/').pop() : base;
  if (!suffix) return '';
  const sanitized = suffix.replace(/[^a-z0-9]+/g, '');
  if (!sanitized) return '';
  if (Object.prototype.hasOwnProperty.call(MIME_EXTENSION_OVERRIDES, sanitized)) {
    return MIME_EXTENSION_OVERRIDES[sanitized] || '';
  }
  switch (sanitized) {
    case 'gltfbinary':
      return 'glb';
    case 'gltfjson':
      return 'gltf';
    case 'quicktime':
      return 'mov';
    case 'mpeg':
      return 'mp3';
    case 'pjpeg':
      return 'jpg';
    default:
      return sanitized;
  }
}

function getResultFilterMeta(entry) {
  if (!entry) {
    return { type: '', extension: '' };
  }
  const saved = entry.savedFile || {};
  const savedList = Array.isArray(entry.savedFiles) ? entry.savedFiles : [];
  const candidates = [];
  const enqueue = (value) => {
    if (!value && value !== 0) return;
    const str = String(value).trim();
    if (!str) return;
    candidates.push(str);
  };
  enqueue(entry.fileName || entry.filename || entry.path);
  enqueue(entry.outputPath);
  enqueue(saved.fileName || saved.filename || saved.path);
  enqueue(saved.webPath);
  enqueue(saved.absolute);
  savedList.forEach((item) => {
    if (!item) return;
    enqueue(item.fileName || item.filename || item.path);
  });
  if (entry.imageUrl) {
    enqueue(entry.imageUrl.split('?')[0]);
  }
  if (saved.url) {
    enqueue(String(saved.url).split('?')[0]);
  }
  let extension = '';
  for (const candidate of candidates) {
    const ext = extractFileExtension(candidate);
    if (ext) {
      extension = ext;
      break;
    }
  }
  if (!extension && entry.ext) {
    extension = String(entry.ext).trim().toLowerCase();
  }
  if (!extension && saved.ext) {
    extension = String(saved.ext).trim().toLowerCase();
  }
  if (!extension && entry.mime) {
    extension = inferExtensionFromMime(entry.mime);
  }
  if (!extension && entry.contentType) {
    extension = inferExtensionFromMime(entry.contentType);
  }
  if (!extension && saved.mime) {
    extension = inferExtensionFromMime(saved.mime);
  }
  if (!extension && saved.contentType) {
    extension = inferExtensionFromMime(saved.contentType);
  }
  extension = extension ? extension.toLowerCase() : '';
  const primaryPath = candidates.find((item) => item && item.length) || '';
  const filterProbe = {
    filterType: entry.filterType || entry.type || entry.sourceCategory || saved.filterType || saved.mediaType || '',
    type: entry.type || '',
    mime: entry.mime || entry.contentType || saved.mime || saved.contentType || '',
    ext: extension,
    path: primaryPath,
    url: entry.imageUrl || saved.webPath || saved.absolute || saved.url || ''
  };
  const type = resolveMediaEntryType(filterProbe);
  return { type, extension };
}

function summarizeResultsByFileAttributes(entries) {
  const summary = {
    typeCounts: new Map(),
    extensionCounts: new Map()
  };
  const list = Array.isArray(entries) ? entries : [];
  list.forEach((entry) => {
    const { type, extension } = getResultFilterMeta(entry);
    if (type) {
      summary.typeCounts.set(type, (summary.typeCounts.get(type) || 0) + 1);
    }
    if (extension) {
      summary.extensionCounts.set(extension, (summary.extensionCounts.get(extension) || 0) + 1);
    }
  });
  return summary;
}

function applyResultsFileFilter(entries, filterValue) {
  if (!filterValue || filterValue === 'all') {
    return entries;
  }
  const list = Array.isArray(entries) ? entries : [];
  if (filterValue.startsWith('type:')) {
    const target = filterValue.slice(5);
    if (!target) return list;
    return list.filter((entry) => {
      const { type } = getResultFilterMeta(entry);
      return type === target;
    });
  }
  if (filterValue.startsWith('ext:')) {
    const target = filterValue.slice(4);
    if (!target) return list;
    return list.filter((entry) => {
      const { extension } = getResultFilterMeta(entry);
      return extension === target;
    });
  }
  return list;
}

function updateResultsFileFilterControl(summary) {
  const wrap = document.getElementById('kc-results-file-filter-wrap');
  const select = document.getElementById('kc-results-file-filter');
  if (!wrap || !select) return;
  const typeEntries = Array.from(summary.typeCounts.entries())
    .filter(([type]) => type && type !== 'other')
    .sort((a, b) => a[0].localeCompare(b[0]));
  const otherTypeCount = summary.typeCounts.get('other') || 0;
  const extensionEntries = Array.from(summary.extensionCounts.entries())
    .filter(([ext]) => ext)
    .sort((a, b) => a[0].localeCompare(b[0]));
  const shouldShow = typeEntries.length > 0 || otherTypeCount > 0 || extensionEntries.length > 0;
  if (!shouldShow) {
    wrap.hidden = true;
    select.innerHTML = '';
    const option = document.createElement('option');
    option.value = 'all';
    option.textContent = 'すべて';
    select.append(option);
    select.value = 'all';
    if (state.resultsFileFilter !== 'all') {
      state.resultsFileFilter = 'all';
      try {
        localStorage.setItem(RESULTS_FILE_FILTER_STORAGE_KEY, 'all');
      } catch (err) {
        console.warn('[Showcase] failed to persist results file filter', err);
      }
    }
    return;
  }
  wrap.hidden = false;
  const previousValue = state.resultsFileFilter || 'all';
  select.innerHTML = '';
  const makeOption = (value, label) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    return option;
  };
  select.append(makeOption('all', 'すべて'));
  if (typeEntries.length || otherTypeCount > 0) {
    const group = document.createElement('optgroup');
    group.label = 'タイプ';
    typeEntries.forEach(([type, count]) => {
      const display = MEDIA_TYPE_DISPLAY[type]?.label || type.toUpperCase();
      group.append(makeOption(`type:${type}`, `${display} (${count})`));
    });
    if (otherTypeCount > 0) {
      group.append(makeOption('type:other', `OTHER (${otherTypeCount})`));
    }
    select.append(group);
  }
  if (extensionEntries.length) {
    const group = document.createElement('optgroup');
    group.label = '拡張子';
    extensionEntries.forEach(([ext, count]) => {
      group.append(makeOption(`ext:${ext}`, `${ext.toUpperCase()} (${count})`));
    });
    select.append(group);
  }
  const availableValues = new Set(['all']);
  Array.from(select.options).forEach((option) => availableValues.add(option.value));
  const nextValue = availableValues.has(previousValue) ? previousValue : 'all';
  if (nextValue !== state.resultsFileFilter) {
    state.resultsFileFilter = nextValue;
    try {
      localStorage.setItem(RESULTS_FILE_FILTER_STORAGE_KEY, nextValue);
    } catch (err) {
      console.warn('[Showcase] failed to persist results file filter', err);
    }
  }
  select.value = nextValue;
}

function engineDefaults(meta) {
  if (!meta) return {};
  const defaults = {};
  const props = meta?.tools?.submit?.parameters?.properties || {};
  Object.entries(props).forEach(([key, schema]) => {
    const defaultValue = getSchemaDefaultValue(schema);
    if (defaultValue !== undefined) {
      defaults[key] = cloneParameterDefault(defaultValue);
    }
  });
  return defaults;
}

function ensureEngineInputs(engineMeta) {
  if (!engineMeta || !engineMeta.id) return {};
  if (!state.inputs.has(engineMeta.id)) {
    state.inputs.set(engineMeta.id, engineDefaults(engineMeta));
  }
  return state.inputs.get(engineMeta.id);
}

function closeLightbox() {
  if (!activeLightbox) return;
  const { overlay, onKey, cleanup } = activeLightbox;
  if (onKey) window.removeEventListener('keydown', onKey);
  if (typeof cleanup === 'function') {
    try {
      cleanup();
    } catch (err) {
      console.warn('[Showcase] lightbox cleanup failed', err);
    }
  }
  overlay.remove();
  document.body.classList.remove('kc-lightbox-open');
  activeLightbox = null;
}

function formatMediaCaption(entry, index, total) {
  const parts = [];
  if (Number.isFinite(index) && Number.isFinite(total) && total > 0) {
    parts.push(`${index + 1}/${total}`);
  }
  const displayName = entry?.fileName
    || entry?.name
    || extractFilename(entry?.path)
    || extractFilename(entry?.url)
    || '';
  if (displayName) {
    parts.push(displayName);
  }
  return parts.join('  •  ');
}

function openMediaLightbox(entries, startIndex = 0) {
  if (!Array.isArray(entries) || !entries.length) return;
  const snapshots = entries.slice();
  const validIndices = [];
  snapshots.forEach((entry, idx) => {
    if (hasMediaUrl(entry)) {
      validIndices.push(idx);
    }
  });
  if (!validIndices.length) return;

  const indexToPosition = new Map();
  validIndices.forEach((idx, pos) => {
    indexToPosition.set(idx, pos);
  });

  const findNearestIndex = (index) => {
    if (indexToPosition.has(index)) {
      return index;
    }
    for (const candidate of validIndices) {
      if (candidate >= index) return candidate;
    }
    return validIndices[validIndices.length - 1];
  };

  const initialIndex = findNearestIndex(startIndex);
  if (initialIndex === undefined || initialIndex === null) return;

  closeLightbox();
  closeResultsModal();
  closeTemplateMenu();
  closePromptModal();

  const overlay = document.createElement('div');
  overlay.className = 'kc-lightbox';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'kc-lightbox__nav kc-lightbox__nav--prev';
  prevBtn.innerHTML = '‹';
  prevBtn.setAttribute('aria-label', '前のメディア');

  const nextBtn = document.createElement('button');
  nextBtn.className = 'kc-lightbox__nav kc-lightbox__nav--next';
  nextBtn.innerHTML = '›';
  nextBtn.setAttribute('aria-label', '次のメディア');

  const content = document.createElement('div');
  content.className = 'kc-lightbox__content';

  const mediaContainer = document.createElement('div');
  mediaContainer.className = 'kc-lightbox__frame';

  const caption = document.createElement('div');
  caption.className = 'kc-lightbox__caption';

  content.append(mediaContainer, caption);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'kc-lightbox__close';
  closeBtn.innerHTML = '&times;';

  overlay.append(prevBtn, nextBtn, content, closeBtn);
  document.body.appendChild(overlay);
  document.body.classList.add('kc-lightbox-open');

  const findSibling = (current, direction) => {
    const pos = indexToPosition.get(current);
    if (!Number.isFinite(pos)) return null;
    const nextPos = pos + direction;
    if (nextPos < 0 || nextPos >= validIndices.length) return null;
    return validIndices[nextPos];
  };

  let currentIndex = initialIndex;
  let releaseCurrent = null;

  const applyCleanup = () => {
    if (typeof releaseCurrent === 'function') {
      try {
        releaseCurrent();
      } catch (err) {
        console.warn('[Showcase] media cleanup failed', err);
      }
    }
    releaseCurrent = null;
  };

  const renderEntry = (entry) => {
    applyCleanup();
    mediaContainer.innerHTML = '';
    mediaContainer.className = 'kc-lightbox__frame';

    const type = resolveMediaEntryType(entry);
    if (type === 'video' && hasMediaUrl(entry)) {
      const video = document.createElement('video');
      video.className = 'kc-lightbox__video';
      video.src = entry.url;
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = false;
      applyLoopSettingToMedia(video);
      bindShowcaseMediaLifecycle(video, {
        src: entry.url,
        mediaType: 'video',
        context: 'lightbox'
      });
      mediaContainer.innerHTML = '';
      mediaContainer.className = 'kc-lightbox__frame kc-lightbox__frame--video';
      mediaContainer.appendChild(video);
      const startPlayback = () => {
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {});
        }
      };
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        startPlayback();
      } else {
        video.addEventListener('canplay', startPlayback, { once: true });
      }
      releaseCurrent = () => {
        try {
          video.pause();
          video.removeAttribute('src');
          video.load();
        } catch (err) {
          console.warn('[Showcase] video cleanup failed', err);
        }
      };
      updateBatchControlVisuals();
      return;
    }

    if (type === 'sound' && hasMediaUrl(entry)) {
      const audio = document.createElement('audio');
      audio.className = 'kc-lightbox__audio';
      audio.src = entry.url;
      audio.controls = true;
      audio.autoplay = true;
      applyLoopSettingToMedia(audio);
      bindShowcaseMediaLifecycle(audio, {
        src: entry.url,
        mediaType: 'audio',
        context: 'lightbox'
      });
      mediaContainer.innerHTML = '';
      mediaContainer.className = 'kc-lightbox__frame kc-lightbox__frame--audio';
      mediaContainer.appendChild(audio);
      audio.play().catch(() => {});
      updateBatchControlVisuals();
      releaseCurrent = () => {
        try {
          audio.pause();
          audio.removeAttribute('src');
          audio.load();
        } catch (err) {
          console.warn('[Showcase] audio cleanup failed', err);
        }
      };
      return;
    }

    if (type === '3d' && hasMediaUrl(entry)) {
      mediaContainer.className = 'kc-lightbox__frame kc-lightbox__frame--3d';
      if (isPreviewable3dEntry(entry)) {
        mount3dPreview(mediaContainer, {
          src: entry.url,
          alt: entry.name || extractFilename(entry.path) || '3D preview',
          variant: 'lightbox'
        });
        releaseCurrent = () => {
          mediaContainer.innerHTML = '';
        };
      } else {
        render3dDownloadMessage(mediaContainer, entry.url, 'lightbox');
      }
      return;
    }

    if (type === 'other' && hasMediaUrl(entry)) {
      const message = document.createElement('div');
      message.className = 'kc-lightbox__message';
      const text = document.createElement('span');
      text.textContent = 'このファイル形式のプレビューは未対応です。';
      const br = document.createElement('br');
      const link = document.createElement('a');
      link.href = entry.url;
      link.textContent = 'ダウンロード';
      link.setAttribute('download', '');
      message.append(text, br, link, document.createTextNode(' してご確認ください。'));
      mediaContainer.innerHTML = '';
      mediaContainer.className = 'kc-lightbox__frame kc-lightbox__frame--message';
      mediaContainer.appendChild(message);
      return;
    }

    if (hasMediaUrl(entry)) {
      const frame = document.createElement('div');
      frame.className = 'kc-lightbox__frame';
      const img = document.createElement('img');
      img.className = 'kc-lightbox__image';
      img.src = entry.url;
      img.alt = entry.name || extractFilename(entry.path) || 'preview';
      frame.appendChild(img);
      mediaContainer.innerHTML = '';
      mediaContainer.className = '';
      mediaContainer.appendChild(frame);
      return;
    }

    const placeholder = document.createElement('div');
    placeholder.className = 'kc-lightbox__message';
    placeholder.textContent = 'プレビュー対象のURLが見つかりません';
    mediaContainer.innerHTML = '';
    mediaContainer.className = '';
    mediaContainer.appendChild(placeholder);
  };

  const updateView = (index) => {
    if (!indexToPosition.has(index)) return;
    const entry = snapshots[index];
    if (!entry || !hasMediaUrl(entry)) return;
    currentIndex = index;
    renderEntry(entry);
    const position = indexToPosition.get(index) || 0;
    caption.textContent = formatMediaCaption(entry, position, validIndices.length);
    const prevIndex = findSibling(index, -1);
    const nextIndex = findSibling(index, 1);
    prevBtn.disabled = prevIndex === null;
    nextBtn.disabled = nextIndex === null;
  };

  prevBtn.addEventListener('click', (evt) => {
    evt.stopPropagation();
    const prevIndex = findSibling(currentIndex, -1);
    if (prevIndex !== null) {
      updateView(prevIndex);
    }
  });

  nextBtn.addEventListener('click', (evt) => {
    evt.stopPropagation();
    const nextIndex = findSibling(currentIndex, 1);
    if (nextIndex !== null) {
      updateView(nextIndex);
    }
  });

  overlay.addEventListener('click', (evt) => {
    if (evt.target === overlay) {
      closeLightbox();
    }
  });

  closeBtn.addEventListener('click', (evt) => {
    evt.stopPropagation();
    closeLightbox();
  });

  const onKey = (evt) => {
    if (evt.key === 'Escape') {
      closeLightbox();
    } else if (evt.key === 'ArrowLeft') {
      const prevIndex = findSibling(currentIndex, -1);
      if (prevIndex !== null) updateView(prevIndex);
    } else if (evt.key === 'ArrowRight') {
      const nextIndex = findSibling(currentIndex, 1);
      if (nextIndex !== null) updateView(nextIndex);
    }
  };

  window.addEventListener('keydown', onKey);

  updateView(initialIndex);

  activeLightbox = {
    overlay,
    onKey,
    cleanup: applyCleanup
  };
}

function openResultLightbox(startIndex) {
  const results = getCurrentResults();
  const entry = results[startIndex];
  if (!entry || !entry.imageUrl) return;

  closeResultsModal();
  closeLightbox();
  closePromptModal();

  const overlay = document.createElement('div');
  overlay.className = 'kc-lightbox';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'kc-lightbox__nav kc-lightbox__nav--prev';
  prevBtn.innerHTML = '‹';

  const nextBtn = document.createElement('button');
  nextBtn.className = 'kc-lightbox__nav kc-lightbox__nav--next';
  nextBtn.innerHTML = '›';

  const content = document.createElement('div');
  content.className = 'kc-lightbox__content';

  const frame = document.createElement('div');
  frame.className = 'kc-lightbox__frame';

  const img = document.createElement('img');
  img.className = 'kc-lightbox__image';
  frame.appendChild(img);

  const caption = document.createElement('div');
  caption.className = 'kc-lightbox__caption';

  content.append(frame, caption);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'kc-lightbox__close';
  closeBtn.innerHTML = '&times;';

  overlay.append(prevBtn, nextBtn, content, closeBtn);
  document.body.appendChild(overlay);
  document.body.classList.add('kc-lightbox-open');

  const findSibling = (current, direction) => {
    let idx = current + direction;
    while (idx >= 0 && idx < results.length) {
      if (results[idx]?.imageUrl) return idx;
      idx += direction;
    }
    return null;
  };

  let currentIndex = startIndex;

  const updateView = (index) => {
    const currentEntry = results[index];
    if (!currentEntry || !currentEntry.imageUrl) return;
    currentIndex = index;
    img.src = currentEntry.imageUrl;
    img.alt = currentEntry.label || currentEntry.engineId || 'preview';
    caption.textContent = currentEntry.fileName || currentEntry.engineId || '';
    const prevIndex = findSibling(index, -1);
    const nextIndex = findSibling(index, 1);
    prevBtn.disabled = prevIndex === null;
    nextBtn.disabled = nextIndex === null;
  };

  prevBtn.addEventListener('click', (evt) => {
    evt.stopPropagation();
    const prevIndex = findSibling(currentIndex, -1);
    if (prevIndex !== null) updateView(prevIndex);
  });

  nextBtn.addEventListener('click', (evt) => {
    evt.stopPropagation();
    const nextIndex = findSibling(currentIndex, 1);
    if (nextIndex !== null) updateView(nextIndex);
  });

  overlay.addEventListener('click', (evt) => {
    if (evt.target === overlay) closeLightbox();
  });
  closeBtn.addEventListener('click', (evt) => {
    evt.stopPropagation();
    closeLightbox();
  });

  const onKey = (evt) => {
    if (evt.key === 'Escape') {
      closeLightbox();
    } else if (evt.key === 'ArrowLeft') {
      const prevIndex = findSibling(currentIndex, -1);
      if (prevIndex !== null) updateView(prevIndex);
    } else if (evt.key === 'ArrowRight') {
      const nextIndex = findSibling(currentIndex, 1);
      if (nextIndex !== null) updateView(nextIndex);
    }
  };
  window.addEventListener('keydown', onKey);

  updateView(startIndex);
  activeLightbox = { overlay, onKey };
}

function closeResultsModal() {
  if (!activeResultsModal) return;
  const { overlay, onKeyDown } = activeResultsModal;
  document.removeEventListener('keydown', onKeyDown);
  overlay.remove();
  document.body.classList.remove('kc-modal-open');
  activeResultsModal = null;
  updateBatchControlVisuals();
}

function openResultsGallery() {
  const rawResults = getCurrentResults();
  const activeFilter = state.resultsFileFilter || 'all';
  const filteredResults = applyResultsFileFilter(rawResults, activeFilter);
  const partition = splitResultsByFailure(filteredResults);
  const results = partition.visible;
  const hasHiddenFailures = partition.hidden > 0;
  if (!results.length) {
    return;
  }

  const previewEntries = createLightboxEntriesFromSources(results, { preferImageUrl: true });

  closeTemplateMenu();
  closeResultsModal();
  closeLightbox();
  closePromptModal();
  closePromptPopover();

  const overlay = document.createElement('div');
  overlay.className = 'kc-results-modal';

  const panel = document.createElement('div');
  panel.className = 'kc-results-modal__panel';

  const header = document.createElement('div');
  header.className = 'kc-results-modal__header';
  const headerContent = document.createElement('div');
  headerContent.className = 'kc-results-modal__header-content';
  const title = document.createElement('h3');
  title.className = 'kc-results-modal__title';
  const activeEntry = getActiveHistoryEntry();
  const modalCategory = normalizeCategory(activeEntry?.category || state.activeCategory);
  const modalTypeTokens = results.length ? collectResultTypes(results[0]) : [];
  const modalTypeLabel = modalTypeTokens.length ? modalTypeTokens[0].toUpperCase() : '';
  const modalPrompt = (activeEntry?.prompt || '').trim()
    || getActivePromptForCategory(modalCategory)
    || '';
  const promptSuffix = modalPrompt ? ` 「${modalPrompt}」` : '';
  const typeSuffix = modalTypeLabel ? ` ${modalTypeLabel}` : '';
  title.textContent = `${categoryLabel(modalCategory)}${typeSuffix}${promptSuffix}`;

  const controls = document.createElement('div');
  controls.className = 'kc-results-controls kc-results-modal__controls';
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', '拡大結果のメディアコントロール');

  const rewindBtn = document.createElement('button');
  rewindBtn.type = 'button';
  rewindBtn.className = 'kc-button-icon';
  rewindBtn.id = 'kc-results-modal-rewind';
  rewindBtn.title = '最初に戻る';
  rewindBtn.setAttribute('aria-label', '最初に戻る');
  rewindBtn.textContent = '⏮';

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'kc-button-icon';
  toggleBtn.id = 'kc-results-modal-toggle';
  toggleBtn.title = '全てのメディアを再生';
  toggleBtn.setAttribute('aria-label', '全てのメディアを再生');
  toggleBtn.textContent = '▶';

  const forwardBtn = document.createElement('button');
  forwardBtn.type = 'button';
  forwardBtn.className = 'kc-button-icon';
  forwardBtn.id = 'kc-results-modal-forward';
  forwardBtn.title = '最後まで進む';
  forwardBtn.setAttribute('aria-label', '最後まで進む');
  forwardBtn.textContent = '⏭';

  const loopBtn = document.createElement('button');
  loopBtn.type = 'button';
  loopBtn.className = 'kc-button-icon';
  loopBtn.id = 'kc-results-modal-loop';
  loopBtn.title = 'ループ再生を有効';
  loopBtn.setAttribute('aria-label', 'ループ再生を有効');
  loopBtn.textContent = '🔁';

  controls.append(rewindBtn, toggleBtn, forwardBtn, loopBtn);
  headerContent.append(title, controls);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'kc-results-modal__close';
  closeBtn.innerHTML = '×';
  closeBtn.setAttribute('aria-label', '閉じる');
  closeBtn.addEventListener('click', (evt) => {
    evt.stopPropagation();
    closeResultsModal();
  });

  header.append(headerContent, closeBtn);

  const body = document.createElement('div');
  body.className = 'kc-results-modal__body';

  if (results.length) {
    const grid = document.createElement('div');
    grid.className = 'kc-results-modal__grid';

    if (hasHiddenFailures) {
      const notice = document.createElement('div');
      notice.className = 'kc-results-modal__notice';
      notice.textContent = `Failure結果 ${partition.hidden}件を非表示`;
      body.append(notice);
    }

    results.forEach((entry, index) => {
      const card = document.createElement('div');
      card.className = 'kc-results-modal__card';

      const media = document.createElement('div');
      media.className = 'kc-results-modal__media';
      media.style.margin = '0 auto';

      if (entry.imageUrl) {
        const label = formatEngineLabel(entry) || 'result';
        const mediaType = resolveMediaEntryType({
          filterType: entry.filterType || entry.type || '',
          type: entry.type || '',
          url: entry.imageUrl,
          path: entry.fileName || ''
        });
        const openDetail = () => {
          openMediaLightbox(previewEntries, index);
        };
        let previewEl;
        if (mediaType === 'video') {
          const video = document.createElement('video');
          video.src = entry.imageUrl;
          video.muted = true;
          video.playsInline = true;
          video.preload = 'metadata';
          video.autoplay = true;
          video.controls = true;
          video.className = 'kc-results-modal__video';
          applyLoopSettingToMedia(video);
          bindShowcaseMediaLifecycle(video, {
            src: entry.imageUrl,
            mediaType: 'video',
            context: 'results-modal'
          });
          const beginPlayback = () => {
            const playPromise = video.play();
            if (playPromise && typeof playPromise.catch === 'function') {
              playPromise.catch(() => {});
            }
          };
          if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            beginPlayback();
          } else {
            video.addEventListener('canplay', beginPlayback, { once: true });
          }
          previewEl = video;
        } else if (mediaType === 'sound') {
          const audio = document.createElement('audio');
          audio.src = entry.imageUrl;
          audio.controls = true;
          audio.preload = 'metadata';
          audio.className = 'kc-results-modal__audio';
          applyLoopSettingToMedia(audio);
          bindShowcaseMediaLifecycle(audio, {
            src: entry.imageUrl,
            mediaType: 'audio',
            context: 'results-modal'
          });
          previewEl = audio;
        } else if (mediaType === '3d') {
          if (isPreviewable3dEntry({ ...entry, url: entry.imageUrl })) {
            mount3dPreview(media, {
              src: entry.imageUrl,
              alt: label,
              variant: 'modal'
            });
          } else {
            render3dDownloadMessage(media, entry.imageUrl, 'modal');
          }
          previewEl = null;
        } else {
          const img = document.createElement('img');
          img.src = entry.imageUrl;
          img.alt = label;
          previewEl = img;
        }
        if (previewEl) {
          if (mediaType === '3d') {
            previewEl.addEventListener('click', (evt) => {
              evt.stopPropagation();
            });
          } else {
            previewEl.addEventListener('click', openDetail);
          }
          media.append(previewEl);
        } else if (mediaType !== '3d') {
          media.addEventListener('click', openDetail);
        }
        if (mediaType === '3d') {
          media.classList.add('kc-results-modal__media--interactive');
        }
      } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'kc-result-card__placeholder';
        placeholder.textContent = entry.error ? 'Failure' : 'No Preview';
        media.append(placeholder);
      }

      card.append(media);

      const meta = document.createElement('div');
      meta.className = 'kc-results-modal__meta';
      const titleLine = document.createElement('strong');
      titleLine.textContent = formatEngineLabel(entry) || '-';
      meta.append(titleLine);
      if (entry.fileName) {
        const fileLine = document.createElement('span');
        fileLine.textContent = entry.fileName;
        meta.append(fileLine);
      }
      if (entry.error) {
        const errorLine = document.createElement('span');
        errorLine.textContent = entry.error;
        errorLine.style.color = '#ff8b8b';
        meta.append(errorLine);
      }
      if (entry.imageUrl) {
        const mediaType = resolveMediaEntryType({
          filterType: entry.filterType || entry.type || '',
          type: entry.type || '',
          url: entry.imageUrl,
          path: entry.fileName || ''
        });
        if (mediaType === '3d') {
          const actionsLine = document.createElement('div');
          actionsLine.className = 'kc-results-modal__meta-actions';
          const openBtn = document.createElement('button');
          openBtn.type = 'button';
          openBtn.className = 'kc-results-modal__action';
          openBtn.textContent = '個別表示';
          openBtn.addEventListener('click', (evt) => {
            evt.stopPropagation();
            openMediaLightbox(previewEntries, index);
          });
          actionsLine.append(openBtn);
          meta.append(actionsLine);
        }
      }
      card.append(meta);
      grid.append(card);
    });

    body.append(grid);
  } else {
    const empty = document.createElement('div');
    empty.className = 'kc-results-modal__message';
    empty.textContent = '生成結果がありません';
    body.append(empty);
  }

  panel.append(header, body);
  overlay.append(panel);
  overlay.addEventListener('click', (evt) => {
    if (evt.target === overlay) closeResultsModal();
  });

  document.body.append(overlay);
  document.body.classList.add('kc-modal-open');

  registerBatchControlGroup({
    rewindBtn,
    toggleBtn,
    forwardBtn,
    loopBtn
  });

  const onKeyDown = (evt) => {
    if (evt.key === 'Escape') {
      closeResultsModal();
    }
  };

  document.addEventListener('keydown', onKeyDown);

  updateBatchControlVisuals();

  activeResultsModal = {
    overlay,
    onKeyDown
  };
}

function createLightboxEntryFromSource(entry, { preferImageUrl = false } = {}) {
  if (!entry) {
    return {
      url: ''
    };
  }

  const urlCandidates = [];
  if (preferImageUrl && entry.imageUrl) urlCandidates.push(entry.imageUrl);
  if (entry.url) urlCandidates.push(entry.url);
  if (entry.absolute) urlCandidates.push(entry.absolute);
  if (entry.webPath) urlCandidates.push(entry.webPath);
  const url = urlCandidates.find((value) => typeof value === 'string' && value.trim().length > 0) || '';

  const fallbackName = entry.fileName
    || entry.name
    || entry.label
    || extractFilename(entry.path)
    || extractFilename(url)
    || '';

  const base = {
    ...entry,
    url,
    imageUrl: entry.imageUrl || url || entry.absolute || entry.webPath || '',
    fileName: entry.fileName || fallbackName,
    name: entry.name || entry.label || fallbackName,
    path: entry.path || entry.fileName || entry.name || ''
  };

  const resolvedType = resolveMediaEntryType(base);
  if (!base.filterType || base.filterType === 'other') {
    base.filterType = resolvedType;
  }
  if (!base.type || base.type === 'other') {
    base.type = resolvedType;
  }

  return base;
}

function createLightboxEntriesFromSources(entries, options = {}) {
  if (!Array.isArray(entries)) return [];
  return entries.map((entry) => createLightboxEntryFromSource(entry, options));
}

function openMediaPreview(source, maybeIndexOrLabel, maybeType = 'image') {
  if (Array.isArray(source)) {
    const startIndex = Number.isFinite(maybeIndexOrLabel) ? Number(maybeIndexOrLabel) : 0;
    openMediaLightbox(createLightboxEntriesFromSources(source, { preferImageUrl: true }), startIndex);
    return;
  }

  const url = source;
  const label = typeof maybeIndexOrLabel === 'string' ? maybeIndexOrLabel : '';
  const type = typeof maybeType === 'string' ? maybeType : 'image';
  if (!url) return;
  openMediaLightbox([
    createLightboxEntryFromSource({
      url,
      name: label,
      filterType: type,
      type
    })
  ], 0);
}

function cancelParamsPopoverClose() {
  if (!paramsPopoverCloseTimer) return;
  clearTimeout(paramsPopoverCloseTimer);
  paramsPopoverCloseTimer = null;
}

function paramsPopoverContainsSelection(popover) {
  if (!popover) return false;
  if (typeof window.getSelection !== 'function') return false;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;
  const anchorNode = selection.anchorNode;
  if (!anchorNode) return false;
  const nodeType = (window.Node && window.Node.ELEMENT_NODE) || 1;
  const anchorElement = anchorNode.nodeType === nodeType
    ? anchorNode
    : anchorNode.parentElement;
  if (!anchorElement) return false;
  return popover.contains(anchorElement);
}

function isParamsPopoverEngaged() {
  if (!activeParamsPopover) return false;
  const { popover, anchor } = activeParamsPopover;
  if (!popover) return false;
  const pointerInside = typeof popover.matches === 'function' && popover.matches(':hover');
  const focusInside = popover.contains(document.activeElement);
  const selectionInside = paramsPopoverContainsSelection(popover);
  const anchorHovered = anchor && typeof anchor.matches === 'function' && anchor.matches(':hover');
  return Boolean(pointerInside || focusInside || selectionInside || anchorHovered);
}

function scheduleParamsPopoverClose() {
  cancelParamsPopoverClose();
  if (isParamsPopoverEngaged()) {
    return;
  }
  paramsPopoverCloseTimer = window.setTimeout(() => {
    if (isParamsPopoverEngaged()) {
      cancelParamsPopoverClose();
      return;
    }
    closeParamsPopover();
  }, PARAMS_POPOVER_HIDE_DELAY_MS);
}

function positionParamsPopover(popover, anchor) {
  if (!popover || !anchor) return;
  const rect = anchor.getBoundingClientRect();
  const popRect = popover.getBoundingClientRect();
  const padding = 12;
  const offset = 12;

  let left = rect.right + offset;
  if (left + popRect.width > window.innerWidth - padding) {
    left = rect.left - popRect.width - offset;
  }
  left = Math.max(padding, Math.min(left, window.innerWidth - popRect.width - padding));

  const maxTop = window.innerHeight - popRect.height - padding;
  let top = rect.bottom - popRect.height;
  if (Number.isNaN(top)) {
    top = padding;
  }
  if (maxTop < padding) {
    top = padding;
  } else if (top > maxTop) {
    top = maxTop;
  }
  if (top < padding) {
    top = padding;
  }

  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
}

function closeParamsPopover() {
  cancelParamsPopoverClose();
  if (!activeParamsPopover) return;
  const { popover, anchor, onWindowChange, onKeyDown } = activeParamsPopover;
  if (popover && popover.isConnected) {
    popover.removeEventListener('mouseenter', cancelParamsPopoverClose);
    popover.removeEventListener('mouseleave', scheduleParamsPopoverClose);
    popover.removeEventListener('pointerdown', cancelParamsPopoverClose);
    popover.removeEventListener('pointerup', cancelParamsPopoverClose);
    popover.removeEventListener('focusin', cancelParamsPopoverClose);
    popover.removeEventListener('focusout', handlePopoverFocusOut);
    popover.remove();
  }
  if (anchor) {
    anchor.classList.remove('is-active');
    anchor.setAttribute('aria-expanded', 'false');
  }
  if (onWindowChange) {
    window.removeEventListener('scroll', onWindowChange, true);
    window.removeEventListener('resize', onWindowChange);
  }
  if (onKeyDown) {
    window.removeEventListener('keydown', onKeyDown);
  }
  activeParamsPopover = null;
}

function closePromptPopover({ resetState = true } = {}) {
  const panel = document.getElementById('kc-results-prompt-panel');
  const toggle = document.getElementById('kc-results-prompt-button');
  const anchor = activePromptPopover?.anchor;
  const onWindowChange = activePromptPopover?.onWindowChange;
  const onKeyDown = activePromptPopover?.onKeyDown;
  if (onWindowChange) {
    window.removeEventListener('scroll', onWindowChange, true);
    window.removeEventListener('resize', onWindowChange);
  }
  if (onKeyDown) {
    window.removeEventListener('keydown', onKeyDown);
  }
  if (panel) {
    panel.hidden = true;
    panel.classList.remove('is-open');
    panel.style.visibility = '';
    panel.style.left = '';
    panel.style.top = '';
    panel.style.position = '';
    panel.style.right = '';
    panel.style.bottom = '';
    const hostId = panel.dataset.hostId;
    if (hostId) {
      const host = document.getElementById(hostId);
      if (host && panel.parentElement !== host) {
        host.appendChild(panel);
      }
    }
  }
  if (toggle) {
    toggle.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  }
  if (anchor) {
    anchor.classList.remove('is-open');
  }
  activePromptPopover = null;
  if (resetState) {
    state.resultsPromptExpanded = false;
  }
}

function handlePopoverFocusOut(evt) {
  if (!activeParamsPopover) return;
  const { popover } = activeParamsPopover;
  if (!popover || popover.contains(evt.relatedTarget)) {
    return;
  }
  scheduleParamsPopoverClose();
}

function openParamsPopover(engineMeta, anchor) {
  if (!engineMeta || !anchor) return;
  ensureEngineInputs(engineMeta);
  cancelParamsPopoverClose();

  if (activeParamsPopover && activeParamsPopover.anchor === anchor) {
    positionParamsPopover(activeParamsPopover.popover, anchor);
    return;
  }

  closeParamsPopover();

  const popover = document.createElement('div');
  popover.className = 'kc-param-popover';
  popover.setAttribute('role', 'dialog');
  const label = engineMeta.displayLabel || engineMeta.label || engineMeta.id || 'MCP 詳細設定';
  popover.setAttribute('aria-label', `${label} の詳細設定`);

  const header = document.createElement('div');
  header.className = 'kc-param-popover__header';
  const title = document.createElement('div');
  title.className = 'kc-param-popover__title';
  title.textContent = label;
  header.append(title);

  if (engineMeta.documentationUrl) {
    const docLink = document.createElement('a');
    docLink.className = 'kc-param-popover__doc-link';
    docLink.href = engineMeta.documentationUrl;
    docLink.target = '_blank';
    docLink.rel = 'noopener noreferrer';
    docLink.setAttribute('aria-label', `${label} のドキュメントを開く`);
    docLink.title = 'ドキュメントを開く';
    docLink.addEventListener('click', (evt) => {
      evt.stopPropagation();
    });

    const icon = document.createElement('span');
    icon.className = 'kc-param-popover__doc-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '↗';

    docLink.append(icon);
    header.append(docLink);
  }

  const body = document.createElement('div');
  body.className = 'kc-param-popover__body';
  renderParameterFields(engineMeta, body);
  const fragments = [header];

  let summaryEn = typeof engineMeta.docSummaryEn === 'string' ? engineMeta.docSummaryEn.trim() : '';
  let summaryJa = typeof engineMeta.docSummaryJa === 'string' ? engineMeta.docSummaryJa.trim() : '';
  if (!summaryEn && !summaryJa && typeof engineMeta.description === 'string') {
    summaryEn = engineMeta.description.trim();
  }

  if (summaryEn || summaryJa) {
    const summary = document.createElement('div');
    summary.className = 'kc-param-popover__doc-summary';
    if (summaryEn) {
      const lineEn = document.createElement('div');
      lineEn.className = 'kc-param-popover__doc-summary-line kc-param-popover__doc-summary-line--primary';
      lineEn.textContent = summaryEn;
      summary.append(lineEn);
    }
    if (summaryJa) {
      const lineJa = document.createElement('div');
      lineJa.className = 'kc-param-popover__doc-summary-line kc-param-popover__doc-summary-line--secondary';
      lineJa.textContent = summaryJa;
      summary.append(lineJa);
    }
    fragments.push(summary);
  }

  fragments.push(body);

  popover.append(...fragments);
  document.body.appendChild(popover);

  const handleWindowChange = () => {
    positionParamsPopover(popover, anchor);
  };
  window.addEventListener('scroll', handleWindowChange, true);
  window.addEventListener('resize', handleWindowChange);

  const handleKeyDown = (evt) => {
    if (evt.key === 'Escape') {
      closeParamsPopover();
      anchor.blur();
    }
  };
  window.addEventListener('keydown', handleKeyDown);

  popover.addEventListener('mouseenter', cancelParamsPopoverClose);
  popover.addEventListener('mouseleave', scheduleParamsPopoverClose);
  popover.addEventListener('pointerdown', cancelParamsPopoverClose);
  popover.addEventListener('pointerup', cancelParamsPopoverClose);
  popover.addEventListener('focusin', cancelParamsPopoverClose);
  popover.addEventListener('focusout', handlePopoverFocusOut);

  anchor.classList.add('is-active');
  anchor.setAttribute('aria-expanded', 'true');

  activeParamsPopover = {
    anchor,
    engineId: engineMeta.id,
    popover,
    onWindowChange: handleWindowChange,
    onKeyDown: handleKeyDown
  };

  requestAnimationFrame(() => {
    positionParamsPopover(popover, anchor);
  });
}

function positionPromptPopoverElement(panel, anchor) {
  if (!panel || !anchor) return;
  const gap = 14;
  const margin = 16;
  const anchorRect = anchor.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;

  let left = anchorRect.right + gap;
  if (left + panelRect.width + margin > viewportWidth) {
    left = Math.max(margin, viewportWidth - panelRect.width - margin);
  }

  let top = anchorRect.top + (anchorRect.height - panelRect.height) / 2;
  if (top < margin) {
    top = margin;
  }
  if (top + panelRect.height + margin > viewportHeight) {
    top = Math.max(margin, viewportHeight - panelRect.height - margin);
  }

  panel.style.left = `${Math.round(left)}px`;
  panel.style.top = `${Math.round(top)}px`;
}

function openPromptPopover(anchor, promptText) {
  const panel = document.getElementById('kc-results-prompt-panel');
  const textTarget = document.getElementById('kc-results-prompt-text');
  const text = typeof promptText === 'string' ? promptText.trim() : '';
  if (!panel || !textTarget || !text) {
    closePromptPopover();
    return;
  }

  closePromptPopover({ resetState: false });

  textTarget.textContent = text;
  const host = document.getElementById('kc-results-prompt-host') || panel.parentElement;
  if (host && host.id) {
    panel.dataset.hostId = host.id;
  } else if (!panel.dataset.hostId) {
    panel.dataset.hostId = 'kc-results-prompt-host';
  }

  if (panel.parentElement !== document.body) {
    document.body.appendChild(panel);
  }

  panel.hidden = false;
  panel.classList.add('is-open');
  panel.style.position = 'fixed';
  panel.style.right = 'auto';
  panel.style.bottom = 'auto';
  panel.style.visibility = 'hidden';

  if (anchor) {
    anchor.classList.add('is-open');
    anchor.setAttribute('aria-expanded', 'true');
  }

  const handleWindowChange = () => {
    positionPromptPopoverElement(panel, anchor || document.getElementById('kc-results-prompt-button'));
  };
  window.addEventListener('scroll', handleWindowChange, true);
  window.addEventListener('resize', handleWindowChange);

  const handleKeyDown = (evt) => {
    if (evt.key === 'Escape') {
      closePromptPopover();
      if (anchor) {
        anchor.blur();
      }
    }
  };
  window.addEventListener('keydown', handleKeyDown);

  requestAnimationFrame(() => {
    positionPromptPopoverElement(panel, anchor || document.getElementById('kc-results-prompt-button'));
    panel.style.visibility = 'visible';
  });

  state.resultsPromptExpanded = true;
  activePromptPopover = {
    anchor,
    hostId: panel.dataset.hostId || '',
    onWindowChange: handleWindowChange,
    onKeyDown: handleKeyDown
  };
}

function resolveUrl(pathOrUrl) {
  if (/^https?:/i.test(pathOrUrl)) return pathOrUrl;
  if (!state.backendOrigin) return pathOrUrl;
  const trimmed = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${state.backendOrigin}${trimmed}`;
}

function deriveDocumentationUrl(meta) {
  if (!meta) return '';
  if (typeof meta.documentationUrl === 'string' && meta.documentationUrl.trim()) {
    return meta.documentationUrl.trim();
  }

  const override = DOC_URL_OVERRIDES[meta.id];
  if (override) return override;
  return '';
}

function fetchJson(url, options) {
  const target = resolveUrl(url);
  return fetch(target, options).then(async (res) => {
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Request failed (${res.status}): ${text}`);
    }
    return res.json();
  });
}

function saveHistoryToStorage() {
  const filters = createDefaultHistoryFilters();
  const payload = {
    version: 3,
    filters,
    entries: state.history.map((entry) => ({
      id: entry.id,
      prompt: entry.prompt,
      createdAt: entry.createdAt,
      category: entry.category,
      sourceCategories: Array.isArray(entry.sourceCategories) ? entry.sourceCategories : [],
      results: Array.isArray(entry.results)
        ? entry.results.map((item) => ({
            ...item,
            sourceCategory: item.sourceCategory || '',
            type: item.type || '',
            typePrefixes: Array.isArray(item.typePrefixes) ? item.typePrefixes : []
          }))
        : []
    }))
  };

  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('[Showcase] failed to persist history cache', err);
  }

  if (isShowcaseSyncDisabled()) {
    return;
  }

  const target = resolveUrl(HISTORY_API_ENDPOINT);
  setReloadBlock(true);
  fetch(target, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .catch((err) => {
      console.warn('[Showcase] history sync failed', err);
    })
    .finally(() => {
      setReloadBlock(false, { release: false });
    });
}

function parseTemplateYaml(text) {
  const normalized = (text || '').replace(/\r/g, '');
  const match = normalized.match(/templates:\s*([\s\S]*)/);
  if (!match) return [];
  const section = match[1];
  const boundaryRegex = /^\s*-\s+id:/gm;
  const templates = [];
  const indices = [];
  let boundaryMatch;
  while ((boundaryMatch = boundaryRegex.exec(section)) !== null) {
    indices.push(boundaryMatch.index);
  }
  indices.push(section.length);
  for (let i = 0; i < indices.length - 1; i += 1) {
    const start = indices[i];
    const end = indices[i + 1];
    if (start === undefined || end === undefined) continue;
    const slice = section.slice(start, end).trim();
    if (!slice) continue;
    const entryText = slice.replace(/^\s*-\s*/, '');
    const lines = entryText.split(/\n/);
    const record = {};
    let lineIndex = 0;
    while (lineIndex < lines.length) {
      const line = lines[lineIndex];
      if (!line.trim()) {
        lineIndex += 1;
        continue;
      }
      const keyMatch = line.match(/^\s*([A-Za-z0-9_-]+):\s*(.*)$/);
      if (!keyMatch) {
        lineIndex += 1;
        continue;
      }
      const key = keyMatch[1];
      let value = keyMatch[2];
      if (value === '|') {
        const blockLines = [];
        const keyIndent = line.match(/^\s*/)[0].length;
        const blockIndent = keyIndent + 2;
        lineIndex += 1;
        while (lineIndex < lines.length) {
          const blockLine = lines[lineIndex];
          const indent = blockLine.match(/^\s*/)[0].length;
          if (blockLine.trim() && indent < blockIndent) {
            break;
          }
          const sliceIndex = Math.min(blockIndent, blockLine.length);
          blockLines.push(blockLine.slice(sliceIndex));
          lineIndex += 1;
        }
        while (blockLines.length && blockLines[blockLines.length - 1] === '') {
          blockLines.pop();
        }
        record[key] = blockLines.join('\n');
        continue;
      }
      value = value.replace(/^"(.*)"$/, '$1');
      record[key] = value;
      lineIndex += 1;
    }
    const id = (record.id || '').trim();
    const prompt = (record.prompt || '').trim();
    if (!id || !prompt) continue;
    const name = (record.name || id).trim();
    const category = (record.category || '').trim() || DEFAULT_ACTIVE_CATEGORY;
    const type = (record.type || '').trim();
    const filePrefixRaw = record.filePrefix || record.filename_prefix || record.filenamePrefix || '';
    const filePrefix = typeof filePrefixRaw === 'string' ? filePrefixRaw.trim() : '';
    const memo = typeof record.memo === 'string' ? record.memo.trim() : '';
    const soundText = typeof record.soundText === 'string' ? record.soundText.trim() : '';
    templates.push({
      id,
      name,
      category,
      prompt,
      type,
      filePrefix,
      memo,
      soundText,
      source: 'default'
    });
  }
  return templates;
}

async function loadTemplateCatalog() {
  try {
    const res = await fetch('/data/kamui-code/templates.yaml', { cache: 'no-cache' });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const text = await res.text();
    state.templateDefaults = parseTemplateYaml(text).map((tpl) => normalizeTemplateEntry(tpl));
  } catch (err) {
    console.warn('[Showcase] failed to load template catalog', err);
    state.templateDefaults = [];
  }
}

async function loadDocMetadata() {
  try {
    const res = await fetch(DOC_METADATA_ENDPOINT, { cache: 'no-cache' });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const json = await res.json();
    const map = new Map();
    if (json && typeof json === 'object') {
      Object.entries(json).forEach(([id, meta]) => {
        if (!id || typeof id !== 'string' || !meta || typeof meta !== 'object') {
          return;
        }
        const documentationUrl = typeof meta.documentationUrl === 'string' ? meta.documentationUrl.trim() : '';
        const descriptionEn = typeof meta.descriptionEn === 'string' ? meta.descriptionEn.trim() : '';
        const descriptionJa = typeof meta.descriptionJa === 'string' ? meta.descriptionJa.trim() : '';
        map.set(id, {
          documentationUrl,
          descriptionEn,
          descriptionJa
        });
      });
    }
    state.docMetadata = map;
  } catch (err) {
    console.warn('[Showcase] doc metadata load failed', err);
    state.docMetadata = new Map();
  }
}

function getDocMetadata(engineId) {
  if (!engineId) return null;
  return state.docMetadata.get(engineId) || null;
}

async function loadTemplatePreferences() {
  let payload = null;
  let needsMigration = false;

  const loadLocal = () => {
    try {
      const raw = localStorage.getItem(TEMPLATE_STORAGE_KEY);
      if (!raw) return null;
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (parseErr) {
        console.warn('[Showcase] template preferences local parse failed', parseErr);
        localStorage.removeItem(TEMPLATE_STORAGE_KEY);
        return null;
      }
      if (Array.isArray(parsed)) {
        return { payload: { version: 1, hidden: [], custom: parsed }, needsMigration: true };
      }
      if (parsed && typeof parsed === 'object') {
        const normalized = {
          version: Number.isFinite(parsed.version) ? parsed.version : 1,
          hidden: Array.isArray(parsed.hidden) ? parsed.hidden : [],
          custom: Array.isArray(parsed.custom) ? parsed.custom : []
        };
        return { payload: normalized, needsMigration: !parsed.version || parsed.version < 4 };
      }
    } catch (storageErr) {
      console.warn('[Showcase] template preferences local load failed', storageErr);
    }
    return null;
  };

  const localResult = loadLocal();
  if (localResult) {
    payload = localResult.payload;
    needsMigration = localResult.needsMigration;
  }

  if (!payload) {
    try {
      const response = await fetchJson(TEMPLATES_API_ENDPOINT);
      if (response && typeof response === 'object') {
        payload = {
          version: Number.isFinite(response.version) ? response.version : 4,
          hidden: Array.isArray(response.hidden) ? response.hidden : [],
          custom: Array.isArray(response.custom) ? response.custom : []
        };
        needsMigration = payload.version < 4;
        try {
          localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(payload));
        } catch (cacheErr) {
          console.warn('[Showcase] template cache update failed', cacheErr);
        }
      }
    } catch (err) {
      console.warn('[Showcase] template preferences fetch failed', err);
    }
  }

  if (!payload) {
    try {
      const res = await fetch('/data/kamui-code/template-prefs.json', { cache: 'no-cache' });
      if (res.ok) {
        const json = await res.json();
        if (json && typeof json === 'object') {
          payload = {
            version: Number.isFinite(json.version) ? json.version : 4,
            hidden: Array.isArray(json.hidden) ? json.hidden : [],
            custom: Array.isArray(json.custom) ? json.custom : []
          };
          needsMigration = payload.version < 4;
          try {
            localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(payload));
          } catch (persistErr) {
            console.warn('[Showcase] template fallback cache failed', persistErr);
          }
        }
      }
    } catch (staticErr) {
      console.warn('[Showcase] template fallback load failed', staticErr);
    }
  }

  if (!payload) {
    payload = { version: 4, hidden: [], custom: [] };
  }

  if (payload.version < 4) {
    needsMigration = true;
  }

  const hidden = Array.isArray(payload.hidden)
    ? payload.hidden.filter((id) => typeof id === 'string' && id)
    : [];
  const custom = Array.isArray(payload.custom)
    ? payload.custom
        .filter((tpl) => tpl && typeof tpl.prompt === 'string')
        .map((tpl) => {
          const base = {
            id: typeof tpl.id === 'string' ? tpl.id : `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: typeof tpl.name === 'string' && tpl.name ? tpl.name : (tpl.id || 'テンプレート'),
            prompt: String(tpl.prompt || ''),
            category: String(tpl.category || '').trim() || DEFAULT_ACTIVE_CATEGORY,
            type: typeof tpl.type === 'string' ? tpl.type : '',
            filePrefix: typeof tpl.filePrefix === 'string' ? tpl.filePrefix : '',
            memo: typeof tpl.memo === 'string' ? tpl.memo : '',
            soundText: typeof tpl.soundText === 'string' ? tpl.soundText : '',
            source: 'custom'
          };
          return normalizeTemplateEntry(base);
        })
    : [];

  state.templateHidden = new Set(hidden.map((id) => id.trim()).filter(Boolean));
  state.templateCustom = custom;

  if (needsMigration) {
    saveTemplatePreferences();
  }
}

function saveTemplatePreferences() {
  const payload = {
    version: 4,
    hidden: Array.from(state.templateHidden),
    custom: state.templateCustom.map((tpl) => ({
      id: tpl.id,
      name: tpl.name,
      prompt: tpl.prompt,
      category: tpl.category,
      type: tpl.type || '',
      filePrefix: tpl.filePrefix || '',
      memo: tpl.memo || '',
      soundText: tpl.soundText || ''
    }))
  };

  try {
    localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('[Showcase] failed to persist template cache', err);
  }

  if (isShowcaseSyncDisabled()) {
    return;
  }

  const target = resolveUrl(TEMPLATES_API_ENDPOINT);
  setReloadBlock(true);
  fetch(target, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .catch((err) => {
      console.warn('[Showcase] template sync failed', err);
    })
    .finally(() => {
      setReloadBlock(false, { release: false });
    });
}

function rebuildTemplates() {
  const defaults = (state.templateDefaults || [])
    .filter((tpl) => !state.templateHidden.has(tpl.id))
    .map((tpl) => normalizeTemplateEntry(tpl));
  const custom = state.templateCustom.map((tpl) => ({
    ...normalizeTemplateEntry(tpl),
    source: 'custom'
  }));
  state.templates = [...defaults, ...custom];
}

function cancelTemplateMenuClose() {
  if (!templateMenuCloseTimer) return;
  clearTimeout(templateMenuCloseTimer);
  templateMenuCloseTimer = null;
}

function scheduleTemplateMenuClose() {
  cancelTemplateMenuClose();
  if (activeTemplateMenu?.menu?.contains(document.activeElement)) {
    return;
  }
  templateMenuCloseTimer = window.setTimeout(() => {
    const menu = activeTemplateMenu?.menu;
    if (menu && menu.contains(document.activeElement)) {
      templateMenuCloseTimer = null;
      return;
    }
    closeTemplateMenu();
  }, PARAMS_POPOVER_HIDE_DELAY_MS);
}

function closeTemplateMenu() {
  cancelTemplateMenuClose();
  if (!activeTemplateMenu) return;
  const { menu, anchor, onOutsideClick, onKeyDown, onWindowChange } = activeTemplateMenu;
  document.removeEventListener('mousedown', onOutsideClick);
  document.removeEventListener('keydown', onKeyDown);
  if (onWindowChange) {
    window.removeEventListener('resize', onWindowChange);
    window.removeEventListener('scroll', onWindowChange, true);
  }
  menu.remove();
  if (anchor) {
    anchor.classList.remove('is-active');
    anchor.setAttribute('aria-expanded', 'false');
  }
  activeTemplateMenu = null;
}

function closeTemplateModal() {
  if (!activeTemplateModal) return;
  const { overlay, onKeyDown } = activeTemplateModal;
  if (onKeyDown) {
    window.removeEventListener('keydown', onKeyDown);
  }
  overlay.remove();
  document.body.classList.remove('kc-template-modal-open');
  activeTemplateModal = null;
}

function closePromptModal() {
  if (!activePromptModal) return;
  const { overlay, onKeyDown } = activePromptModal;
  if (onKeyDown) {
    window.removeEventListener('keydown', onKeyDown);
  }
  overlay.remove();
  document.body.classList.remove('kc-prompt-modal-open');
  activePromptModal = null;
}

function openPromptModal() {
  const anchor = document.getElementById('kc-prompt');
  if (!anchor) return;

  closePromptModal();

  const overlay = document.createElement('div');
  overlay.className = 'kc-prompt-modal';

  const panel = document.createElement('div');
  panel.className = 'kc-prompt-modal__panel';

  const form = document.createElement('form');
  form.className = 'kc-prompt-modal__form';

  const header = document.createElement('div');
  header.className = 'kc-prompt-modal__header';

  const title = document.createElement('h3');
  title.className = 'kc-prompt-modal__title';
  title.textContent = 'プロンプトを編集';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'kc-prompt-modal__close';
  closeBtn.innerHTML = '&times;';
  closeBtn.addEventListener('click', () => {
    closePromptModal();
  });

  header.append(title, closeBtn);

  const body = document.createElement('div');
  body.className = 'kc-prompt-modal__body';

  const textarea = document.createElement('textarea');
  textarea.className = 'kc-prompt-modal__textarea';
  textarea.placeholder = '生成に使うプロンプトを入力してください';
  textarea.value = state.prompt || '';

  const helper = document.createElement('div');
  helper.className = 'kc-prompt-modal__hint';
  helper.textContent = 'Shift + Enter で改行、Ctrl / Cmd + Enter で保存';

  const errorMsg = document.createElement('div');
  errorMsg.className = 'kc-prompt-modal__error';

  body.append(textarea, helper, errorMsg);

  const footer = document.createElement('div');
  footer.className = 'kc-prompt-modal__footer';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'kc-button kc-button--ghost';
  cancelBtn.textContent = 'キャンセル';
  cancelBtn.addEventListener('click', () => {
    closePromptModal();
  });

  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.className = 'kc-button kc-button--primary';
  saveBtn.textContent = '保存';

  footer.append(cancelBtn, saveBtn);

  form.append(header, body, footer);
  panel.append(form);
  overlay.append(panel);
  document.body.append(overlay);
  document.body.classList.add('kc-prompt-modal-open');

  const setError = (message) => {
    errorMsg.textContent = message || '';
  };

  const commitPrompt = () => {
    const nextPrompt = textarea.value;
    state.prompt = nextPrompt;
    syncPromptPreview();
    updateRunButtonState();
    closePromptModal();
    const runButton = document.getElementById('kc-run');
    if (runButton) {
      runButton.focus({ preventScroll: true });
    }
  };

  form.addEventListener('submit', (evt) => {
    evt.preventDefault();
    commitPrompt();
  });

  saveBtn.addEventListener('click', (evt) => {
    evt.preventDefault();
    commitPrompt();
  });

  textarea.addEventListener('keydown', (evt) => {
    if ((evt.metaKey || evt.ctrlKey) && evt.key === 'Enter') {
      evt.preventDefault();
      commitPrompt();
    }
  });

  overlay.addEventListener('click', (evt) => {
    if (evt.target === overlay) {
      closePromptModal();
    }
  });

  const onKeyDown = (evt) => {
    if (evt.key === 'Escape') {
      closePromptModal();
    }
  };
  window.addEventListener('keydown', onKeyDown);

  activePromptModal = {
    overlay,
    onKeyDown
  };

  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  });
}

function openTemplateEditor(options = {}) {
  closeTemplateModal();
  closePromptModal();

  const {
    title = 'テンプレートの保存',
    initialName = '',
    initialPrompt = '',
    initialCategory = state.activeEngineCategory || DEFAULT_ACTIVE_CATEGORY,
    initialType = '',
    initialFilePrefix = '',
    initialMemo = '',
    initialSoundText = '',
    onConfirm,
    onSuccess
  } = options;

  const categoryDefault = isSupportedCategory(initialCategory)
    ? initialCategory
    : DEFAULT_ACTIVE_CATEGORY;

  const overlay = document.createElement('div');
  overlay.className = 'kc-template-modal';

  const panel = document.createElement('div');
  panel.className = 'kc-template-modal__panel';

  const form = document.createElement('form');
  form.className = 'kc-template-modal__form';

  const header = document.createElement('div');
  header.className = 'kc-template-modal__header';

  const heading = document.createElement('h3');
  heading.className = 'kc-template-modal__title';
  heading.textContent = title;

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'kc-template-modal__close';
  closeBtn.innerHTML = '&times;';
  closeBtn.setAttribute('aria-label', '閉じる');
  closeBtn.addEventListener('click', (evt) => {
    evt.preventDefault();
    closeTemplateModal();
  });

  header.append(heading, closeBtn);

  const body = document.createElement('div');
  body.className = 'kc-template-modal__body';

  const suffix = Math.random().toString(36).slice(2, 8);

  const nameGroup = document.createElement('div');
  nameGroup.className = 'kc-template-modal__group';
  const nameLabel = document.createElement('label');
  nameLabel.className = 'kc-template-modal__label';
  nameLabel.setAttribute('for', `kc-template-name-${suffix}`);
  nameLabel.textContent = 'テンプレート名';
  const nameInput = document.createElement('input');
  nameInput.className = 'kc-template-modal__input';
  nameInput.type = 'text';
  nameInput.id = `kc-template-name-${suffix}`;
  nameInput.placeholder = '例: 夕景シネマティック';
  nameInput.value = initialName;
  nameGroup.append(nameLabel, nameInput);

  const filePrefixGroup = document.createElement('div');
  filePrefixGroup.className = 'kc-template-modal__group';
  const filePrefixLabel = document.createElement('label');
  filePrefixLabel.className = 'kc-template-modal__label';
  filePrefixLabel.setAttribute('for', `kc-template-file-prefix-${suffix}`);
  filePrefixLabel.textContent = 'ファイル名接頭辞 (任意)';
  const filePrefixInput = document.createElement('input');
  filePrefixInput.className = 'kc-template-modal__input';
  filePrefixInput.type = 'text';
  filePrefixInput.id = `kc-template-file-prefix-${suffix}`;
  filePrefixInput.value = initialFilePrefix;
  filePrefixGroup.append(filePrefixLabel, filePrefixInput);

  const memoGroup = document.createElement('div');
  memoGroup.className = 'kc-template-modal__group';
  const memoLabel = document.createElement('label');
  memoLabel.className = 'kc-template-modal__label';
  memoLabel.setAttribute('for', `kc-template-memo-${suffix}`);
  memoLabel.textContent = 'メモ (任意)';
  const memoField = document.createElement('textarea');
  memoField.className = 'kc-template-modal__textarea kc-template-modal__textarea--compact';
  memoField.id = `kc-template-memo-${suffix}`;
  memoField.placeholder = '補足コメントや和訳などを記入できます';
  memoField.value = initialMemo;
  memoGroup.append(memoLabel, memoField);

  const categoryGroup = document.createElement('div');
  categoryGroup.className = 'kc-template-modal__group';
  const categoryLabelEl = document.createElement('label');
  categoryLabelEl.className = 'kc-template-modal__label';
  categoryLabelEl.setAttribute('for', `kc-template-category-${suffix}`);
  categoryLabelEl.textContent = 'カテゴリ';
  const categorySelect = document.createElement('select');
  categorySelect.className = 'kc-template-modal__select';
  categorySelect.id = `kc-template-category-${suffix}`;
  SUPPORTED_CATEGORIES.forEach((cat) => {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = categoryLabel(cat);
    if (cat === categoryDefault) {
      option.selected = true;
    }
    categorySelect.append(option);
  });
  categoryGroup.append(categoryLabelEl, categorySelect);

  const typeGroup = document.createElement('div');
  typeGroup.className = 'kc-template-modal__group';
  const typeLabelEl = document.createElement('label');
  typeLabelEl.className = 'kc-template-modal__label';
  typeLabelEl.setAttribute('for', `kc-template-type-${suffix}`);
  typeLabelEl.textContent = 'タイプ';
  const typeSelect = document.createElement('select');
  typeSelect.className = 'kc-template-modal__select';
  typeSelect.id = `kc-template-type-${suffix}`;
  let currentType = normalizeTypeToken(initialType);

  let soundTextGroup = null;
  let soundTextField = null;

  const updateTypeOptions = () => {
    const normalizedCategory = normalizeCategory(categorySelect.value || DEFAULT_ACTIVE_CATEGORY);
    const typeOptions = knownTypesForCategory(normalizedCategory);
    typeSelect.innerHTML = '';
    const autoOption = document.createElement('option');
    autoOption.value = '';
    autoOption.textContent = 'カテゴリに合わせる';
    typeSelect.append(autoOption);
    typeOptions.forEach((type) => {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type.toUpperCase();
      typeSelect.append(option);
    });
    if (currentType && typeOptions.includes(currentType)) {
      typeSelect.value = currentType;
    } else {
      typeSelect.value = '';
      currentType = '';
    }
  };

  const updateSoundTextVisibility = () => {
    if (!soundTextGroup || !soundTextField) return;
    const normalizedCategory = normalizeCategory(categorySelect.value || DEFAULT_ACTIVE_CATEGORY);
    const isSoundCategory = normalizedCategory === 'sound';
    soundTextGroup.hidden = !isSoundCategory;
    soundTextGroup.classList.toggle('is-hidden', !isSoundCategory);
    soundTextField.disabled = !isSoundCategory;
  };

  updateTypeOptions();
  updateSoundTextVisibility();
  typeGroup.append(typeLabelEl, typeSelect);

  categorySelect.addEventListener('change', () => {
    updateTypeOptions();
    updateSoundTextVisibility();
  });

  typeSelect.addEventListener('change', () => {
    currentType = normalizeTypeToken(typeSelect.value);
  });

  const promptGroup = document.createElement('div');
  promptGroup.className = 'kc-template-modal__group';
  const promptLabel = document.createElement('label');
  promptLabel.className = 'kc-template-modal__label';
  promptLabel.setAttribute('for', `kc-template-prompt-${suffix}`);
  promptLabel.textContent = 'プロンプト';
  const promptField = document.createElement('textarea');
  promptField.className = 'kc-template-modal__textarea';
  promptField.id = `kc-template-prompt-${suffix}`;
  promptField.placeholder = '構造化したプロンプトを記入してください';
  promptField.value = initialPrompt;
  promptGroup.append(promptLabel, promptField);

  soundTextGroup = document.createElement('div');
  soundTextGroup.className = 'kc-template-modal__group kc-template-modal__group--sound';
  const soundTextLabel = document.createElement('label');
  soundTextLabel.className = 'kc-template-modal__label';
  soundTextLabel.setAttribute('for', `kc-template-sound-text-${suffix}`);
  soundTextLabel.textContent = '音声テキスト';
  soundTextField = document.createElement('textarea');
  soundTextField.className = 'kc-template-modal__textarea kc-template-modal__textarea--compact';
  soundTextField.id = `kc-template-sound-text-${suffix}`;
  soundTextField.placeholder = SOUND_TEXT_PLACEHOLDER;
  soundTextField.value = initialSoundText;
  soundTextGroup.append(soundTextLabel, soundTextField);
  updateSoundTextVisibility();

  const errorMsg = document.createElement('div');
  errorMsg.className = 'kc-template-modal__error';

  body.append(
    nameGroup,
    filePrefixGroup,
    categoryGroup,
    typeGroup,
    promptGroup,
    soundTextGroup,
    memoGroup,
    errorMsg
  );

  const footer = document.createElement('div');
  footer.className = 'kc-template-modal__footer';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'kc-button kc-button--ghost';
  cancelBtn.textContent = 'キャンセル';
  cancelBtn.addEventListener('click', (evt) => {
    evt.preventDefault();
    closeTemplateModal();
  });

  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.className = 'kc-button kc-button--primary';
  const saveLabel = '保存';
  saveBtn.textContent = saveLabel;

  footer.append(cancelBtn, saveBtn);

  form.append(header, body, footer);
  panel.append(form);
  overlay.append(panel);
  document.body.append(overlay);
  document.body.classList.add('kc-template-modal-open');

  const setError = (message) => {
    errorMsg.textContent = message || '';
  };

  const resetButtons = () => {
    saveBtn.disabled = false;
    cancelBtn.disabled = false;
    saveBtn.textContent = saveLabel;
  };

  const handleSubmit = async () => {
    setError('');
    const name = nameInput.value.trim();
    const prompt = promptField.value.trim();
    const selectedCategory = isSupportedCategory(categorySelect.value)
      ? categorySelect.value
      : DEFAULT_ACTIVE_CATEGORY;
    const selectedType = normalizeTypeToken(typeSelect.value);
    const filePrefix = filePrefixInput.value.trim();
    const memo = memoField.value.trim();
    const isSoundCategory = normalizeCategory(selectedCategory) === 'sound';
    const soundText = isSoundCategory && soundTextField ? soundTextField.value.trim() : '';

    if (!name) {
      setError('テンプレート名を入力してください。');
      nameInput.focus();
      return;
    }
    if (!prompt) {
      setError('プロンプトを入力してください。');
      promptField.focus();
      return;
    }

    let result;
    if (typeof onConfirm === 'function') {
      try {
        result = onConfirm({
          name,
          prompt,
          category: selectedCategory,
          type: selectedType,
          filePrefix,
          memo,
          soundText
        });
        if (result && typeof result.then === 'function') {
          saveBtn.disabled = true;
          cancelBtn.disabled = true;
          saveBtn.textContent = '保存中...';
          result = await result;
        }
      } catch (err) {
        setError(err.message || '保存に失敗しました。');
        resetButtons();
        return;
      }
    }

    if (typeof result === 'string') {
      setError(result);
      resetButtons();
      return;
    }
    if (result === false) {
      resetButtons();
      return;
    }

    closeTemplateModal();
    if (typeof onSuccess === 'function') {
      onSuccess({ name, prompt, category: selectedCategory, type: selectedType, filePrefix, memo, soundText });
    }
  };

  form.addEventListener('submit', (evt) => {
    evt.preventDefault();
    handleSubmit();
  });

  saveBtn.addEventListener('click', (evt) => {
    evt.preventDefault();
    handleSubmit();
  });

  activeTemplateModal = {
    overlay,
    onKeyDown: null
  };

  requestAnimationFrame(() => {
    nameInput.focus();
    nameInput.setSelectionRange(nameInput.value.length, nameInput.value.length);
  });
}

function positionTemplateMenu(menu, anchor) {
  if (!menu || !anchor) return;
  const margin = PROMPT_GENERATOR_FLOAT_MARGIN;
  menu.style.maxHeight = `calc(100vh - ${margin * 2}px)`;
  positionPromptGeneratorMenu(menu, anchor);
}

function applyTemplate(template) {
  if (!template) return;
  state.prompt = template.prompt;
  if (typeof template.soundText === 'string') {
    state.soundText = template.soundText;
  } else if (normalizeCategory(template.category) === 'sound') {
    state.soundText = '';
  }
  const templatePrefix = typeof template.filePrefix === 'string' ? template.filePrefix.trim() : '';
  if (templatePrefix) {
    setFilePrefix(templatePrefix);
  }
  syncPromptPreview();
  updateRunButtonState();
  syncSoundTextField({ preferExisting: false });
  const promptField = document.getElementById('kc-prompt');
  if (promptField) {
    delete promptField.dataset.manualResize;
    adjustPromptFieldHeight(promptField, { force: true });
    promptField.focus({ preventScroll: true });
    const end = promptField.value.length;
    promptField.setSelectionRange(end, end);
  }
}

function handleTemplateDelete(template, menu) {
  if (!template) return;
  if (template.source === 'default') {
    state.templateHidden.add(template.id);
  } else {
    state.templateCustom = state.templateCustom.filter((tpl) => tpl.id !== template.id);
  }
  rebuildTemplates();
  saveTemplatePreferences();
  populateTemplateMenu(menu);
}

function generateTemplateId(name, category) {
  const base = (name || 'template').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'template';
  const existing = new Set();
  (state.templateDefaults || []).forEach((tpl) => existing.add(tpl.id));
  state.templateCustom.forEach((tpl) => existing.add(tpl.id));
  let candidate = `tpl-${category}-${base}`;
  let counter = 2;
  while (existing.has(candidate)) {
    candidate = `tpl-${category}-${base}-${counter}`;
    counter += 1;
  }
  return candidate;
}

function addTemplateFromPrompt(options = {}) {
  const currentCategory = state.activeEngineCategory || DEFAULT_ACTIVE_CATEGORY;
  const templateData = (options && typeof options.template === 'object') ? options.template : {};
  const promptCandidate = typeof options.prompt === 'string' ? options.prompt.trim() : '';
  const promptValue = promptCandidate || state.prompt.trim();
  closeTemplateMenu();

  const primaryNameCandidate = [options.name, templateData.name, options.label]
    .find((value) => typeof value === 'string' && value.trim());
  const defaultName = primaryNameCandidate
    ? primaryNameCandidate.trim()
    : (promptValue ? `テンプレ ${state.templateCustom.length + 1}` : '');

  const categoryCandidate = (() => {
    if (typeof options.category === 'string' && options.category.trim()) {
      return options.category.trim();
    }
    if (typeof templateData.category === 'string' && templateData.category.trim()) {
      return templateData.category.trim();
    }
    return '';
  })();
  const normalizedCandidate = categoryCandidate ? normalizeCategory(categoryCandidate) : '';
  const initialCategory = normalizedCandidate || currentCategory;

  const typeCandidate = (() => {
    if (typeof options.type === 'string' && options.type.trim()) {
      return options.type.trim();
    }
    if (typeof templateData.type === 'string' && templateData.type.trim()) {
      return templateData.type.trim();
    }
    return '';
  })();
  let preferredType = typeCandidate ? normalizeTypeToken(typeCandidate) : '';
  if (!preferredType) {
    const prefix = normalizeTypeToken(state.historyFilters.prefix);
    if (prefix && prefix !== 'other') {
      preferredType = prefix;
    } else {
      const types = knownTypesForCategory(initialCategory);
      preferredType = types.length ? types[0] : '';
    }
  }

  const initialFilePrefix = (() => {
    const candidates = [options.filePrefix, templateData.filePrefix, state.filePrefix];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }
    return '';
  })();

  const initialMemo = (() => {
    const candidates = [options.memo, templateData.memo];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }
    return '';
  })();

  const initialSoundText = (() => {
    const candidates = [options.soundText, templateData.soundText, state.soundText];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }
    return '';
  })();

  const modalTitle = typeof options.title === 'string' && options.title.trim()
    ? options.title.trim()
    : '新規テンプレートを追加';

  openTemplateEditor({
    title: modalTitle,
    initialName: defaultName,
    initialPrompt: promptValue,
    initialCategory,
    initialType: preferredType,
    initialFilePrefix,
    initialMemo,
    initialSoundText,
    onConfirm: ({ name, prompt, category, type, filePrefix, memo, soundText }) => {
      const template = normalizeTemplateEntry({
        id: generateTemplateId(name, type || category),
        name,
        prompt,
        category,
        type,
        filePrefix,
        memo,
        soundText,
        source: 'custom'
      }, category);
      state.templateCustom = [template, ...state.templateCustom].slice(0, TEMPLATE_LIMIT);
      rebuildTemplates();
      saveTemplatePreferences();
      return true;
    },
    onSuccess: ({ prompt, filePrefix, category, soundText }) => {
      const anchor = document.getElementById('kc-template');
      if (anchor) {
        openTemplateMenu(anchor);
      }
      if (!state.prompt.trim()) {
        state.prompt = prompt;
        syncPromptPreview();
        updateRunButtonState();
      }
      if (filePrefix) {
        setFilePrefix(filePrefix);
      }
      if (normalizeCategory(category) === 'sound') {
        state.soundText = soundText || '';
        syncSoundTextField({ preferExisting: false });
      }
    }
  });
}

function syncTemplateMenuControls(menu) {
  const filters = ensureTemplateMenuFilters();
  const categorySelect = menu.querySelector('#kc-template-filter-category');
  if (categorySelect instanceof HTMLSelectElement) {
    const categoryOptions = PROMPT_GENERATOR_CATEGORY_OPTIONS;
    if (categorySelect.dataset.bound !== '1') {
      const fragment = document.createDocumentFragment();
      categoryOptions.forEach((option) => {
        const opt = document.createElement('option');
        opt.value = option.id;
        opt.textContent = option.label;
        fragment.append(opt);
      });
      categorySelect.replaceChildren(fragment);
      categorySelect.dataset.bound = '1';
    }
    const allowedIds = new Set(categoryOptions.map((option) => option.id));
    if (!allowedIds.has(filters.category)) {
      filters.category = allowedIds.has(state.activeEngineCategory) ? state.activeEngineCategory : ALL_CATEGORY_ID;
    }
    if (categorySelect.value !== filters.category) {
      categorySelect.value = filters.category;
    }
  }

  const typeSelect = menu.querySelector('#kc-template-filter-type');
  if (typeSelect instanceof HTMLSelectElement) {
    const typeOptions = getTypeFilterOptions(filters.category);
    const fragment = document.createDocumentFragment();
    typeOptions.forEach((option) => {
      const opt = document.createElement('option');
      opt.value = option.id;
      opt.textContent = option.label;
      fragment.append(opt);
    });
    typeSelect.replaceChildren(fragment);
    const allowed = typeOptions.map((option) => option.id);
    if (!allowed.includes(filters.type)) {
      filters.type = 'all';
    }
    if (typeSelect.value !== filters.type) {
      typeSelect.value = filters.type;
    }
  }

  const searchInput = menu.querySelector('#kc-template-filter-search');
  if (searchInput instanceof HTMLInputElement) {
    if (!searchInput.placeholder) {
      searchInput.placeholder = 'テンプレートを検索';
    }
    if (searchInput.value !== filters.query) {
      searchInput.value = filters.query;
    }
  }

  return filters;
}

function populateTemplateMenu(menu) {
  const list = menu.querySelector('.kc-template-menu__list');
  if (!list) return;
  list.innerHTML = '';
  const filters = syncTemplateMenuControls(menu);
  const previewRoot = menu.querySelector('.kc-template-menu__preview');
  const previewBody = menu.querySelector('.kc-template-menu__preview-body');
  const previewName = menu.querySelector('.kc-template-menu__preview-name');
  const previewType = menu.querySelector('.kc-template-menu__preview-type');
  const previewMemo = menu.querySelector('.kc-template-menu__preview-memo');
  const previewSoundLabel = menu.querySelector('.kc-template-menu__preview-label--sound');
  const previewSound = menu.querySelector('.kc-template-menu__preview-sound');
  const previewPlaceholder = previewBody?.dataset?.placeholder || 'テンプレートをホバーするとプロンプトを表示します';
  const previewNamePlaceholder = previewName?.dataset?.placeholder || 'テンプレート未選択';
  const previewMemoPlaceholder = previewMemo?.dataset?.placeholder || 'メモは設定されていません';
  const previewSoundPlaceholder = previewSound?.dataset?.placeholder || '音声テキストは設定されていません';
  const defaultCategory = normalizeCategory(filters.category === ALL_CATEGORY_ID
    ? (state.activeEngineCategory || DEFAULT_ACTIVE_CATEGORY)
    : filters.category);
  let activeItem = null;
  const setPreview = (template, itemEl = null) => {
    if (!previewBody || !previewRoot || !previewName) return;
    if (activeItem && activeItem !== itemEl) {
      activeItem.classList.remove('is-preview-active');
    }
    if (itemEl) {
      activeItem = itemEl;
      activeItem.classList.add('is-preview-active');
    } else {
      if (activeItem) {
        activeItem.classList.remove('is-preview-active');
      }
      activeItem = null;
    }
    const name = template?.name?.trim();
    const prompt = template?.prompt?.trim();
    const memo = template?.memo?.trim();
    const normalizedTemplateCategory = template ? normalizeCategory(template.category) : '';
    const badgeFallbackCategory = normalizedTemplateCategory
      || (filters.category !== ALL_CATEGORY_ID ? normalizeCategory(filters.category) : defaultCategory);
    const soundText = template?.soundText?.trim();
    previewName.textContent = name || previewNamePlaceholder;
    previewName.classList.toggle('is-placeholder', !name);
    if (previewType) {
      previewType.style.display = 'none';
      previewType.textContent = '';
      clearBadgeTheme(previewType);
      if (template) {
        const typeToken = normalizeTypeToken(template.type);
        if (typeToken) {
          previewType.textContent = typeToken.toUpperCase();
          previewType.style.display = 'inline-flex';
          applyBadgeTheme(previewType, typeToken, { fallbackCategory: badgeFallbackCategory });
        }
      }
    }
    if (prompt) {
      previewBody.textContent = prompt;
      previewRoot.classList.remove('kc-template-menu__preview--placeholder');
    } else {
      previewBody.textContent = previewPlaceholder;
      previewRoot.classList.add('kc-template-menu__preview--placeholder');
    }
    if (previewMemo) {
      if (memo) {
        previewMemo.textContent = memo;
        previewMemo.classList.remove('is-placeholder');
      } else {
        previewMemo.textContent = previewMemoPlaceholder;
        previewMemo.classList.add('is-placeholder');
      }
    }
    if (previewSound && previewSoundLabel) {
      const isSoundTemplate = template && normalizedTemplateCategory === 'sound';
      if (isSoundTemplate) {
        previewSoundLabel.hidden = false;
        previewSound.hidden = false;
        if (soundText) {
          previewSound.textContent = soundText;
          previewSound.classList.remove('is-placeholder');
        } else {
          previewSound.textContent = previewSoundPlaceholder;
          previewSound.classList.add('is-placeholder');
        }
      } else {
        previewSoundLabel.hidden = true;
        previewSound.hidden = true;
        previewSound.textContent = previewSoundPlaceholder;
        previewSound.classList.add('is-placeholder');
      }
    }
  };
  setPreview(null);
  const relevant = state.templates.filter((tpl) => templateMatchesFilters(tpl, filters));
  const sortedTemplates = relevant.slice().sort((a, b) => {
    const typeA = normalizeTypeToken(a.type) || 'zzzz';
    const typeB = normalizeTypeToken(b.type) || 'zzzz';
    const typeCompare = typeA.localeCompare(typeB, 'ja', { sensitivity: 'base' });
    if (typeCompare !== 0) return typeCompare;
    const nameA = (a.name || '').trim();
    const nameB = (b.name || '').trim();
    return nameA.localeCompare(nameB, 'ja', { sensitivity: 'base' });
  });
  const countEl = menu.querySelector('.kc-template-menu__count');
  if (countEl) {
    const categoryId = filters.category === ALL_CATEGORY_ID ? ALL_CATEGORY_ID : normalizeCategory(filters.category);
    const categoryText = categoryLabel(categoryId).toUpperCase();
    let typeText = 'ALL';
    if (filters.type && filters.type !== 'all') {
      typeText = filters.type === 'other' ? 'OTHER' : filters.type.toUpperCase();
    }
    countEl.textContent = `${categoryText} / ${typeText} · ${sortedTemplates.length}件`;
  }
  if (!sortedTemplates.length) {
    const empty = document.createElement('div');
    empty.className = 'kc-template-empty';
    empty.textContent = '該当するテンプレートがありません';
    list.append(empty);
    setPreview(null);
    return;
  }
  sortedTemplates.forEach((template) => {
    const item = document.createElement('div');
    item.className = 'kc-template-item';

    const name = document.createElement('span');
    name.className = 'kc-template-item__name';
    name.textContent = template.name;

    const actions = document.createElement('div');
    actions.className = 'kc-template-item__actions';

    const badges = document.createElement('div');
    badges.className = 'kc-template-item__badges';

    const typeToken = normalizeTypeToken(template.type);
    if (typeToken) {
      const typeBadge = document.createElement('span');
      typeBadge.className = 'kc-template-item__badge kc-template-item__badge--type kc-badge kc-badge--micro';
      typeBadge.textContent = typeToken.toUpperCase();
      const badgeFallbackCategory = normalizeCategory(template.category || defaultCategory);
      applyBadgeTheme(typeBadge, typeToken, { fallbackCategory: badgeFallbackCategory });
      badges.append(typeBadge);
    }

    const categoryBadge = document.createElement('span');
    categoryBadge.className = 'kc-template-item__badge kc-template-item__badge--category kc-badge kc-badge--micro';
    const categoryId = normalizeCategory(template.category || defaultCategory);
    categoryBadge.textContent = categoryLabel(categoryId);
    applyBadgeTheme(categoryBadge, categoryId, { fallbackCategory: categoryId });
    badges.append(categoryBadge);

    actions.append(badges);

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'kc-template-item__edit';
    editBtn.title = 'テンプレートを編集';
    editBtn.textContent = '✎';
    editBtn.addEventListener('click', (evt) => {
      evt.stopPropagation();
      closeTemplateMenu();
      openTemplateEditor({
        title: `${template.name} を編集`,
        initialName: template.name,
        initialPrompt: template.prompt,
        initialCategory: template.category,
        initialType: template.type,
        initialFilePrefix: template.filePrefix || '',
        initialMemo: template.memo || '',
        initialSoundText: template.soundText || '',
        onConfirm: ({ name, prompt, category, type, filePrefix, memo, soundText }) => {
          const updated = {
            id: template.id,
            name,
            prompt,
            category,
            type,
            filePrefix,
            memo,
            soundText,
            source: 'custom'
          };
          const normalized = normalizeTemplateEntry(updated, category);
          normalized.source = 'custom';
          const existingCustom = state.templateCustom.filter((tpl) => tpl.id !== template.id);
          if (template.source === 'default') {
            state.templateHidden.add(template.id);
          }
          state.templateCustom = [normalized, ...existingCustom].slice(0, TEMPLATE_LIMIT);
          rebuildTemplates();
          saveTemplatePreferences();
          const currentPrompt = state.prompt || '';
          if (currentPrompt.trim() && currentPrompt.trim() === (template.prompt || '').trim()) {
            state.prompt = prompt;
            syncPromptPreview();
            updateRunButtonState();
          }
          if (normalizeCategory(category) === 'sound') {
            state.soundText = soundText || '';
            syncSoundTextField({ preferExisting: false });
          }
          return true;
        },
        onSuccess: ({ prompt, filePrefix, category, soundText }) => {
          const anchorBtn = document.getElementById('kc-template');
          if (anchorBtn) {
            openTemplateMenu(anchorBtn);
          }
          if (!state.prompt.trim()) {
            state.prompt = prompt;
            syncPromptPreview();
            updateRunButtonState();
          }
          if (filePrefix) {
            setFilePrefix(filePrefix);
          }
          if (normalizeCategory(category) === 'sound') {
            state.soundText = soundText || '';
            syncSoundTextField({ preferExisting: false });
          }
        }
      });
    });
    actions.append(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'kc-template-item__delete';
    deleteBtn.title = template.source === 'default' ? 'テンプレートを非表示' : 'テンプレートを削除';
    deleteBtn.textContent = '×';
    deleteBtn.addEventListener('click', (evt) => {
      evt.stopPropagation();
      const confirmation = template.source === 'default'
        ? 'このテンプレートを一覧から非表示にしますか？'
        : 'このテンプレートを削除しますか？';
      if (!window.confirm(confirmation)) return;
      handleTemplateDelete(template, menu);
    });
    actions.append(deleteBtn);

    item.append(name, actions);
    item.addEventListener('click', () => {
      applyTemplate(template);
      closeTemplateMenu();
    });
    item.addEventListener('mouseenter', () => {
      setPreview(template, item);
    });
    item.addEventListener('focus', () => {
      setPreview(template, item);
    });

    list.append(item);
  });

  if (!menu.dataset.templatePreviewLeaveBound) {
    const handleLeave = (evt) => {
      if (!menu.contains(evt.relatedTarget)) {
        setPreview(null);
      }
    };
    menu.addEventListener('mouseleave', handleLeave);
    menu.dataset.templatePreviewLeaveBound = 'true';
  }

  if (activeTemplateMenu && activeTemplateMenu.menu === menu) {
    requestAnimationFrame(() => {
      positionTemplateMenu(menu, activeTemplateMenu.anchor);
    });
  }
}

function openTemplateMenu(anchor) {
  if (!anchor) return;
  cancelTemplateMenuClose();
  if (activeTemplateMenu && activeTemplateMenu.anchor === anchor) {
    closeTemplateMenu();
    return;
  }
  closeTemplateMenu();

  const menu = document.createElement('div');
  menu.className = 'kc-template-menu';
  menu.tabIndex = -1;
  menu.setAttribute('role', 'dialog');
  menu.setAttribute('aria-modal', 'true');
  menu.style.visibility = 'hidden';
  menu.style.pointerEvents = 'none';

  const header = document.createElement('div');
  header.className = 'kc-template-menu__header';
  const headerMain = document.createElement('div');
  headerMain.className = 'kc-template-menu__header-main';
  const headerTitle = document.createElement('div');
  headerTitle.className = 'kc-template-menu__title';
  headerTitle.textContent = 'テンプレート';
  const headerCount = document.createElement('span');
  headerCount.className = 'kc-template-menu__count';
  headerMain.append(headerTitle, headerCount);

  const filterWrap = document.createElement('div');
  filterWrap.className = 'kc-template-menu__filters';

  const categorySelect = document.createElement('select');
  categorySelect.id = 'kc-template-filter-category';
  categorySelect.className = 'kc-template-filter';
  categorySelect.setAttribute('aria-label', 'カテゴリで絞り込み');
  filterWrap.append(categorySelect);

  const typeSelect = document.createElement('select');
  typeSelect.id = 'kc-template-filter-type';
  typeSelect.className = 'kc-template-filter';
  typeSelect.setAttribute('aria-label', 'タイプで絞り込み');
  filterWrap.append(typeSelect);

  const searchWrap = document.createElement('div');
  searchWrap.className = 'kc-template-search';
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.id = 'kc-template-filter-search';
  searchInput.className = 'kc-template-search__input';
  searchInput.placeholder = 'テンプレートを検索';
  searchInput.setAttribute('aria-label', 'テンプレートを検索');
  searchWrap.append(searchInput);
  filterWrap.append(searchWrap);

  header.append(headerMain, filterWrap);
  menu.append(header);

  const content = document.createElement('div');
  content.className = 'kc-template-menu__content';

  const preview = document.createElement('div');
  preview.className = 'kc-template-menu__preview kc-template-menu__preview--placeholder';
  const previewHeader = document.createElement('div');
  previewHeader.className = 'kc-template-menu__preview-header';
  const previewName = document.createElement('div');
  previewName.className = 'kc-template-menu__preview-name';
  previewName.dataset.placeholder = 'テンプレート未選択';
  previewName.textContent = previewName.dataset.placeholder;
  const previewType = document.createElement('span');
  previewType.className = 'kc-template-menu__preview-type kc-badge kc-badge--tiny';
  previewType.style.display = 'none';
  previewHeader.append(previewName, previewType);
  const previewLabel = document.createElement('div');
  previewLabel.className = 'kc-template-menu__preview-label';
  previewLabel.textContent = 'プロンプト';
  const previewBody = document.createElement('div');
  previewBody.className = 'kc-template-menu__preview-body';
  previewBody.dataset.placeholder = 'テンプレートをホバーするとプロンプトを表示します';
  previewBody.textContent = previewBody.dataset.placeholder;
  const previewSoundLabel = document.createElement('div');
  previewSoundLabel.className = 'kc-template-menu__preview-label kc-template-menu__preview-label--sound';
  previewSoundLabel.textContent = '音声テキスト';
  previewSoundLabel.hidden = true;
  const previewSound = document.createElement('div');
  previewSound.className = 'kc-template-menu__preview-sound is-placeholder';
  previewSound.dataset.placeholder = '音声テキストは設定されていません';
  previewSound.textContent = previewSound.dataset.placeholder;
  previewSound.hidden = true;
  const previewMemoLabel = document.createElement('div');
  previewMemoLabel.className = 'kc-template-menu__preview-label';
  previewMemoLabel.textContent = 'メモ';
  const previewMemo = document.createElement('div');
  previewMemo.className = 'kc-template-menu__preview-memo is-placeholder';
  previewMemo.dataset.placeholder = 'メモは設定されていません';
  previewMemo.textContent = previewMemo.dataset.placeholder;
  preview.append(
    previewHeader,
    previewLabel,
    previewBody,
    previewSoundLabel,
    previewSound,
    previewMemoLabel,
    previewMemo
  );

  const list = document.createElement('div');
  list.className = 'kc-template-menu__list';

  content.append(preview, list);
  menu.append(content);

  const footer = document.createElement('div');
  footer.className = 'kc-template-menu__footer';
  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'kc-template-add';
  addBtn.textContent = '＋ 新規テンプレートを追加';
  addBtn.addEventListener('click', (evt) => {
    evt.preventDefault();
    addTemplateFromPrompt();
  });
  footer.append(addBtn);
  menu.append(footer);

  document.body.append(menu);

  const menuState = {
    menu,
    anchor,
    onOutsideClick: null,
    onKeyDown: null,
    onWindowChange: null
  };
  activeTemplateMenu = menuState;

  const reposition = () => {
    positionTemplateMenu(menu, anchor);
  };

  const handleCategoryChange = (evt) => {
    const select = evt.target;
    if (!(select instanceof HTMLSelectElement)) return;
    const templateFilters = ensureTemplateMenuFilters();
    const value = select.value;
    if (value === ALL_CATEGORY_ID) {
      templateFilters.category = ALL_CATEGORY_ID;
    } else {
      templateFilters.category = normalizeCategory(value);
    }
    const allowedTypes = getTypeFilterOptions(templateFilters.category).map((option) => option.id);
    if (!allowedTypes.includes(templateFilters.type)) {
      templateFilters.type = 'all';
    }
    populateTemplateMenu(menu);
    reposition();
  };
  const handleTypeChange = (evt) => {
    const select = evt.target;
    if (!(select instanceof HTMLSelectElement)) return;
    const templateFilters = ensureTemplateMenuFilters();
    const value = select.value;
    if (value === 'all' || value === 'other') {
      templateFilters.type = value;
    } else {
      const normalized = normalizeTypeToken(value);
      templateFilters.type = normalized || 'all';
    }
    populateTemplateMenu(menu);
    reposition();
  };
  const handleSearchInput = (evt) => {
    const input = evt.target;
    if (!(input instanceof HTMLInputElement)) return;
    cancelTemplateMenuClose();
    const templateFilters = ensureTemplateMenuFilters();
    templateFilters.query = input.value;
    populateTemplateMenu(menu);
    reposition();
  };

  categorySelect.addEventListener('change', handleCategoryChange);
  typeSelect.addEventListener('change', handleTypeChange);
  searchInput.addEventListener('input', handleSearchInput);
  searchInput.addEventListener('search', handleSearchInput);
  searchInput.addEventListener('focus', cancelTemplateMenuClose);

  populateTemplateMenu(menu);
  reposition();

  menu.style.visibility = '';
  menu.style.pointerEvents = '';

  requestAnimationFrame(() => {
    reposition();
    menu.classList.add('is-open');
    try {
      menu.focus({ preventScroll: true });
    } catch (err) {
      // フォーカスできない場合は無視
    }
  });

  const handleWindowChange = () => {
    if (!document.body.contains(menu)) {
      window.removeEventListener('resize', handleWindowChange);
      window.removeEventListener('scroll', handleWindowChange, true);
      return;
    }
    requestAnimationFrame(reposition);
  };

  window.addEventListener('resize', handleWindowChange, { passive: true });
  window.addEventListener('scroll', handleWindowChange, { passive: true, capture: true });

  menu.addEventListener('mouseenter', cancelTemplateMenuClose);
  menu.addEventListener('mouseleave', scheduleTemplateMenuClose);
  menu.addEventListener('focusin', cancelTemplateMenuClose);
  menu.addEventListener('focusout', (evt) => {
    if (!menu.contains(evt.relatedTarget)) {
      scheduleTemplateMenuClose();
    }
  });

  const onOutsideClick = (evt) => {
    if (!menu.contains(evt.target) && evt.target !== anchor) {
      closeTemplateMenu();
    }
  };
  const onKeyDown = (evt) => {
    if (evt.key === 'Escape') {
      closeTemplateMenu();
    }
  };
  document.addEventListener('mousedown', onOutsideClick);
  document.addEventListener('keydown', onKeyDown);

  anchor.classList.add('is-active');
  anchor.setAttribute('aria-expanded', 'true');

  menuState.onOutsideClick = onOutsideClick;
  menuState.onKeyDown = onKeyDown;
  menuState.onWindowChange = handleWindowChange;
  activeTemplateMenu = menuState;
}

function ingestHistoryEntries(entries) {
  const mapped = Array.isArray(entries)
    ? entries.map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }
        const rawCategory = normalizeCategory(entry.category);
        const rawResults = Array.isArray(entry.results)
          ? entry.results.map((item) => ({ ...item }))
          : [];
        const sanitizedResults = rawResults.map((item) => {
          const typePrefix = resolveTypePrefix([
            item.type,
            item.kind,
            item.sourceCategory,
            extractEnginePrefix(item.engineId || item.label || '')
          ]);
          return {
            ...item,
            imageUrl: normalizeShowcaseAssetUrl(item.imageUrl),
            logFile: item.logFile ? normalizeShowcaseAssetUrl(item.logFile) : item.logFile,
            sourceCategory: typePrefix,
            type: typePrefix,
            typePrefixes: Array.isArray(item.typePrefixes)
              ? item.typePrefixes.map((prefix) => normalizeTypeToken(prefix)).filter(Boolean)
              : (typePrefix ? [typePrefix] : [])
          };
        });
        const sourcePrefixSet = new Set();
        if (Array.isArray(entry.sourceCategories) && entry.sourceCategories.length) {
          entry.sourceCategories.forEach((src) => {
            const normalized = normalizeTypeToken(src);
            if (normalized) sourcePrefixSet.add(normalized);
          });
        }
        sanitizedResults.forEach((result) => {
          if (result.type) sourcePrefixSet.add(result.type);
          if (Array.isArray(result.typePrefixes)) {
            result.typePrefixes.forEach((prefix) => {
              const normalized = normalizeTypeToken(prefix);
              if (normalized) sourcePrefixSet.add(normalized);
            });
          }
        });
        const sourceCategories = Array.from(sourcePrefixSet);
        const inferredCategory = inferCategoryFromTokens([
          rawCategory,
          ...sourceCategories
        ], rawCategory);
        const category = inferredCategory || DEFAULT_ACTIVE_CATEGORY;
        ensureCategoryCollections(category);
        return {
          id: typeof entry.id === 'string' ? entry.id : `run-${category}-${Date.now()}`,
          prompt: entry.prompt || '',
          createdAt: Number.isFinite(entry.createdAt) ? entry.createdAt : Date.now(),
          category,
          sourceCategories,
          results: sanitizedResults
        };
      }).filter(Boolean)
    : [];

  const sorted = mapped.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  state.history = MAX_HISTORY_ENTRIES === Number.POSITIVE_INFINITY
    ? sorted
    : sorted.slice(0, MAX_HISTORY_ENTRIES);

  SUPPORTED_CATEGORIES.forEach((cat) => {
    ensureCategoryCollections(cat);
    const first = state.history.find((entry) => entry.category === cat);
    state.resultsByCategory[cat] = first ? first.results.map((item) => ({ ...item })) : [];
  });

  if (state.history.length) {
    const latest = state.history[0];
    state.historyActiveId = latest.id;
    state.activeCategory = latest.category;
    ensureCategoryCollections(latest.category);
    state.resultsByCategory[latest.category] = latest.results.map((item) => ({ ...item }));
    ensureCategoryCollections(ALL_CATEGORY_ID);
    state.activeEngineCategory = ALL_CATEGORY_ID;
    state.historyManualSelection = false;
  } else {
    state.historyActiveId = null;
    state.activeCategory = DEFAULT_ACTIVE_CATEGORY;
    state.historyFilters.category = 'all';
    state.historyFilters.prefix = 'all';
    SUPPORTED_CATEGORIES.forEach((cat) => {
      state.resultsByCategory[cat] = [];
    });
    ensureCategoryCollections(ALL_CATEGORY_ID);
    state.activeEngineCategory = ALL_CATEGORY_ID;
    state.historyManualSelection = false;
  }
}

async function loadHistoryFromStorage() {
  let entries = null;
  let fallbackVersion = 1;
  let filters = null;
  const loadLocalHistory = () => {
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (!raw) return null;
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (parseErr) {
        console.warn('[Showcase] history local cache parse failed', parseErr);
        localStorage.removeItem(HISTORY_STORAGE_KEY);
        return null;
      }
      if (Array.isArray(parsed)) {
        return { version: 1, entries: parsed, filters: null };
      }
      if (parsed && Array.isArray(parsed.entries)) {
        return {
          version: Number.isFinite(parsed.version) ? parsed.version : 1,
          entries: parsed.entries,
          filters: parsed.filters || null
        };
      }
    } catch (storageErr) {
      console.warn('[Showcase] history local load failed', storageErr);
    }
    return null;
  };

  const localPayload = loadLocalHistory();
  if (localPayload) {
    entries = localPayload.entries;
    fallbackVersion = Number.isFinite(localPayload.version) ? localPayload.version : fallbackVersion;
    filters = sanitizeHistoryFilters(localPayload.filters);
  }

  if (!entries) {
    try {
      const response = await fetchJson(HISTORY_API_ENDPOINT);
      if (response && Array.isArray(response.entries)) {
        entries = response.entries;
        fallbackVersion = Number.isFinite(response.version) ? response.version : fallbackVersion;
        filters = sanitizeHistoryFilters(response.filters);
        try {
          localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify({
            version: fallbackVersion,
            entries,
            filters
          }));
        } catch (cacheErr) {
          console.warn('[Showcase] history cache update failed', cacheErr);
        }
      }
    } catch (err) {
      console.warn('[Showcase] history fetch failed', err);
    }
  }

  if (!entries) {
    try {
      const res = await fetch('/data/kamui-code/history.json', { cache: 'no-cache' });
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.entries)) {
          entries = json.entries;
          fallbackVersion = Number.isFinite(json.version) ? json.version : fallbackVersion;
          filters = sanitizeHistoryFilters(json.filters);
          try {
            localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify({
              version: fallbackVersion,
              entries,
              filters
            }));
          } catch (persistErr) {
            console.warn('[Showcase] history fallback cache failed', persistErr);
          }
        }
      }
    } catch (staticErr) {
      console.warn('[Showcase] history static fallback load failed', staticErr);
    }
  }

  ingestHistoryEntries(entries || []);
  const normalizedFilters = createDefaultHistoryFilters();
  state.historyFilters.category = normalizedFilters.category;
  state.historyFilters.prefix = normalizedFilters.prefix;
}

function flattenCurrentRunResults() {
  const aggregated = [];
  state.currentRunResults.forEach((items) => {
    items.forEach((item) => {
      aggregated.push({ ...item });
    });
  });
  return aggregated;
}

function deriveHistorySourceCategories(results) {
  const tokens = new Set();
  results.forEach((item) => {
    const primary = normalizeTypeToken(item.type);
    if (primary) tokens.add(primary);
    const source = normalizeTypeToken(item.sourceCategory);
    if (source) tokens.add(source);
    if (Array.isArray(item.typePrefixes)) {
      item.typePrefixes.forEach((prefix) => {
        const normalized = normalizeTypeToken(prefix);
        if (normalized) tokens.add(normalized);
      });
    }
    const derived = normalizeTypeToken(extractEnginePrefix(item.engineId || item.label || ''));
    if (derived) tokens.add(derived);
  });
  return Array.from(tokens);
}

function ensureHistoryEntryForCurrentRun({ prompt, category, jobId } = {}) {
  let entry = state.currentHistoryEntryId
    ? state.history.find((item) => item.id === state.currentHistoryEntryId)
    : null;
  const normalizedCategory = normalizeCategory(category || entry?.category || DEFAULT_ACTIVE_CATEGORY);
  if (!entry) {
    entry = {
      id: `run-${normalizedCategory}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      prompt: prompt || '',
      createdAt: Date.now(),
      category: normalizedCategory,
      sourceCategories: [],
      results: [],
      jobId: jobId || ''
    };
    state.currentHistoryEntryId = entry.id;
    state.history = [entry, ...state.history].slice(0, MAX_HISTORY_ENTRIES);
  } else {
    entry.jobId = jobId || entry.jobId || '';
    if (prompt) entry.prompt = prompt;
    entry.category = normalizedCategory;
  }
  if (!state.historyManualSelection || state.historyActiveId === entry.id) {
    state.historyActiveId = entry.id;
  }
  return entry;
}

function syncHistoryEntryFromCurrentResults(entry, { prompt, category } = {}) {
  if (!entry) return;
  const aggregated = flattenCurrentRunResults();
  entry.results = aggregated.map((item) => ({ ...item }));
  const normalizedCategory = normalizeCategory(category || entry.category || DEFAULT_ACTIVE_CATEGORY);
  entry.category = normalizedCategory;
  if (typeof prompt === 'string' && prompt) {
    entry.prompt = prompt;
  }
  entry.sourceCategories = deriveHistorySourceCategories(entry.results);
  entry.createdAt = entry.createdAt || Date.now();
}

function getActiveHistoryEntry() {
  if (!state.historyActiveId) return null;
  const entry = state.history.find((item) => item.id === state.historyActiveId);
  return entry || null;
}

function setHistoryActiveId(entryId, options = {}) {
  const { syncEngine = true, rerenderResults = true, userInitiated = false } = options;
  const entry = state.history.find((item) => item.id === entryId);
  if (!entry) return null;
  if (userInitiated) {
    const isCurrentRunEntry = Boolean(state.currentHistoryEntryId)
      && entry.id === state.currentHistoryEntryId;
    state.historyManualSelection = !isCurrentRunEntry;
  } else {
    state.historyManualSelection = false;
  }
  state.historyActiveId = entry.id;
  state.activeCategory = entry.category;
  ensureCategoryCollections(entry.category);
  state.resultsByCategory[entry.category] = entry.results.map((item) => ({ ...item }));
  if (syncEngine && state.activeEngineCategory !== entry.category) {
    setActiveEngineCategory(entry.category, { skipHistorySync: true });
  }
  if (rerenderResults) {
    const resultsContainer = document.getElementById('kc-results');
    if (resultsContainer) renderResults(resultsContainer);
  }
  return entry;
}

function removeHistoryEntry(entryId) {
  const index = state.history.findIndex((entry) => entry.id === entryId);
  if (index === -1) return;
  const [removed] = state.history.splice(index, 1);
  const removedCategory = removed?.category;
  if (state.historyActiveId === entryId) {
    const fallbackSameCategory = state.history.find((entry) => entry.category === removedCategory);
    const fallback = fallbackSameCategory || state.history[0] || null;
    if (fallback) {
      setHistoryActiveId(fallback.id, { rerenderResults: false, syncEngine: false });
    } else {
      state.historyActiveId = null;
      if (removedCategory) {
        state.resultsByCategory[removedCategory] = [];
      }
    }
  } else if (removedCategory) {
    const next = state.history.find((entry) => entry.category === removedCategory);
    state.resultsByCategory[removedCategory] = next ? next.results.map((item) => ({ ...item })) : [];
  }
  saveHistoryToStorage();
  const resultsContainer = document.getElementById('kc-results');
  if (resultsContainer) renderResults(resultsContainer);
}

function renderHistory() {
  const body = document.getElementById('kc-history');
  const countLabel = document.getElementById('kc-history-count');
  const tabsContainer = document.getElementById('kc-history-tabs');
  const footer = document.getElementById('kc-history-footer');
  const controls = tabsContainer?.parentElement;

  const selectedType = state.historyFilters.prefix;
  const currentCategory = state.historyFilters.category || 'all';
  const derivedCategory = (currentCategory !== 'all' && selectedType !== 'all' && selectedType !== 'other')
    ? TYPE_PREFIX_TO_CATEGORY.get(selectedType) || currentCategory
    : null;

  if (countLabel) {
    countLabel.textContent = '';
    countLabel.style.display = 'none';
  }
  if (footer) {
    footer.style.display = 'none';
  }

  if (tabsContainer) {
    tabsContainer.innerHTML = '';
    tabsContainer.className = 'kc-history-filterbar';
    if (controls && controls.classList.contains('kc-panel__controls')) {
      controls.style.display = 'flex';
    }

    const createToggleTabs = (options, activeValue, onSelect, themeFallback, ariaLabel, config = {}) => {
      const {
        sizeClass = 'kc-badge--micro',
        tabsClass = '',
        applyThemeAlways = false,
        applyOnHover = false
      } = config;
      const wrap = document.createElement('div');
      wrap.className = 'kc-history-filter-tabs';
      if (tabsClass) wrap.classList.add(tabsClass);
      wrap.setAttribute('role', 'group');
      if (ariaLabel) {
        wrap.setAttribute('aria-label', ariaLabel);
      }
      options.forEach((option) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `kc-history-filter-tab kc-badge ${sizeClass}`;
        btn.textContent = option.label;
        const fallbackCategory = typeof themeFallback === 'function'
          ? themeFallback(option)
          : themeFallback;
        const isActive = activeValue === option.id;
        clearBadgeTheme(btn);
        if (isActive || applyThemeAlways) {
          applyBadgeTheme(btn, option.id, { fallbackCategory });
        }
        if (!isActive && !applyThemeAlways && applyOnHover) {
          btn.addEventListener('mouseenter', () => {
            applyBadgeTheme(btn, option.id, { fallbackCategory });
          });
          btn.addEventListener('mouseleave', () => {
            if (!btn.classList.contains('is-active')) {
              clearBadgeTheme(btn);
            }
          });
        }
        btn.classList.toggle('is-active', isActive);
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        btn.addEventListener('click', () => {
          if (btn.classList.contains('is-active')) return;
          onSelect(option.id);
        });
        wrap.appendChild(btn);
      });
      return wrap;
    };

    const categoryOptions = [
      { id: 'all', label: 'All' },
      ...CATEGORY_DEFINITIONS.map((def) => ({ id: def.id, label: def.label }))
    ];

    const activeCategoryForUi = derivedCategory || state.historyFilters.category || 'all';

    const wrapGroup = (node, extraClass = '') => {
      const group = document.createElement('div');
      group.className = 'kc-history-filterbar__group';
      if (extraClass) {
        group.classList.add(extraClass);
      }
      group.append(node);
      return group;
    };

    const categoryTabs = createToggleTabs(categoryOptions, activeCategoryForUi, (value) => {
      if (derivedCategory && value !== derivedCategory) {
        state.historyFilters.prefix = 'all';
      }
      if (state.historyFilters.category === value) return;
      state.historyFilters.category = value;
      state.historyFilters.prefix = 'all';
      renderHistory();
    }, (option) => option.id, 'カテゴリフィルタ', {
      tabsClass: 'kc-history-filter-tabs--category',
      applyThemeAlways: false,
      sizeClass: 'kc-badge--tiny',
      applyOnHover: true
    });

    const activeCategoryForTypes = currentCategory === 'all'
      ? 'all'
      : (derivedCategory || currentCategory);
    const typeOptions = getTypeFilterOptions(activeCategoryForTypes);
    if (!typeOptions.some((option) => option.id === state.historyFilters.prefix)) {
      state.historyFilters.prefix = 'all';
    }
    const typeThemeFallback = (option) => {
      if (option.id === 'all') return 'all';
      if (option.id === 'other') return 'other';
      return TYPE_PREFIX_TO_CATEGORY.get(option.id) || activeCategoryForTypes;
    };
    const prefixTabs = createToggleTabs(typeOptions, state.historyFilters.prefix, (value) => {
      if (state.historyFilters.prefix === value) return;
      state.historyFilters.prefix = value;
      const latestCategory = state.historyFilters.category || 'all';
      if (value !== 'all' && value !== 'other') {
        if (latestCategory !== 'all') {
          const inferredCategory = TYPE_PREFIX_TO_CATEGORY.get(value) || latestCategory;
          state.historyFilters.category = inferredCategory;
        }
      } else if (value === 'all') {
        if (!state.historyFilters.category) {
          state.historyFilters.category = 'all';
        }
      }
      renderHistory();
    }, typeThemeFallback, 'タイプフィルタ', {
      tabsClass: 'kc-history-filter-tabs--type',
      applyThemeAlways: false,
      sizeClass: 'kc-badge--micro',
      applyOnHover: true
    });

    tabsContainer.append(
      wrapGroup(categoryTabs, 'kc-history-filterbar__group--category'),
      wrapGroup(prefixTabs, 'kc-history-filterbar__group--type')
    );
  }

  if (!body) {
    return;
  }
  body.innerHTML = '';

  if (!state.history.length) {
    const empty = document.createElement('div');
    empty.className = 'kc-history-empty';
    empty.textContent = '生成履歴はまだありません';
    body.append(empty);
    return;
  }

  const normalizedPrefixFilter = state.historyFilters.prefix === 'all'
    ? 'all'
    : state.historyFilters.prefix.toLowerCase();
  const normalizedCategoryFilter = (() => {
    if (normalizedPrefixFilter !== 'all' && normalizedPrefixFilter !== 'other') {
      return (TYPE_PREFIX_TO_CATEGORY.get(normalizedPrefixFilter) || DEFAULT_ACTIVE_CATEGORY).toLowerCase();
    }
    return (state.historyFilters.category || 'all').toLowerCase();
  })();
  const allTypeSet = new Set(ALL_TYPE_FILTERS);

  const filteredEntries = state.history.filter((entry) => {
    const entryCategory = inferCategoryFromTokens([
      entry.category,
      ...(Array.isArray(entry.sourceCategories) ? entry.sourceCategories : []),
      ...(Array.isArray(entry.results) ? entry.results.map((res) => res.type || res.sourceCategory || res.category) : [])
    ], entry.category).toLowerCase();
    const passesCategory = normalizedCategoryFilter === 'all'
      || entryCategory === normalizedCategoryFilter;
    if (!passesCategory) return false;
    if (normalizedPrefixFilter === 'all') return true;
    const sources = Array.isArray(entry.sourceCategories) ? entry.sourceCategories : [];
    if (normalizedPrefixFilter !== 'other') {
      return sources.some((src) => src === normalizedPrefixFilter);
    }
    if (normalizedPrefixFilter === 'other') {
      if (!sources.length) return true;
      const hasKnown = sources.some((src) => allTypeSet.has(src));
      return !hasKnown;
    }
    return true;
  });

  if (!filteredEntries.length) {
    const empty = document.createElement('div');
    empty.className = 'kc-history-empty';
    empty.textContent = '条件に一致する履歴がありません';
    body.append(empty);
    return;
  }

  if (!filteredEntries.some((entry) => entry.id === state.historyActiveId)) {
    const fallback = filteredEntries[0];
    if (fallback) {
      setHistoryActiveId(fallback.id, { rerenderResults: false, syncEngine: false });
    }
  }

  const list = document.createElement('div');
  list.className = 'kc-history-list';

  filteredEntries.forEach((entry) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'kc-history-card';
    if (entry.id === state.historyActiveId) {
      card.classList.add('is-active');
      card.setAttribute('aria-pressed', 'true');
    } else {
      card.setAttribute('aria-pressed', 'false');
    }

    const header = document.createElement('div');
    header.className = 'kc-history-card__header';
    const categoryTag = document.createElement('span');
    categoryTag.className = 'kc-history-card__category kc-badge kc-badge--micro';
    const displayCategory = inferCategoryFromTokens([
      entry.category,
      ...(Array.isArray(entry.sourceCategories) ? entry.sourceCategories : []),
      ...(Array.isArray(entry.results) ? entry.results.map((res) => res.type || res.sourceCategory || res.category) : [])
    ], entry.category);
    categoryTag.textContent = categoryLabel(displayCategory);
    applyBadgeTheme(categoryTag, displayCategory, { fallbackCategory: displayCategory });
    header.append(categoryTag);
    const sourceCategories = Array.isArray(entry.sourceCategories)
      ? entry.sourceCategories.filter((src) => typeof src === 'string' && src.trim())
      : [];
    if (sourceCategories.length) {
      const typesTag = document.createElement('div');
      typesTag.className = 'kc-history-card__types';
      sourceCategories.forEach((src) => {
        const badge = document.createElement('span');
        badge.className = 'kc-history-card__type kc-badge kc-badge--micro';
        const normalized = String(src).trim();
        badge.textContent = normalized.toUpperCase();
        applyBadgeTheme(badge, normalized, { fallbackCategory: displayCategory });
        typesTag.append(badge);
      });
      header.append(typesTag);
    }

    const thumbsWrap = document.createElement('div');
    thumbsWrap.className = 'kc-history-card__thumbs';

    const rawResults = Array.isArray(entry.results) ? entry.results : [];
    const historyPartition = splitResultsByFailure(rawResults);
    const hasHiddenFailures = historyPartition.hidden > 0 && !state.showFailures;
    const resultList = historyPartition.visible.length
      ? historyPartition.visible
      : (rawResults.length
        ? [{ __hiddenFailurePlaceholder: true }]
        : [{ imageUrl: '', label: entry.prompt }]);

    resultList.forEach((res) => {
      const cell = document.createElement('div');
      cell.className = 'kc-history-card__thumb';
      if (res.__hiddenFailurePlaceholder) {
        const placeholder = document.createElement('div');
        placeholder.className = 'kc-history-card__placeholder kc-history-card__placeholder--notice';
        placeholder.textContent = 'Failure結果は非表示';
        cell.appendChild(placeholder);
      } else if (res.imageUrl) {
        const savedFileMeta = res.savedFile || {};
        const pathCandidate = res.fileName
          || savedFileMeta.fileName
          || savedFileMeta.filename
          || '';
        const mediaType = resolveMediaEntryType({
          filterType: res.filterType || res.type || res.sourceCategory || '',
          type: res.type || '',
          url: res.imageUrl,
          path: pathCandidate
        });
        if (mediaType === 'video') {
          const video = document.createElement('video');
          video.src = res.imageUrl;
          video.muted = true;
          video.playsInline = true;
          video.preload = 'metadata';
          video.autoplay = false;
          video.className = 'kc-history-card__video';
          applyLoopSettingToMedia(video);
          bindShowcaseMediaLifecycle(video, {
            src: res.imageUrl,
            mediaType: 'video',
            context: 'history-card'
          });
          attachHoverPlayback(video, { resetOnLeave: true, extraTargets: [cell] });
          cell.appendChild(video);
        } else if (mediaType === 'sound') {
          cell.classList.add('is-sound');
          const audio = document.createElement('audio');
          audio.src = res.imageUrl;
          audio.controls = false;
          audio.preload = 'metadata';
          audio.className = 'kc-history-card__audio';
          audio.setAttribute('aria-hidden', 'true');
          audio.tabIndex = -1;
          applyLoopSettingToMedia(audio);
          bindShowcaseMediaLifecycle(audio, {
            src: res.imageUrl,
            mediaType: 'audio',
            context: 'history-card'
          });
          attachHoverPlayback(audio, { resetOnLeave: true, extraTargets: [cell] });

          const placeholder = document.createElement('div');
          placeholder.className = 'kc-history-card__placeholder kc-history-card__placeholder--sound';
          placeholder.textContent = 'SOUND';

          cell.append(audio, placeholder);
        } else if (mediaType === '3d') {
          cell.classList.add('is-3d');
          const thumbnailUrl = resolveHistory3dThumbnail(entry, res);
          if (thumbnailUrl) {
            const img = document.createElement('img');
            img.src = thumbnailUrl;
            img.alt = entry.prompt || entry.id || '3D result';
            cell.appendChild(img);
          } else {
            const { extension } = getResultFilterMeta(res);
            const placeholder = document.createElement('div');
            placeholder.className = 'kc-history-card__placeholder kc-history-card__placeholder--3d';
            placeholder.textContent = (extension ? extension.toUpperCase() : '3D');
            cell.appendChild(placeholder);
          }
        } else {
          const img = document.createElement('img');
          img.src = res.imageUrl;
          img.alt = entry.prompt || entry.id;
          cell.appendChild(img);
        }
      } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'kc-history-card__placeholder';
        placeholder.setAttribute('aria-hidden', 'true');
        cell.appendChild(placeholder);
      }
      thumbsWrap.appendChild(cell);
    });

    const promptText = (entry.prompt || '').trim();
    let prompt = null;
    if (promptText) {
      prompt = document.createElement('div');
      prompt.className = 'kc-history-card__prompt';
      prompt.textContent = `「${promptText}」`;
    }

    let failureNotice = null;
    if (hasHiddenFailures) {
      failureNotice = document.createElement('div');
      failureNotice.className = 'kc-history-card__notice';
      failureNotice.textContent = `Failure結果 ${historyPartition.hidden}件を非表示`;
    }

    const actions = document.createElement('div');
    actions.className = 'kc-history-card__actions';
    const hideBtn = document.createElement('button');
    hideBtn.type = 'button';
    hideBtn.className = 'kc-history-card__icon';
    hideBtn.title = '履歴を削除';
    hideBtn.setAttribute('aria-label', '履歴を削除');
    hideBtn.textContent = '×';
    hideBtn.addEventListener('click', (evt) => {
      evt.stopPropagation();
      if (!window.confirm('この履歴を削除しますか？')) return;
      removeHistoryEntry(entry.id);
      renderHistory();
    });
    actions.append(hideBtn);

    card.append(header, thumbsWrap);
    if (failureNotice) {
      card.append(failureNotice);
    }
    if (prompt) card.append(prompt);
    card.append(actions);
    card.addEventListener('click', () => {
      setHistoryActiveId(entry.id, { syncEngine: false, userInitiated: true });
      renderHistory();
    });
    list.append(card);
  });

  body.append(list);
  const activeEntry = getActiveHistoryEntry();
  if (activeEntry) {
    const resultsContainer = document.getElementById('kc-results');
    if (resultsContainer) renderResults(resultsContainer);
  }
  if (footer && state.history.length === 0) {
    footer.style.display = 'none';
  }
  updateBatchControlVisuals();
}

function renderParameterFields(engineMeta, paramsContainer) {
  paramsContainer.innerHTML = '';
  const submitParams = engineMeta?.tools?.submit?.parameters;
  if (!submitParams || !submitParams.properties) {
    paramsContainer.textContent = '調整可能なパラメータはありません';
    return;
  }

  const inputStore = ensureEngineInputs(engineMeta);
  ensureParameterDefaults(submitParams, inputStore);
  const engineCategory = normalizeCategory(engineMeta?.category || '');
  const isSoundEngine = engineCategory === 'sound';
  const soundTextKeys = new Set(getSoundTextParamKeys(engineMeta));
  const promptKey = getPromptKey(engineMeta);
  let soundTextFieldPresent = false;
  const requiredKeys = Array.isArray(submitParams.required)
    ? new Set(submitParams.required.map((item) => String(item)))
    : new Set();
  const manualRequired = ENGINE_PARAMETER_REQUIRED_HINTS[engineMeta.id];
  if (Array.isArray(manualRequired)) {
    manualRequired.forEach((key) => {
      if (key || key === 0) {
        requiredKeys.add(String(key));
      }
    });
  }

  Object.entries(submitParams.properties).forEach(([key, schema]) => {
    const isPromptField = Boolean(promptKey) && key === promptKey;

    const field = document.createElement('div');
    field.className = 'kc-param-field';

    const label = document.createElement('label');
    label.className = 'kc-label';
    const headerWrap = document.createElement('span');
    headerWrap.className = 'kc-param-label__header';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'kc-param-label__name';
    nameSpan.textContent = key;
    const badges = [];
    const isRequiredField = requiredKeys.has(key);
    const isSoundTextField = !isPromptField && isSoundEngine && soundTextKeys.has(key);
    if (isRequiredField) {
      field.classList.add('kc-param-field--required');
      label.classList.add('kc-label--required');
      nameSpan.classList.add('kc-param-label__name--required');
    }
    if (isSoundTextField) {
      const badge = document.createElement('span');
      badge.className = 'kc-param-label__badge kc-param-label__badge--sound';
      badge.textContent = '音声テキスト';
      badges.push(badge);
    }
    headerWrap.appendChild(nameSpan);

    const descText = resolveParameterDescription(schema);
    let descSpan = null;
    if (descText) {
      descSpan = document.createElement('span');
      descSpan.className = 'kc-param-label__desc';
      descSpan.textContent = `— ${descText}`;
    }

    const fieldId = `kc-param-${engineMeta.id}-${key}`;

    let options = extractEnumOptions(schema, key);
    const manualOptions = getManualParameterOptions(engineMeta, key, schema);
    if (manualOptions.length) {
      options = mergeManualParameterOptions(options, manualOptions, schema);
    }
    const suppressSet = ENGINE_PARAMETER_OPTION_SUPPRESS[engineMeta.id];
    if (suppressSet && suppressSet.has(key)) {
      options = [];
    }
    const hasEnum = options.length > 0;
    const types = schemaTypes(schema);
    const isBoolean = types.length === 1 && types[0] === 'boolean';
    const isNumeric = types.includes('number') || types.includes('integer');
    const isInteger = types.includes('integer');

    if ((inputStore[key] === undefined || inputStore[key] === null) && !isPromptField) {
      const derivedDefault = deriveParameterDefault(engineMeta, key, schema, options);
      if (derivedDefault !== undefined) {
        inputStore[key] = derivedDefault;
      }
    }

    let control;
    let inputHandler = null;
    if (isPromptField) {
      control = document.createElement('textarea');
      control.rows = 3;
      control.classList.add('kc-param-textarea');
      control.dataset.minHeight = String(PROMPT_MIN_HEIGHT);
      control.dataset.maxHeight = String(PROMPT_MAX_HEIGHT);
      const value = inputStore?.[key];
      const initial = value !== undefined ? value : (schema?.default ?? '');
      const formattedInitial = formatParameterValueForInput(initial);
      control.value = formattedInitial;
      control.placeholder = PROMPT_PLACEHOLDER;
      control.spellcheck = true;
      attachPromptResizeHandlers(control);
      requestAnimationFrame(() => {
        adjustPromptFieldHeight(control, { force: true });
      });
      control.addEventListener('input', () => {
        inputStore[key] = coerceParameterValue(schema, control.value);
        adjustPromptFieldHeight(control);
        updateRunButtonState();
      });
      control.addEventListener('blur', () => {
        inputStore[key] = coerceParameterValue(schema, control.value);
      });
    } else if (isBoolean) {
      control = document.createElement('input');
      control.type = 'checkbox';
      const initial = inputStore?.[key];
      control.checked = initial !== undefined ? Boolean(initial) : Boolean(schema.default ?? false);
      control.addEventListener('change', () => {
        inputStore[key] = control.checked;
        updateRunButtonState();
      });
    } else if (isNumeric) {
      control = document.createElement('input');
      control.type = 'number';
      control.step = isInteger ? '1' : 'any';
      if (schema.minimum !== undefined) control.min = schema.minimum;
      if (schema.maximum !== undefined) control.max = schema.maximum;
      const value = inputStore?.[key] ?? schema.default;
      if (value !== undefined && value !== null) {
        control.value = value;
      } else {
        control.value = '';
      }
      inputHandler = () => {
        const parsed = control.value === '' ? undefined : Number(control.value);
        inputStore[key] = Number.isNaN(parsed) ? undefined : parsed;
      };
    } else {
      control = document.createElement('input');
      control.type = 'text';
      const value = inputStore?.[key];
      const initial = value !== undefined ? value : (schema.default ?? '');
      const formattedInitial = formatParameterValueForInput(initial);
      control.value = formattedInitial;
      if (isSoundTextField) {
        control.placeholder = SOUND_TEXT_PLACEHOLDER;
        if (!state.soundText || !state.soundText.trim()) {
          state.soundText = formattedInitial || '';
        }
        soundTextFieldPresent = true;
      }
      inputHandler = () => {
        inputStore[key] = coerceParameterValue(schema, control.value);
        if (isSoundTextField) {
          state.soundText = control.value || '';
          syncSoundTextField({ preferExisting: false });
        }
      };
    }

    control.id = fieldId;
    control.dataset.paramKey = key;
    control.classList.add('kc-param-input');
    if (isRequiredField) {
      control.setAttribute('aria-required', 'true');
    }

    const appendStandardLabel = () => {
      badges.forEach((badge) => headerWrap.appendChild(badge));
      const fragments = [headerWrap];
      if (descSpan) fragments.push(descSpan);
      label.append(...fragments);
      label.htmlFor = fieldId;
    };

    if (isBoolean) {
      const checkboxWrap = document.createElement('span');
      checkboxWrap.className = 'kc-param-checkbox-wrap';
      checkboxWrap.append(control);
      const textWrap = document.createElement('span');
      textWrap.className = 'kc-param-label__text';
      const headerClone = headerWrap.cloneNode(false);
      badges.forEach((badge) => {
        if (badge) headerClone.appendChild(badge.cloneNode(true));
      });
      headerClone.appendChild(nameSpan);
      textWrap.append(headerClone);
      if (descSpan) {
        textWrap.append(descSpan);
      }
      label.classList.add('kc-label--checkbox');
      label.htmlFor = '';
      label.append(checkboxWrap, textWrap);
      field.classList.add('kc-param-field--boolean');
      field.append(label);
    } else if (hasEnum) {
      appendStandardLabel();
      field.classList.add('kc-param-field--with-select');
      const combo = document.createElement('div');
      combo.className = 'kc-param-combo';

      const select = document.createElement('select');
      select.className = 'kc-param-select';
      select.dataset.paramKey = key;

      const placeholderOption = document.createElement('option');
      placeholderOption.value = '';
      placeholderOption.textContent = 'プリセットを選択';
      select.append(placeholderOption);

      options.forEach((option, index) => {
        const opt = document.createElement('option');
        opt.value = String(index);
        opt.textContent = option.label;
        select.append(opt);
      });

      const customOption = document.createElement('option');
      customOption.value = 'custom';
      customOption.textContent = 'カスタム入力';
      select.append(customOption);

      const currentValue = inputStore?.[key];
      const matchedIndex = options.findIndex((option) => isSameParameterValue(option.value, currentValue));
      if (matchedIndex !== -1) {
        select.value = String(matchedIndex);
        control.value = formatParameterValueForInput(options[matchedIndex].value);
      } else if (currentValue !== undefined && currentValue !== null && currentValue !== '') {
        select.value = 'custom';
        control.value = formatParameterValueForInput(currentValue);
      } else {
        select.value = '';
        control.value = '';
      }

      select.addEventListener('change', () => {
        const selected = select.value;
        if (selected === 'custom') {
          control.focus();
          return;
        }
        if (selected === '') {
          delete inputStore[key];
          control.value = '';
          if (inputHandler) inputHandler();
          updateRunButtonState();
          return;
        }
        const option = options[Number.parseInt(selected, 10)];
        if (!option) return;
        const typed = normalizeOptionValue(schema, option.value);
        inputStore[key] = typed;
        control.value = formatParameterValueForInput(typed);
        if (inputHandler) {
          inputHandler();
        }
        updateRunButtonState();
      });

      const handleManualInput = () => {
        if (inputHandler) inputHandler();
        select.value = control.value === '' ? '' : 'custom';
      };

      control.addEventListener('input', handleManualInput);

      combo.append(select, control);
      field.append(label, combo);
    } else {
      appendStandardLabel();
      if (inputHandler) {
        control.addEventListener('input', inputHandler);
      }
      field.append(label, control);
    }
    paramsContainer.append(field);
  });

  if (isSoundEngine && soundTextFieldPresent) {
    syncSoundTextField({ preferExisting: false });
  }
}

function renderEngineCards(categoryId, container, options = {}) {
  const { displayList = null, totalList = null } = options;
  container.innerHTML = '';
  const baseList = Array.isArray(totalList)
    ? totalList
    : (state.enginesByCategory.get(categoryId) || []);
  const list = Array.isArray(displayList) ? displayList : baseList;
  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'kc-engines__empty';
    const keyword = state.engineSearchKeyword.trim();
    empty.textContent = keyword && keyword.length && baseList.length
      ? '条件に一致するMCPが見つかりません'
      : '利用可能なツールが見つかりません';
    container.append(empty);
    return;
  }

  list.forEach((engineMeta) => {
    const selected = state.selected.has(engineMeta.id);
    const card = document.createElement('div');
    card.className = 'kc-engine-card';
    if (selected) card.classList.add('kc-engine-card--active');
    applyBadgeTheme(card, [
      engineMeta.category,
      engineMeta.sourceCategory,
      determineEngineTypeKey(engineMeta)
    ], { fallbackCategory: categoryId });
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-pressed', selected ? 'true' : 'false');
    const engineLabel = engineMeta.displayLabel || engineMeta.label || deriveEngineLabel(engineMeta.id);
    card.setAttribute('aria-label', `${engineLabel} を選択`);

    const header = document.createElement('div');
    header.className = 'kc-engine-card__header';

    const title = document.createElement('div');
    title.className = 'kc-engine-card__title';
    title.textContent = engineLabel;

    const controls = document.createElement('div');
    controls.className = 'kc-engine-card__controls';

    const detailBtn = document.createElement('button');
    detailBtn.type = 'button';
    detailBtn.className = 'kc-button-mini';
    detailBtn.innerHTML = '⚙';
    detailBtn.title = '詳細設定';
    detailBtn.setAttribute('aria-label', `${engineLabel} の詳細設定`);
    detailBtn.setAttribute('aria-haspopup', 'dialog');
    detailBtn.setAttribute('aria-expanded', 'false');

    const showParams = () => {
      cancelParamsPopoverClose();
      openParamsPopover(engineMeta, detailBtn);
    };

    const hideParams = (evt) => {
      if (!activeParamsPopover || activeParamsPopover.anchor !== detailBtn) return;
      if (evt && evt.relatedTarget && activeParamsPopover.popover?.contains(evt.relatedTarget)) {
        return;
      }
      if (isParamsPopoverEngaged()) {
        cancelParamsPopoverClose();
        return;
      }
      scheduleParamsPopoverClose();
    };

    detailBtn.addEventListener('click', (evt) => {
      evt.stopPropagation();
      showParams();
    });
    detailBtn.addEventListener('mouseenter', (evt) => {
      evt.stopPropagation();
      showParams();
    });
    detailBtn.addEventListener('focus', showParams);
    detailBtn.addEventListener('mouseleave', hideParams);
    detailBtn.addEventListener('blur', hideParams);
    detailBtn.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter' || evt.key === ' ') {
        evt.preventDefault();
        showParams();
      }
    });

    controls.append(detailBtn);
    header.append(title, controls);

    card.append(header);

    const toggleSelection = () => {
      closeParamsPopover();
      if (state.selected.has(engineMeta.id)) {
        state.selected.delete(engineMeta.id);
      } else {
        ensureEngineInputs(engineMeta);
        state.selected.set(engineMeta.id, {
          id: engineMeta.id,
          label: engineLabel,
          category: engineMeta.category,
          requiresMedia: Boolean(engineMeta.requiresMedia),
          requiredMediaTypes: Array.isArray(engineMeta.requiredMediaTypes)
            ? engineMeta.requiredMediaTypes.slice()
            : [],
          requiresPrompt: engineRequiresPrompt(engineMeta),
          requiresSoundText: engineRequiresSoundText(engineMeta),
          promptKey: engineMeta.promptKey || getPromptKey(engineMeta),
          soundTextKeys: Array.isArray(engineMeta.soundTextKeys)
            ? engineMeta.soundTextKeys.slice()
            : [],
          requiredSoundTextKeys: Array.isArray(engineMeta.requiredSoundTextKeys)
            ? engineMeta.requiredSoundTextKeys.slice()
            : [],
          documentationUrl: engineMeta.documentationUrl || '',
          docSummaryEn: engineMeta.docSummaryEn || '',
          docSummaryJa: engineMeta.docSummaryJa || ''
        });
        applySelectedMediaToEngineInputs();
      }
      renderCategories();
      updateRunButtonState();
    };

    card.addEventListener('click', toggleSelection);
    card.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter' || evt.key === ' ') {
        evt.preventDefault();
        toggleSelection();
      }
    });

    container.append(card);
  });
}

function renderMediaSection(container) {
  container.innerHTML = '';

  renderSelectionSummary();

  const controls = document.createElement('div');
  controls.className = 'kc-media-controls irs-source-controls';

  const filterWrap = document.createElement('div');
  filterWrap.className = 'kc-media-filters';
  const filterLabel = document.createElement('span');
  filterLabel.className = 'kc-media-filter-label';
  filterLabel.textContent = 'INPUT';
  filterWrap.appendChild(filterLabel);

  const filterTrack = document.createElement('div');
  filterTrack.className = 'kc-media-filter-track';
  filterWrap.appendChild(filterTrack);
  MEDIA_FILTERS.forEach((filter) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'kc-media-filter kc-panel-tab';
    applyBadgeTheme(btn, filter.id, { fallbackCategory: filter.id });
    if (state.media.typeFilter === filter.id) {
      btn.classList.add('is-active');
    }
    btn.textContent = filter.label.toUpperCase();
    btn.setAttribute('aria-pressed', state.media.typeFilter === filter.id ? 'true' : 'false');
    btn.setAttribute('aria-label', `${filter.label.toUpperCase()} INPUTメディアを表示`);
    btn.addEventListener('click', () => {
      if (state.media.typeFilter === filter.id) return;
      state.media.typeFilter = filter.id;
      applyMediaFilters();
      renderList();
      controls.querySelectorAll('.kc-media-filter').forEach((node) => {
        node.classList.toggle('is-active', node === btn);
        node.setAttribute('aria-pressed', node === btn ? 'true' : 'false');
      });
    });
    filterTrack.appendChild(btn);
  });

  const wrapper = document.createElement('div');
  wrapper.className = 'kc-media-wrapper';

  const scroll = document.createElement('div');
  scroll.className = 'kc-media-scroll';
  wrapper.append(scroll);

  const renderList = () => {
    scroll.innerHTML = '';
    renderSelectionSummary();

    if (state.media.error) {
      const retry = document.createElement('div');
      retry.className = 'kc-history-empty';
      retry.textContent = `読み込みに失敗しました: ${state.media.error}`;
      scroll.append(retry);
      return;
    }

    if (state.media.isLoading) {
      const loading = document.createElement('div');
      loading.className = 'kc-history-empty';
      loading.textContent = '読み込み中...';
      scroll.append(loading);
      return;
    }

    const hasActiveFilter = state.media.typeFilter !== 'all'
      || Boolean(state.media.searchKeyword.trim());
    const list = state.media.filtered.length
      ? state.media.filtered
      : (hasActiveFilter ? [] : state.media.items);

    if (!list.length) {
      const empty = document.createElement('div');
      empty.className = 'kc-history-empty';
      if (hasActiveFilter) {
        empty.textContent = '条件に一致するメディアが見つかりません';
      } else {
        empty.textContent = 'メディアフォルダにファイルが見つかりませんでした';
      }
      scroll.append(empty);
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'irs-source-list kc-media-list';

    const previewEntries = createLightboxEntriesFromSources(list);

    list.forEach((item, index) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'irs-source-card';
      const selectionInfo = getMediaSelectionOrderInfo(item);
      if (selectionInfo) {
        card.classList.add('is-active');
      }

      const thumbWrap = document.createElement('div');
      thumbWrap.className = 'irs-source-card__thumb';
      if (item.filterType) {
        thumbWrap.classList.add(`irs-source-card__thumb--${item.filterType}`);
      }

      const createPreviewButton = () => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'irs-source-card__preview';
        btn.title = 'プレビュー';
        btn.textContent = '⤢';
        btn.setAttribute('aria-label', `${item.name} をプレビュー`);
        btn.addEventListener('click', (evt) => {
          evt.stopPropagation();
          if (item.url) {
            openMediaLightbox(previewEntries, index);
          }
        });
        return btn;
      };

      if (item.thumbUrl) {
        const img = document.createElement('img');
        img.src = item.thumbUrl;
        img.alt = item.name;
        thumbWrap.appendChild(img);
        if (item.url) {
          thumbWrap.appendChild(createPreviewButton());
        }
      } else if ((item.filterType === 'video' || item.filterType === 'sound') && item.url) {
        if (item.filterType === 'video') {
          const video = document.createElement('video');
          video.src = item.url;
          video.muted = true;
          video.loop = true;
          video.playsInline = true;
          video.preload = 'metadata';
          video.className = 'irs-source-card__video';
          video.addEventListener('loadeddata', () => {
            try {
              video.currentTime = 0;
              video.pause();
            } catch (err) {
              // ignore seek errors
            }
          });
          thumbWrap.appendChild(video);
          const startPreview = () => {
            video.play().catch(() => {});
          };
          const stopPreview = () => {
            try {
              video.pause();
              video.currentTime = 0;
            } catch (err) {
              // ignore pause errors
            }
          };
          card.addEventListener('mouseenter', startPreview);
          card.addEventListener('mouseleave', stopPreview);
          card.addEventListener('focus', startPreview);
          card.addEventListener('blur', stopPreview);
        } else {
          const icon = document.createElement('div');
          icon.className = 'irs-source-card__placeholder irs-source-card__placeholder--audio';
          icon.textContent = 'SOUND';
          thumbWrap.appendChild(icon);
        }
        thumbWrap.appendChild(createPreviewButton());
      } else if (item.filterType === '3d' && item.url) {
        thumbWrap.classList.add('is-3d');
        const modelHost = document.createElement('div');
        modelHost.className = 'irs-source-card__model-host';
        thumbWrap.appendChild(modelHost);
        mount3dPreview(modelHost, {
          src: item.url,
          alt: item.name,
          variant: 'input'
        });
        thumbWrap.appendChild(createPreviewButton());
        thumbWrap.addEventListener('dblclick', (evt) => {
          if (!item.url) return;
          if (evt.target && evt.target.closest('.irs-source-card__preview')) {
            return;
          }
          const viewer = thumbWrap.querySelector('model-viewer');
          if (!viewer) return;
          if (evt.target === viewer || viewer.contains(evt.target)) {
            evt.preventDefault();
            evt.stopPropagation();
            openMediaLightbox(previewEntries, index);
          }
        });
      } else {
        thumbWrap.classList.add('irs-source-card__thumb--empty');
        const placeholder = document.createElement('div');
        placeholder.className = 'irs-source-card__placeholder';
        placeholder.textContent = (item.filterType || 'other').toUpperCase();
        thumbWrap.appendChild(placeholder);
        if (item.url) {
          thumbWrap.appendChild(createPreviewButton());
        }
      }

      if (selectionInfo) {
        const badge = document.createElement('span');
        badge.className = 'kc-media-selection-order';
        const typeClass = selectionInfo.type ? `kc-media-selection-order--${selectionInfo.type}` : '';
        if (typeClass) badge.classList.add(typeClass);
        badge.textContent = String(selectionInfo.order);
        badge.setAttribute('aria-label', `${(MEDIA_TYPE_DISPLAY[selectionInfo.type]?.label || selectionInfo.type || 'MEDIA')} #${selectionInfo.order}`);
        thumbWrap.appendChild(badge);
      }

      const meta = document.createElement('div');
      meta.className = 'irs-source-card__meta';
      const name = document.createElement('span');
      name.className = 'irs-source-card__name';
      name.title = item.name;
      name.textContent = item.name;
      meta.appendChild(name);

      const typeChip = document.createElement('span');
      typeChip.className = 'irs-source-card__type';
      typeChip.textContent = (item.filterType || 'other').toUpperCase();
      meta.appendChild(typeChip);

      card.append(thumbWrap, meta);

      card.addEventListener('click', () => {
        toggleMediaSelection(item);
        renderList();
        updateRunButtonState();
      });

      grid.appendChild(card);
    });

    scroll.append(grid);

    renderSelectionSummary();
  };

  const searchWrap = document.createElement('div');
  searchWrap.className = 'irs-search';
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.placeholder = 'INPUTメディアを検索';
  searchInput.setAttribute('aria-label', 'INPUTメディア検索');
  searchInput.value = state.media.searchKeyword;
  searchInput.addEventListener('input', () => {
    state.media.searchKeyword = searchInput.value;
    applyMediaFilters();
    renderList();
  });
  searchWrap.appendChild(searchInput);

  const sortWrap = document.createElement('div');
  sortWrap.className = 'irs-sort';
  const sortSelect = document.createElement('select');
  sortSelect.id = 'kc-media-sort';
  sortSelect.setAttribute('aria-label', '並び替え');
  sortSelect.innerHTML = `
    <option value="name">名前順</option>
    <option value="newest">新しい順</option>
    <option value="oldest">古い順</option>
  `;
  sortSelect.value = state.media.sortMode;
  sortSelect.addEventListener('change', () => {
    state.media.sortMode = sortSelect.value;
    applyMediaFilters();
    renderList();
  });
  sortWrap.append(sortSelect);

  const refreshBtn = document.createElement('button');
  refreshBtn.type = 'button';
  refreshBtn.className = 'irs-refresh';
  refreshBtn.title = 'INPUTメディアを再読み込み';
  refreshBtn.textContent = '⟳';
  refreshBtn.addEventListener('click', () => {
    loadMediaLibrary({ force: true });
  });

  controls.append(filterWrap, searchWrap, sortWrap, refreshBtn);
  container.append(controls, wrapper);

  renderList();
}

function renderCategories() {
  const container = document.getElementById('kc-engines');
  if (!container) return;
  renderSelectionSummary();
  renderEngineSubTabs();
  renderEngineTabs();
  container.innerHTML = '';

  const categoryId = state.activeEngineCategory;
  ensureCategoryCollections(categoryId);
  const activeSubTab = state.categoryTabs[categoryId] || 'engine';
  const isEngineView = activeSubTab === 'engine';
  const isMediaView = activeSubTab === 'media';

  const contentHost = document.createElement('div');
  contentHost.className = 'kc-engine-content';
  container.append(contentHost);

  const toolbar = document.querySelector('.kc-engine-toolbar');
  if (toolbar) {
    toolbar.style.display = isEngineView ? 'flex' : 'none';
    toolbar.hidden = !isEngineView;
  }

  const toolbarSearchHost = document.getElementById('kc-engine-toolbar-search');
  if (toolbarSearchHost) {
    toolbarSearchHost.innerHTML = '';
    if (isEngineView) {
      const searchControls = createEngineSearchControls();
      toolbarSearchHost.append(searchControls);
      toolbarSearchHost.removeAttribute('hidden');
    } else {
      toolbarSearchHost.setAttribute('hidden', '');
    }
  }

  if (!state.categories.length) {
    renderEngineStats({
      isLoading: true,
      engines: [],
      categoryId,
      visible: isEngineView
    });
    const empty = document.createElement('div');
    empty.className = 'kc-engines__empty';
    empty.textContent = '利用可能なツールが見つかりません';
    contentHost.append(empty);
    return;
  }

  const viewingAll = isAllCategory(categoryId);
  let engines = [];
  let isLoading = false;

  if (viewingAll) {
    const aggregated = state.enginesByCategory.get(ALL_CATEGORY_ID);
    if (Array.isArray(aggregated)) {
      engines = aggregated;
    }
    isLoading = !Array.isArray(aggregated)
      && (state.enginesLoading.size > 0 || state.engineIndex.size === 0);
  } else {
    const hasEntry = state.enginesByCategory.has(categoryId);
    const payload = hasEntry ? state.enginesByCategory.get(categoryId) : null;
    engines = Array.isArray(payload) ? payload : [];
    isLoading = state.enginesLoading.has(categoryId) || payload === null || !hasEntry;
  }

  const mainTabsEl = document.getElementById('kc-engine-tabs');
  if (mainTabsEl) {
    if (isEngineView) {
      mainTabsEl.classList.remove('kc-panel-tabs--hidden');
      mainTabsEl.style.display = state.categories.length > 1 ? 'inline-flex' : 'none';
      mainTabsEl.removeAttribute('hidden');
    } else {
      mainTabsEl.classList.add('kc-panel-tabs--hidden');
      mainTabsEl.style.display = 'none';
      mainTabsEl.setAttribute('hidden', '');
    }
  }

  const statsEngines = viewingAll
    ? (Array.isArray(state.enginesByCategory.get(ALL_CATEGORY_ID))
      ? state.enginesByCategory.get(ALL_CATEGORY_ID)
      : engines)
    : engines;

  const statsBaseList = Array.isArray(statsEngines) ? statsEngines : [];
  const displayBaseList = Array.isArray(engines) ? engines : [];
  const keyword = isEngineView ? state.engineSearchKeyword : '';
  const statsFiltered = statsBaseList;
  const displayFiltered = isLoading
    ? []
    : filterEnginesByKeyword(displayBaseList, keyword).filter((engine) => {
      if (!isMediaView) return true;
      return Boolean(engine && engine.requiresMedia);
    });

  renderEngineStats({
    isLoading,
    engines: statsBaseList,
    filteredEngines: statsFiltered,
    categoryId,
    searchKeyword: '',
    visible: isEngineView
  });

  if (isLoading) {
    const loading = document.createElement('div');
    loading.className = 'kc-engines__empty';
    loading.textContent = '読み込み中...';
    contentHost.append(loading);
    return;
  }

  if (!isEngineView) {
    renderSelectionSummary();
    renderMediaSection(contentHost);
    return;
  }

  const listRoot = document.createElement('div');
  listRoot.className = 'kc-engine-list';
  contentHost.append(listRoot);

  if (!displayBaseList.length) {
    const empty = document.createElement('div');
    empty.className = 'kc-engines__empty';
    empty.textContent = '利用可能なツールが見つかりません';
    listRoot.append(empty);
    return;
  }

  if (!displayFiltered.length) {
    const empty = document.createElement('div');
    empty.className = 'kc-engines__empty';
    empty.textContent = keyword && keyword.trim()
      ? '条件に一致するMCPが見つかりません'
      : '利用可能なツールが見つかりません';
    listRoot.append(empty);
    return;
  }

  renderEngineCards(categoryId, listRoot, { displayList: displayFiltered, totalList: displayBaseList });
}

function normalizeShowcaseAssetUrl(url) {
  if (!url || typeof url !== 'string') return url;
  let working = url.trim().replace(/\\/g, '/');
  if (!working) return working;

  if (working.includes('/public/showcase/')) {
    working = working.replace('/public/showcase/', '/showcase/');
  }
  if (working.includes('public/showcase/')) {
    working = working.replace('public/showcase/', 'showcase/');
  }
  if (working.includes('/public/images/')) {
    working = working.replace('/public/images/', '/images/');
  }
  if (working.includes('public/images/')) {
    working = working.replace('public/images/', 'images/');
  }

  const knownPrefixes = ['showcase', 'images'];
  for (const prefix of knownPrefixes) {
    const match = working.match(new RegExp(`\\/?${prefix}\\/[^\\s?#]+`));
    if (match) {
      const suffix = match[0].startsWith('/') ? match[0] : `/${match[0]}`;
      return suffix;
    }
  }
  return working;
}

function buildImageUrl(savedFile) {
  if (savedFile?.webPath) {
    const web = savedFile.webPath.startsWith('/') ? savedFile.webPath : `/${savedFile.webPath}`;
    return normalizeShowcaseAssetUrl(web);
  }
  if (savedFile?.absolute && state.scanPath && savedFile.absolute.startsWith(state.scanPath)) {
    const relative = savedFile.absolute.slice(state.scanPath.length);
    if (!relative) return '';
    const web = `/${relative.replace(/\\/g, '/')}`;
    return normalizeShowcaseAssetUrl(web);
  }
  return normalizeShowcaseAssetUrl(savedFile?.absolute || '');
}

function getActivePromptForCategory(category) {
  const normalized = normalizeCategory(category);
  const activeEntry = getActiveHistoryEntry();
  if (activeEntry && activeEntry.category === normalized) {
    return activeEntry.prompt || state.prompt || '';
  }
  const fallback = state.history.find((entry) => entry.category === normalized);
  return fallback?.prompt || state.prompt || '';
}

function renderResults(container) {
  closeResultsModal();
  closeTemplateMenu();
  const wasPromptPopoverOpen = Boolean(state.resultsPromptExpanded);
  closePromptPopover({ resetState: false });
  container.innerHTML = '';
  const results = getCurrentResults();
  syncFailureToggle();
  syncInputToggle();
  syncParameterToggle();
  const categoryBadge = document.getElementById('kc-results-category');
  const typeBadge = document.getElementById('kc-results-type');
  const activeEntry = getActiveHistoryEntry();
  const activeCategoryId = normalizeCategory(activeEntry?.category || state.activeCategory);
  if (categoryBadge) {
    categoryBadge.textContent = categoryLabel(activeCategoryId);
    applyBadgeTheme(categoryBadge, activeCategoryId, { fallbackCategory: activeCategoryId });
  }
  const promptLabel = document.getElementById('kc-results-prompt');
  const promptPanel = document.getElementById('kc-results-prompt-panel');
  const promptText = document.getElementById('kc-results-prompt-text');
  const promptHost = document.getElementById('kc-results-prompt-host');
  const filterRow = document.getElementById('kc-results-filter-row');
  const filterWrap = document.getElementById('kc-results-file-filter-wrap');
  const expandBtn = document.getElementById('kc-results-expand');
  if (typeBadge) {
    clearBadgeTheme(typeBadge);
  }
  if (expandBtn) {
    const disabled = !results.length && !(state.isRunning && state.activeJobSnapshot);
    expandBtn.disabled = disabled;
    expandBtn.setAttribute('aria-disabled', String(disabled));
  }

  const normalizedCategory = normalizeCategory(activeCategoryId);
  const isAllCategoryView = normalizedCategory === ALL_CATEGORY_ID;
  const displayOrderMap = createDisplayOrderMap(normalizedCategory);
  let resultsForRender = Array.isArray(results) ? results.slice() : [];
  let pendingCount = 0;

  const jobSnapshot = state.isRunning ? state.activeJobSnapshot : null;
  const activeJobId = jobSnapshot?.id || state.currentJobId || '';
  const statusMap = new Map();
  if (jobSnapshot && Array.isArray(jobSnapshot.engines)) {
    jobSnapshot.engines.forEach((engine) => {
      statusMap.set(engine.id, engine);
    });
  }

  const engineOrderSource = (state.currentJobEngines && state.currentJobEngines.length)
    ? state.currentJobEngines
    : (jobSnapshot?.engines || []);

  if (engineOrderSource.length) {
    const resultMap = new Map(resultsForRender.map((entry) => [entry.engineId, entry]));
    const combined = [];
    const usedIds = new Set();

    engineOrderSource.forEach((engine) => {
      if (!engine || !engine.id) return;
      const engineCategory = normalizeCategory(engine.category || normalizedCategory);
      if (!isAllCategoryView && engineCategory !== normalizedCategory) {
        return;
      }
      const existing = resultMap.get(engine.id);
      if (existing) {
        if (!Number.isFinite(existing.displayOrder)) {
          existing.displayOrder = resolveEngineDisplayOrder(engine.id, engineCategory);
        }
        const metaStatus = statusMap.get(engine.id);
        if (metaStatus?.cancelRequested && !isJobTerminal(metaStatus.status) && existing.__pending) {
          existing.status = 'cancelling';
        }
        combined.push(existing);
        usedIds.add(engine.id);
        return;
      }
      const metaStatus = statusMap.get(engine.id);
      const effectiveStatus = metaStatus && metaStatus.cancelRequested && !isJobTerminal(metaStatus.status)
        ? 'cancelling'
        : (metaStatus?.status || 'running');
      combined.push({
        engineId: engine.id,
        label: engine.displayLabel || engine.label || deriveEngineLabel(engine.id),
        category: engineCategory,
        type: normalizeTypeToken(engine.category) || engine.category || '',
        status: effectiveStatus,
        displayOrder: resolveEngineDisplayOrder(engine.id, engineCategory),
        __pending: true
      });
      pendingCount += 1;
    });

    resultsForRender.forEach((entry) => {
      const entryCategory = normalizeCategory(entry.category || normalizedCategory);
      if (!isAllCategoryView && entryCategory !== normalizedCategory) {
        return;
      }
      if (usedIds.has(entry.engineId)) {
        return;
      }
      if (!Number.isFinite(entry.displayOrder)) {
        entry.displayOrder = resolveEngineDisplayOrder(entry.engineId, entryCategory);
      }
      combined.push(entry);
    });

    if (combined.length) {
      resultsForRender = combined;
      sortEntriesInPlace(resultsForRender, normalizedCategory, displayOrderMap);
    }
  } else if (resultsForRender.length > 1) {
    sortEntriesInPlace(resultsForRender, normalizedCategory, displayOrderMap);
  }

  if (!resultsForRender.length && state.isRunning) {
    const fallbackSource = engineOrderSource.length
      ? engineOrderSource
      : Array.from(state.selected.values() || []);
    const seenIds = new Set();
    const pendingEntries = [];
    fallbackSource.forEach((engine) => {
      if (!engine || !engine.id || seenIds.has(engine.id)) return;
      const engineCategory = normalizeCategory(engine.category || normalizedCategory);
      if (!isAllCategoryView && engineCategory !== normalizedCategory) return;
      const metaStatus = statusMap.get(engine.id);
      const effectiveStatus = metaStatus && metaStatus.cancelRequested && !isJobTerminal(metaStatus.status)
        ? 'cancelling'
        : (metaStatus?.status || 'running');
      pendingEntries.push({
        engineId: engine.id,
        label: engine.displayLabel || engine.label || deriveEngineLabel(engine.id),
        category: engineCategory,
        type: normalizeTypeToken(engine.category) || engine.category || '',
        status: effectiveStatus,
        displayOrder: resolveEngineDisplayOrder(engine.id, engineCategory),
        __pending: true
      });
      seenIds.add(engine.id);
    });
    if (pendingEntries.length) {
      resultsForRender = pendingEntries;
      pendingCount = pendingEntries.length;
      sortEntriesInPlace(resultsForRender, normalizedCategory, displayOrderMap);
    }
  }

  const allResultsForRender = resultsForRender;
  const filterSummary = summarizeResultsByFileAttributes(allResultsForRender);
  updateResultsFileFilterControl(filterSummary);

  const activeFileFilter = state.resultsFileFilter || 'all';
  const filterActive = activeFileFilter !== 'all';
  const filteredResultsForPartition = applyResultsFileFilter(allResultsForRender, activeFileFilter);

  const partition = splitResultsByFailure(filteredResultsForPartition);
  let visibleResults = partition.visible;
  const hasHiddenFailures = partition.hidden > 0;
  const filterRemovedAllVisible = filterActive
    && allResultsForRender.length > 0
    && filteredResultsForPartition.length === 0;

  if (!visibleResults.length) {
    const message = filterRemovedAllVisible
      ? '選択したファイル種別に一致する生成結果がありません'
      : (hasHiddenFailures
        ? 'Failure結果は非表示になっています'
        : '選択したカテゴリの生成結果がありません');
    const messageNode = document.createElement('div');
    messageNode.className = 'kc-results__message';
    messageNode.textContent = message;
    container.append(messageNode);
    if (typeBadge) {
      typeBadge.textContent = '';
      typeBadge.style.display = 'none';
      typeBadge.classList.remove('is-pending');
      clearBadgeTheme(typeBadge);
    }
    if (promptLabel) {
      promptLabel.textContent = '';
    }
    if (expandBtn) {
      expandBtn.disabled = true;
      expandBtn.setAttribute('aria-disabled', 'true');
    }
    updateBatchControlVisuals();
    return;
  }

  resultsForRender = visibleResults;

  const primaryTypeToken = (() => {
    if (!resultsForRender.length) return '';
    const tokens = collectResultTypes(resultsForRender[0]);
    return tokens.length ? tokens[0].toUpperCase() : '';
  })();
  const fallbackTypeToken = (() => {
    if (!normalizedCategory || normalizedCategory === ALL_CATEGORY_ID) return '';
    return normalizedCategory.toUpperCase();
  })();
  const baseTypeLabel = pendingCount > 0
    ? (fallbackTypeToken || primaryTypeToken)
    : (primaryTypeToken || fallbackTypeToken);
  const typeThemeTokens = [];
  if (primaryTypeToken) typeThemeTokens.push(primaryTypeToken);
  if (normalizedCategory && normalizedCategory !== ALL_CATEGORY_ID) {
    typeThemeTokens.push(normalizedCategory);
  }
  const categoryBadgeLabel = (categoryBadge?.textContent || '').trim().toLowerCase();
  const shouldHideTypeBadge = (pendingCount > 0 && state.isRunning)
    || !baseTypeLabel
    || (baseTypeLabel && categoryBadgeLabel && baseTypeLabel.toLowerCase() === categoryBadgeLabel);

  if (typeBadge) {
    if (!shouldHideTypeBadge && baseTypeLabel) {
      typeBadge.textContent = baseTypeLabel;
      typeBadge.style.display = 'inline-flex';
      typeBadge.classList.toggle('is-pending', pendingCount > 0);
      applyBadgeTheme(typeBadge, typeThemeTokens.length ? typeThemeTokens : baseTypeLabel, {
        fallbackCategory: activeCategoryId
      });
    } else {
      typeBadge.textContent = '';
      typeBadge.style.display = 'none';
      typeBadge.classList.remove('is-pending');
      clearBadgeTheme(typeBadge);
    }
  }

  let runningBadge = document.getElementById('kc-results-running');
  const ensureRunningBadgeElement = () => {
    if (runningBadge && runningBadge instanceof HTMLElement) {
      return runningBadge;
    }
    if (!typeBadge || !typeBadge.parentElement) return null;
    runningBadge = document.createElement('span');
    runningBadge.id = 'kc-results-running';
    runningBadge.className = 'kc-badge kc-badge--status';
    runningBadge.style.display = 'none';
    typeBadge.parentElement.appendChild(runningBadge);
    return runningBadge;
  };

  if (pendingCount > 0 && state.isRunning) {
    const badge = ensureRunningBadgeElement();
    if (badge) {
      badge.textContent = 'RUNNING';
      badge.style.display = 'inline-flex';
      badge.classList.add('is-pending');
    }
  } else if (runningBadge) {
    runningBadge.textContent = '';
    runningBadge.style.display = 'none';
    runningBadge.classList.remove('is-pending');
  }

  const resultLightboxEntries = createLightboxEntriesFromSources(resultsForRender, { preferImageUrl: true });

  resultsForRender.forEach((entry, index) => {
    const card = document.createElement('div');
    const isPending = Boolean(entry.__pending);
    card.className = 'kc-result-card';
    if (isPending) {
      card.classList.add('is-pending');
    }

    const imageWrap = document.createElement('div');
    imageWrap.className = 'kc-result-card__image';
    const normalizedLabel = formatEngineLabel(entry);
    const engineMeta = statusMap.get(entry.engineId);
    const engineStatus = engineMeta?.status || entry.status || '';
    const engineCancelRequested = Boolean(engineMeta?.cancelRequested);
    if (engineCancelRequested && !isJobTerminal(engineStatus)) {
      entry.status = 'cancelling';
    }
    if (!isPending && entry.imageUrl) {
      const mediaType = resolveMediaEntryType({
        filterType: entry.filterType || entry.type || '',
        type: entry.type || '',
        url: entry.imageUrl,
        path: entry.fileName || ''
      });
      let previewEl;
      if (mediaType === 'video') {
        const video = document.createElement('video');
        video.src = entry.imageUrl;
        video.muted = true;
        video.playsInline = true;
        video.preload = 'metadata';
        video.autoplay = false;
        video.className = 'kc-result-card__video';
        applyLoopSettingToMedia(video);
        bindShowcaseMediaLifecycle(video, {
          src: entry.imageUrl,
          mediaType: 'video',
          context: 'results-card'
        });
        attachHoverPlayback(video, { resetOnLeave: true });
        previewEl = video;
      } else if (mediaType === 'sound') {
        imageWrap.classList.add('is-sound');
        const audio = document.createElement('audio');
        audio.src = entry.imageUrl;
        audio.controls = true;
        audio.preload = 'metadata';
        audio.className = 'kc-result-card__audio';
        applyLoopSettingToMedia(audio);
        bindShowcaseMediaLifecycle(audio, {
          src: entry.imageUrl,
          mediaType: 'audio',
          context: 'results-card'
        });
        attachHoverPlayback(audio, { resetOnLeave: true, extraTargets: [card, imageWrap] });
        previewEl = audio;
      } else if (mediaType === '3d') {
        if (isPreviewable3dEntry({ ...entry, url: entry.imageUrl })) {
          mount3dPreview(imageWrap, {
            src: entry.imageUrl,
            alt: normalizedLabel,
            variant: 'card'
          });
        } else {
          render3dDownloadMessage(imageWrap, entry.imageUrl, 'card');
        }
        previewEl = null;
      } else {
        const img = document.createElement('img');
        img.src = entry.imageUrl;
        img.alt = normalizedLabel;
        previewEl = img;
      }
      if (previewEl) {
        imageWrap.appendChild(previewEl);
      }
      imageWrap.addEventListener('click', () => {
        openMediaLightbox(resultLightboxEntries, index);
      });
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = isPending
        ? 'kc-result-card__placeholder kc-result-card__placeholder--pending'
        : 'kc-result-card__placeholder';
      if (isPending) {
        placeholder.textContent = translateEngineStatus({ status: entry.status });
      } else {
        placeholder.textContent = entry.error ? 'Failure' : 'No Preview';
      }
      imageWrap.appendChild(placeholder);
    }

    const meta = document.createElement('div');
    meta.className = 'kc-result-card__meta';
    const engineLine = document.createElement('div');
    engineLine.className = 'kc-result-engine';
    engineLine.textContent = normalizedLabel || '-';

    const fileLine = document.createElement('div');
    fileLine.className = 'kc-result-file';
    meta.append(engineLine);
    if (!isPending && entry.fileName) {
      const displayIndex = Number.isFinite(entry.savedFileIndex) ? Number(entry.savedFileIndex) : index;
      const displayCount = Number.isFinite(entry.savedFilesCount) ? Number(entry.savedFilesCount) : resultsForRender.length;
      const positionSuffix = displayCount > 1
        ? ` (${displayIndex + 1}/${displayCount})`
        : '';
      fileLine.textContent = `${entry.fileName}${positionSuffix}`;
      meta.append(fileLine);
    }

    if (state.showInputs !== false && Array.isArray(entry.inputMedia) && entry.inputMedia.length) {
      const inputsSection = document.createElement('div');
      inputsSection.className = 'kc-result-card__inputs';

      const inputsTitle = document.createElement('span');
      inputsTitle.className = 'kc-result-card__inputs-title';
      inputsTitle.textContent = 'INPUT';
      inputsSection.append(inputsTitle);

      const inputsTrack = document.createElement('div');
      inputsTrack.className = 'kc-result-card__inputs-track';

      const totalInputs = entry.inputMedia.length;
      const lightboxEntries = [];
      const lightboxIndexByAssignment = new Map();

      entry.inputMedia.forEach((assignment, inputIndex) => {
        if (!assignment || !assignment.media) return;
        const media = assignment.media || {};
        const normalizedSlotType = normalizeMediaGroupType(
          assignment.slotType || assignment.type || media.filterType || media.type || ''
        );
        const displayLabel = formatSlotLabelForDisplay(
          assignment.slotLabel,
          normalizedSlotType,
          inputIndex,
          totalInputs
        );

        const hasPreviewEntry = hasMediaUrl(media);
        const resolvedType = normalizeMediaGroupType(media.filterType || normalizedSlotType || '');
        if (hasPreviewEntry) {
          const previewLabel = displayLabel || media.name || media.path || 'INPUT';
          const extendedName = media.name && media.name !== previewLabel
            ? `${previewLabel} • ${media.name}`
            : previewLabel;
          lightboxIndexByAssignment.set(inputIndex, lightboxEntries.length);
          lightboxEntries.push({
            ...media,
            filterType: resolvedType,
            name: extendedName
          });
        }

        const item = document.createElement('div');
        item.className = 'kc-result-input';
        if (hasPreviewEntry) {
          item.setAttribute('role', 'button');
          item.tabIndex = 0;
        }

        const label = document.createElement('span');
        label.className = 'kc-result-input__label';
        label.textContent = displayLabel;
        item.append(label);

        const thumbWrap = document.createElement('div');
        thumbWrap.className = 'kc-result-input__thumb';
        let thumbData = null;
        if (hasPreviewEntry) {
          thumbData = createResultInputThumb(media, {
            label: displayLabel,
            type: resolvedType
          });
        }
        if (thumbData && thumbData.element) {
          if (thumbData.modifier) {
            thumbWrap.classList.add(`kc-result-input__thumb--${thumbData.modifier}`);
          }
          if (!thumbData.isPlaceholder) {
            thumbWrap.classList.add('kc-result-input__thumb--has-preview');
          }
          thumbWrap.append(thumbData.element);
        } else {
          const placeholder = document.createElement('span');
          placeholder.className = 'kc-result-input__placeholder';
          const placeholderLabel = (media.ext || resolvedType || normalizedSlotType || '?').toUpperCase();
          placeholder.textContent = placeholderLabel;
          thumbWrap.append(placeholder);
        }
        if (media.path || media.url) {
          const titleParts = [];
          if (displayLabel) titleParts.push(displayLabel);
          if (media.name && media.name !== displayLabel) titleParts.push(media.name);
          if (media.path && media.path !== media.name) titleParts.push(media.path);
          if (media.url && media.url !== media.path) titleParts.push(media.url);
          if (titleParts.length) {
            item.title = titleParts.join('\n');
          }
        }

        if (hasPreviewEntry) {
          const openPreview = (evt) => {
            evt.preventDefault();
            evt.stopPropagation();
            const lightboxIndex = lightboxIndexByAssignment.get(inputIndex);
            if (lightboxIndex === undefined) return;
            if (!lightboxEntries.length) return;
            openMediaLightbox(lightboxEntries, lightboxIndex);
          };

          item.addEventListener('click', openPreview);
          item.addEventListener('keydown', (evt) => {
            if (evt.key === 'Enter' || evt.key === ' ') {
              openPreview(evt);
            }
          });
        }

        item.append(thumbWrap);
        inputsTrack.append(item);
      });

      inputsSection.append(inputsTrack);
      meta.append(inputsSection);
    }

    if (state.showParameters !== false && Array.isArray(entry.inputParameters) && entry.inputParameters.length) {
      const paramsButton = document.createElement('button');
      paramsButton.type = 'button';
      paramsButton.className = 'kc-result-card__param-btn';
      paramsButton.setAttribute('aria-expanded', 'false');
      paramsButton.innerHTML = '<span aria-hidden="true">⚙️</span><span>パラメータ</span>';

      const paramsPanel = document.createElement('div');
      paramsPanel.className = 'kc-result-card__params';
      paramsPanel.hidden = true;

      entry.inputParameters.forEach((param) => {
        if (!param || !param.key) return;
        const row = document.createElement('div');
        row.className = 'kc-result-card__param-row';
        const keyLabel = document.createElement('span');
        keyLabel.className = 'kc-result-card__param-key';
        keyLabel.textContent = param.key;
        const valueLabel = document.createElement('span');
        valueLabel.className = 'kc-result-card__param-value';
        valueLabel.textContent = param.value || '';
        row.append(keyLabel, valueLabel);
        paramsPanel.append(row);
      });

      paramsButton.addEventListener('click', (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        const isOpen = paramsPanel.hidden === false;
        paramsPanel.hidden = isOpen;
        paramsButton.setAttribute('aria-expanded', String(!isOpen));
        paramsButton.classList.toggle('is-open', !isOpen);
      });

      meta.append(paramsButton, paramsPanel);
    }

    if (isPending) {
      const statusBadge = document.createElement('div');
      statusBadge.className = 'kc-badge kc-result-card__status is-pending';
      statusBadge.textContent = translateEngineStatus({ status: entry.status });
      meta.append(statusBadge);
    }

    if (entry.error) {
      const err = document.createElement('div');
      err.className = 'kc-result-error';
      err.textContent = entry.error;
      meta.append(err);
    }

    const engineIsTerminal = isJobTerminal(engineStatus);
    const canCancelIndividually = Boolean(
      state.isRunning
      && activeJobId
      && engineMeta
      && !engineCancelRequested
      && !engineIsTerminal
    );
    if (canCancelIndividually) {
      const actions = document.createElement('div');
      actions.className = 'kc-result-card__actions';
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'kc-result-card__cancel-btn';
      cancelBtn.textContent = '個別キャンセル';
      cancelBtn.addEventListener('click', (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        cancelBtn.disabled = true;
        cancelBtn.textContent = 'キャンセル中...';
        requestCancelEngine(activeJobId, entry.engineId);
      });
      actions.append(cancelBtn);
      meta.append(actions);
    } else if (engineCancelRequested && !engineIsTerminal) {
      const actions = document.createElement('div');
      actions.className = 'kc-result-card__actions';
      const label = document.createElement('span');
      label.className = 'kc-result-card__cancel-label';
      label.textContent = 'キャンセル処理中...';
      actions.append(label);
      meta.append(actions);
    }

    card.append(imageWrap, meta);
    container.append(card);
  });

  if (expandBtn) {
    const disabled = !resultsForRender.length && !(state.isRunning && state.activeJobSnapshot);
    expandBtn.disabled = disabled;
    expandBtn.setAttribute('aria-disabled', String(disabled));
  }

  if (promptLabel) {
    const activePrompt = (activeEntry?.prompt || '').trim()
      || getActivePromptForCategory(activeCategoryId)
      || (state.prompt || '').trim()
      || '';

    promptLabel.innerHTML = '';
    const hasPrompt = Boolean(activePrompt);
    promptLabel.classList.toggle('has-content', hasPrompt);
    if (promptHost) {
      promptHost.hidden = !hasPrompt;
      promptHost.setAttribute('aria-hidden', hasPrompt ? 'false' : 'true');
      promptHost.classList.toggle('has-content', hasPrompt);
    }
    if (promptPanel) {
      promptPanel.classList.toggle('has-content', hasPrompt);
      if (!hasPrompt || !state.resultsPromptExpanded) {
        promptPanel.hidden = true;
      }
    }
    if (promptText) {
      promptText.textContent = hasPrompt ? activePrompt : '';
    }

    if (hasPrompt) {
      const promptButton = document.createElement('button');
      promptButton.type = 'button';
      promptButton.id = 'kc-results-prompt-button';
      promptButton.className = 'kc-results-prompt__toggle';
      promptButton.innerHTML = '<span aria-hidden="true">📝</span><span>prompt</span>';
      promptButton.setAttribute('aria-controls', 'kc-results-prompt-panel');
      promptButton.setAttribute('aria-expanded', state.resultsPromptExpanded ? 'true' : 'false');

      if (state.resultsPromptExpanded) {
        promptButton.classList.add('is-open');
      }

      promptButton.addEventListener('click', (evt) => {
        evt.preventDefault();
        if (state.resultsPromptExpanded) {
          closePromptPopover();
        } else {
          openPromptPopover(promptButton, activePrompt);
        }
      });

      promptLabel.append(promptButton);

      if (wasPromptPopoverOpen) {
        requestAnimationFrame(() => {
          if (document.contains(promptButton)) {
            openPromptPopover(promptButton, activePrompt);
          }
        });
      }
    } else {
      state.resultsPromptExpanded = false;
    }

    if (filterRow) {
      const hasFilterControl = filterWrap && filterWrap.hidden === false;
      const shouldShowRow = hasFilterControl || hasPrompt;
      filterRow.hidden = !shouldShowRow;
      filterRow.setAttribute('aria-hidden', shouldShowRow ? 'false' : 'true');
    }
  } else {
    closePromptPopover();
    if (filterRow && filterWrap) {
      const hasFilterControl = filterWrap.hidden === false;
      filterRow.hidden = !hasFilterControl;
      filterRow.setAttribute('aria-hidden', hasFilterControl ? 'false' : 'true');
    }
  }

  updateBatchControlVisuals();
}

function resolvePromptKey(meta, entry = null) {
  if (meta) {
    const key = getPromptKey(meta);
    if (key) return key;
  }
  if (entry && typeof entry.promptKey === 'string' && entry.promptKey) {
    return entry.promptKey;
  }
  return 'prompt';
}

function getEnginePromptValue(meta, entry = null) {
  if (!meta && !entry) return '';
  const promptKey = resolvePromptKey(meta, entry);
  if (!promptKey) return '';
  const target = meta && meta.id ? meta : (entry && entry.id ? { id: entry.id } : null);
  if (!target || !target.id) return '';
  const store = ensureEngineInputs(target);
  const value = store?.[promptKey];
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value.trim();
  return String(value).trim();
}

function getSelectionPromptStatus() {
  const result = {
    requiresPrompt: false,
    missingEngines: []
  };
  if (!(state.selected instanceof Map) || state.selected.size === 0) {
    return result;
  }
  state.selected.forEach((entry, id) => {
    const meta = getEngineMeta(id) || entry;
    if (!meta) return;
    const requires = engineRequiresPrompt(meta) || Boolean(entry?.requiresPrompt);
    if (!requires) return;
    result.requiresPrompt = true;
    const promptValue = getEnginePromptValue(meta, entry);
    if (!promptValue) {
      result.missingEngines.push({ id, meta });
    }
  });
  return result;
}

function updateRunButtonState() {
  const runButton = document.getElementById('kc-run');
  if (!runButton) return;
  const hasSelection = state.selected.size > 0;
  const promptStatus = getSelectionPromptStatus();
  const promptRequired = hasSelection && promptStatus.requiresPrompt;
  const hasGlobalPrompt = Boolean((state.prompt || '').trim());
  const needsMedia = Array.from(state.selected.values()).some((engine) => engine.requiresMedia);
  const selectedMedia = getSelectedMediaList();
  const requiredTypes = new Set();
  Array.from(state.selected.values()).forEach((engine) => {
    if (Array.isArray(engine.requiredMediaTypes)) {
      engine.requiredMediaTypes.forEach((type) => {
        const normalized = normalizeMediaGroupType(type);
        if (normalized && normalized !== 'other') {
          requiredTypes.add(normalized);
        }
      });
    }
    const meta = getEngineMeta(engine.id);
    if (meta && Array.isArray(meta.requiredMediaTypes)) {
      meta.requiredMediaTypes.forEach((type) => {
        const normalized = normalizeMediaGroupType(type);
        if (normalized && normalized !== 'other') {
          requiredTypes.add(normalized);
        }
      });
    }
  });

  const groupedMedia = groupMediaEntriesByType(selectedMedia);
  const hasRequiredMediaTypes = Array.from(requiredTypes).every((type) => {
    const list = groupedMedia.get(type);
    return Array.isArray(list) && list.length > 0;
  });

  const hasMedia = (() => {
    if (requiredTypes.size) {
      return hasRequiredMediaTypes;
    }
    if (needsMedia) {
      return selectedMedia.length > 0;
    }
    return true;
  })();
  const soundSelections = getSelectedSoundEngines();
  const needsSoundText = soundSelections.some(({ meta, entry }) => engineRequiresSoundText(meta, entry));
  const hasSoundText = !needsSoundText || Boolean((state.soundText || '').trim());
  const promptSatisfied = !promptRequired
    || hasGlobalPrompt
    || (promptStatus.missingEngines && promptStatus.missingEngines.length === 0);
  if (state.isRunning) {
    if (state.currentJobId) {
      runButton.disabled = false;
      runButton.textContent = 'キャンセル';
    } else {
      runButton.disabled = true;
      runButton.textContent = '実行中...';
    }
    return;
  }
  const disabled = !hasSelection || !promptSatisfied || !hasMedia || !hasSoundText;
  runButton.disabled = disabled;
  runButton.textContent = '生成を開始';
}

function encodePath(relativePath) {
  return relativePath.split(/\\|\//).map(encodeURIComponent).join('/');
}

function cacheBust(url) {
  if (!url || typeof url !== 'string') return url;
  if (url.startsWith('data:')) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_=${Date.now()}`;
}

function canonicalizePath(path) {
  if (!path) return '';
  return path.replace(/^\/+/, '').toLowerCase();
}

function normalizeFileTimestamp(value) {
  if (value === null || value === undefined) return 0;
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? 0 : time;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value > 1e12) return Math.round(value);
    if (value > 1e9) return Math.round(value * 1000);
    if (value > 0) return Math.round(value);
    return 0;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) return parsed;
    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric)) {
      return normalizeFileTimestamp(numeric);
    }
  }
  return 0;
}

function pickNormalizedTimestamp(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const normalized = normalizeFileTimestamp(value);
    if (Number.isFinite(normalized) && normalized > 0) {
      return normalized;
    }
  }
  return 0;
}

function getMediaModifiedTime(media) {
  if (!media) return 0;
  return pickNormalizedTimestamp(
    media.modified,
    media.modifiedMs,
    media.modified_ms,
    media.modified_ts,
    media.updated,
    media.updatedAt,
    media.updated_at,
    media.mtime,
    media.mtimeMs,
    media.mtime_ms,
    media.lastModified,
    media.last_modified
  );
}

function getMediaCreatedTime(media) {
  if (!media) return 0;
  const created = pickNormalizedTimestamp(
    media.created,
    media.createdMs,
    media.created_ms,
    media.created_ts,
    media.createdAt,
    media.created_at,
    media.birthtime,
    media.birthTime,
    media.birth_time,
    media.birthtimeMs,
    media.birthtime_ms,
    media.added,
    media.creationTime,
    media.creationTimeMs,
    media.ctime,
    media.ctimeMs,
    media.ctime_ms
  );
  if (created) return created;
  return getMediaModifiedTime(media);
}

function hasMediaUrl(entry) {
  if (!entry) return false;
  const url = entry.url || entry.absolute || entry.webPath || '';
  return typeof url === 'string' && url.trim().length > 0;
}

function createResultInputThumb(media, {
  label = '',
  type = 'other'
} = {}) {
  if (!media) return null;
  const resolvedType = normalizeMediaGroupType(type || media.filterType || media.type || media.ext || '');
  const source = media.thumbUrl || media.url || media.absolute || media.webPath || '';
  const safeLabel = label || media.name || media.path || 'INPUT';

  if (resolvedType === 'image' && source) {
    const img = document.createElement('img');
    img.src = source;
    img.alt = safeLabel;
    img.loading = 'lazy';
    return { element: img, modifier: 'image' };
  }

  if (resolvedType === 'video' && source) {
    const video = document.createElement('video');
    video.src = source;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.loop = true;
    video.classList.add('kc-result-input__video');
    video.addEventListener('mouseenter', () => {
      if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
        video.play().catch(() => {});
      }
    });
    video.addEventListener('mouseleave', () => {
      video.pause();
      try {
        video.currentTime = 0;
      } catch (err) {
        /* noop */
      }
    });
    return { element: video, modifier: 'video' };
  }

  if (resolvedType === 'sound') {
    const icon = document.createElement('span');
    icon.className = 'kc-result-input__icon';
    icon.textContent = '♪';
    icon.setAttribute('aria-hidden', 'true');
    return { element: icon, modifier: 'sound' };
  }

  if (resolvedType === '3d') {
    const icon = document.createElement('span');
    icon.className = 'kc-result-input__icon';
    icon.textContent = '3D';
    icon.setAttribute('aria-hidden', 'true');
    return { element: icon, modifier: '3d' };
  }

  if (source) {
    const fallback = document.createElement('span');
    fallback.className = 'kc-result-input__placeholder';
    fallback.textContent = (media.ext || resolvedType || '?').toUpperCase();
    return { element: fallback, modifier: resolvedType || 'other', isPlaceholder: true };
  }

  return null;
}

function resolveMediaEntryType(entry) {
  const mapExtToType = (raw) => {
    if (!raw && raw !== 0) return '';
    const trimmed = String(raw).trim().toLowerCase();
    if (!trimmed) return '';
    const ext = trimmed.replace(/^\./, '');
    if (IMAGE_EXTENSIONS.has(ext)) return 'image';
    if (VIDEO_EXTENSIONS.has(ext)) return 'video';
    if (AUDIO_EXTENSIONS.has(ext)) return 'sound';
    if (THREED_EXTENSIONS.has(ext)) return '3d';
    return '';
  };

  const normalizeCandidate = (raw) => {
    if (!raw && raw !== 0) return '';
    const value = String(raw).trim().toLowerCase();
    if (!value) return '';
    if (MEDIA_INPUT_ALLOWED_TYPES.has(value)) return value;
    if (value === 'audio') return 'sound';
    if (value === 'images') return 'image';
    if (value === 'videos') return 'video';
    if (value.startsWith('image/')) return 'image';
    if (value.startsWith('video/')) return 'video';
    if (value.startsWith('audio/')) return 'sound';
    const fromExt = mapExtToType(value);
    if (fromExt) return fromExt;
    return '';
  };

  const candidates = [
    entry?.filterType,
    entry?.mediaType,
    entry?.type,
    entry?.mime,
    entry?.ext
  ];
  for (const candidate of candidates) {
    const resolved = normalizeCandidate(candidate);
    if (resolved) return resolved;
  }
  if (entry?.path && entry.path.includes('.')) {
    const pathExt = entry.path.split('.').pop();
    const resolved = normalizeCandidate(pathExt);
    if (resolved) return resolved;
  }
  if (entry?.url && entry.url.includes('.')) {
    const urlToken = entry.url.split('?')[0].split('#')[0];
    const urlExt = urlToken.split('.').pop();
    const resolved = normalizeCandidate(urlExt);
    if (resolved) return resolved;
  }
  return 'other';
}

function collectMedia(node, acc = []) {
  if (!node) return acc;
  if (Array.isArray(node.files)) {
    node.files.forEach((file) => {
      const filterTags = deriveMediaFilterTags(file);
      const filterType = selectPrimaryMediaFilter(filterTags);
      if (!MEDIA_INPUT_ALLOWED_TYPES.has(filterType)) {
        return;
      }
      const createdMs = normalizeFileTimestamp(
        file.createdMs
        ?? file.createdAt
        ?? file.created
        ?? file.birthtime
        ?? file.birthTime
        ?? file.birth_time
        ?? file.added
        ?? file.ctime
        ?? file.ctimeMs
        ?? file.birthtimeMs
        ?? file.created_ms
        ?? file.created_ts
        ?? file.creationTime
        ?? file.creationTimeMs
      );
      let modifiedMs = normalizeFileTimestamp(
        file.modifiedMs
        ?? file.modified
        ?? file.updated
        ?? file.mtime
        ?? file.mtimeMs
        ?? file.lastModified
        ?? file.last_modified
        ?? file.modified_ms
        ?? file.modified_ts
        ?? file.updatedAt
        ?? file.updated_at
      );
      if (!modifiedMs && createdMs) {
        modifiedMs = createdMs;
      }
      acc.push({
        name: file.name,
        path: file.path,
        ext: file.ext,
        mime: file.mime || file.type || '',
        type: file.type || '',
        mediaType: file.mediaType || '',
        size: file.size,
        created: createdMs,
        modified: modifiedMs,
        canonical: canonicalizePath(file.path),
        filterType,
        filterTags
      });
    });
  }
  if (Array.isArray(node.folders)) {
    node.folders.forEach((folder) => {
      collectMedia(folder.items, acc);
    });
  }
  return acc;
}

function extractFilename(input) {
  if (!input) return '';
  const parts = String(input).split(/[\\/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : String(input);
}

function extractFileExtension(input) {
  const name = extractFilename(input);
  const match = name.toLowerCase().match(/\.([^.]+)$/);
  return match ? match[1] : '';
}

function matchesMediaFilter(item, filterId) {
  if (!filterId || filterId === 'all') return true;
  if (!item) return false;
  const normalizedFilter = normalizeMediaGroupType(filterId);
  const itemType = normalizeMediaGroupType(item.filterType);
  if (MEDIA_INPUT_ALLOWED_TYPES.has(normalizedFilter)) {
    return itemType === normalizedFilter;
  }
  let tags = Array.isArray(item.filterTags) ? item.filterTags : null;
  if (!tags || !tags.length) {
    const derived = deriveMediaFilterTags(item);
    if (derived.length) {
      item.filterTags = derived;
      tags = derived;
    } else {
      tags = [];
    }
  }
  if (tags.includes(filterId)) {
    return true;
  }
  if (item.filterType && item.filterType === filterId) {
    return true;
  }
  return false;
}

function applyMediaFilters() {
  const keyword = state.media.searchKeyword.trim().toLowerCase();
  let list = Array.isArray(state.media.items) ? [...state.media.items] : [];
  if (keyword) {
    list = list.filter((item) => {
      const name = (item.name || '').toLowerCase();
      const path = (item.path || '').toLowerCase();
      return name.includes(keyword) || path.includes(keyword);
    });
  }

  const typeFilter = state.media.typeFilter;
  if (typeFilter && typeFilter !== 'all') {
    list = list.filter((item) => matchesMediaFilter(item, typeFilter));
  }

  switch (state.media.sortMode) {
    case 'newest':
      list.sort((a, b) => {
        const diff = getMediaCreatedTime(b) - getMediaCreatedTime(a);
        if (diff) return diff;
        return (a.path || '').localeCompare(b.path || '');
      });
      break;
    case 'oldest':
      list.sort((a, b) => {
        const diff = getMediaCreatedTime(a) - getMediaCreatedTime(b);
        if (diff) return diff;
        return (a.path || '').localeCompare(b.path || '');
      });
      break;
    case 'name':
    default:
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      break;
  }

  state.media.filtered = list;
}

async function loadMediaLibrary({ force = false } = {}) {
  if (!state.backendOrigin) return;
  if (state.media.isLoading) return;
  const now = Date.now();
  if (!force && state.media.items.length && now - state.media.lastLoadedAt < MEDIA_CACHE_TTL_MS) {
    return;
  }
  state.media.isLoading = true;
  state.media.error = '';
  renderCategories();
  try {
    const json = await fetchJson('/api/scan');
    const rawImages = collectMedia(json.data || json);
    const uniq = new Map();
    rawImages.forEach((item) => {
      if (!item || !item.path) return;
      if (!uniq.has(item.path)) uniq.set(item.path, item);
    });
    const items = Array.from(uniq.values()).sort((a, b) => {
      const diff = getMediaCreatedTime(b) - getMediaCreatedTime(a);
      if (diff) return diff;
      return (a.path || '').localeCompare(b.path || '');
    });
    state.media.items = items.map((item) => {
      const absoluteUrl = state.backendOrigin ? `${state.backendOrigin}/${encodePath(item.path)}` : '';
      const baseTags = Array.isArray(item.filterTags) ? item.filterTags : deriveMediaFilterTags(item);
      const deduped = Array.from(new Set((baseTags || []).filter(Boolean)));
      let filterType = item.filterType || selectPrimaryMediaFilter(deduped);
      if ((!filterType || filterType === 'other') && deduped.length) {
        filterType = selectPrimaryMediaFilter(deduped);
      }
      if (!filterType) filterType = 'other';
      if (!MEDIA_INPUT_ALLOWED_TYPES.has(filterType)) {
        return null;
      }
      const filterTags = deduped.filter((tag) => tag && tag !== 'other');
      if (filterType !== 'other' && !filterTags.includes(filterType)) {
        filterTags.unshift(filterType);
      }
      const isImage = filterType === 'image';
      const createdTime = getMediaCreatedTime(item);
      const modifiedTime = getMediaModifiedTime(item);
      return {
        path: item.path,
        name: extractFilename(item.path) || item.name,
        url: absoluteUrl || '',
        thumbUrl: isImage && absoluteUrl ? cacheBust(absoluteUrl) : '',
        created: createdTime,
        createdMs: createdTime,
        modified: modifiedTime,
        modifiedMs: modifiedTime,
        filterType,
        filterTags,
        mime: item.mime || item.type || '',
        ext: item.ext || '',
        mediaType: item.mediaType || '',
        size: item.size
      };
    }).filter(Boolean);
    state.media.lastLoadedAt = Date.now();
    const currentPaths = new Set(state.media.items.map((media) => media.path));
    clearMissingMediaSelections(currentPaths);
    applyMediaFilters();
  } catch (err) {
    console.error('[Showcase] media load failed', err);
    state.media.error = err.message || 'メディアの取得に失敗しました';
    state.media.filtered = [];
  } finally {
    state.media.isLoading = false;
    renderCategories();
    updateRunButtonState();
  }
}

function cleanupSelections() {
  const validIds = new Set(state.engineIndex.keys());
  const preservedSelected = new Map();
  state.selected.forEach((value, key) => {
    if (validIds.has(key)) {
      const meta = state.engineIndex.get(key);
      const displayLabel = meta?.displayLabel || meta?.label || deriveEngineLabel(meta?.id || value?.label || key);
      preservedSelected.set(key, {
        ...value,
        label: displayLabel,
        requiresMedia: Boolean(meta?.requiresMedia),
        requiredMediaTypes: Array.isArray(meta?.requiredMediaTypes)
          ? meta.requiredMediaTypes.slice()
          : (Array.isArray(value?.requiredMediaTypes) ? value.requiredMediaTypes.slice() : []),
        requiresPrompt: engineRequiresPrompt(meta) || Boolean(value?.requiresPrompt),
        requiresSoundText: engineRequiresSoundText(meta, value) || Boolean(value?.requiresSoundText),
        promptKey: meta?.promptKey || value?.promptKey || getPromptKey(meta),
        soundTextKeys: Array.isArray(meta?.soundTextKeys)
          ? meta.soundTextKeys.slice()
          : (Array.isArray(value?.soundTextKeys) ? value.soundTextKeys.slice() : []),
        requiredSoundTextKeys: Array.isArray(meta?.requiredSoundTextKeys)
          ? meta.requiredSoundTextKeys.slice()
          : (Array.isArray(value?.requiredSoundTextKeys) ? value.requiredSoundTextKeys.slice() : []),
        documentationUrl: meta?.documentationUrl || value?.documentationUrl || '',
        docSummaryEn: meta?.docSummaryEn || value?.docSummaryEn || '',
        docSummaryJa: meta?.docSummaryJa || value?.docSummaryJa || ''
      });
    }
  });
  state.selected = preservedSelected;

  const preservedInputs = new Map();
  state.inputs.forEach((value, key) => {
    if (validIds.has(key)) {
      preservedInputs.set(key, value);
    }
  });
  state.inputs = preservedInputs;
  applySelectedMediaToEngineInputs();
}

function clearAllSelections({ clearInputs = false } = {}) {
  if (state.selected instanceof Map) {
    state.selected.clear();
  } else {
    state.selected = new Map();
  }
  if (clearInputs) {
    state.inputs = new Map();
  }
  renderCategories();
  updateRunButtonState();
}

function removeLastSelectedEngine() {
  if (!(state.selected instanceof Map) || state.selected.size === 0) return false;
  const keys = Array.from(state.selected.keys());
  const lastKey = keys[keys.length - 1];
  if (!lastKey) return false;
  state.selected.delete(lastKey);
  if (state.inputs && state.inputs instanceof Map && state.inputs.has(lastKey)) {
    state.inputs.delete(lastKey);
  }
  renderCategories();
  updateRunButtonState();
  return true;
}

function removeLastSelectedMedia() {
  const list = getSelectedMediaList();
  if (!list.length) return false;
  const next = list.slice(0, -1);
  setSelectedMediaList(next);
  renderCategories();
  updateRunButtonState();
  return true;
}

function removeSelectedMediaEntry(target, fallbackIndex = -1, identifier = '') {
  const list = getSelectedMediaList();
  if (!list.length) return false;
  const normalizedId = identifier || target?.path || target?.url || '';
  let removed = false;
  const next = [];
  list.forEach((entry, idx) => {
    if (removed) {
      next.push(entry);
      return;
    }
    const samePath = target?.path && entry?.path === target.path;
    const sameUrl = !target?.path && target?.url && entry?.url === target.url;
    const sameIdentifier = normalizedId && (entry?.path === normalizedId || entry?.url === normalizedId);
    if (samePath || sameUrl || sameIdentifier || idx === fallbackIndex) {
      removed = true;
      return;
    }
    next.push(entry);
  });
  if (!removed) return false;
  setSelectedMediaList(next);
  renderCategories();
  updateRunButtonState();
  return true;
}

function clearAllMediaSelections() {
  if (!getSelectedMediaList().length) return false;
  state.media.activeSlot = '';
  setSelectedMediaList([]);
  renderCategories();
  updateRunButtonState();
  return true;
}

async function loadEnginesForCategory(categoryId) {
  if (!categoryId) return;
  if (state.enginesByCategory.has(categoryId) && state.enginesByCategory.get(categoryId) !== null) {
    return;
  }
  await loadCatalog();
}

async function loadCatalog() {
  const container = document.getElementById('kc-engines');
  if (!container) return;
  container.textContent = '読み込み中...';
  state.enginesLoading.clear();
  SUPPORTED_CATEGORIES.forEach((id) => {
    state.enginesLoading.add(id);
    state.enginesByCategory.set(id, null);
  });
  if (state.categories.length) {
    renderCategories();
  }
  try {
    const response = await fetchJson(`${API_BASE}/tools`);
    const allServers = Array.isArray(response?.data?.servers)
      ? response.data.servers
      : [];

    const enginesByCategory = new Map();
    SUPPORTED_CATEGORIES.forEach((id) => {
      enginesByCategory.set(id, []);
    });

    const engineIndex = new Map();

    allServers.forEach((meta) => {
      if (!meta || !meta.id) return;
      let assignedCategory = categorizeServerMeta(meta);
      const metaCategory = (meta.category || '').toLowerCase();
      const typeFromCategory = PREFIX_TO_CATEGORY.has(metaCategory) ? metaCategory : '';
      const rawType = typeFromCategory || extractEnginePrefix(meta.id) || extractEnginePrefix(meta.label);
      const displayLabel = deriveEngineLabel(meta.id) || deriveEngineLabel(meta.label || '');
      const parameterAnalysis = analyzeEngineParameters(meta);
      const requiredMediaTypes = Array.from(parameterAnalysis.requiredMediaTypes || []);
      const requiresMediaByParams = requiredMediaTypes.length > 0;
      const hasAnyMediaParam = Object.values(parameterAnalysis.mediaParams || {})
        .some((list) => Array.isArray(list) && list.length);
      const soundTextKeys = Array.isArray(parameterAnalysis.soundTextKeys)
        ? parameterAnalysis.soundTextKeys
        : [];
      const requiredSoundTextKeys = Array.isArray(parameterAnalysis.requiredSoundTextKeys)
        ? parameterAnalysis.requiredSoundTextKeys
        : [];
      const requiresSoundText = parameterAnalysis.requiresSoundText
        || meta.requiresSoundText === true
        || requiredSoundTextKeys.length > 0;
      const enriched = {
        ...meta,
        category: assignedCategory,
        sourceCategory: rawType,
        label: displayLabel,
        displayLabel,
        mediaParams: parameterAnalysis.mediaParams,
        soundTextKeys,
        requiredSoundTextKeys,
        requiresSoundText,
        soundTextKey: soundTextKeys[0],
        promptKey: parameterAnalysis.promptKey || getPromptKey(meta),
        requiredMediaTypes,
        requiresMedia: Boolean(meta?.requiresMedia)
          || requiresMediaByParams
          || (!hasAnyMediaParam && requiresMediaForPrefix(rawType)),
        documentationUrl: deriveDocumentationUrl(meta)
      };
      const docMeta = getDocMetadata(meta.id);
      if (docMeta) {
        if (docMeta.documentationUrl) {
          enriched.documentationUrl = docMeta.documentationUrl;
        }
        if (docMeta.descriptionEn) {
          enriched.docSummaryEn = docMeta.descriptionEn;
        }
        if (docMeta.descriptionJa) {
          enriched.docSummaryJa = docMeta.descriptionJa;
        }
      } else if (typeof meta.description === 'string' && meta.description.trim()) {
        enriched.docSummaryEn = meta.description.trim();
      }
      if (parameterAnalysis.requiresPrompt || meta.requiresPrompt === true) {
        enriched.requiresPrompt = true;
      }
      if (!enginesByCategory.has(assignedCategory)) {
        assignedCategory = DEFAULT_ACTIVE_CATEGORY;
        enriched.category = assignedCategory;
      }
      enginesByCategory.get(assignedCategory).push(enriched);
      engineIndex.set(enriched.id, enriched);
    });

    enginesByCategory.forEach((list) => {
      list.sort((a, b) => (a.label || a.id).localeCompare(b.label || b.id));
    });

    state.enginesByCategory = enginesByCategory;
    state.engineIndex = engineIndex;
    const aggregatedAll = Array.from(engineIndex.values()).sort((a, b) => {
      const left = a.displayLabel || a.label || a.id;
      const right = b.displayLabel || b.label || b.id;
      return (left || '').localeCompare(right || '');
    });
    state.enginesByCategory.set(ALL_CATEGORY_ID, aggregatedAll);
    state.enginesLoading.clear();

    const categoriesForUi = CATEGORY_DEFINITIONS.map((def) => ({ id: def.id, label: def.label }));

    state.categories = categoriesForUi;
    state.categories.forEach((category) => ensureCategoryCollections(category.id));

    ensureCategoryCollections(ALL_CATEGORY_ID);
    if (!state.engineCategoryInitialized) {
      state.activeEngineCategory = ALL_CATEGORY_ID;
      state.engineCategoryInitialized = true;
    }

    if (!isAllCategory(state.activeEngineCategory)
      && !state.categories.some((category) => category.id === state.activeEngineCategory)) {
      const fallback = state.categories.find((category) => category.id === DEFAULT_ACTIVE_CATEGORY)
        || state.categories[0];
      state.activeEngineCategory = fallback.id;
      state.activeCategory = fallback.id;
    }

    cleanupSelections();
    renderEngineTabs();
    renderEngineSubTabs();
    renderCategories();
    updateRunButtonState();
    if (state.categoryTabs[state.activeEngineCategory] === 'media'
      && state.media.items.length === 0
      && !state.media.isLoading) {
      loadMediaLibrary().catch((err) => console.error('[Showcase] initial media load failed', err));
    }
    renderHistory();
  } catch (err) {
    console.error('[Showcase] load catalog failed', err);
    container.textContent = `エンジン情報の取得に失敗しました: ${err.message}`;
  }
}

async function detectBackendOrigin() {
  const protocol = window.location.protocol || 'http:';
  const hostname = window.location.hostname || 'localhost';
  const ports = new Set();
  if (window.location.port) ports.add(window.location.port);
  ports.add('7777');
  ports.add('3001');
  ports.add('8888');

  const origins = new Set();
  ports.forEach((port) => {
    const suffix = port ? `:${port}` : '';
    origins.add(`${protocol}//${hostname}${suffix}`);
  });
  origins.add(`${protocol}//${hostname}`);
  origins.add('http://localhost:7777');
  origins.add('http://127.0.0.1:7777');

  let lastError = null;
  for (const origin of origins) {
    try {
      const res = await fetch(`${origin}/api/config`, { mode: 'cors' });
      if (!res.ok) {
        lastError = new Error(`config status ${res.status}`);
        continue;
      }
      const json = await res.json();
      state.backendOrigin = origin;
      if (json.scanPath) {
        state.scanPath = json.scanPath.endsWith('/') ? json.scanPath : `${json.scanPath}/`;
      }
      return;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('バックエンドサーバーを検出できませんでした');
}

async function loadConfig() {
  try {
    const json = await fetchJson('/api/config');
    if (json.scanPath) {
      state.scanPath = json.scanPath.endsWith('/') ? json.scanPath : `${json.scanPath}/`;
    }
  } catch (err) {
    console.warn('[Showcase] /api/config load failed', err);
  }
}

async function runGeneration() {
  if (state.isRunning && state.currentJobId) {
    requestCancelJob(state.currentJobId);
    return;
  }
  const selectedEngines = Array.from(state.selected.values());
  if (!selectedEngines.length) return;

  closeParamsPopover();
  closeTemplateMenu();
  closeResultsModal();
  closeLightbox();
  closePromptModal();
  setPromptGeneratorPanelVisible(false);
  stopAllJobPollers();
  state.currentRunResults = new Map();
  state.completedEngineKeys = new Set();
  state.currentHistoryEntryId = '';
  state.historyActiveId = null;
  state.historyManualSelection = false;
  state.currentJobEngines = [];
  state.activeJobSnapshot = null;
  SUPPORTED_CATEGORIES.forEach((category) => {
    ensureCategoryCollections(category);
    state.resultsByCategory[category] = [];
  });

  state.currentJobEngines = selectedEngines.map((selected) => ({
    id: selected.id,
    label: selected.label || '',
    displayLabel: selected.displayLabel || '',
    category: selected.category || DEFAULT_ACTIVE_CATEGORY
  }));

  state.engineDisplayOrder = new Map();
  selectedEngines.forEach((selected, index) => {
    if (!selected || !selected.id) return;
    const normalizedCategory = normalizeCategory(selected.category || DEFAULT_ACTIVE_CATEGORY);
    state.engineDisplayOrder.set(selected.id, {
      order: index,
      category: normalizedCategory
    });
  });

  const primaryCategory = normalizeCategory(selectedEngines[0]?.category || DEFAULT_ACTIVE_CATEGORY);
  state.activeCategory = primaryCategory;
  ensureCategoryCollections(primaryCategory);

  state.isRunning = true;
  setReloadBlock(true);
  updateRunButtonState();

  const resultsContainer = document.getElementById('kc-results');
  if (resultsContainer) {
    renderResults(resultsContainer);
  }

  const selectedMediaList = getSelectedMediaList();
  const slotDefinitions = computeMediaSlotDefinitions(selectedEngines);
  const groupedMedia = groupMediaEntriesByType(selectedMediaList);

  try {
    const enginesPayload = selectedEngines.map((selected) => {
      const engineMeta = getEngineMeta(selected.id) || { id: selected.id, category: selected.category };
      const store = ensureEngineInputs(engineMeta);
      const input = { ...store };
      if (Object.prototype.hasOwnProperty.call(input, '__autoMediaAssignments')) {
        delete input.__autoMediaAssignments;
      }
      const payload = {
        id: selected.id,
        label: selected.label,
        category: selected.category,
        input
      };
      if (selectedMediaList.length) {
        payload.media = selectedMediaList
          .map((entry, idx) => {
            const sanitized = sanitizeMediaEntryForPayload(entry, entry.filterType || entry.type || '');
            if (!sanitized) return null;
            return {
              ...sanitized,
              order: idx
            };
          })
          .filter(Boolean);
      }
      const mediaAssignments = buildMediaAssignmentsForEngine(engineMeta, slotDefinitions, groupedMedia);
      if (mediaAssignments.length) {
        payload.mediaAssignments = mediaAssignments;
      }
      return payload;
    });

    const response = await fetchJson(`${API_BASE}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: state.prompt,
        filePrefix: state.filePrefix,
        engines: enginesPayload
      })
    });

    const job = response?.job;
    const jobId = response?.jobId || job?.id;
    if (!job || !jobId) {
      throw new Error('ジョブIDを取得できませんでした');
    }

    state.currentJobId = jobId;
    state.jobs.set(jobId, job);
    state.activeJobSnapshot = job;
    state.currentJobEngines = job.engines.map((engine) => ({
      id: engine.id,
      label: engine.label || '',
      displayLabel: engine.displayLabel || engine.label || '',
      category: engine.category || DEFAULT_ACTIVE_CATEGORY
    }));

    if (resultsContainer) {
      renderResults(resultsContainer);
    }

    const statusLabel = document.getElementById('kc-results-status');
    if (statusLabel) {
      statusLabel.textContent = translateJobStatus(job.status);
    }

    const initialCategory = (() => {
      if (Array.isArray(job.engines) && job.engines.length) {
        const withCategory = job.engines.find((engine) => engine && engine.category);
        if (withCategory?.category) {
          return normalizeCategory(withCategory.category);
        }
      }
      if (state.activeCategory) {
        return normalizeCategory(state.activeCategory);
      }
      return DEFAULT_ACTIVE_CATEGORY;
    })();

    const historyEntry = ensureHistoryEntryForCurrentRun({
      prompt: state.prompt,
      category: initialCategory,
      jobId
    });
    syncHistoryEntryFromCurrentResults(historyEntry, {
      prompt: state.prompt,
      category: initialCategory
    });
    saveHistoryToStorage();
    renderHistory();

    handleJobUpdate(job);
    if (!isJobTerminal(job.status)) {
      startJobPolling(jobId, { immediate: false });
    } else {
      finalizeCurrentJob(job);
    }
  } catch (err) {
    console.error('[Showcase] run failed', err);
    state.isRunning = false;
    setReloadBlock(false, { release: false });
    state.activeJobSnapshot = null;
    state.currentJobEngines = [];
    state.engineDisplayOrder = new Map();
    if (resultsContainer) {
      const errorMessage = document.createElement('div');
      errorMessage.className = 'kc-results-error-message';
      errorMessage.textContent = `エラーが発生しました: ${err.message}`;
      resultsContainer.append(errorMessage);
    }
    const statusLabel = document.getElementById('kc-results-status');
    if (statusLabel) {
      statusLabel.textContent = '生成に失敗しました';
    }
    closePromptPopover();
    renderCategories();
    updateRunButtonState();
  }
}

function attachEvents() {
  const promptInput = document.getElementById('kc-prompt');
  const filePrefixInput = document.getElementById('kc-file-prefix');
  const soundTextInput = document.getElementById('kc-sound-text');
  const runButton = document.getElementById('kc-run');
  const templateButton = document.getElementById('kc-template');
  const expandButton = document.getElementById('kc-results-expand');
  const resultsRewindButton = document.getElementById('kc-results-rewind');
  const resultsToggleButton = document.getElementById('kc-results-toggleplay');
  const resultsForwardButton = document.getElementById('kc-results-forward');
  const resultsLoopButton = document.getElementById('kc-results-loop');
  const resultsFileFilterSelect = document.getElementById('kc-results-file-filter');
  const inputToggleButton = document.getElementById('kc-results-input-toggle');
  const paramsToggleButton = document.getElementById('kc-results-params-toggle');
  const failureToggleButton = document.getElementById('kc-results-failure-toggle');
  const promptGeneratorSection = document.getElementById('kc-prompt-generator');
  const promptGenerateButton = document.getElementById('kc-prompt-generate');
  const promptGeneratorToggle = document.getElementById('kc-prompt-generator-toggle');
  const promptGeneratorCategorySelect = document.getElementById('kc-prompt-generator-category');
  const promptGeneratorTypeSelect = document.getElementById('kc-prompt-generator-type');
  const promptGeneratorVariantSelect = document.getElementById('kc-prompt-generator-variants');
  const promptGeneratorGuidanceInputEn = document.getElementById('kc-prompt-generator-guidance-en');
  const promptGeneratorGuidanceInputJa = document.getElementById('kc-prompt-generator-guidance-ja');
  const promptGeneratorLyricsToggle = document.getElementById('kc-prompt-generator-lyrics-toggle');
  const promptGeneratorLyricsStructureField = document.getElementById('kc-prompt-generator-lyrics-structure');
  const promptGeneratorLyricsLanguageSelect = document.getElementById('kc-prompt-generator-lyrics-language');
  const promptGeneratorLyricsCharInput = document.getElementById('kc-prompt-generator-lyrics-chars');
  const promptGeneratorLyricsKeywordsInput = document.getElementById('kc-prompt-generator-lyrics-keywords');
  const promptGeneratorLyricsSectionsToggle = document.getElementById('kc-prompt-generator-lyrics-sections');
  const promptGeneratorSoundTextToggle = document.getElementById('kc-prompt-generator-soundtext-toggle');
  const promptGeneratorSoundTextLanguageSelect = document.getElementById('kc-prompt-generator-soundtext-language');
  const promptGeneratorSoundTextCharInput = document.getElementById('kc-prompt-generator-soundtext-chars');
  const promptGeneratorSoundTextKeywordsInput = document.getElementById('kc-prompt-generator-soundtext-keywords');
  const promptGeneratorSoundTextNotesField = document.getElementById('kc-prompt-generator-soundtext-notes');

  if (filePrefixInput) {
    const handlePrefixChange = () => {
      setFilePrefix(filePrefixInput.value);
    };
    filePrefixInput.addEventListener('input', handlePrefixChange);
    filePrefixInput.addEventListener('blur', handlePrefixChange);
    syncFilePrefixField();
  }

  if (promptInput) {
    promptInput.placeholder = PROMPT_PLACEHOLDER;
    promptInput.removeAttribute('readonly');
    promptInput.readOnly = false;
    promptInput.disabled = false;
    const handleInput = () => {
      state.prompt = promptInput.value;
      adjustPromptFieldHeight(promptInput);
      updateRunButtonState();
      updatePromptGeneratorControls();
    };

    promptInput.addEventListener('input', handleInput);
    promptInput.addEventListener('blur', () => {
      state.prompt = promptInput.value;
      adjustPromptFieldHeight(promptInput);
      updatePromptGeneratorControls();
    });

    attachPromptResizeHandlers(promptInput);
    adjustPromptFieldHeight(promptInput, { force: true });
  }
  if (soundTextInput) {
    soundTextInput.placeholder = SOUND_TEXT_PLACEHOLDER;
    const handleSoundTextChange = () => {
      state.soundText = soundTextInput.value;
      applySoundTextToInputs(state.soundText);
      updateRunButtonState();
    };
    soundTextInput.addEventListener('input', handleSoundTextChange);
    soundTextInput.addEventListener('blur', handleSoundTextChange);
    attachPromptResizeHandlers(soundTextInput);
    const soundWrapper = document.getElementById('kc-sound-text-field');
    if (soundWrapper && !soundWrapper.hidden) {
      adjustPromptFieldHeight(soundTextInput, { force: true });
    } else {
      soundTextInput.style.height = '';
    }
  }
  if (runButton) {
    runButton.addEventListener('click', runGeneration);
  }
  if (templateButton) {
    templateButton.setAttribute('aria-haspopup', 'dialog');
    templateButton.setAttribute('aria-expanded', 'false');
    templateButton.addEventListener('click', (evt) => {
      evt.preventDefault();
      cancelTemplateMenuClose();
      openTemplateMenu(templateButton);
    });
  }
  if (promptGeneratorToggle) {
    promptGeneratorToggle.setAttribute('aria-controls', 'kc-prompt-generator');
    promptGeneratorToggle.setAttribute('aria-haspopup', 'dialog');
    promptGeneratorToggle.setAttribute('aria-expanded', 'false');
    promptGeneratorToggle.setAttribute('aria-label', 'プロンプトジェネレーターの表示切り替え');
    promptGeneratorToggle.title = 'プロンプトジェネレーターを開閉';
    promptGeneratorToggle.addEventListener('click', (evt) => {
      evt.preventDefault();
      togglePromptGeneratorPanel(promptGeneratorToggle);
      updatePromptGeneratorControls();
    });
  }
  if (expandButton) {
    expandButton.addEventListener('click', (evt) => {
      evt.preventDefault();
      openResultsGallery();
    });
  }
  if (resultsFileFilterSelect) {
    resultsFileFilterSelect.addEventListener('change', () => {
      const value = resultsFileFilterSelect.value || 'all';
      state.resultsFileFilter = value;
      try {
        localStorage.setItem(RESULTS_FILE_FILTER_STORAGE_KEY, value);
      } catch (err) {
        console.warn('[Showcase] failed to persist results file filter', err);
      }
      closeResultsModal();
      const resultsContainer = document.getElementById('kc-results');
      if (resultsContainer) {
        renderResults(resultsContainer);
      }
    });
  }
  if (inputToggleButton) {
    inputToggleButton.addEventListener('click', (evt) => {
      evt.preventDefault();
      state.showInputs = !state.showInputs;
      try {
        localStorage.setItem(INPUT_VISIBILITY_STORAGE_KEY, state.showInputs ? '1' : '0');
      } catch (err) {
        console.warn('[Showcase] failed to persist input visibility preference', err);
      }
      syncInputToggle();
      closeResultsModal();
      const resultsContainer = document.getElementById('kc-results');
      if (resultsContainer) {
        renderResults(resultsContainer);
      }
      renderHistory();
    });
    syncInputToggle();
  }
  if (paramsToggleButton) {
    paramsToggleButton.addEventListener('click', (evt) => {
      evt.preventDefault();
      state.showParameters = !state.showParameters;
      try {
        localStorage.setItem(PARAM_VISIBILITY_STORAGE_KEY, state.showParameters ? '1' : '0');
      } catch (err) {
        console.warn('[Showcase] failed to persist parameter visibility preference', err);
      }
      syncParameterToggle();
      closeResultsModal();
      const resultsContainer = document.getElementById('kc-results');
      if (resultsContainer) {
        renderResults(resultsContainer);
      }
      renderHistory();
    });
    syncParameterToggle();
  }
  if (failureToggleButton) {
    failureToggleButton.addEventListener('click', (evt) => {
      evt.preventDefault();
      state.showFailures = !state.showFailures;
      try {
        localStorage.setItem(FAILURE_VISIBILITY_STORAGE_KEY, state.showFailures ? '1' : '0');
      } catch (err) {
        console.warn('[Showcase] failed to persist failure visibility preference', err);
      }
      syncFailureToggle();
      closeResultsModal();
      const resultsContainer = document.getElementById('kc-results');
      if (resultsContainer) {
        renderResults(resultsContainer);
      }
      renderHistory();
    });
    syncFailureToggle();
  }
  if (promptGenerateButton) {
    promptGenerateButton.addEventListener('click', (evt) => {
      evt.preventDefault();
      triggerPromptGeneration();
    });
  }
  if (promptGeneratorCategorySelect) {
    promptGeneratorCategorySelect.addEventListener('change', () => {
      setPromptGeneratorCategory(promptGeneratorCategorySelect.value, { fromUser: true });
      updatePromptGeneratorControls();
    });
  }
  if (promptGeneratorTypeSelect) {
    promptGeneratorTypeSelect.addEventListener('change', () => {
      setPromptGeneratorType(promptGeneratorTypeSelect.value, { fromUser: true });
      updatePromptGeneratorControls();
    });
  }
  if (promptGeneratorVariantSelect) {
    promptGeneratorVariantSelect.addEventListener('change', () => {
      setPromptGeneratorVariantCount(promptGeneratorVariantSelect.value);
      updatePromptGeneratorControls();
    });
  }
  if (promptGeneratorGuidanceInputEn) {
    promptGeneratorGuidanceInputEn.addEventListener('input', () => {
      setPromptGeneratorGuidance(promptGeneratorGuidanceInputEn.value, { fromUser: true, persist: true });
    });
    promptGeneratorGuidanceInputEn.addEventListener('blur', () => {
      setPromptGeneratorGuidance(promptGeneratorGuidanceInputEn.value, { fromUser: true, persist: true });
    });
  }
  if (promptGeneratorGuidanceInputJa) {
    promptGeneratorGuidanceInputJa.addEventListener('input', () => {
      setPromptGeneratorGuidanceTranslation(promptGeneratorGuidanceInputJa.value, { fromUser: true, persist: true });
    });
    promptGeneratorGuidanceInputJa.addEventListener('blur', () => {
      setPromptGeneratorGuidanceTranslation(promptGeneratorGuidanceInputJa.value, { fromUser: true, persist: true });
    });
  }
  if (promptGeneratorLyricsToggle) {
    promptGeneratorLyricsToggle.addEventListener('change', () => {
      setPromptGeneratorLyricsEnabled(promptGeneratorLyricsToggle.checked);
      updatePromptGeneratorControls();
    });
  }
  if (promptGeneratorLyricsStructureField) {
    const syncStructure = () => {
      setPromptGeneratorLyricsStructure(promptGeneratorLyricsStructureField.value);
      updatePromptGeneratorControls();
    };
    promptGeneratorLyricsStructureField.addEventListener('input', syncStructure);
    promptGeneratorLyricsStructureField.addEventListener('blur', syncStructure);
  }
  if (promptGeneratorLyricsLanguageSelect) {
    promptGeneratorLyricsLanguageSelect.addEventListener('change', () => {
      setPromptGeneratorLyricsLanguage(promptGeneratorLyricsLanguageSelect.value);
      updatePromptGeneratorControls();
    });
  }
  if (promptGeneratorLyricsCharInput) {
    const syncChars = () => {
      setPromptGeneratorLyricsCharTarget(promptGeneratorLyricsCharInput.value);
      updatePromptGeneratorControls();
    };
    promptGeneratorLyricsCharInput.addEventListener('input', syncChars);
    promptGeneratorLyricsCharInput.addEventListener('blur', syncChars);
  }
  if (promptGeneratorLyricsKeywordsInput) {
    const syncKeywords = () => {
      setPromptGeneratorLyricsKeywords(promptGeneratorLyricsKeywordsInput.value);
    };
    promptGeneratorLyricsKeywordsInput.addEventListener('input', syncKeywords);
    promptGeneratorLyricsKeywordsInput.addEventListener('blur', () => {
      setPromptGeneratorLyricsKeywords(promptGeneratorLyricsKeywordsInput.value);
      updatePromptGeneratorControls();
    });
  }
  if (promptGeneratorLyricsSectionsToggle) {
    promptGeneratorLyricsSectionsToggle.addEventListener('change', () => {
      setPromptGeneratorLyricsIncludeSections(promptGeneratorLyricsSectionsToggle.checked);
      updatePromptGeneratorControls();
    });
  }
  if (promptGeneratorSoundTextToggle) {
    promptGeneratorSoundTextToggle.addEventListener('change', () => {
      setPromptGeneratorSoundTextEnabled(promptGeneratorSoundTextToggle.checked);
      updatePromptGeneratorControls();
    });
  }
  if (promptGeneratorSoundTextLanguageSelect) {
    promptGeneratorSoundTextLanguageSelect.addEventListener('change', () => {
      setPromptGeneratorSoundTextLanguage(promptGeneratorSoundTextLanguageSelect.value);
      updatePromptGeneratorControls();
    });
  }
  if (promptGeneratorSoundTextCharInput) {
    const syncCharTarget = () => {
      setPromptGeneratorSoundTextCharTarget(promptGeneratorSoundTextCharInput.value);
      updatePromptGeneratorControls();
    };
    promptGeneratorSoundTextCharInput.addEventListener('input', syncCharTarget);
    promptGeneratorSoundTextCharInput.addEventListener('blur', syncCharTarget);
  }
  if (promptGeneratorSoundTextKeywordsInput) {
    const syncVoiceKeywords = () => {
      setPromptGeneratorSoundTextKeywords(promptGeneratorSoundTextKeywordsInput.value);
    };
    promptGeneratorSoundTextKeywordsInput.addEventListener('input', syncVoiceKeywords);
    promptGeneratorSoundTextKeywordsInput.addEventListener('blur', () => {
      setPromptGeneratorSoundTextKeywords(promptGeneratorSoundTextKeywordsInput.value);
      updatePromptGeneratorControls();
    });
  }
  if (promptGeneratorSoundTextNotesField) {
    const syncVoiceNotes = () => {
      setPromptGeneratorSoundTextNotes(promptGeneratorSoundTextNotesField.value);
    };
    promptGeneratorSoundTextNotesField.addEventListener('input', syncVoiceNotes);
    promptGeneratorSoundTextNotesField.addEventListener('blur', () => {
      setPromptGeneratorSoundTextNotes(promptGeneratorSoundTextNotesField.value);
      updatePromptGeneratorControls();
    });
  }
  if (promptGeneratorSection) {
    promptGeneratorSection.addEventListener('click', handlePromptGeneratorClick);
  }
  renderPromptGeneratorResults();
  updatePromptGeneratorControls();
  syncPromptGeneratorPanelVisibility();
  syncPromptGeneratorSelectors({ refreshOptions: true });
  syncPromptGeneratorGuidanceField();
  registerBatchControlGroup({
    rewindBtn: resultsRewindButton,
    toggleBtn: resultsToggleButton,
    forwardBtn: resultsForwardButton,
    loopBtn: resultsLoopButton
  });

  syncPromptPreview();
  syncSoundTextField();
  updateRunButtonState();
}

async function init() {
  const root = document.getElementById('kamui-code-showcase-root');
  if (!root) {
    console.warn('[Showcase] root element not found');
    return;
  }
  root.innerHTML = showcaseTemplate();
  try {
    const storedPrefix = localStorage.getItem(FILE_PREFIX_STORAGE_KEY);
    if (typeof storedPrefix === 'string') {
      state.filePrefix = storedPrefix;
    }
    const storedFailures = localStorage.getItem(FAILURE_VISIBILITY_STORAGE_KEY);
    if (storedFailures === '0' || storedFailures === 'false') {
      state.showFailures = false;
    } else if (storedFailures === '1' || storedFailures === 'true') {
      state.showFailures = true;
    }
    const storedInputs = localStorage.getItem(INPUT_VISIBILITY_STORAGE_KEY);
    if (storedInputs === '0' || storedInputs === 'false') {
      state.showInputs = false;
    } else if (storedInputs === '1' || storedInputs === 'true') {
      state.showInputs = true;
    }
    const storedParams = localStorage.getItem(PARAM_VISIBILITY_STORAGE_KEY);
    if (storedParams === '0' || storedParams === 'false') {
      state.showParameters = false;
    } else if (storedParams === '1' || storedParams === 'true') {
      state.showParameters = true;
    }
    const storedResultsFilter = localStorage.getItem(RESULTS_FILE_FILTER_STORAGE_KEY);
    if (typeof storedResultsFilter === 'string' && storedResultsFilter) {
      state.resultsFileFilter = storedResultsFilter;
    }
  } catch (err) {
    console.warn('[Showcase] failed to restore file prefix', err);
  }
  await loadTemplateCatalog();
  try {
    await detectBackendOrigin();
  } catch (err) {
    console.warn('[Showcase] backend detection failed', err);
  }
  await loadDocMetadata();
  await loadTemplatePreferences();
  rebuildTemplates();
  attachEvents();
  syncFilePrefixField();
  await loadHistoryFromStorage();
  renderHistory();
  const resultsContainer = document.getElementById('kc-results');
  if (resultsContainer) {
    renderResults(resultsContainer);
  }
  try {
    if (!state.backendOrigin) {
      await detectBackendOrigin();
    }
    await loadConfig();
    await loadCatalog();
  } catch (err) {
    console.error('[Showcase] initialization failed', err);
    const enginesContainer = document.getElementById('kc-engines');
    if (enginesContainer) {
      enginesContainer.textContent = `バックエンドに接続できません: ${err.message}`;
    }
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      init().catch((err) => {
        console.error('[Showcase] initialization error', err);
      });
    }, { once: true });
  } else {
    init().catch((err) => {
      console.error('[Showcase] initialization error', err);
    });
  }
}
