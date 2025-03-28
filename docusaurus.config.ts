import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'ZhengMao.Ye',
  favicon: 'img/favicon.ico',

  // Set the production url of your site here
  url: 'https://yezhem.com',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'yezhengmao1', // Usually your GitHub org/user name.
  projectName: 'blog', // Usually your repo name.

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'zh-Hans',
    locales: ['zh-Hans', 'en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl: undefined,
          remarkPlugins: [remarkMath],
          rehypePlugins: [rehypeKatex]
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl: undefined,
          // Useful options to enforce blogging best practices
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
          remarkPlugins: [remarkMath],
          rehypePlugins: [rehypeKatex]
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    // image: 'img/docusaurus-social-card.jpg',
    colorMode: {
      defaultMode: 'light',
    },
    navbar: {
      title: 'ZhengMao.Ye',
      logo: {
        src: 'img/favicon.ico',
      },
      items: [
        { to: '/', label: 'About.Me', position: 'left' },
        { to: '/docs', label: 'Article', position: 'right' },
        { to: '/blog', label: 'Blog', position: 'right' },
        { to: '/project', label: 'Projects', position: 'right' },
        { to: '/publication', label: "Publications", position: 'right' },
      ],
    },
    footer: {
      style: 'light',
      copyright: `Copyright © ${new Date().getFullYear()} ZhengMao.Ye. ICP备案号：<a href="https://beian.miit.gov.cn/" target="_blank">蜀ICP备2021000119号-1</a>.`,
    },
    prism: {
      theme: prismThemes.nightOwlLight,
      additionalLanguages: ['c', 'cpp', 'rust', 'python', 'json', 'yaml'],
    },
  } satisfies Preset.ThemeConfig,

  stylesheets: [
    {
      href: 'https://cdn.jsdelivr.net/npm/katex@0.13.24/dist/katex.min.css',
      type: 'text/css',
      integrity:
        'sha384-odtC+0UGzzFL/6PNoE8rX/SPcQDXBJ+uRepguP4QkPCm2LBxH3FA3y+fKSiJ+AmM',
      crossorigin: 'anonymous',
    },
  ],

  scripts: [
    {
      src: 'https://shynet.yezhem.com/ingress/6622bce5-62e5-4eed-bda1-f3eb70420e8a/script.js',
      async: true,
    },
  ]
};

export default config;
