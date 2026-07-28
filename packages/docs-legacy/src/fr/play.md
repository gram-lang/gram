---
layout: page
sidebar: false
title: Playground
---

<div class="playground-container">
  <GramPlayground />
</div>

<style>

/* Custom container mimicking Vitepress home page */
.playground-container {
  margin: 0 auto;
  max-width: calc(var(--vp-layout-max-width) - 64px);
  padding: 0 24px;
}

@media (min-width: 960px) {
  .playground-container {
    padding: 0;
  }
}
</style>
