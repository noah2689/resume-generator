import type { Density, ResumeStyle } from '../types/resume';
import {
  SUPPORTED_DENSITIES,
  SUPPORTED_FONT_FAMILIES,
  SUPPORTED_THEME_COLORS,
  THEME_COLOR_VALUES,
  isDensityToken,
  isFontFamilyToken,
  isThemeColorToken,
  type FontFamilyToken,
  type ThemeColorToken,
} from '../templates/templateStyleTokens';
import styles from './StyleControls.module.css';

/**
 * 样式设置控件（M5）。
 *
 * 依据：docs/ai-context/05_EDITOR_UX_SPEC.md 第 7 节（右侧只包括模板 / 主题色 / 字体 / 密度 / 头像）、
 *       02_MVP_PRODUCT_SPEC.md 第 4 节（固定色板、固定字体组合、三档密度）
 *
 * 职责（严格限定）：
 * - 受控组件：当前值来自 props.style，任何改动上抛一个 StyleChange。
 * - 不持有状态，不读路由，不读 / 写 LocalStorage，不 import sampleResume，不修改 Resume。
 * - 只负责呈现与上抛，不负责解析 token → 具体值：那是 templateStyleTokens.ts 的事。
 *
 * 中文标签（深蓝 / 传统襈线 / 宽松 …）刻意留在这里，**没有**放进 templateStyleTokens.ts：
 * 那个模块只描述 token → CSS 值这一层语义，不是一个样式设置页面的 metadata 系统。
 *
 * 头像（修正后）：
 * - 组件额外接收 `hasAvatar`，由 EditorPage 计算（它才知道完整 profile）。
 * - **即使 hasAvatar 为 false，勾选框也不 disabled**——它仍然是真实的 showAvatar 设置，
 *   只是当前没有头像内容可供显示。所以只给一条说明文字，不夺走用户的设置。
 * - 本组件不知道 profile 长什么样，也不提供任何头像输入入口。
 *
 * 未知 token：
 * 主题色是色块，所以不硬造「未知颜色」的色块，改为显示一条提示（5 个已知色块照常显示、
 * 只是没有一个被选中）；字体与密度是 select，就沿用 M4 的写法补一个 disabled option，
 * 让控件有明确的可见状态而不是空白。三种情况共同遵守：
 * UI 明确告知取值未知 → 预览用安全兜底 → mount 不修改数据、不写回 storage →
 * 用户主动选择已知值后才更新 Resume。
 */

/**
 * 一次样式改动。
 *
 * 只是「四个真实字段」的判别联合，**不是通用 path setter**：
 * `density` 在类型层就只能是三值之一，不靠运行时猜。
 */
export type StyleChange =
  | { field: 'themeColor'; value: string }
  | { field: 'fontFamily'; value: string }
  | { field: 'density'; value: ResumeStyle['density'] }
  | { field: 'showAvatar'; value: boolean };

/** 主题色的中文标签。UI 文案属于本组件，因此不放进 token 模块。 */
const THEME_COLOR_LABELS: Record<ThemeColorToken, string> = {
  navy: '深蓝',
  charcoal: '黑灰',
  blue: '蓝色',
  green: '墨绿',
  burgundy: '酒红',
};

/** 字体 token → 中文标签（05 §7 要求「固定 2～4 个组合」）。 */
const FONT_FAMILY_LABELS: Record<FontFamilyToken, string> = {
  'noto-sans-sc': '现代无衬线',
  'noto-serif-sc': '传统衬线',
};

/** 密度 token → 中文标签（05 §7 的「宽松 / 标准 / 紧凑」）。 */
const DENSITY_LABELS: Record<Density, string> = {
  loose: '宽松',
  standard: '标准',
  compact: '紧凑',
};

const FONT_FAMILY_SELECT_ID = 'style-font-family';
const DENSITY_SELECT_ID = 'style-density';
const SHOW_AVATAR_CHECKBOX_ID = 'style-show-avatar';
const THEME_COLOR_GROUP_ID = 'style-theme-color-label';

interface StyleControlsProps {
  /** 当前样式设置（Resume.style）。 */
  style: ResumeStyle;
  /**
   * 当前简历是否真的有头像内容。
   *
   * 由 EditorPage 计算后传入，本组件不接收完整 profile。
   * 只用于决定要不要显示那条说明文字，**不影响勾选框的可用性**。
   */
  hasAvatar: boolean;
  onChange: (change: StyleChange) => void;
}

export default function StyleControls({
  style,
  hasAvatar,
  onChange,
}: StyleControlsProps) {
  const hasKnownThemeColor = isThemeColorToken(style.themeColor);
  const hasKnownFontFamily = isFontFamilyToken(style.fontFamily);
  const hasKnownDensity = isDensityToken(style.density);

  return (
    <section className={styles.wrapper}>
      <h2 className={styles.title}>样式</h2>

      {/* ---------- 主题色 ---------- */}
      <div className={styles.group} role="group" aria-labelledby={THEME_COLOR_GROUP_ID}>
        <span className={styles.groupLabel} id={THEME_COLOR_GROUP_ID}>
          主题色
        </span>
        <div className={styles.swatches}>
          {SUPPORTED_THEME_COLORS.map((token) => (
            // 受控 radio：选中与否完全由 style.themeColor 决定。
            // 当前值不受支持时，5 个色块会全部处于未选中状态。
            <label key={token} className={styles.swatch}>
              <input
                className={styles.swatchInput}
                type="radio"
                name="style-theme-color"
                value={token}
                checked={style.themeColor === token}
                onChange={() => onChange({ field: 'themeColor', value: token })}
                style={{ background: THEME_COLOR_VALUES[token] }}
              />
              <span className={styles.swatchName}>{THEME_COLOR_LABELS[token]}</span>
            </label>
          ))}
        </div>
        {!hasKnownThemeColor && (
          <p className={styles.hint}>当前主题色不受支持，预览已使用深蓝兜底。</p>
        )}
      </div>

      {/* ---------- 字体 ---------- */}
      <div className={styles.group}>
        <label className={styles.groupLabel} htmlFor={FONT_FAMILY_SELECT_ID}>
          字体
        </label>
        <select
          id={FONT_FAMILY_SELECT_ID}
          className={styles.select}
          value={style.fontFamily}
          onChange={(event) =>
            onChange({ field: 'fontFamily', value: event.target.value })
          }
        >
          {!hasKnownFontFamily && (
            <option value={style.fontFamily} disabled>
              未知字体（已回退为现代无衬线）
            </option>
          )}
          {SUPPORTED_FONT_FAMILIES.map((token) => (
            <option key={token} value={token}>
              {FONT_FAMILY_LABELS[token]}
            </option>
          ))}
        </select>
      </div>

      {/* ---------- 密度 ---------- */}
      <div className={styles.group}>
        <label className={styles.groupLabel} htmlFor={DENSITY_SELECT_ID}>
          密度
        </label>
        <select
          id={DENSITY_SELECT_ID}
          className={styles.select}
          value={style.density}
          onChange={(event) => {
            // 可选项只有三个已知档位（未知值渲染为 disabled option），
            // 这里用守卫再收一次口，因此 StyleChange 的 density 分支
            // 在类型层就只能是三值之一，不需要断言。
            const nextDensity = event.target.value;
            if (isDensityToken(nextDensity)) {
              onChange({ field: 'density', value: nextDensity });
            }
          }}
        >
          {!hasKnownDensity && (
            <option value={style.density} disabled>
              未知密度（已回退为标准）
            </option>
          )}
          {SUPPORTED_DENSITIES.map((token) => (
            <option key={token} value={token}>
              {DENSITY_LABELS[token]}
            </option>
          ))}
        </select>
      </div>

      {/* ---------- 头像 ---------- */}
      <div className={styles.group}>
        <div className={styles.checkboxRow}>
          <input
            id={SHOW_AVATAR_CHECKBOX_ID}
            className={styles.checkbox}
            type="checkbox"
            checked={style.showAvatar === true}
            onChange={(event) =>
              onChange({ field: 'showAvatar', value: event.target.checked })
            }
          />
          <label className={styles.checkboxLabel} htmlFor={SHOW_AVATAR_CHECKBOX_ID}>
            显示头像
          </label>
        </div>
        {!hasAvatar && (
          <p className={styles.hint}>
            当前简历没有头像数据，开关暂不会改变预览。
          </p>
        )}
      </div>
    </section>
  );
}
