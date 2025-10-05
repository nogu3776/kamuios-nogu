const DEFAULT_BLOCKED_SEGMENTS = [
  '/_showcase/',
  'static/data/kamui-code/',
  'data/kamui-code/'
];

const DEFAULT_MEDIA_SEGMENTS = [
  '/static/images/',
  '/images/',
  '/static/videos/',
  '/videos/'
];

const DEFAULT_MEDIA_EXTENSION_PATTERN = /\.(png|jpe?g|webp|gif|bmp|tiff|heic|heif|mp4|mov|webm|mkv|avi|m4v|wmv|mp3|wav|ogg|m4a|aac|flac|opus)(?:[?#]|$)/;

const DEFAULT_TIMESTAMP_TOKEN = /_[0-9]{8}-[0-9]{4}[_\.]/;

const DEFAULT_BLOCKED_RESOURCE_TOKENS = ['livereload', '__livereload', 'update-client'];

function toLowerArray(values = []) {
  return values
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
}

function normalizePath(value) {
  if (!value || typeof value !== 'string') return '';
  return value.replace(/\\/g, '/').toLowerCase();
}

function installLiveReloadGuard(options = {}) {
  if (typeof window === 'undefined') return;
  if (typeof window.WebSocket === 'undefined') return;
  if (window.__kcLiveReloadGuardInstalled) return;

  const config = {
    alwaysBlockReload: Boolean(options.alwaysBlockReload),
    blockedSegments: toLowerArray(
      [...DEFAULT_BLOCKED_SEGMENTS, ...(options.blockedSegments || [])]
    ),
    mediaSegments: toLowerArray(
      [...DEFAULT_MEDIA_SEGMENTS, ...(options.mediaSegments || [])]
    ),
    mediaExtensionPattern: options.mediaExtensionPattern || DEFAULT_MEDIA_EXTENSION_PATTERN,
    timestampToken: options.timestampToken || DEFAULT_TIMESTAMP_TOKEN,
    blockedResourceTokens: toLowerArray(
      [...DEFAULT_BLOCKED_RESOURCE_TOKENS, ...(options.blockedResourceTokens || [])]
    )
  };

  const NativeWebSocket = window.WebSocket;
  const NativeEventSource = window.EventSource;

  const isLiveReloadUrl = (value) => {
    if (!value) return false;
    const stringValue = typeof value === 'string' ? value : (value?.url || '');
    if (!stringValue) return false;
    const lower = String(stringValue).toLowerCase();
    return config.blockedResourceTokens.some((token) => lower.includes(token));
  };

  const shouldBlockReload = (path) => {
    if (config.alwaysBlockReload) return true;
    if (window.__kcBlockReload) return true;

    const normalized = normalizePath(path);
    if (!normalized) return true;

    if (config.blockedSegments.some((segment) => normalized.includes(segment))) {
      return true;
    }

    if (config.mediaExtensionPattern.test(normalized)) {
      return true;
    }

    if (config.mediaSegments.some((segment) => normalized.includes(segment))) {
      if (config.timestampToken.test(`${normalized}_`) || normalized.includes('_バージョン(v')) {
        return true;
      }
    }

    return false;
  };

  window.__kcBlockReload = Boolean(window.__kcBlockReload);
  window.__kcBlockManualReload = Boolean(window.__kcBlockManualReload);

  const locationProto = window.Location && window.Location.prototype;

  const guardLocationMethod = (methodName, { alwaysBlock = false } = {}) => {
    if (!locationProto) return;
    const flagKey = `__kc${methodName.charAt(0).toUpperCase()}${methodName.slice(1)}Wrapped`;
    if (locationProto[flagKey]) return;
    const native = locationProto[methodName];
    if (typeof native !== 'function') return;
    const descriptor = Object.getOwnPropertyDescriptor(locationProto, methodName);
    const canOverride = !descriptor || descriptor.writable || typeof descriptor.set === 'function';
    if (!canOverride) {
      try {
        Object.defineProperty(locationProto, flagKey, {
          configurable: false,
          enumerable: false,
          value: true
        });
      } catch (_) {
        /* ignore */
      }
      return;
    }

    const bound = native.bind(window.location);
    const forceKey = `__kcForce${methodName.charAt(0).toUpperCase()}${methodName.slice(1)}`;
    if (!window[forceKey]) {
      window[forceKey] = (...args) => bound(...args);
    }

    const safeDispatchEvent = (evt) => {
      try {
        if (evt && typeof evt.stopImmediatePropagation === 'function') {
          evt.stopImmediatePropagation();
        }
        if (evt && typeof evt.preventDefault === 'function') {
          evt.preventDefault();
        }
      } catch (_) {
        /* ignore */
      }
    };

    try {
      locationProto[methodName] = function guardedLocationMethod(...args) {
        if (alwaysBlock || window.__kcBlockReload || config.alwaysBlockReload) {
          if (args && args.length) {
            safeDispatchEvent(args[0]);
          }
          return undefined;
        }
        return native.apply(this, args);
      };
      Object.defineProperty(locationProto, flagKey, {
        configurable: false,
        enumerable: false,
        value: true
      });
    } catch (err) {
      console.info(`[Showcase] location.${methodName} override failed`, err);
    }
  };

  guardLocationMethod('reload', { alwaysBlock: true });
  guardLocationMethod('assign');
  guardLocationMethod('replace');
  const socketListenerMap = new WeakMap();

  const recordBlockedReload = (path) => {
    const normalized = typeof path === 'string' ? path : '';
    window.__kcLastBlockedReload = normalized;
    window.__kcLastBlockedReloadAt = Date.now();
    window.__kcLiveReloadSuppressed = true;
  };

  const extractReloadPath = (payload) => {
    if (typeof payload === 'string') return payload;
    if (payload && typeof payload === 'object') {
      if (typeof payload.path === 'string') return payload.path;
      if (typeof payload.url === 'string') return payload.url;
      if (typeof payload.href === 'string') return payload.href;
    }
    return '';
  };

  const interceptReloadCommand = (event) => {
    if (!event || typeof event.data !== 'string') return false;
    try {
      const parsed = JSON.parse(event.data);
      if (parsed && parsed.command === 'reload') {
        const path = extractReloadPath(parsed);
        if (shouldBlockReload(path)) {
          recordBlockedReload(path);
          return true;
        }
      }
    } catch (_) {
      /* ignore */
    }
    return false;
  };

  const wrapMessageHandler = (handler, socket) => {
    if (typeof handler !== 'function') return handler;
    return function wrapped(event) {
      if (socket?.__kcIsLiveReload && interceptReloadCommand(event)) {
        return undefined;
      }
      return handler.call(this, event);
    };
  };

  const wrapSocketInstance = (socket) => {
    if (!socket || socket.__kcListenerWrapped) return socket;
    socket.__kcListenerWrapped = true;
    const nativeAdd = typeof socket.addEventListener === 'function'
      ? socket.addEventListener.bind(socket)
      : null;
    const nativeRemove = typeof socket.removeEventListener === 'function'
      ? socket.removeEventListener.bind(socket)
      : null;
    const nativeDispatch = typeof socket.dispatchEvent === 'function'
      ? socket.dispatchEvent.bind(socket)
      : null;

    if (nativeAdd) {
      socket.addEventListener = function addEventListener(type, listener, options) {
        if (this.__kcIsLiveReload && type === 'message' && typeof listener === 'function') {
          const wrapped = wrapMessageHandler(listener, this);
          socketListenerMap.set(listener, wrapped);
          return nativeAdd(type, wrapped, options);
        }
        return nativeAdd(type, listener, options);
      };
    }

    if (nativeRemove) {
      socket.removeEventListener = function removeEventListener(type, listener, options) {
        if (this.__kcIsLiveReload && type === 'message' && typeof listener === 'function' && socketListenerMap.has(listener)) {
          const wrapped = socketListenerMap.get(listener);
          socketListenerMap.delete(listener);
          return nativeRemove(type, wrapped, options);
        }
        return nativeRemove(type, listener, options);
      };
    }

    if (nativeDispatch) {
      socket.dispatchEvent = function dispatchEvent(event) {
        if (this.__kcIsLiveReload && event && event.type === 'message' && interceptReloadCommand(event)) {
          return false;
        }
        return nativeDispatch(event);
      };
    }

    Object.defineProperty(socket, 'onmessage', {
      configurable: true,
      enumerable: true,
      get() {
        return this.__kcOnMessageOriginal || null;
      },
      set(value) {
        if (this.__kcOnMessageWrapped && nativeRemove) {
          nativeRemove('message', this.__kcOnMessageWrapped);
          this.__kcOnMessageWrapped = null;
        }
        if (typeof value !== 'function') {
          this.__kcOnMessageOriginal = value;
          this.__kcOnMessageWrapped = null;
          return value;
        }
        const wrapped = wrapMessageHandler(value, this);
        this.__kcOnMessageOriginal = value;
        this.__kcOnMessageWrapped = wrapped;
        if (nativeAdd) {
          nativeAdd('message', wrapped);
        }
        return value;
      }
    });

    return socket;
  };

  const showcaseWebSocketFactory = (...args) => {
    const socket = new NativeWebSocket(...args);
    if (isLiveReloadUrl(args[0])) {
      socket.__kcIsLiveReload = true;
      wrapSocketInstance(socket);
    }
    return socket;
  };

  const ShowcaseWebSocket = new Proxy(showcaseWebSocketFactory, {
    apply(target, thisArg, args) {
      return target(...args);
    },
    construct(target, args) {
      return target(...args);
    }
  });

  if (NativeWebSocket && NativeWebSocket.prototype) {
    ShowcaseWebSocket.prototype = NativeWebSocket.prototype;
    Object.setPrototypeOf(ShowcaseWebSocket, NativeWebSocket);
  }

  window.WebSocket = ShowcaseWebSocket;

  const patchMethod = (target, method) => {
    if (!target || typeof target[method] !== 'function') return;
    const original = target[method];
    if (original.__kcReloadGuard) return;
    const guarded = function guardedReload(...args) {
      const primary = args && args.length ? args[0] : undefined;
      const secondary = args && args.length > 1 ? args[1] : undefined;
      const path = extractReloadPath(primary) || extractReloadPath(secondary);
      if (shouldBlockReload(path)) {
        recordBlockedReload(path);
      }
      return false;
    };
    guarded.__kcReloadGuard = true;
    try {
      Object.defineProperty(target, method, {
        configurable: true,
        enumerable: false,
        writable: true,
        value: guarded
      });
    } catch (_) {
      target[method] = guarded;
    }
  };

  const patchLiveReloadInstance = (instance) => {
    if (!instance || typeof instance !== 'object' || instance.__kcReloadPatched) return;
    patchMethod(instance, 'reload');
    patchMethod(instance, 'performReload');
    if (instance.socket && typeof instance.socket.close === 'function') {
      try {
        instance.socket.close();
      } catch (_) {
        /* ignore */
      }
    }
    if (instance.reloader && typeof instance.reloader === 'object') {
      patchMethod(instance.reloader, 'reload');
      patchMethod(instance.reloader, 'reloadPage');
      patchMethod(instance.reloader, 'reloadPageWithLocation');
    }
    instance.__kcReloadPatched = true;
  };

  const patchLiveReloadPrototype = (ctor) => {
    if (!ctor || typeof ctor !== 'function' || ctor.__kcReloadPatched) return;
    if (ctor.prototype && typeof ctor.prototype === 'object') {
      patchMethod(ctor.prototype, 'reload');
      patchMethod(ctor.prototype, 'performReload');
    }
    ctor.__kcReloadPatched = true;
  };

  const ensureLiveReloadHook = () => {
    try {
      const descriptor = Object.getOwnPropertyDescriptor(window, 'LiveReload');
      if (!descriptor || descriptor.configurable) {
        let current = window.LiveReload;
        try {
          delete window.LiveReload;
        } catch (_) {
          /* ignore */
        }
        Object.defineProperty(window, 'LiveReload', {
          configurable: true,
          enumerable: false,
          get() {
            return current;
          },
          set(value) {
            current = value;
            if (typeof value === 'function') {
              patchLiveReloadPrototype(value);
            } else if (value && typeof value === 'object') {
              patchLiveReloadInstance(value);
            }
          }
        });
        if (typeof current === 'function') {
          patchLiveReloadPrototype(current);
        } else if (current && typeof current === 'object') {
          patchLiveReloadInstance(current);
        }
      } else {
        const value = descriptor.get ? descriptor.get.call(window) : window.LiveReload;
        if (typeof value === 'function') {
          patchLiveReloadPrototype(value);
        } else if (value && typeof value === 'object') {
          patchLiveReloadInstance(value);
        }
      }
    } catch (err) {
      console.info('[Showcase] LiveReload hook install skipped', err);
    }
  };

  ensureLiveReloadHook();
  setTimeout(ensureLiveReloadHook, 0);
  window.addEventListener('load', ensureLiveReloadHook, { once: true });

  if (NativeEventSource && typeof NativeEventSource === 'function') {
    const createDisabledEventSource = () => {
      const noop = () => {};
      return {
        readyState: 2,
        CLOSED: 2,
        OPEN: 1,
        CONNECTING: 0,
        close: noop,
        addEventListener: noop,
        removeEventListener: noop,
        dispatchEvent: () => false,
        onopen: null,
        onmessage: null,
        onerror: null
      };
    };

    const ShowcaseEventSource = function showcaseEventSource(url, init) {
      if (isLiveReloadUrl(url)) {
        return createDisabledEventSource();
      }
      const instance = new NativeEventSource(url, init);
      instance.addEventListener('message', (event) => {
        if (!event || typeof event.data !== 'string') return;
        try {
          const parsed = JSON.parse(event.data);
          if (parsed && parsed.command === 'reload') {
            const path = typeof parsed.path === 'string' ? parsed.path : '';
            if (shouldBlockReload(path)) {
              event.stopImmediatePropagation();
              if (typeof event.preventDefault === 'function') {
                event.preventDefault();
              }
              return;
            }
          }
        } catch (_) {
          /* ignore */
        }
      }, true);
      return instance;
    };

    ShowcaseEventSource.prototype = NativeEventSource.prototype;
    Object.setPrototypeOf(ShowcaseEventSource, NativeEventSource);
    window.EventSource = ShowcaseEventSource;
  }

  const isBlockedResource = (value) => {
    if (!value) return false;
    const lower = String(value).toLowerCase();
    return config.blockedResourceTokens.some((token) => lower.includes(token));
  };

  const removeLiveReloadNodes = (root = document) => {
    if (!root || !root.querySelectorAll) return;
    const selector = 'script[src], link[href], iframe[src]';
    root.querySelectorAll(selector).forEach((node) => {
      const source = node.src || node.href;
      if (isBlockedResource(source)) {
        if (node.parentElement) {
          node.parentElement.removeChild(node);
        }
      }
    });
  };

  if (!window.__kcLiveReloadObserver) {
    removeLiveReloadNodes(document);
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.tagName === 'SCRIPT' || node.tagName === 'LINK' || node.tagName === 'IFRAME') {
            const source = node.src || node.href;
            if (isBlockedResource(source)) {
              node.remove();
              return;
            }
          }
          removeLiveReloadNodes(node);
        });
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.__kcLiveReloadObserver = observer;
  }

  window.__kcLiveReloadGuardInstalled = true;
}

export default installLiveReloadGuard;
