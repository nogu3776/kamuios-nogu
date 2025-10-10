import {
  CATEGORY_DEFINITIONS,
  PROMPT_GENERATOR_MAX_SUGGESTIONS
} from './constants.js';
import { normalizeTypeToken } from './utils.js';

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

export const PROMPT_GENERATOR_TYPE_OPTIONS = (() => {
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

export const PROMPT_GENERATOR_GUIDANCE_BY_TYPE = new Map([
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
    expandJa: '既存動画の水平展開。ジャンルや映像処理、動きの熱量、編集リズムを変えて多彩な方向性を提示する。'
  })],
  ['r2v', buildGuidanceModes({
    enhanceEn: 'Reference-to-video enhancement. Describe how reference clips influence pacing, composition, lighting, colour science, and motion language of the output.',
    enhanceJa: 'リファレンス動画を活かして強化。テンポ、構図、光源設計、カラーサイエンス、モーション表現をどう活用するか説明する。',
    expandEn: 'Reference-to-video exploration. Suggest divergent ways to interpret the reference clips, experimenting with new moods, narrative beats, and camera strategies inspired by them.',
    expandJa: 'リファレンス動画の水平展開。参考素材から着想した雰囲気、ストーリー展開、カメラ手法を異なる方向に展開する。'
  })],
  ['s2v', buildGuidanceModes({
    enhanceEn: 'Story/script to video enhancement. Break the script into key scenes, define visual tone, production design, transitions, and crucial dialog beats for clarity.',
    enhanceJa: '脚本から映像を強化。重要シーンを区切り、画面のトーン、美術セット、トランジション、要所の台詞を明確に描写する。',
    expandEn: 'Story/script to video exploration. Offer alternative scene breakdowns, visual moods, and editing timelines that reinterpret how the script could be filmed.',
    expandJa: '脚本から映像を水平展開。シーン構成や空気感、編集リズムの異なる案を提示し、脚本の映像化パターンを増やす。'
  })],
  ['a2v', buildGuidanceModes({
    enhanceEn: 'Audio-to-video enhancement. Explain how the audio cues drive pacing, visual motifs, lighting, and transitions, ensuring the video stays rhythmically aligned.',
    enhanceJa: 'サウンドドリブンな映像生成を強化。音のキューがテンポや映像モチーフ、ライティング、カット繋ぎにどう影響するか説明する。',
    expandEn: 'Audio-to-video exploration. Suggest distinct visual interpretations of the same audio—different genres, motion styles, colour stories, and camera dynamics.',
    expandJa: '音源から映像を水平展開。同じオーディオを異なるジャンル・モーション・配色・カメラワークで映像化する案を提案する。'
  })],
  ['i2i3d', buildGuidanceModes({
    enhanceEn: 'Image-to-3D enhancement. Define geometry accuracy, material fidelity, lighting cues, articulation points, and intended level-of-detail.',
    enhanceJa: '画像から3D化を強化。形状の正確さ、マテリアル、ライティング、可動部、求めるディテール密度を具体化する。',
    expandEn: 'Image-to-3D exploration. Present variations in proportions, topology simplification, material choices, and lighting environments for the output asset.',
    expandJa: '画像から3D化の水平展開。プロポーション、トポロジ、素材、ライティング環境を変えた派生案を提示する。'
  })],
  ['t2a', buildGuidanceModes({
    enhanceEn: 'Text-to-audio enhancement. Specify tempo, rhythm structure, instrumentation, mixing preferences, dynamics, and emotional contour.',
    enhanceJa: 'テキストからサウンド生成を強化。テンポ、リズム構造、編成、ミックス、ダイナミクス、感情の起伏を詳しく指示する。',
    expandEn: 'Text-to-audio exploration. Offer separate sonic interpretations—genre shifts, instrumentation swaps, production styles—that preserve the core narrative.',
    expandJa: 'テキストからサウンド生成の水平展開。ジャンルや編成、プロダクション手法を変え、同じテーマを別サウンドで表現する。'
  })],
  ['t2s', buildGuidanceModes({
    enhanceEn: 'Text-to-speech enhancement. Describe voice persona, pacing, inflection, emotional tone, and recording environment expectations.',
    enhanceJa: 'テキスト読み上げの強化。声質、話速、抑揚、感情表現、収録環境の要件を具体的に記す。',
    expandEn: 'Text-to-speech exploration. Provide different stylistic readings—formal, conversational, energetic, calm—to suit multiple scenarios.',
    expandJa: 'テキスト読み上げの水平展開。フォーマル、カジュアル、エネルギッシュ、落ち着いた読み方などを提案する。'
  })],
  ['tts', buildGuidanceModes({
    enhanceEn: 'Text-to-speech enhancement. Clarify pronunciation guides, pacing, pauses, emphasis, accent preferences, and background ambience.',
    enhanceJa: 'TTS の強化。発音ガイド、間の取り方、強調、アクセント、バックグラウンド音の有無を明記する。',
    expandEn: 'Text-to-speech exploration. Suggest different delivery styles—news anchor, storyteller, instructor, motivational—to match use cases.',
    expandJa: 'TTS の水平展開。ニュース風、語り部風、講師風、モチベーション演説風など用途別の読み上げ案を提示する。'
  })],
  ['t2m', buildGuidanceModes({
    enhanceEn: 'Text-to-music enhancement. Detail musical structure, chord progressions, instrumentation layers, production effects, and mix/loudness targets.',
    enhanceJa: 'テキストから楽曲生成を強化。楽曲構造、コード進行、レイヤー構成、エフェクト、音圧ターゲットを指定する。',
    expandEn: 'Text-to-music exploration. Offer multiple stylistic interpretations spanning genres, instrumentation, tempo, and emotional trajectory.',
    expandJa: 'テキストから楽曲生成の水平展開。ジャンルや楽器編成、テンポ、感情曲線を変えたバリエーションを提供する。'
  })],
  ['v2a', buildGuidanceModes({
    enhanceEn: 'Video-to-audio enhancement. Capture timing cues, foley layers, ambience, and mix balance that complement the source video.',
    enhanceJa: '映像からサウンド生成を強化。タイミング指示、フォーリー、環境音、ミックスバランスを映像に合わせて調整する。',
    expandEn: 'Video-to-audio exploration. Suggest alternate sonic landscapes—different ambience, rhythmic accents, instrumentations—to reframe the footage.',
    expandJa: '映像からサウンド生成の水平展開。環境音やリズム、楽器編成を変えて映像の印象を変化させる案を示す。'
  })],
  ['v2sfx', buildGuidanceModes({
    enhanceEn: 'Video-to-sound-effects enhancement. Detail hit points, intensity ramps, layering strategies, and spatialisation for immersive impact.',
    enhanceJa: '映像→効果音生成を強化。アクセント位置、強度変化、レイヤー設計、空間演出を具体化する。',
    expandEn: 'Video-to-sound-effects exploration. Provide varying effect palettes—cinematic, stylised, comedic, hyper-real—to reinterpret the same footage.',
    expandJa: '映像→効果音生成の水平展開。シネマティック、スタイライズ、コミカル、ハイパーリアルなど異なる効果音パレットを提案する。'
  })],
  ['t2visual', buildGuidanceModes({
    enhanceEn: 'Text-to-visual enhancement. Specify diagram type, key nodes, relationships, labels, colour scheme, and layout constraints.',
    enhanceJa: 'テキスト→ビジュアル生成を強化。図表の種類、主要ノード、関係性、ラベル、配色、レイアウト制約を明確化する。',
    expandEn: 'Text-to-visual exploration. Suggest alternative diagram structures, storytelling flows, and visual metaphors that communicate the same information.',
    expandJa: 'テキスト→ビジュアル生成の水平展開。同じ情報を別の図表構造・ストーリーフロー・ビジュアルメタファーで表現する案を提示する。'
  })],
  ['misc', buildGuidanceModes({
    enhanceEn: 'Miscellaneous tool enhancement. Clarify purpose, input expectations, output format, validation steps, and safety considerations.',
    enhanceJa: 'その他ツールの強化。目的、入力想定、出力形式、検証手順、安全面の考慮を整理する。',
    expandEn: 'Miscellaneous tool exploration. Propose different automation or workflow variations tackling the same task with alternative approaches.',
    expandJa: 'その他ツールの水平展開。同じ課題に対して別の自動化・ワークフロー案を提示する。'
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

export const PROMPT_GENERATOR_GUIDANCE_BY_CATEGORY = new Map([
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

export const PROMPT_GENERATOR_VARIANT_OPTIONS = Array.from({ length: PROMPT_GENERATOR_MAX_SUGGESTIONS }, (_, index) => index + 1);
export const PROMPT_GENERATOR_FLOAT_MARGIN = 16;
export const PROMPT_GENERATOR_FLOAT_OFFSET = 12;

export const PROMPT_GENERATOR_TYPE_CATEGORY_MAP = (() => {
  const map = new Map();
  PROMPT_GENERATOR_TYPE_OPTIONS.forEach((option) => {
    map.set(option.id, option.category);
  });
  map.set('other', 'other');
  return map;
})();
