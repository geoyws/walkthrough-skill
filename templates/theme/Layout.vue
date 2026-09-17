<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import manifest from '../../manifest.json'

const { Layout } = DefaultTheme
const at = manifest.refreshedAt || {}
const root = manifest.root || {}
const subs = manifest.submodules || []
const stamp =
  'Walkthrough refreshed ' + at.local + ' (' + at.tz + ') at ' + root.short +
  ' on ' + root.branch + (root.dirty ? ' \u00b7 dirty' : '')
</script>

<template>
  <Layout>
    <template #layout-bottom>
      <footer class="wt-stamp">
        <p class="wt-stamp-line">{{ stamp }}</p>
        <details v-if="subs.length" class="wt-stamp-subs">
          <summary>Submodules ({{ subs.length }})</summary>
          <ul>
            <li v-for="s in subs" :key="s.path">
              <code>{{ s.path }}</code> at <code>{{ s.sha.slice(0, 10) }}</code>
              <span v-if="s.branch"> ({{ s.branch }})</span>
            </li>
          </ul>
        </details>
      </footer>
    </template>
  </Layout>
</template>

<style scoped>
.wt-stamp {
  border-top: 1px solid var(--vp-c-divider);
  padding: 12px 24px 24px;
  font-size: 12px;
  color: var(--vp-c-text-2);
}
.wt-stamp-line { margin: 0 0 4px; font-family: var(--vp-font-family-mono); }
.wt-stamp-subs ul { margin: 4px 0 0; padding-left: 18px; }
</style>
