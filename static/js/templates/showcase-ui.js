export default function showcaseTemplate() {
  return `
    <div class="kc-showcase-wrapper">
      <div class="kc-column kc-column--engines">
        <div class="kc-panel kc-panel--engines">
          <div class="kc-panel__header kc-panel__header--engines">
            <div class="kc-selection-header">
              <div class="kc-selection-tabs">
                <div class="kc-panel-tabs kc-panel-tabs--sub" id="kc-engine-subtabs"></div>
              </div>
              <div class="kc-selection-summary-wrapper">
                <div class="kc-selection-summary" id="kc-selection-summary">
                  <div class="kc-selection-summary__section kc-selection-summary__section--mcp">
                    <div class="kc-selection-summary__header">
                      <div class="kc-selection-summary__metrics" id="kc-selection-metrics"></div>
                      <div class="kc-selection-summary__actions" id="kc-selected-mcp-actions"></div>
                    </div>
                    <div class="kc-selection-summary__content" id="kc-selected-mcp"></div>
                  </div>
                  <div class="kc-selection-summary__section kc-selection-summary__section--media">
                    <div class="kc-selection-summary__header">
                      <span class="kc-selection-summary__title">選択中のINPUTメディア</span>
                      <div class="kc-selection-summary__header-controls">
                        <div class="kc-selection-summary__actions" id="kc-selected-media-actions"></div>
                      </div>
                    </div>
                    <div class="kc-selection-summary__content" id="kc-selected-media"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="kc-panel__body kc-panel__body--engines">
            <div class="kc-engine-toolbar" id="kc-engine-toolbar">
              <span class="kc-engine-toolbar__label" id="kc-engine-toolbar-label">MCP</span>
              <div class="kc-panel-tabs kc-panel-tabs--main" id="kc-engine-tabs"></div>
              <div class="kc-engine-stats" id="kc-engine-stats" aria-live="polite"></div>
              <div class="kc-engine-toolbar__search" id="kc-engine-toolbar-search">
                <div class="kc-engine-toolbar__search-slot" id="kc-engine-toolbar-search-slot"></div>
                <button id="kc-mcp-config-button" type="button" class="kc-button kc-button--ghost">MCP設定</button>
              </div>
            </div>
            <div class="kc-engines" id="kc-engines"></div>
          </div>
        </div>
      </div>
      <div class="kc-column kc-column--main">
        <div class="kc-panel kc-panel--prompt">
          <div class="kc-panel__body kc-panel__body--prompt">
            <div class="kc-prompt-row">
              <div class="kc-prompt-main">
                <textarea
                  id="kc-prompt"
                  rows="1"
                  data-min-height="36"
                  data-max-height="240"
                  placeholder="プロンプトを入力してください"
                  aria-label="プロンプトを入力"
                ></textarea>
                <div class="kc-prompt-option kc-prompt-option--sound" id="kc-sound-text-field" hidden>
                  <textarea
                    id="kc-sound-text"
                    class="kc-field__textarea"
                    rows="1"
                    data-min-height="36"
                    data-max-height="240"
                    placeholder="音声テキストを入力してください"
                    aria-label="音声テキスト"
                  ></textarea>
                </div>
              </div>
              <div class="kc-prompt-side">
                <div class="kc-prefix-row">
                  <label class="kc-field kc-field--prefix" for="kc-file-prefix">
                    <input
                      id="kc-file-prefix"
                      type="text"
                      class="kc-field__input"
                      autocomplete="off"
                      aria-label="ファイル名接頭辞"
                    />
                  </label>
                  <button
                    id="kc-template-reset"
                    type="button"
                    class="kc-button-icon kc-template-reset"
                    title="表示をリセット"
                      aria-label="表示をリセット"
                      disabled
                    >
                      <span class="kc-template-reset__icon" aria-hidden="true">
                        <svg viewBox="0 0 20 20" focusable="false" class="kc-template-reset__svg">
                          <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="1.3" opacity="0.85"></circle>
                          <path d="M7 7l6 6m0-6l-6 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></path>
                        </svg>
                      </span>
                    </button>
                </div>
                <div class="kc-template-preview" id="kc-template-preview" hidden>
                  <div class="kc-template-preview__name" id="kc-template-preview-name"></div>
                  <div class="kc-template-preview__memo" id="kc-template-preview-memo"></div>
                </div>
                <div class="kc-prompt-actions">
                  <button id="kc-prompt-generator-toggle" type="button" class="kc-button kc-button--ghost">ジェネ</button>
                  <button id="kc-template" type="button" class="kc-button kc-button--ghost">テンプレ</button>
                  <button id="kc-run" type="button" class="kc-button kc-button--accent kc-button--launch" disabled>生成を開始</button>
                </div>
              </div>
            </div>
            <div class="kc-prompt-generator-host" id="kc-prompt-generator-host">
              <div class="kc-prompt-generator" id="kc-prompt-generator" hidden aria-hidden="true" tabindex="-1">
                <div class="kc-prompt-generator__header">
                  <div class="kc-prompt-generator__title">プロンプトジェネレーター</div>
                  <div class="kc-prompt-generator__modes" role="group" aria-label="プロンプト生成モード">
                    <button type="button" class="kc-prompt-generator__mode" data-role="prompt-generator-mode" data-mode="expand" aria-pressed="false">水平展開</button>
                    <button type="button" class="kc-prompt-generator__mode" data-role="prompt-generator-mode" data-mode="enhance" aria-pressed="false">エンハンス</button>
                  </div>
                  <div class="kc-prompt-generator__quick-controls">
                    <div class="kc-prompt-generator__quick-group">
                      <label class="kc-prompt-generator__field">
                        <span class="kc-prompt-generator__field-label">カテゴリ</span>
                        <select id="kc-prompt-generator-category" class="kc-prompt-generator__select"></select>
                      </label>
                      <label class="kc-prompt-generator__field">
                        <span class="kc-prompt-generator__field-label">タイプ</span>
                        <select id="kc-prompt-generator-type" class="kc-prompt-generator__select"></select>
                      </label>
                      <label class="kc-prompt-generator__field kc-prompt-generator__field--compact">
                        <span class="kc-prompt-generator__field-label">候補数</span>
                        <select id="kc-prompt-generator-variants" class="kc-prompt-generator__select"></select>
                      </label>
                    </div>
                    <div class="kc-prompt-generator__quick-actions">
                      <button id="kc-prompt-generate" type="button" class="kc-button kc-button--accent">プロンプト生成</button>
                    </div>
                  </div>
                </div>
                <div class="kc-prompt-generator__guidance">
                  <label class="kc-prompt-generator__guidance-label" for="kc-prompt-generator-guidance-en">Gemini Instructions (English)</label>
                  <textarea
                    id="kc-prompt-generator-guidance-en"
                    class="kc-prompt-generator__guidance-input"
                    rows="2"
                    placeholder="Detail the guidance that will be sent to Gemini in English"
                    aria-label="Gemini instructions in English"
                  ></textarea>
                </div>
                <div class="kc-prompt-generator__guidance kc-prompt-generator__guidance--secondary">
                  <label class="kc-prompt-generator__guidance-label" for="kc-prompt-generator-guidance-ja">Gemini指示メモ（日本語）</label>
                  <textarea
                    id="kc-prompt-generator-guidance-ja"
                    class="kc-prompt-generator__guidance-input"
                    rows="2"
                    placeholder="英語指示の内容や補足を日本語でまとめてください"
                    aria-label="Gemini instructions memo in Japanese"
                  ></textarea>
                </div>
                <div class="kc-prompt-generator__lyrics" id="kc-prompt-generator-lyrics" hidden aria-hidden="true">
                  <label class="kc-prompt-generator__lyrics-toggle" for="kc-prompt-generator-lyrics-toggle">
                    <input type="checkbox" id="kc-prompt-generator-lyrics-toggle" class="kc-prompt-generator__checkbox" />
                    <span>歌詞も生成する</span>
                  </label>
                  <div class="kc-prompt-generator__lyrics-fields" id="kc-prompt-generator-lyrics-fields" hidden aria-hidden="true">
                    <label class="kc-prompt-generator__field kc-prompt-generator__field--full" for="kc-prompt-generator-lyrics-structure">
                      <span class="kc-prompt-generator__field-label">セクション構成メモ（任意）</span>
                      <textarea
                        id="kc-prompt-generator-lyrics-structure"
                        class="kc-prompt-generator__textarea"
                        rows="4"
                        placeholder="[Intro]\n[Verse 1]\n[Pre-Chorus]\n[Chorus]\n[Verse 2]\n[Bridge]\n[Outro]"
                      ></textarea>
                    </label>
                    <div class="kc-prompt-generator__lyrics-grid">
                      <label class="kc-prompt-generator__field kc-prompt-generator__field--compact" for="kc-prompt-generator-lyrics-chars">
                        <span class="kc-prompt-generator__field-label">目安文字数</span>
                        <input
                          id="kc-prompt-generator-lyrics-chars"
                          type="number"
                          min="60"
                          max="1600"
                          step="20"
                          class="kc-prompt-generator__input"
                          placeholder="例: 240"
                          inputmode="numeric"
                        />
                      </label>
                      <label class="kc-prompt-generator__field kc-prompt-generator__field--compact" for="kc-prompt-generator-lyrics-language">
                        <span class="kc-prompt-generator__field-label">言語</span>
                        <select id="kc-prompt-generator-lyrics-language" class="kc-prompt-generator__select">
                          <option value="ja">JA</option>
                          <option value="en">EN</option>
                        </select>
                      </label>
                    </div>
                    <label class="kc-prompt-generator__field kc-prompt-generator__field--full" for="kc-prompt-generator-lyrics-keywords">
                      <span class="kc-prompt-generator__field-label">キーワード（カンマ/改行区切り）</span>
                      <input
                        id="kc-prompt-generator-lyrics-keywords"
                        type="text"
                        class="kc-prompt-generator__input"
                        placeholder="例: dawn, hopeful, synthwave"
                        autocomplete="off"
                      />
                    </label>
                    <label class="kc-prompt-generator__lyrics-checkbox" for="kc-prompt-generator-lyrics-sections">
                      <input type="checkbox" id="kc-prompt-generator-lyrics-sections" class="kc-prompt-generator__checkbox" />
                      <span>[Verse]などのセクション見出しを付ける</span>
                    </label>
                  </div>
                </div>
                <div class="kc-prompt-generator__soundtext" id="kc-prompt-generator-soundtext" hidden aria-hidden="true">
                  <label class="kc-prompt-generator__soundtext-toggle" for="kc-prompt-generator-soundtext-toggle">
                    <input type="checkbox" id="kc-prompt-generator-soundtext-toggle" class="kc-prompt-generator__checkbox" />
                    <span>音声テキストも生成する</span>
                  </label>
                  <div class="kc-prompt-generator__soundtext-fields" id="kc-prompt-generator-soundtext-fields" hidden aria-hidden="true">
                    <div class="kc-prompt-generator__soundtext-grid">
                      <label class="kc-prompt-generator__field kc-prompt-generator__field--compact" for="kc-prompt-generator-soundtext-chars">
                        <span class="kc-prompt-generator__field-label">目安文字数</span>
                        <input
                          id="kc-prompt-generator-soundtext-chars"
                          type="number"
                          min="40"
                          max="800"
                          step="10"
                          class="kc-prompt-generator__input"
                          placeholder="例: 180"
                          inputmode="numeric"
                        />
                      </label>
                      <label class="kc-prompt-generator__field kc-prompt-generator__field--compact" for="kc-prompt-generator-soundtext-language">
                        <span class="kc-prompt-generator__field-label">言語</span>
                        <select id="kc-prompt-generator-soundtext-language" class="kc-prompt-generator__select">
                          <option value="ja">JA</option>
                          <option value="en">EN</option>
                        </select>
                      </label>
                    </div>
                    <label class="kc-prompt-generator__field kc-prompt-generator__field--full" for="kc-prompt-generator-soundtext-keywords">
                      <span class="kc-prompt-generator__field-label">キーワード（カンマ/改行区切り）</span>
                      <input
                        id="kc-prompt-generator-soundtext-keywords"
                        type="text"
                        class="kc-prompt-generator__input"
                        placeholder="例: calm, uplifting, sunrise"
                        autocomplete="off"
                      />
                    </label>
                    <label class="kc-prompt-generator__field kc-prompt-generator__field--full" for="kc-prompt-generator-soundtext-notes">
                      <span class="kc-prompt-generator__field-label">シーン・トーンメモ（任意）</span>
                      <textarea
                        id="kc-prompt-generator-soundtext-notes"
                        class="kc-prompt-generator__textarea"
                        rows="3"
                        placeholder="例: 夜の都市を歩く静かなナレーション。温かさと安心感を伝える。"
                      ></textarea>
                    </label>
                  </div>
                </div>
                <p class="kc-prompt-generator__status" id="kc-prompt-generator-status" hidden></p>
                <div class="kc-prompt-generator__results" id="kc-prompt-generator-results" aria-live="polite"></div>
              </div>
            </div>
          </div>
        </div>
        <div class="kc-panel kc-panel--results">
          <div class="kc-panel__header kc-panel__header--results">
            <div class="kc-results-header">
              <div class="kc-results-header__column kc-results-header__column--left">
              <div class="kc-results-header__section kc-results-header__section--title">
                <span class="kc-results-title">生成結果</span>
                <div class="kc-results-tags">
                  <span class="kc-badge" id="kc-results-category"></span>
                  <span class="kc-badge kc-badge--type" id="kc-results-type"></span>
                  <span class="kc-results-template" id="kc-results-template-name"></span>
                  </div>
                </div>
                <div class="kc-results-header__section kc-results-header__section--toggles">
                  <div class="kc-results-toggle-group" role="group" aria-label="結果表示の切り替え">
                    <button
                      type="button"
                      class="kc-button-icon kc-results-toggle is-active"
                      id="kc-results-input-toggle"
                      aria-pressed="true"
                      title="INPUTメディアの表示切り替え"
                      aria-label="INPUTメディアの表示切り替え"
                    >📥</button>
                    <button
                      type="button"
                      class="kc-button-icon kc-results-toggle is-active"
                      id="kc-results-params-toggle"
                      aria-pressed="true"
                      title="パラメータ表示の切り替え"
                      aria-label="パラメータ表示の切り替え"
                    >⚙️</button>
                    <button
                      type="button"
                      class="kc-button-icon kc-results-toggle is-active"
                      id="kc-results-failure-toggle"
                      aria-pressed="true"
                      title="Failure結果の表示切り替え"
                      aria-label="Failure結果の表示切り替え"
                    >🚫</button>
                  </div>
                  <div class="kc-results-filter-row" id="kc-results-filter-row" hidden>
                    <div class="kc-results-filter" id="kc-results-file-filter-wrap" hidden>
                      <select
                        id="kc-results-file-filter"
                        class="kc-results-filter__select"
                        aria-label="ファイル種別を選択"
                      >
                        <option value="all">すべて</option>
                      </select>
                    </div>
                    <div class="kc-results-prompt-host" id="kc-results-prompt-host" hidden aria-hidden="true">
                    <div class="kc-results-prompt" id="kc-results-prompt"></div>
                    <div class="kc-results-prompt-panel" id="kc-results-prompt-panel" hidden aria-labelledby="kc-results-prompt-panel-title">
                      <div class="kc-results-prompt-panel__title" id="kc-results-prompt-panel-title">prompt</div>
                      <div class="kc-results-prompt-panel__memo" id="kc-results-prompt-memo"></div>
                      <pre class="kc-results-prompt__content" id="kc-results-prompt-text"></pre>
                    </div>
                  </div>
                </div>
              </div>
              </div>
              <div class="kc-results-header__column kc-results-header__column--right">
                <div class="kc-results-header__section kc-results-header__section--actions">
                  <button type="button" class="kc-button-icon" id="kc-results-expand" title="拡大表示" aria-label="拡大表示">⤢</button>
                </div>
                <div class="kc-results-header__section kc-results-header__section--controls">
                  <div class="kc-results-controls" role="group" aria-label="動画の一括コントロール">
                    <button
                      type="button"
                      class="kc-button-icon"
                      id="kc-results-rewind"
                      title="最初のフレームに移動"
                      aria-label="最初のフレームに移動"
                    >⏮</button>
                    <button
                      type="button"
                      class="kc-button-icon"
                      id="kc-results-toggleplay"
                      title="全ての動画を再生"
                      aria-label="全ての動画を再生"
                    >▶</button>
                    <button
                      type="button"
                      class="kc-button-icon"
                      id="kc-results-forward"
                      title="最後のフレームに移動"
                      aria-label="最後のフレームに移動"
                    >⏭</button>
                    <button
                      type="button"
                      class="kc-button-icon"
                      id="kc-results-loop"
                      title="ループ再生を有効"
                      aria-label="ループ再生を有効"
                    >🔁</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="kc-panel__body kc-results" id="kc-results"></div>
        </div>
      </div>
      <div class="kc-column kc-column--history">
        <div class="kc-panel kc-panel--history" id="kc-history-panel">
          <div class="kc-panel__header kc-panel__header--history">
            <div class="kc-panel__controls">
              <div class="kc-panel-tabs" id="kc-history-tabs"></div>
            </div>
          </div>
          <div class="kc-panel__body kc-history" id="kc-history"></div>
          <div class="kc-panel__footer" id="kc-history-footer">
            <span class="kc-panel__subtitle" id="kc-history-count"></span>
          </div>
        </div>
      </div>
    </div>
  `;
}
