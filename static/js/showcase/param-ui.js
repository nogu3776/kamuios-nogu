import { ensureEngineInputs } from './engine.js';
import { PARAMS_POPOVER_HIDE_DELAY_MS } from './state.js';

let activeParamsPopover = null;
let paramsPopoverCloseTimer = null;

export function getActiveParamsPopover() {
  return activeParamsPopover;
}

export function cancelParamsPopoverClose() {
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
  const elementNode = (window.Node && window.Node.ELEMENT_NODE) || 1;
  const anchorElement = anchorNode.nodeType === elementNode ? anchorNode : anchorNode.parentElement;
  if (!anchorElement) return false;
  return popover.contains(anchorElement);
}

export function isParamsPopoverEngaged() {
  if (!activeParamsPopover) return false;
  const { popover, anchor } = activeParamsPopover;
  if (!popover) return false;
  const pointerInside = typeof popover.matches === 'function' && popover.matches(':hover');
  const focusInside = popover.contains(document.activeElement);
  const selectionInside = paramsPopoverContainsSelection(popover);
  const anchorHovered = anchor && typeof anchor.matches === 'function' && anchor.matches(':hover');
  return Boolean(pointerInside || focusInside || selectionInside || anchorHovered);
}

export function scheduleParamsPopoverClose() {
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

export function closeParamsPopover() {
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

function handlePopoverFocusOut(evt) {
  if (!activeParamsPopover) return;
  const { popover } = activeParamsPopover;
  if (!popover || popover.contains(evt.relatedTarget)) {
    return;
  }
  scheduleParamsPopoverClose();
}

export function openParamsPopover(engineMeta, anchor, options = {}) {
  if (!engineMeta || !anchor) return;
  const { renderParameterFields } = options;
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

  const body = document.createElement('div');
  body.className = 'kc-param-popover__body';
  if (typeof renderParameterFields === 'function') {
    renderParameterFields(engineMeta, body);
  } else {
    body.textContent = '詳細設定を読み込めませんでした';
  }

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

  fragments.forEach((fragment) => popover.append(fragment));

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
