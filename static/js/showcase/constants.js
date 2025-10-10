export const API_BASE = '/api/mcp';
export const SHOWCASE_API_BASE = '/api/showcase';
export const HISTORY_API_ENDPOINT = `${SHOWCASE_API_BASE}/history`;
export const TEMPLATES_API_ENDPOINT = `${SHOWCASE_API_BASE}/templates`;
export const PROMPT_GENERATOR_ENDPOINT = '/api/prompt/generate';
export const RELOAD_RELEASE_DELAY_MS = 15000;

export const DEFAULT_ACTIVE_CATEGORY = 'image';
export const ALL_CATEGORY_ID = 'all';
export const ALL_CATEGORY_LABEL = 'ALL';

export const CATEGORY_DEFINITIONS = [
  { id: 'image', label: 'IMAGE', prefixes: ['t2i', 'i2i'] },
  { id: 'video', label: 'VIDEO', prefixes: ['t2v', 'i2v', 'r2v', 's2v', 'a2v', 'v2v'] },
  { id: '3d', label: '3D', prefixes: ['i2i3d'] },
  { id: 'sound', label: 'SOUND', prefixes: ['v2a', 'v2sfx', 't2a', 't2s', 'tts', 't2m'] },
  { id: 'other', label: 'OTHER', prefixes: ['t2visual', 'file', 'train', 'misc'] }
];

export const CATEGORY_DEFINITION_MAP = new Map(CATEGORY_DEFINITIONS.map((def) => [def.id, def]));
export const PREFIX_TO_CATEGORY = new Map();
CATEGORY_DEFINITIONS.forEach((def) => {
  (def.prefixes || []).forEach((prefix) => {
    PREFIX_TO_CATEGORY.set(prefix, def.id);
  });
});
export const TYPE_PREFIX_TO_CATEGORY = PREFIX_TO_CATEGORY;

export const SUPPORTED_CATEGORIES = CATEGORY_DEFINITIONS.map((def) => def.id);
export const CATEGORY_LABELS = Object.fromEntries([
  [ALL_CATEGORY_ID, ALL_CATEGORY_LABEL],
  ...CATEGORY_DEFINITIONS.map((def) => [def.id, def.label])
]);

export const PREFIXES_REQUIRING_MEDIA = new Set(['i2i', 'i2v', 'r2v', 'a2v', 'i2i3d']);

export const MEDIA_FILTERS = [
  { id: 'all', label: 'all' },
  { id: 'image', label: 'image' },
  { id: 'video', label: 'video' },
  { id: '3d', label: '3d' },
  { id: 'sound', label: 'sound' }
];

export const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff', 'tif', 'heic', 'heif']);
export const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'mkv', 'webm', 'avi', 'm4v', 'wmv']);
export const AUDIO_EXTENSIONS = new Set(['wav', 'mp3', 'aac', 'flac', 'ogg', 'm4a', 'aiff', 'wma', 'opus', 'mid', 'midi']);
export const THREED_EXTENSIONS = new Set(['obj', 'fbx', 'stl', 'glb', 'gltf', 'ply', 'usdz', 'usd', 'blend', '3ds', 'dae', 'stp', 'step', 'igs', 'iges', 'vrm']);

export const MIME_EXTENSION_OVERRIDES = Object.freeze({
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

export const MEDIA_HINTS = {
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

export const MEDIA_FILTER_PRIORITY = ['3d', 'image', 'video', 'sound'];
export const MEDIA_SELECTION_TYPE_ORDER = ['image', 'video', 'sound', '3d', 'other'];
export const MEDIA_INPUT_ALLOWED_TYPES = new Set(['image', 'video', 'sound', '3d']);

export const MEDIA_HINT_LOOKUP = (() => {
  const map = new Map();
  Object.entries(MEDIA_HINTS).forEach(([key, set]) => {
    set.forEach((token) => {
      map.set(token, key);
    });
  });
  return map;
})();

export const MEDIA_PARAM_ID_TOKENS = new Set(['id', 'ids', 'identifier', 'identifiers']);

export const MEDIA_PARAM_INDICATOR_TOKENS = new Set([
  'url', 'urls', 'uri', 'uris', 'href', 'hrefs', 'path', 'paths', 'file', 'files',
  'filename', 'filenames', 'asset', 'assets', 'source', 'sources', 'clip', 'clips',
  'track', 'tracks', 'thumbnail', 'thumbnails', 'thumb', 'thumbs',
  'mask', 'masks', 'base64', 'data', 'payload', 'attachment', 'attachments',
  '3d', 'mesh', 'meshes'
]);

export const MEDIA_PARAM_LOCATOR_TOKENS = new Set([
  'url', 'urls', 'uri', 'uris', 'href', 'hrefs', 'path', 'paths'
]);

export const MEDIA_PARAM_SIZE_TOKENS = new Set([
  'size', 'sizes', 'resolution', 'resolutions', 'dimension', 'dimensions', 'width', 'height'
]);

export const MEDIA_PARAM_EXCLUDE_TOKENS = new Set([
  'prompt', 'prompts', 'caption', 'captions', 'text', 'texts', 'script', 'scripts',
  'language', 'languages', 'output', 'outputs', 'style', 'styles', 'quality', 'qualities',
  'mode', 'modes', 'speed', 'speeds', 'name', 'names', 'title', 'titles', 'temperature', 'temperatures'
]);

export const MEDIA_PARAM_CONFIG_TOKENS = new Set([
  'format', 'formats', 'option', 'options', 'choice', 'choices', 'preset', 'presets',
  'variant', 'variants', 'setting', 'settings', 'config', 'configs'
]);

export const MEDIA_PARAM_KEYWORDS = {
  image: new Set([
    'image', 'images', 'img', 'picture', 'photo', 'thumbnail', 'thumb',
    'reference_image', 'input_image', 'init_image', 'mask', 'background', 'texture', 'screenshot',
    'frame', 'frames'
  ]),
  video: new Set([
    'video', 'videos', 'clip', 'clips', 'movie', 'movies', 'animation', 'footage', 'sequence', 'trailer', 'replay'
  ]),
  sound: new Set([
    'audio', 'audios', 'sound', 'sounds', 'voice', 'voices', 'speech', 'music', 'sfx', 'fx', 'track', 'tracks', 'song', 'songs', 'vocals'
  ])
};

export const MEDIA_PARAM_STRONG_TOKENS = {
  image: new Set(['mask', 'masks', 'background', 'texture', 'screenshot', 'thumbnail', 'thumb', 'reference', 'sprite', 'input', 'init', 'frame', 'frames']),
  video: new Set(['clip', 'clips', 'movie', 'movies', 'animation', 'footage', 'sequence', 'trailer', 'replay']),
  sound: new Set(['track', 'tracks', 'song', 'songs', 'audio', 'sound', 'voice', 'voices', 'music']),
  '3d': new Set(['mesh', 'meshes', 'model', 'models', 'geometry', 'pointcloud'])
};

export const MEDIA_PARAM_BADGE_EXCLUDE_TOKENS = new Set([
  'prompt', 'prompts', 'caption', 'captions', 'text', 'texts', 'language', 'languages',
  'output', 'outputs', 'script', 'scripts', 'subtitle', 'subtitles', 'transcript', 'transcripts',
  'default', 'defaults', 'title', 'titles', 'name', 'names', 'description', 'descriptions',
  'tone', 'tones', 'style', 'styles'
]);

export const MEDIA_TYPE_DISPLAY = {
  image: { label: 'IMAGE' },
  video: { label: 'VIDEO' },
  sound: { label: 'SOUND' },
  '3d': { label: '3D' },
  other: { label: 'OTHER' }
};

export const MEDIA_SLOT_START_TOKENS = Object.freeze([
  'start',
  'first',
  'initial',
  'begin',
  'intro'
]);

export const MEDIA_SLOT_END_TOKENS = Object.freeze([
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

export const ENGINE_PARAMETER_REQUIRED_HINTS = Object.freeze({
  'v2v-kamui-hunyuan-video-foley': ['text_prompt']
});

export const ENGINE_PARAMETER_OPTION_SUPPRESS = Object.freeze({
  'v2v-kamui-hunyuan-video-foley': new Set(['text_prompt']),
  't2v-kamui-openai-sora': new Set(['remix_video_id'])
});

export const DOC_METADATA_ENDPOINT = '/data/showcase/doc-metadata.json';

export const PREVIEWABLE_3D_EXTENSIONS = new Set(['glb', 'gltf', 'usdz', 'usd', 'vrm']);
export const MODEL_VIEWER_MODULE_URL = 'https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js';
export const MODEL_VIEWER_SCRIPT_ATTR = 'data-kc-model-viewer';

export const SOUND_TEXT_PARAM_KEYS = new Set([
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

export const PROMPT_GENERATOR_DEFAULT_MODE = 'enhance';
export const PROMPT_GENERATOR_DEFAULT_TYPE = 't2i';
export const PROMPT_GENERATOR_MODES = [
  { id: 'expand', label: '水平展開' },
  { id: 'enhance', label: 'エンハンス' }
];
export const PROMPT_GENERATOR_MAX_SUGGESTIONS = 8;
export const PROMPT_GENERATOR_DEFAULT_VARIANTS = 3;
export const PROMPT_GENERATOR_STATUS_TIMEOUT_MS = 3200;

export const PROMPT_GENERATOR_LYRICS_ENABLED_TYPES = new Set(['t2a', 't2m']);
export const PROMPT_GENERATOR_LYRICS_LANGUAGE_OPTIONS = ['ja', 'en'];
export const PROMPT_GENERATOR_LYRICS_KEYWORD_LIMIT = 8;
export const PROMPT_GENERATOR_LYRICS_CHAR_MIN = 60;
export const PROMPT_GENERATOR_LYRICS_CHAR_MAX = 1600;
export const PROMPT_GENERATOR_LYRICS_KEYWORDS_MAX_LENGTH = 240;
export const PROMPT_GENERATOR_LYRICS_STRUCTURE_MAX_LENGTH = 360;
export const PROMPT_GENERATOR_LYRICS_SECTION_LIMIT = 12;
export const PROMPT_GENERATOR_LYRICS_DEFAULTS = {
  enabled: false,
  structure: '[Intro]\\n[Verse 1]\\n[Pre-Chorus]\\n[Chorus]\\n[Verse 2]\\n[Bridge]\\n[Outro]',
  charTarget: 240,
  language: 'ja',
  includeSectionLabels: true,
  keywords: ''
};
export const PROMPT_GENERATOR_LYRICS_LEGACY_MAP = {
  verse_chorus: '[Intro]\\n[Verse 1]\\n[Chorus]\\n[Verse 2]\\n[Chorus]',
  verse_chorus_bridge: '[Intro]\\n[Verse 1]\\n[Chorus]\\n[Verse 2]\\n[Bridge]\\n[Chorus]',
  verse_chorus_outro: '[Intro]\\n[Verse 1]\\n[Chorus]\\n[Verse 2]\\n[Chorus]\\n[Outro]',
  verse_chorus_bridge_outro: '[Intro]\\n[Verse 1]\\n[Chorus]\\n[Verse 2]\\n[Bridge]\\n[Chorus]\\n[Outro]',
  verse_only: '[Intro]\\n[Verse 1]\\n[Verse 2]\\n[Verse 3]'
};

export const PROMPT_GENERATOR_SOUND_TEXT_ENABLED_TYPES = new Set(['t2s', 'tts']);
export const PROMPT_GENERATOR_SOUND_TEXT_AUTO_TYPES = new Set(['t2s', 'tts']);
export const PROMPT_GENERATOR_SOUND_TEXT_CHAR_MIN = 40;
export const PROMPT_GENERATOR_SOUND_TEXT_CHAR_MAX = 800;
export const PROMPT_GENERATOR_SOUND_TEXT_KEYWORDS_MAX_LENGTH = 200;
export const PROMPT_GENERATOR_SOUND_TEXT_NOTES_MAX_LENGTH = 360;
export const PROMPT_GENERATOR_SOUND_TEXT_KEYWORD_LIMIT = 10;
export const PROMPT_GENERATOR_SOUND_TEXT_DEFAULTS = {
  enabled: false,
  charTarget: 180,
  language: 'ja',
  keywords: '',
  notes: ''
};

export const PROMPT_KEY_EXCLUDE_TOKENS = new Set(['negative', 'anti', 'avoid']);

export const PROMPT_GENERATOR_CATEGORY_OPTIONS = [
  { id: ALL_CATEGORY_ID, label: ALL_CATEGORY_LABEL },
  ...CATEGORY_DEFINITIONS.map((def) => ({ id: def.id, label: def.label }))
];
