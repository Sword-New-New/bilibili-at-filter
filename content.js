(() => {
  'use strict';

  const components = [
    'bili-comments',
    'bili-comment-thread-renderer',
    'bili-comment-renderer',
    'bili-comment-replies-renderer',
    'bili-comment-reply-renderer',
    'bili-rich-text',
  ].join(',');
  const observed = new WeakSet();
  const hidden = new WeakMap();
  let scheduled = false;

  function filter(comment) {
    // 只读取正文，不匹配昵称、头像 URL 或下方的回复。
    const contents = comment.shadowRoot
      ?.querySelector('bili-rich-text')
      ?.shadowRoot?.querySelector('#contents');
    if (!contents) return;

    const text = contents.textContent;
    const shouldHide = text.includes('@') && !/^\s*回复\s*@/.test(text);
    if (shouldHide) {
      if (!hidden.has(comment)) {
        hidden.set(comment, {
          value: comment.style.getPropertyValue('display'),
          priority: comment.style.getPropertyPriority('display'),
        });
      }
      comment.style.setProperty('display', 'none', 'important');
    } else if (hidden.has(comment)) {
      // 页面复用评论节点时，恢复已不再命中规则的评论。
      const original = hidden.get(comment);
      if (original.value) {
        comment.style.setProperty('display', original.value, original.priority);
      } else {
        comment.style.removeProperty('display');
      }
      hidden.delete(comment);
    }
  }

  function scan(root) {
    if (root !== document && !observed.has(root)) {
      new MutationObserver(schedule).observe(root, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      observed.add(root);
    }

    for (const element of root.querySelectorAll(components)) {
      if (!element.shadowRoot) continue;
      if (element.matches('bili-comment-renderer, bili-comment-reply-renderer')) {
        filter(element);
      }
      // B 站新版评论使用多层 Shadow DOM，逐层进入。
      scan(element.shadowRoot);
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      scan(document);
    });
  }

  scan(document);
  // attachShadow 本身不会触发外层观察器，补查延迟初始化的组件。
  setInterval(schedule, 1000);
})();
