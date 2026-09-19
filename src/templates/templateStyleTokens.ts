import type { Density, ResumeStyle } from '../types/resume';

/**
 * Style Token 解析（M5）。
 *
 * 依据：docs/ai-context/04_TEMPLATE_SYSTEM_SPEC.md 第 5 节（Style Token）、
 *       03_RESUME_DATA_SCHEMA.md 第 10 节（style 只存选项名）、
 *       02_MVP_PRODUCT_SPEC.md 第 4 节（固定色板 / 固定字体组合 / 三档密度）、
 *       05_EDITOR_UX_SPEC.md 第 7 节（右侧样式的五项内容）
 *
 * 职责只有一个：**支持集合 + token → 实际 CSS 值**。
 * 也就是 04 §5 要求的「模板内部把 style token 映射成具体色值 / 字号」这一步。
 *
 * - 输入是 Resume.style 里的选项名（如 `navy` / `noto-sans-sc` / `standard`），
 *   输出是可直接写进 CSS 自定义属性的值。
 * - 不持有状态、无副作用、不读存储、不读路由、不 import React、不 import 任何模板。
 *   因此它可以被三个模板共用，也可以被测试直接调用。
 * - **不含 UI 文案**：中文标签（深蓝 / 传统襈线 / 推荐 / 默认 等）、色块 aria 文案、
 *   控件布局全部属于 StyleControls.tsx。这里只描述 Schema token 的展示语义，
 *   不是一个「样式设置页面的 metadata / config 系统」。
 *
 * 为什么这个映射可以共享，而 buildEntries / formatDate 那类 helper 不共享：
 * 那些 helper 是**渲染**逻辑，重复保留让各模板的展示方式能独立演化（README 决策第 7 条）。
 * 而这里的值是**同一份 Resume.style 的映射**——样式必须由用户选的那个 token 唯一决定。
 * 三处各存一份等于 5 色 + 2 字体 + 3 密度共 30 个值要手动同步，漏一处就是三个模板显示不一致。
 * 这已经是 3 个真实复用场景，符合 06 §5 的抽象门槛。
 *
 * 未知 token（重要）：
 * `storage/resumeStorage.ts` 的校验只确认 `style` 是对象，**不逐字段校验取值**，
 * 因此存储里完全可能出现 `density: "tiny"` 这类值。所以每个解析函数都必须自兜底，
 * 且**绝不调用传入值上的任何方法**（不 `.trim()`、不 `.toLowerCase()`），
 * 一律用相等比较判断——传入数字 / null / 对象时只会「不匹配」，不会抛错。
 * 兜底只影响展示；不修改 Resume、不写回 storage、不做 migration
 * （与 M4 未知 templateId 同一条原则：展示层回退 ≠ 数据迁移）。
 */

/* ---------- 主题色 ---------- */

/**
 * 支持的 5 个主题色 token。
 *
 * 04 §6 的「基础布局 × 主题风格」目前只做到「固定 5 色」这一步；
 * 主题变体（色 × 模板组合成卡片）属于 M8。
 */
export const SUPPORTED_THEME_COLORS = [
  'navy',
  'charcoal',
  'blue',
  'green',
  'burgundy',
] as const;

export type ThemeColorToken = (typeof SUPPORTED_THEME_COLORS)[number];

/**
 * token → 具体色值。
 *
 * navy 沿用 M1 起就写在各模板里的 #1f3a5f，兜底色沿用当时的 #333333，
 * 所以默认值下的渲染结果与 M5 之前逐字节一致。
 * 05 §7 要求「固定 5～8 个颜色」，这里取 5 个，与 02 §4 的示例色板一一对应。
 */
export const THEME_COLOR_VALUES: Record<ThemeColorToken, string> = {
  navy: '#1f3a5f',
  charcoal: '#333333',
  blue: '#2563eb',
  green: '#2f6b4f',
  burgundy: '#7a263a',
};

/** 未知 themeColor 的兜底色：深蓝，保证仍是可读的单色简历。 */
const DEFAULT_THEME_COLOR: ThemeColorToken = 'navy';

/* ---------- 字体 ---------- */

/**
 * 支持的字体 token：2 个（05 §7 要求 2～4 个，取最少）。
 *
 * 只定义白名单与 fallback stack，**不下载、不 embed、不引 webfont、不改 index.html**
 * （04 §7 禁止模板临时引用网络未知字体）。
 *
 * M5 证明的是「style.fontFamily 能稳定控制模板使用哪个白名单 font stack」；
 * 「最终使用哪份可获得、可嵌入、中文不乱码的字体资产」属于 M6 在真实 PDF 环境里解决的问题。
 * 因此浏览器里落到 PingFang SC / Songti SC 等系统 fallback 是可接受的。
 */
export const SUPPORTED_FONT_FAMILIES = ['noto-sans-sc', 'noto-serif-sc'] as const;

export type FontFamilyToken = (typeof SUPPORTED_FONT_FAMILIES)[number];

/** token → font stack。fallback 链写全，不依赖用户电脑安装 Noto 系列。 */
const FONT_FAMILY_VALUES: Record<FontFamilyToken, string> = {
  'noto-sans-sc':
    "'Noto Sans SC', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
  'noto-serif-sc': "'Noto Serif SC', 'Songti SC', 'SimSun', serif",
};

/** 未知 fontFamily 的兜底：现代无衬线。 */
const DEFAULT_FONT_FAMILY: FontFamilyToken = 'noto-sans-sc';

/* ---------- 密度 ---------- */

/**
 * 支持的密度 token：3 档，顺序按 05 §7 的「宽松 / 标准 / 紧凑」。
 *
 * 用 `satisfies` 让编译器保证这里不会写错 types/resume.ts 里的 Density 取值。
 */
export const SUPPORTED_DENSITIES = [
  'loose',
  'standard',
  'compact',
] as const satisfies readonly Density[];

/** 一档密度实际影响的 4 个数值。 */
interface DensityValues {
  /** 正文字号。 */
  bodySize: string;
  /** 正文行高（无单位，相对字号）。 */
  lineHeight: string;
  /** 模块（Section）之间的间距。 */
  sectionGap: string;
  /** 条目（entry）之间的间距。 */
  itemGap: string;
}

/**
 * token → 具体数值。
 *
 * standard 一行就是 04 §5 给出的原值（body 12 / line-height 1.55 / section gap 18 / item gap 10），
 * 也正是 M5 之前三个模板各自硬编码的那套数值。
 *
 * 密度覆盖「字号 / 行高 / 模块间距 / 条目间距」四项——02 §4 的原话，
 * 不让用户分别调几十个数值。
 */
const DENSITY_VALUES: Record<Density, DensityValues> = {
  compact: {
    bodySize: '11px',
    lineHeight: '1.45',
    sectionGap: '14px',
    itemGap: '8px',
  },
  standard: {
    bodySize: '12px',
    lineHeight: '1.55',
    sectionGap: '18px',
    itemGap: '10px',
  },
  loose: {
    bodySize: '13px',
    lineHeight: '1.65',
    sectionGap: '22px',
    itemGap: '13px',
  },
};

/** 未知 density 的兜底：标准。 */
const DEFAULT_DENSITY: Density = 'standard';

/* ---------- 解析结果 ---------- */

/**
 * 一份 Resume.style 解析出的 6 个 CSS 自定义属性。
 *
 * 刻意不 import React 的 CSSProperties：这个模块保持零 UI 依赖，
 * 由各模板在调用处把结果转成 style prop 需要的类型。
 *
 * 为什么走 CSS 自定义属性而不是别的做法（这是 M5 唯一真正生效的方案）：
 * - 只把字号设在 `.paper` 上**不生效**——子元素自己有 `font-size` 声明，
 *   父级的字号不会覆盖子元素自己的声明，密度改了也看不出来。
 * - 自定义属性会**继承**，写在一处、全部后代都能用 `var()` 消费，
 *   所以正文、模块标题、条目标题、bullet、技能等都能真正跟着密度变。
 */
export interface TemplateStyleVariables {
  /** 主题色（分割线、色条、bullet 记号、目标岗位文字等）。 */
  '--accent': string;
  /** 简历正文使用的字体。 */
  '--resume-font-family': string;
  /** 正文字号。 */
  '--resume-body-size': string;
  /** 正文行高。 */
  '--resume-line-height': string;
  /** 模块间距。 */
  '--resume-section-gap': string;
  /** 条目间距。 */
  '--resume-item-gap': string;
}

/* ---------- 判断 ---------- */

/**
 * 下面三个判断都用「逐项相等比较」而不是 `Array.prototype.includes`：
 * 一是避免为 `as const` 数组做类型断言，二是传入非字符串时同样安全。
 */
export function isThemeColorToken(value: string): value is ThemeColorToken {
  return SUPPORTED_THEME_COLORS.some((token) => token === value);
}

export function isFontFamilyToken(value: string): value is FontFamilyToken {
  return SUPPORTED_FONT_FAMILIES.some((token) => token === value);
}

export function isDensityToken(value: string): value is Density {
  return SUPPORTED_DENSITIES.some((token) => token === value);
}

/* ---------- 主入口 ---------- */

/**
 * 把一份 Resume.style 解析成三个模板都要用的 CSS 自定义属性。
 *
 * 这是三个模板共用的**唯一**样式入口：模板不再各自维护 THEME_COLORS / FALLBACK_ACCENT，
 * 也不再各自决定字号与间距，只负责在自己的 CSS 里消费这些变量。
 *
 * 任何未知取值都会落到标准档位对应的默认值，因此本函数**永不抛错、永不返回 undefined**。
 */
export function getTemplateStyleVariables(
  style: ResumeStyle,
): TemplateStyleVariables {
  const themeColor = isThemeColorToken(style.themeColor)
    ? style.themeColor
    : DEFAULT_THEME_COLOR;

  const fontFamily = isFontFamilyToken(style.fontFamily)
    ? style.fontFamily
    : DEFAULT_FONT_FAMILY;

  const density = isDensityToken(style.density) ? style.density : DEFAULT_DENSITY;

  const { bodySize, lineHeight, sectionGap, itemGap } = DENSITY_VALUES[density];

  return {
    '--accent': THEME_COLOR_VALUES[themeColor],
    '--resume-font-family': FONT_FAMILY_VALUES[fontFamily],
    '--resume-body-size': bodySize,
    '--resume-line-height': lineHeight,
    '--resume-section-gap': sectionGap,
    '--resume-item-gap': itemGap,
  };
}
