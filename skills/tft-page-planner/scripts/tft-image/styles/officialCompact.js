const PAGE_CONFIG = {
  width: 900,
  height: 1200,
  imageFormat: 'png',
};

const PAGE_STYLE = {
  fontFamily: '"Chakra Petch", "Microsoft YaHei", Arial, sans-serif',
  fontSize: '30px',
  lineHeight: '1.9',
};

const PAGE_THEME = {
  baseBg: '#18121F',
  bodyBg: '#120F1F',
  panel: '#231C39',
  panelRaised: '#2D2550',
  panelEdge: '#4B4996',
  text: '#F4EEFF',
  muted: '#D5CFF3',
  title: '#FFF38A',
  purpleLight: '#A589F2',
  purpleDeep: '#4B4996',
  auroraGreen: '#B1FF91',
  accentPink: '#FF8E8E',
  border: 'rgba(165, 137, 242, 0.34)',
  borderSoft: 'rgba(244, 238, 255, 0.08)',
  glow: 'rgba(165, 137, 242, 0.28)',
  shadow: 'rgba(9, 8, 24, 0.46)',
};

function buildPagedCss({ h1BackgroundImagePath = '' } = {}) {
  return `
  :root {
    --base-bg: ${PAGE_THEME.baseBg};
    --body-bg: ${PAGE_THEME.bodyBg};
    --panel: ${PAGE_THEME.panel};
    --panel-raised: ${PAGE_THEME.panelRaised};
    --panel-edge: ${PAGE_THEME.panelEdge};
    --text: ${PAGE_THEME.text};
    --muted: ${PAGE_THEME.muted};
    --title: ${PAGE_THEME.title};
    --purple-light: ${PAGE_THEME.purpleLight};
    --purple-deep: ${PAGE_THEME.purpleDeep};
    --aurora-green: ${PAGE_THEME.auroraGreen};
    --accent-pink: ${PAGE_THEME.accentPink};
    --border: ${PAGE_THEME.border};
    --border-soft: ${PAGE_THEME.borderSoft};
    --glow: ${PAGE_THEME.glow};
    --shadow: ${PAGE_THEME.shadow};
  }

  html, body {
    margin: 0;
    padding: 0;
    background: transparent;
  }

  body {
    min-height: 100vh;
  }

  .tft-page {
    width: ${PAGE_CONFIG.width}px;
    min-height: ${PAGE_CONFIG.height}px;
    margin: 0;
    padding: 0;
    position: relative;
    overflow: hidden;
    font-family: ${PAGE_STYLE.fontFamily};
    font-size: ${PAGE_STYLE.fontSize};
    line-height: ${PAGE_STYLE.lineHeight};
    background-color: var(--base-bg);
    background-image:
      linear-gradient(180deg,
        rgba(167, 139, 250, 0.10) 0%,
        rgba(91, 33, 182, 0.18) 24%,
        rgba(18, 9, 31, 0.10) 62%,
        rgba(18, 9, 31, 0) 100%
      ),
      linear-gradient(180deg,
        rgba(18, 9, 31, 0) 0%,
        rgba(18, 9, 31, 0.24) 76%,
        rgba(88, 72, 140, 0.32) 100%
      ),
      radial-gradient(circle at top, rgba(139, 92, 246, 0.22) 0%, rgba(139, 92, 246, 0.08) 30%, transparent 60%),
      linear-gradient(180deg, #140B22 0%, #12091F 42%, #100817 100%),
      radial-gradient(circle, rgba(255,255,255,0.08) 2px, transparent 2px);
    background-size: auto, auto, auto, auto, 26px 26px;
    background-repeat: no-repeat, no-repeat, no-repeat, no-repeat, repeat;
    background-attachment: fixed;
    color: var(--text);
  }

  .tft-page[data-page="1"]::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, rgba(255, 142, 142, 0.10) 0%, var(--accent-pink) 18%, var(--purple-light) 46%, var(--aurora-green) 74%, rgba(177, 255, 145, 0.10) 100%);
    box-shadow: 0 0 18px rgba(165, 137, 242, 0.30);
    z-index: 12;
  }

  .tft-page > * {
    position: relative;
    z-index: 1;
  }

  .h1-container {
    margin: 0;
    padding: 80px 48px 72px 48px;
    position: relative;
    overflow: hidden;

    ${h1BackgroundImagePath ? `
    background-image:
      linear-gradient(160deg,
        rgba(18, 15, 31, 0.76) 0%,
        rgba(24, 18, 31, 0.42) 34%,
        rgba(75, 73, 150, 0.24) 62%,
        rgba(18, 15, 31, 0.72) 100%
      ),
      url('${h1BackgroundImagePath}');
    background-size: cover, cover;
    background-position: center, center 28%;
    background-repeat: no-repeat, no-repeat;
    ` : `
    background:
      radial-gradient(circle at 24% 10%, rgba(165, 137, 242, 0.46), transparent 34%),
      radial-gradient(circle at 82% 20%, rgba(255, 142, 142, 0.18), transparent 26%),
      radial-gradient(circle at 78% 74%, rgba(177, 255, 145, 0.10), transparent 18%),
      linear-gradient(160deg,
        rgba(24, 18, 31, 1) 0%,
        rgba(18, 15, 31, 1) 44%,
        rgba(75, 73, 150, 0.62) 100%
      );
    `}

    border-bottom: 1px solid var(--border);
    box-shadow:
      inset 0 -28px 50px rgba(9, 8, 24, 0.34),
      0 10px 36px rgba(9, 8, 24, 0.22);
  }

  .h1-container::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      linear-gradient(90deg, rgba(12, 10, 27, 0.32), transparent 36%, transparent 64%, rgba(12, 10, 27, 0.28)),
      radial-gradient(circle at 18% 22%, rgba(165, 137, 242, 0.18), transparent 22%),
      radial-gradient(circle at 86% 30%, rgba(255, 142, 142, 0.16), transparent 14%),
      radial-gradient(circle at 78% 78%, rgba(177, 255, 145, 0.10), transparent 12%);
    pointer-events: none;
  }

  .h1-container::after {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(circle at 14% 16%, rgba(255, 142, 142, 0.92) 0 2px, transparent 3px),
      radial-gradient(circle at 27% 28%, rgba(255, 142, 142, 0.72) 0 3px, transparent 4px),
      radial-gradient(circle at 83% 24%, rgba(177, 255, 145, 0.82) 0 3px, transparent 4px),
      radial-gradient(circle at 90% 18%, rgba(255, 142, 142, 0.72) 0 2px, transparent 3px),
      linear-gradient(90deg, transparent 0%, rgba(165, 137, 242, 0.18) 18%, rgba(255, 142, 142, 0.24) 50%, rgba(177, 255, 145, 0.18) 82%, transparent 100%);
    pointer-events: none;
    opacity: 0.92;
  }

  .h1-container > * {
    position: relative;
    z-index: 1;
  }

  .tags-container {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    margin: 0 0 26px 0;
    align-items: center;
  }

  .tag {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-family: 'Russo One', ${PAGE_STYLE.fontFamily};
    font-size: 24px;
    font-weight: 900;
    letter-spacing: 1.8px;
    text-transform: uppercase;
    color: #FFE8F6;
    background: linear-gradient(135deg,
      rgba(251, 113, 190, 0.96) 0%,
      rgba(236, 72, 153, 0.94) 52%,
      rgba(219, 39, 119, 0.92) 100%
    );
    padding: 7px 20px 8px;
    border: 1px solid rgba(251, 113, 190, 0.5);
    border-radius: 999px;
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.08) inset,
      0 6px 18px rgba(236, 72, 153, 0.28);
  }

  h1 {
    font-family: 'Russo One', ${PAGE_STYLE.fontFamily};
    font-size: 106px;
    font-weight: 900;
    margin: 0;
    padding: 0;
    color: var(--title);
    text-align: left;
    letter-spacing: -0.8px;
    line-height: 1.14;
    text-shadow:
      0 2px 0 rgba(20, 18, 55, 0.56),
      0 10px 28px rgba(20, 18, 55, 0.48),
      0 0 26px rgba(165, 137, 242, 0.18);
  }

  h2 {
    font-family: 'Russo One', ${PAGE_STYLE.fontFamily};
    font-size: 36px;
    font-weight: 900;
    margin: 36px 40px 18px 40px;
    padding: 16px 32px 16px 22px;
    color: var(--text);
    background:
      linear-gradient(180deg, rgba(75, 73, 150, 0.60) 0%, rgba(35, 28, 57, 0.94) 100%);
    border-left: 6px solid var(--purple-light);
    border-top: 1px solid rgba(244, 238, 255, 0.08);
    border-bottom: 1px solid rgba(165, 137, 242, 0.42);
    border-right: 1px solid rgba(165, 137, 242, 0.18);
    border-radius: 0 10px 10px 0;
    position: relative;
    box-shadow:
      inset 0 1px 0 rgba(244, 238, 255, 0.08),
      0 10px 24px rgba(9, 8, 24, 0.24);
  }

  h2::after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 52px;
    height: 100%;
    background: linear-gradient(135deg, transparent 0%, rgba(255, 142, 142, 0.20) 100%);
    clip-path: polygon(38% 0, 100% 0, 100% 100%, 0 100%);
  }

  h3 {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    max-width: calc(100% - 80px);
    font-family: '"Chakra Petch"', ${PAGE_STYLE.fontFamily};
    font-size: 32px;
    font-weight: 900;
    line-height: 1.15;
    margin: 20px 40px 12px 40px;
    padding: 8px 24px 9px 20px;
    color: var(--aurora-green);
    background: linear-gradient(135deg,
      rgba(177, 255, 145, 0.16) 0%,
      rgba(45, 37, 80, 0.96) 34%,
      rgba(75, 73, 150, 0.86) 66%,
      rgba(255, 142, 142, 0.18) 100%
    );
    border: 1px solid rgba(177, 255, 145, 0.56);
    clip-path: polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 18px 100%, 0 calc(100% - 18px));
    position: relative;
    letter-spacing: 1px;
    box-shadow:
      inset 0 1px 0 rgba(177, 255, 145, 0.22),
      inset 0 -12px 20px rgba(9, 8, 24, 0.22),
      0 8px 18px rgba(9, 8, 24, 0.20),
      0 0 16px rgba(177, 255, 145, 0.18),
      0 0 26px rgba(165, 137, 242, 0.10);
    text-shadow:
      0 2px 0 rgba(9, 8, 24, 0.58),
      0 0 12px rgba(177, 255, 145, 0.26);
  }

  p {
    margin: 12px 0;
    padding: 0 40px;
    color: var(--text);
  }

  ul, ol {
    margin: 12px 0;
    padding-left: 72px;
    padding-right: 40px;
    color: var(--text);
  }

  li {
    margin: 10px 0;
    line-height: 1.9;
  }

  ul {
    list-style: none;
  }

  ul li::before {
    content: '◆';
    display: inline-block;
    width: 36px;
    margin-left: -44px;
    color: var(--accent-pink);
    font-size: 18px;
    text-align: center;
    vertical-align: middle;
    text-shadow: 0 0 10px rgba(255, 142, 142, 0.18);
  }

  ul ul li::before {
    content: '◇';
    color: rgba(165, 137, 242, 0.56);
    font-size: 15px;
  }

  ol {
    list-style: none;
    counter-reset: ol-counter;
  }

  ol li {
    counter-increment: ol-counter;
  }

  ol li::before {
    content: counter(ol-counter);
    display: inline-block;
    width: 36px;
    height: 36px;
    margin-left: -50px;
    margin-right: 14px;
    background: linear-gradient(180deg, rgba(165, 137, 242, 0.96) 0%, rgba(75, 73, 150, 0.96) 100%);
    color: var(--base-bg);
    font-family: 'Russo One', ${PAGE_STYLE.fontFamily};
    font-size: 18px;
    font-weight: 900;
    text-align: center;
    line-height: 36px;
    border-radius: 50%;
    box-shadow:
      inset 0 1px 0 rgba(244, 238, 255, 0.28),
      0 4px 12px rgba(9, 8, 24, 0.24);
    vertical-align: middle;
  }

  strong {
    color: var(--aurora-green);
    font-weight: 700;
    text-shadow: 0 0 10px rgba(177, 255, 145, 0.16);
  }

  u {
    color: inherit;
    font-weight: 600;
    text-decoration: underline;
    text-decoration-color: rgba(165, 137, 242, 0.88);
    text-underline-offset: 5px;
    text-decoration-thickness: 2px;
  }

  em {
    color: var(--accent-pink);
    font-style: italic;
  }

  code {
    background: rgba(35, 28, 57, 0.95);
    color: var(--title);
    padding: 2px 8px;
    border-radius: 4px;
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 0.85em;
    border: 1px solid rgba(165, 137, 242, 0.22);
  }

  pre {
    background: linear-gradient(180deg, rgba(35, 28, 57, 0.98) 0%, rgba(24, 18, 31, 0.98) 100%);
    margin: 16px 40px;
    padding: 20px 24px;
    border-radius: 10px;
    overflow-x: auto;
    border: 1px solid rgba(165, 137, 242, 0.20);
    border-top: 2px solid var(--purple-light);
    box-shadow: 0 8px 24px rgba(9, 8, 24, 0.30);
  }

  pre code {
    background: transparent;
    padding: 0;
    color: var(--text);
    border: none;
    font-size: ${PAGE_STYLE.fontSize};
  }

  blockquote {
    margin: 20px 40px;
    padding: 24px 30px 24px 86px;
    position: relative;
    background: linear-gradient(180deg, rgba(53, 43, 86, 0.96) 0%, rgba(28, 23, 52, 0.96) 100%);
    border: 1px solid rgba(165, 137, 242, 0.30);
    border-left: 5px solid var(--accent-pink);
    border-radius: 12px;
    box-shadow:
      inset 0 1px 0 rgba(244, 238, 255, 0.06),
      0 10px 24px rgba(9, 8, 24, 0.24);
  }

  blockquote::before {
    content: '!';
    position: absolute;
    left: 28px;
    top: 50%;
    transform: translateY(-50%);
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: linear-gradient(180deg, rgba(255, 142, 142, 0.98) 0%, rgba(165, 137, 242, 0.98) 100%);
    color: var(--base-bg);
    font-family: 'Russo One', ${PAGE_STYLE.fontFamily};
    font-size: 24px;
    line-height: 34px;
    text-align: center;
    box-shadow: 0 0 14px rgba(255, 142, 142, 0.18);
  }

  blockquote p {
    margin: 0;
    padding: 0;
    color: var(--text);
    font-style: normal;
    font-weight: 500;
  }

  a {
    color: var(--purple-light);
    text-decoration: none;
    border-bottom: 1px solid rgba(165, 137, 242, 0.30);
  }

  hr {
    border: none;
    border-top: 1px solid var(--border-soft);
    margin: 24px 40px;
  }

  img {
    max-width: calc(100% - 80px);
    height: auto;
    display: block;
    margin: 20px 40px;
    border-radius: 10px;
    border: 1px solid rgba(165, 137, 242, 0.16);
    box-shadow: 0 8px 28px rgba(9, 8, 24, 0.38);
  }

  p > img:only-child {
    margin: 20px 0;
  }

  .emoji {
    font-family: 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif;
  }

  table {
    width: calc(100% - 80px);
    margin: 20px 40px;
    border-collapse: collapse;
    background: linear-gradient(180deg, rgba(31, 24, 52, 0.98) 0%, rgba(24, 18, 31, 0.98) 100%);
    border: 1px solid rgba(165, 137, 242, 0.18);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 8px 22px rgba(9, 8, 24, 0.24);
  }

  thead {
    background: linear-gradient(180deg, rgba(90, 84, 165, 0.92) 0%, rgba(75, 73, 150, 0.98) 100%);
    border-bottom: 2px solid rgba(255, 142, 142, 0.32);
  }

  th {
    padding: 14px 18px;
    text-align: left;
    font-weight: 700;
    font-family: 'Russo One', ${PAGE_STYLE.fontFamily};
    color: var(--title);
    font-size: 24px;
    letter-spacing: 0.5px;
    border-bottom: 2px solid rgba(255, 142, 142, 0.24);
  }

  td {
    padding: 12px 18px;
    color: var(--text);
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    font-size: 23px;
  }

  tr:last-child td {
    border-bottom: none;
  }

  tbody tr:nth-child(even) {
    background: rgba(165, 137, 242, 0.05);
  }

  table code {
    font-size: 21px;
  }

  .cover-image {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 28px 0 0 0;
    border-radius: 12px;
    padding: 0;
    border: 1px solid rgba(165, 137, 242, 0.20);
    box-shadow:
      inset 0 1px 0 rgba(244, 238, 255, 0.06),
      0 12px 28px rgba(9, 8, 24, 0.30);
  }
`;
}

export {
  PAGE_CONFIG,
  PAGE_STYLE,
  PAGE_THEME,
  buildPagedCss,
};
