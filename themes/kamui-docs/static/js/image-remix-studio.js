const root = document.getElementById('image-remix-root');
if (!root) {
  console.warn('[ImageRemix] root element not found');
} else {
  const state = {
    backendPort: null,
    backendOrigin: null,
    backendConfig: null,
    images: [],
    filteredImages: [],
    selectedImagePath: null,
    engine: 'nano-banana',
    history: [],
    isProcessing: false,
    searchKeyword: '',
    sortMode: 'name'
  };

  const els = {
    sourceList: root.querySelector('#irs-source-list'),
    searchInput: root.querySelector('#irs-search-input'),
    refreshButton: root.querySelector('#irs-refresh-sources'),
    sortSelect: root.querySelector('#irs-sort-select'),
    engineSelect: root.querySelector('#irs-engine-select'),
    prompt: root.querySelector('#irs-prompt'),
    runButton: root.querySelector('#irs-run-button'),
    status: root.querySelector('#irs-status'),
    logContent: root.querySelector('#irs-log-content'),
    history: root.querySelector('#irs-history'),
    beforeContainer: root.querySelector('#irs-preview-before'),
    afterContainer: root.querySelector('#irs-preview-after')
  };

  const MEDIA_DEDUP_PREFIXES = [/^public\//i, /^static\//i, /^\.\//];
  const HISTORY_STORAGE_KEY = 'irs-history-v1';

  function encodePath(relativePath) {
    return relativePath.split(/\\|\//).map(encodeURIComponent).join('/');
  }

  function canonicalizePath(path) {
    if (!path) return '';
    let canonical = path;
    MEDIA_DEDUP_PREFIXES.forEach((regex) => {
      canonical = canonical.replace(regex, '');
    });
    return canonical.replace(/^\/+/, '').toLowerCase();
  }

  function cacheBust(url) {
    if (!url || typeof url !== 'string') return url;
    if (url.startsWith('data:')) return url;
    const allowedOrigins = new Set();
    try {
      allowedOrigins.add(window.location.origin);
    } catch (_) {}
    if (state.backendOrigin) {
      try {
        allowedOrigins.add(new URL(state.backendOrigin, window.location.origin).origin);
      } catch (_) {
        allowedOrigins.add(state.backendOrigin);
      }
    }
    try {
      const resolved = new URL(url, window.location.origin);
      if (!allowedOrigins.has(resolved.origin)) {
        return url;
      }
    } catch (err) {
      if (/^https?:/i.test(url)) {
        return url;
      }
    }
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}_=${Date.now()}`;
  }

  function loadHistoryFromStorage() {
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn('[ImageRemix] failed to load history from storage', err);
      return [];
    }
  }

  function saveHistoryToStorage(history) {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch (err) {
      console.warn('[ImageRemix] failed to persist history', err);
    }
  }

  function extractFilename(input) {
    if (!input) return '';
    let target = String(input);
    try {
      target = decodeURIComponent(target);
    } catch (_) {
      // ignore decode failures
    }
    const sanitized = target.split(/[?#]/)[0];
    const parts = sanitized.split(/[\\\/]/).filter(Boolean);
    return parts.length ? parts[parts.length - 1] : sanitized;
  }

  let activeLightbox = null;

  function closeLightbox() {
    if (!activeLightbox) return;
    const { overlay, handler } = activeLightbox;
    if (handler) {
      window.removeEventListener('keydown', handler);
    }
    overlay.remove();
    document.body.classList.remove('irs-lightbox-open');
    activeLightbox = null;
  }

  function openImageModal(url, title, options = {}) {
    if (!url) return;
    closeLightbox();

    const overlay = document.createElement('div');
    overlay.className = 'irs-lightbox';

    const content = document.createElement('div');
    content.className = 'irs-lightbox__content';

    const imageWrap = document.createElement('div');
    imageWrap.className = 'irs-lightbox__image-wrap';

    const img = document.createElement('img');
    img.className = 'irs-lightbox__image';
    img.src = url;
    img.alt = title || options.filename || 'preview';
    imageWrap.appendChild(img);
    content.appendChild(imageWrap);

    const captionText = options.filename || title || '';
    if (captionText) {
      const caption = document.createElement('div');
      caption.className = 'irs-lightbox__caption';
      caption.textContent = captionText;
      content.appendChild(caption);
    }

    const closeBtn = document.createElement('button');
    closeBtn.className = 'irs-lightbox__close';
    closeBtn.type = 'button';
    closeBtn.innerHTML = '&times;';

    overlay.appendChild(content);
    overlay.appendChild(closeBtn);
    document.body.appendChild(overlay);
    document.body.classList.add('irs-lightbox-open');

    const handler = (event) => {
      if (event.key === 'Escape') {
        closeLightbox();
      }
    };

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        closeLightbox();
      }
    });
    closeBtn.addEventListener('click', closeLightbox);
    window.addEventListener('keydown', handler);

    activeLightbox = { overlay, handler };
  }

  async function copyToClipboard(text) {
    if (!text) return false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {
      // fallback below
    }
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    } catch (err) {
      console.error('[ImageRemix] clipboard copy failed', err);
      return false;
    }
  }

  function buildSavedFileUrl(file, bust = false) {
    if (!file) return '';
    const webPath = file.webPath || file.relative;
    if (webPath && state.backendOrigin) {
      const baseUrl = `${state.backendOrigin}/${encodePath(webPath)}`;
      return bust ? cacheBust(baseUrl) : baseUrl;
    }
    if (file.url) return file.url;
    return '';
  }

  async function detectBackendOrigin() {
    const protocol = window.location.protocol || 'http:';
    const hostname = window.location.hostname || 'localhost';
    const ports = [];
    if (window.location.port) ports.push(window.location.port);
    ports.push('7777', '3001', '8888');

    const origins = new Set();
    ports.forEach((port) => {
      const suffix = port ? `:${port}` : '';
      origins.add(`${protocol}//${hostname}${suffix}`);
    });
    origins.add(`${protocol}//${hostname}`);
    origins.add('http://localhost:7777');
    origins.add('http://127.0.0.1:7777');

    let lastError;
    for (const origin of origins) {
      try {
        const res = await fetch(`${origin}/api/config`, { mode: 'cors' });
        if (!res.ok) {
          lastError = new Error(`config status ${res.status}`);
          continue;
        }
        const json = await res.json();
        state.backendOrigin = origin;
        state.backendPort = json.port;
        state.backendConfig = json;
        return;
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error('バックエンドサーバーを検出できませんでした');
  }

  function collectImages(node, acc = []) {
    if (!node) return acc;
    if (Array.isArray(node.files)) {
      node.files.filter(file => file.type === 'image').forEach(file => {
        let modifiedMs = 0;
        if (file.modified) {
          if (typeof file.modified === 'number') {
            modifiedMs = file.modified;
          } else {
            const parsed = Date.parse(file.modified);
            if (!Number.isNaN(parsed)) modifiedMs = parsed;
          }
        }
        acc.push({
          name: file.name,
          path: file.path,
          ext: file.ext,
          size: file.size,
          modified: modifiedMs,
          canonical: canonicalizePath(file.path)
        });
      });
    }
    if (Array.isArray(node.folders)) {
      node.folders.forEach(folder => {
        collectImages(folder.items, acc);
      });
    }
    return acc;
  }

  async function fetchImages() {
    if (!state.backendOrigin) throw new Error('backend origin is not resolved');
    const res = await fetch(`${state.backendOrigin}/api/scan`, { mode: 'cors' });
    if (!res.ok) {
      throw new Error(`Failed to fetch scan data (${res.status})`);
    }
    const json = await res.json();
    const raw = collectImages(json.data || json);
    const uniq = new Map();
    raw.forEach(item => {
      if (!item || !item.path) return;
      if (!uniq.has(item.path)) uniq.set(item.path, item);
    });
    state.images = Array.from(uniq.values());
    applyFilters();
  }

  function applyFilters() {
    const keyword = state.searchKeyword;
    const unique = new Map();
    state.images.forEach(item => {
      if (!item || !item.path) return;
      const key = item.canonical || canonicalizePath(item.path);
      if (!unique.has(key)) {
        unique.set(key, item);
      }
    });
    let list = Array.from(unique.values());
    if (keyword) {
      const lower = keyword.toLowerCase();
      list = list.filter(item =>
        item.name.toLowerCase().includes(lower) ||
        (item.path && item.path.toLowerCase().includes(lower))
      );
    }
    switch (state.sortMode) {
      case 'newest':
        list.sort((a, b) => (b.modified || 0) - (a.modified || 0));
        break;
      case 'oldest':
        list.sort((a, b) => (a.modified || 0) - (b.modified || 0));
        break;
      default:
        list.sort((a, b) => a.name.localeCompare(b.name));
    }
    state.filteredImages = list;
    renderImageList();
  }

  function setStatus(message, tone = 'neutral') {
    els.status.textContent = message;
    els.status.dataset.tone = tone || 'neutral';
  }

  function setProcessing(isProcessing) {
    state.isProcessing = isProcessing;
    els.runButton.disabled = isProcessing || !state.backendOrigin || !state.selectedImagePath || !els.prompt.value.trim();
    if (els.engineSelect) els.engineSelect.disabled = isProcessing;
    if (els.prompt) els.prompt.disabled = isProcessing;
    if (isProcessing) {
      els.runButton.textContent = '処理中...';
      setStatus('編集ジョブを送信しました。', 'info');
    } else {
      els.runButton.textContent = '編集を開始';
    }
  }

  function updateRunButtonState() {
    if (state.isProcessing) return;
    const ready = Boolean(state.backendOrigin && state.selectedImagePath && els.prompt.value.trim());
    els.runButton.disabled = !ready;
  }

  function renderImageList() {
    const list = state.filteredImages || [];
    els.sourceList.innerHTML = '';
    if (!list.length) {
      const empty = document.createElement('div');
      empty.className = 'irs-empty';
      empty.textContent = '画像が見つかりません';
      els.sourceList.appendChild(empty);
      return;
    }

    list.forEach((image) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'irs-source-card';
      card.dataset.path = image.path;
      const rawThumbSrc = state.backendOrigin
        ? `${state.backendOrigin}/${encodePath(image.path)}`
        : '';
      const thumbSrc = rawThumbSrc ? cacheBust(rawThumbSrc) : '';
      card.innerHTML = `
        <div class="irs-source-card__thumb">
          ${thumbSrc ? `<img src="${thumbSrc}" alt="${image.name}">` : ''}
          ${thumbSrc ? '<button type="button" class="irs-source-card__preview" title="拡大表示">⤢</button>' : ''}
        </div>
        <div class="irs-source-card__meta">
          <span class="irs-source-card__name" title="${image.name}">${image.name}</span>
        </div>
      `;
      if (image.path === state.selectedImagePath) {
        card.classList.add('is-active');
      }
      card.addEventListener('click', () => {
        state.selectedImagePath = image.path;
        renderImageList();
        updateRunButtonState();
        renderBeforePreview();
      });
      if (thumbSrc) {
        const previewBtn = card.querySelector('.irs-source-card__preview');
        previewBtn?.addEventListener('click', (e) => {
          e.stopPropagation();
          openImageModal(rawThumbSrc, image.name, { filename: extractFilename(image.path) || image.name });
        });
      }
      els.sourceList.appendChild(card);
    });
  }

  function renderBeforePreview() {
    els.beforeContainer.innerHTML = '';
    if (!state.selectedImagePath) {
      els.beforeContainer.innerHTML = '<p class="irs-placeholder">画像を選択してください</p>';
      return;
    }
    if (state.backendOrigin) {
      const rawUrl = `${state.backendOrigin}/${encodePath(state.selectedImagePath)}`;
      const url = cacheBust(rawUrl);
      const filename = extractFilename(state.selectedImagePath);
      const img = document.createElement('img');
      img.src = url;
      img.alt = state.selectedImagePath;
      img.title = filename;
      img.addEventListener('click', () => openImageModal(rawUrl, '元画像', { filename }));
      els.beforeContainer.appendChild(img);
    } else {
      els.beforeContainer.innerHTML = '<p class="irs-placeholder">バックエンド未検出のためプレビューできません</p>';
    }
  }

  function renderAfterPreview(imageData) {
    els.afterContainer.innerHTML = '';
    if (!imageData) {
      els.afterContainer.innerHTML = '<p class="irs-placeholder">生成結果がここに表示されます</p>';
      return;
    }
    let displayUrl;
    let remoteUrl = null;
    let savedFiles = [];
    if (typeof imageData === 'string') {
      displayUrl = imageData;
      remoteUrl = imageData;
    } else {
      displayUrl = imageData.displayUrl;
      remoteUrl = imageData.remoteUrl || imageData.displayUrl;
      savedFiles = imageData.savedFiles || [];
    }
    if (!displayUrl) {
      displayUrl = remoteUrl;
    }
    if (!displayUrl) {
      els.afterContainer.innerHTML = '<p class="irs-placeholder">生成結果がここに表示されます</p>';
      return;
    }
    const baseForName = remoteUrl || displayUrl;
    const fallbackName = baseForName && !/^data:/i.test(baseForName) ? extractFilename(baseForName) : '';
    const primaryFilename = savedFiles.map(f => f && f.fileName).find(Boolean) || fallbackName;
    const img = document.createElement('img');
    img.src = cacheBust(displayUrl);
    img.alt = 'Edited result';
    img.classList.add('irs-after-image');
    if (primaryFilename) {
      img.title = primaryFilename;
    }
    img.addEventListener('click', () => openImageModal(remoteUrl || displayUrl, '編集結果', { filename: primaryFilename }));
    els.afterContainer.appendChild(img);
    if (savedFiles.length) {
      img.dataset.savedUrls = JSON.stringify(savedFiles.map(f => buildSavedFileUrl(f, true)).filter(Boolean));
    }
  }

  function pushHistory(entry) {
    state.history.unshift(entry);
    if (state.history.length > 12) {
      state.history.length = 12;
    }
    saveHistoryToStorage(state.history);
    renderHistory();
  }

  function renderHistory() {
    els.history.innerHTML = '';
    if (!state.history.length) {
      els.history.innerHTML = '<p class="irs-placeholder">まだ履歴がありません</p>';
      return;
    }
    state.history.forEach((entry, index) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'irs-history-card';
      const thumbUrl = cacheBust(entry.displayUrl || entry.imageUrl);
      const savedLabel = entry.savedLabel ? `<span class="irs-history-card__path" title="${entry.savedLabel}">${entry.savedLabel}</span>` : '';
      const promptBlock = entry.prompt
        ? `<div class="irs-history-card__prompt" title="${entry.prompt}">${entry.prompt}</div>`
        : '';
      card.innerHTML = `
        <div class="irs-history-card__thumb">
          ${thumbUrl ? `<img src="${thumbUrl}" alt="result-${index}">` : ''}
        </div>
        <div class="irs-history-card__meta">
          <div class="irs-history-card__row">
            <span class="irs-history-card__engine">${entry.engineLabel}</span>
            <span class="irs-history-card__time">${entry.timeLabel || ''}</span>
          </div>
          ${savedLabel}
          ${promptBlock}
        </div>
      `;
      const meta = card.querySelector('.irs-history-card__meta');
      const actions = document.createElement('div');
      actions.className = 'irs-history-card__actions';
      const hideBtn = document.createElement('button');
      hideBtn.type = 'button';
      hideBtn.className = 'irs-history-card__icon-button';
      hideBtn.title = '履歴から非表示';
      hideBtn.innerHTML = '×';
      hideBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!window.confirm('この履歴を非表示にしますか？')) return;
        state.history.splice(index, 1);
        saveHistoryToStorage(state.history);
        renderHistory();
        setStatus('履歴を非表示にしました', 'info');
      });
      actions.appendChild(hideBtn);
      meta.appendChild(actions);
      card.addEventListener('click', () => {
        const savedUrls = Array.isArray(entry.savedFiles)
          ? entry.savedFiles.map(f => buildSavedFileUrl(f, true)).filter(Boolean)
          : [];
        const modalUrl = savedUrls[0] || entry.displayUrl || entry.imageUrl;
        const fallback = modalUrl && !/^data:/i.test(modalUrl) ? extractFilename(modalUrl) : '';
        const historyFilename = Array.isArray(entry.savedFiles)
          ? entry.savedFiles.map(f => f && f.fileName).find(Boolean) || fallback
          : fallback;
        if (modalUrl) {
          openImageModal(modalUrl, `${entry.engineLabel} 結果`, { filename: historyFilename });
        }
      });
      els.history.appendChild(card);
    });
  }

  async function runEdit() {
    if (!state.backendOrigin) {
      setStatus('バックエンドに接続できません。再読み込みしてください。', 'error');
      return;
    }
    if (!state.selectedImagePath || state.isProcessing) return;
    const originalSelection = state.selectedImagePath;
    const payload = {
      engine: state.engine,
      prompt: els.prompt.value.trim(),
      sourcePath: state.selectedImagePath,
      options: {
        seed: Math.floor(Math.random() * 1_000_000_000)
      }
    };

    setProcessing(true);
    els.logContent.textContent = 'ジョブを実行中...';
    try {
      const res = await fetch(`${state.backendOrigin}/api/image-remix/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'cors'
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API error ${res.status}: ${text}`);
      }
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || '編集に失敗しました');
      }
      const savedFiles = Array.isArray(json.savedFiles) ? json.savedFiles : [];
      const remoteUrl = json.images && json.images.length ? json.images[0].url : null;
      const displayUrl = savedFiles.length ? buildSavedFileUrl(savedFiles[0]) : remoteUrl;
      renderAfterPreview({
        displayUrl,
        remoteUrl,
        savedFiles
      });
      els.logContent.textContent = (json.logs || []).join('\n\n');
      const finishedAt = new Date();
      const savedLabel = savedFiles.map((file) => file.fileName || '').filter(Boolean).join(', ');
      const timeLabel = finishedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const historyEntry = {
        imageUrl: remoteUrl,
        displayUrl,
        engineLabel: json.engine === 'seedream' ? 'Seedream' : 'Nano Banana',
        timeLabel,
        logs: json.logs || [],
        prompt: json.prompt,
        requestId: json.requestId,
        savedLabel,
        savedFiles,
        logFile: json.logFile || ''
      };
      pushHistory(historyEntry);
      try {
        await fetchImages();
      } catch (refreshErr) {
        console.error('[ImageRemix] refresh after edit failed', refreshErr);
      }
      state.selectedImagePath = originalSelection;
      renderBeforePreview();
      const labelText = savedFiles.length
        ? savedFiles.map(f => f.fileName || '').filter(Boolean).join(', ')
        : (json.requestId || '完了');
      const statusMsg = savedFiles.length ? `編集が完了しました: ${labelText}` : '編集が完了しました';
      setStatus(statusMsg, 'success');
    } catch (err) {
      console.error('[ImageRemix] failed', err);
      els.logContent.textContent = String(err.message || err);
      setStatus(err.message || 'エラーが発生しました', 'error');
      renderAfterPreview(null);
    } finally {
      setProcessing(false);
      updateRunButtonState();
    }
  }

  // Event bindings
  els.searchInput.addEventListener('input', () => {
    state.searchKeyword = els.searchInput.value.trim().toLowerCase();
    applyFilters();
  });

 els.refreshButton.addEventListener('click', async () => {
    setStatus('画像一覧を更新しています...', 'info');
    try {
      await fetchImages();
      setStatus('画像一覧を更新しました', 'success');
    } catch (err) {
      console.error('[ImageRemix] refresh error', err);
      setStatus('画像一覧の取得に失敗しました', 'error');
    }
  });

  els.prompt.addEventListener('input', updateRunButtonState);
  els.sortSelect?.addEventListener('change', () => {
    state.sortMode = els.sortSelect.value;
    applyFilters();
  });

  els.engineSelect?.addEventListener('change', () => {
    state.engine = els.engineSelect.value;
    updateRunButtonState();
  });

  els.runButton.addEventListener('click', runEdit);

  async function bootstrap() {
    try {
      setStatus('バックエンドを検出しています...', 'info');
      await detectBackendOrigin();
      await fetchImages();
      const persistedHistory = loadHistoryFromStorage();
      if (persistedHistory.length) {
        state.history = persistedHistory;
        renderHistory();
      }
      if (els.engineSelect) {
        els.engineSelect.value = state.engine;
        state.engine = els.engineSelect.value;
      }
      if (els.sortSelect) {
        els.sortSelect.value = state.sortMode;
      }
      renderBeforePreview();
      renderAfterPreview(null);
      updateRunButtonState();
      setStatus('');
    } catch (err) {
      console.error('[ImageRemix] init failed', err);
      setStatus('初期化に失敗しました。バックエンドが起動しているか確認してください。', 'error');
      els.logContent.textContent = String(err.message || err);
      }
    }

    bootstrap();
}
