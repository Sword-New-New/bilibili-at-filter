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
    // 主楼与回复是线程内的兄弟节点，隐藏整个线程才能一起隐藏。
    const host = comment.getRootNode().host;
    const target = comment.matches('bili-comment-renderer')
      && host?.matches('bili-comment-thread-renderer') ? host : comment;
    if (shouldHide) {
      if (!hidden.has(target)) {
        hidden.set(target, {
          value: target.style.getPropertyValue('display'),
          priority: target.style.getPropertyPriority('display'),
        });
      }
      target.style.setProperty('display', 'none', 'important');
    } else if (hidden.has(target)) {
      // 页面复用评论或线程节点时，恢复已不再命中的内容。
      const original = hidden.get(target);
      if (original.value) {
        target.style.setProperty('display', original.value, original.priority);
      } else {
        target.style.removeProperty('display');
      }
      hidden.delete(target);
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
