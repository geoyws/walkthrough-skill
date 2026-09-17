import { defineConfig } from 'vitepress'

// walkthrough:sidebar:begin
{{SIDEBAR}}
// walkthrough:sidebar:end

export default defineConfig({
  title: '{{TITLE}}',
  description: '{{DESCRIPTION}}',
  base: '{{BASE}}',
  lastUpdated: true,
  cleanUrls: false,
  ignoreDeadLinks: true,
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/reading-order' },
      { text: 'Areas', link: '{{AREAS_LINK}}' },
      { text: 'Generated', link: '/generated/inventory' },
    ],
    sidebar,
    outline: [2, 3],
    search: { provider: 'local' },
  },
})
