import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
/*
 * 自托管中文字体（M6b）。
 *
 * 这两个包各自声明 100+ 条带 `unicode-range` 的 @font-face，
 * 浏览器只会下载页面真实用到的那些子集，因此不会一次性拉走几 MB 全量字体。
 *
 * 为什么在这里引入、而不是各模板 CSS 里：
 * - 字体是**全局资产**，三个模板共用，放在模块 CSS 里会变成三份重复引入。
 * - `wght.css` 是 variable 轴入口（font-weight 100 900 一个文件覆盖全部字重）；
 *   引入 `index.css` 会展开成「每个字重 × 每个子集」的静态实例，体积成倍增长。
 * - 必须排在 `./styles/global.css` 之前：@font-face 先注册，
 *   后面所有引用这两个 family 的样式才不会落到 fallback 上。
 *
 * 注意 family 名带 `Variable` 后缀（`'Noto Sans SC Variable'`），
 * 与 token 名（`noto-sans-sc`）不同。映射见 templates/templateStyleTokens.ts。
 */
import '@fontsource-variable/noto-sans-sc/wght.css';
import '@fontsource-variable/noto-serif-sc/wght.css';
import './styles/global.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('找不到 #root 挂载点，请检查 index.html');
}

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
