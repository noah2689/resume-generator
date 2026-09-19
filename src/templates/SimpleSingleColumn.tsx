import type { CSSProperties } from 'react';
import type { Resume, ResumeSection } from '../types/resume';
import { getTemplateStyleVariables } from './templateStyleTokens';
import styles from './SimpleSingleColumn.module.css';

/**
 * 模板：简约单栏（simple-single-column）
 *
 * 依据：docs/ai-context/04_TEMPLATE_SYSTEM_SPEC.md
 *
 * 职责边界（严格遵守）：
 * - 只通过 props 接收 Resume 数据，然后渲染。
 * - 不 import sampleResume，不读路由，不读 LocalStorage，不自己保存状态。
 * - 不为某个模板修改 Resume Schema，不新增模板专属字段。
 *
 * M1 阶段说明：
 * - 只实现这一个模板，直接 import 渲染，不建注册中心 / 引擎 / 工厂 / DSL。
 * - A4 纸面属于本模板，外层舞台由 EditorPage 提供。
 * - 不实现分页：纸面宽度固定，内容超长时自然向下增长。
 *
 * M5 起的样式：
 * - 主题色 / 字体 / 密度不再由本模板自己决定，改为调用
 *   `getTemplateStyleVariables(resume.style)`，把结果作为 CSS 自定义属性写在
 *   `<article>` 上，由本模板的 CSS 逐个消费（见 .module.css 顶部说明）。
 * - 本模板仍然不解释 token 含义，也不保存任何样式状态。
 */
export default function SimpleSingleColumn({ resume }: { resume: Resume }) {
  const { profile } = resume;

  /**
   * 是否渲染头像。
   *
   * 三个条件同时成立才渲染：
   *   showAvatar === true（严格等于，历史数据里可能是 "true" 之类的非布尔值）
   *   avatar 是字符串且非空白（复用本模板已有的安全 isNonEmpty）
   *
   * 为什么不直接 `profile.avatar.trim()`：
   * storage/resumeStorage.ts 只确认 `profile` 是对象，不做逐字段运行时校验，
   * 因此历史存储里完全可能是 `{"avatar": 123}`。`123.trim()` 会直接让模板崩溃，
   * 而 isNonEmpty 内部先判断 typeof，非字符串一律当作「没有头像」。
   *
   * 形状与尺寸由模板决定（04 §8）：本模板头像居中放在姓名上方。
   */
  const showAvatarImage =
    resume.style.showAvatar === true && isNonEmpty(profile.avatar);

  // 按 order 升序；visible 为 false 的不渲染。
  // 注意：先复制再排序，不修改传入的 resume.sections。
  const sections = resume.sections
    .filter((section) => section.visible)
    .slice()
    .sort((a, b) => a.order - b.order);

  // 基本信息：空值不参与拼接，避免出现「上海 ｜ ｜ 138...」这类多余分隔符。
  const contactLine = joinNonEmpty(
    [profile.city, profile.phone, profile.email],
    '　｜　',
  );

  return (
    <article
      className={styles.paper}
      style={getTemplateStyleVariables(resume.style) as CSSProperties}
    >
      <header className={styles.header}>
        {showAvatarImage && (
          // alt 留空：姓名就在旁边以文本呈现，头像属于装饰性重复信息。
          <img className={styles.avatar} src={profile.avatar} alt="" />
        )}
        {isNonEmpty(profile.name) && (
          <h1 className={styles.name}>{profile.name.trim()}</h1>
        )}
        {isNonEmpty(resume.targetRole) && (
          <p className={styles.targetRole}>{resume.targetRole.trim()}</p>
        )}
        {contactLine && <p className={styles.contact}>{contactLine}</p>}
      </header>

      {sections.map((section) => (
        <SectionBlock key={section.id} section={section} />
      ))}
    </article>
  );
}

/**
 * 条目所需的展示数据，已全部处理为空值无关的纯字符串。
 *
 * `id` 保留数据里的条目 id：M2.2 起列表可增删，React key 必须用稳定 id
 * 而不是数组下标，因此这里不能把它丢掉。
 */
interface EntryView {
  id: string;
  title: string;
  dateRange: string;
  subtitleParts: (string | undefined)[];
  bullets: string[];
}

/**
 * 一个 Section：标题 + 内容。
 *
 * 标题读取数据里的 section.title，模板不硬编码任何模块名称。
 * 空 Section（没有任何可渲染内容）整体不显示，包括标题——
 * 依据 05_EDITOR_UX_SPEC.md 第 10 节。
 */
function SectionBlock({ section }: { section: ResumeSection }) {
  const entries = buildEntries(section).filter(hasVisibleEntry);

  if (entries.length === 0) {
    return null;
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{section.title}</h2>

      {section.type === 'skills' ? (
        <ul className={styles.skillList}>
          {entries.map((entry) => (
            <li key={entry.id} className={styles.skill}>
              {joinNonEmpty([entry.title, entry.subtitleParts[0]], ' · ')}
            </li>
          ))}
        </ul>
      ) : (
        entries.map((entry) => (
          <div key={entry.id} className={styles.entry}>
            <div className={styles.entryHead}>
              {entry.title && (
                <h3 className={styles.entryTitle}>{entry.title}</h3>
              )}
              {entry.dateRange && (
                <span className={styles.entryDate}>{entry.dateRange}</span>
              )}
            </div>
            <EntrySubtitle parts={entry.subtitleParts} />
            <Bullets items={entry.bullets} />
          </div>
        ))
      )}
    </section>
  );
}

/**
 * 把 Section 转成统一的展示结构。
 *
 * 用 switch 而不是映射表，是为了让 TypeScript 在每个分支里把 section
 * 收窄到具体类型（discriminated union），字段名写错会直接编译报错。
 */
function buildEntries(section: ResumeSection): EntryView[] {
  switch (section.type) {
    case 'education':
      return section.items.map((item) => ({
        id: item.id,
        title: item.school,
        dateRange: formatDateRange(item.startDate, item.endDate),
        subtitleParts: [item.major, item.degree, item.city],
        bullets: item.description,
      }));
    case 'work':
      return section.items.map((item) => ({
        id: item.id,
        title: item.company,
        dateRange: formatDateRange(item.startDate, item.endDate),
        subtitleParts: [item.role, item.city],
        bullets: item.description,
      }));
    case 'project':
      return section.items.map((item) => ({
        id: item.id,
        title: item.name,
        dateRange: formatDateRange(item.startDate, item.endDate),
        subtitleParts: [item.role],
        bullets: item.description,
      }));
    case 'skills':
      return section.items.map((item) => ({
        id: item.id,
        title: item.name,
        dateRange: '',
        subtitleParts: [item.level],
        bullets: [],
      }));
  }
}

/** 一条条目是否有任何可显示内容；全空的条目不渲染。 */
function hasVisibleEntry(entry: EntryView): boolean {
  return (
    isNonEmpty(entry.title) ||
    isNonEmpty(entry.dateRange) ||
    entry.subtitleParts.some(isNonEmpty) ||
    entry.bullets.some(isNonEmpty)
  );
}

function EntrySubtitle({ parts }: { parts: (string | undefined)[] }) {
  const text = joinNonEmpty(parts, ' · ');
  if (!text) {
    return null;
  }
  return <p className={styles.entrySubtitle}>{text}</p>;
}

/** description 数组渲染成 bullet 列表；空数组或全为空串时不产生空列表。 */
function Bullets({ items }: { items: string[] }) {
  const list = items.filter(isNonEmpty);
  if (list.length === 0) {
    return null;
  }

  return (
    <ul className={styles.bullets}>
      {list.map((text, index) => (
        <li key={index} className={styles.bullet}>
          {text.trim()}
        </li>
      ))}
    </ul>
  );
}

/** 判断字符串字段是否有实际内容（排除 undefined / null / 纯空白）。 */
function isNonEmpty(value: string | undefined | null): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/** 过滤空值后用分隔符拼接，避免出现首尾或连续的分隔符。 */
function joinNonEmpty(parts: (string | undefined)[], separator: string): string {
  return parts
    .filter(isNonEmpty)
    .map((part) => part.trim())
    .join(separator);
}

/**
 * 日期显示转换：数据里是 YYYY-MM，版面上显示为 YYYY.MM。
 *
 * 这是模板层的显示处理，不改数据结构。
 * 不符合 YYYY-MM 格式的值（例如「至今」）原样放行，不会产生 NaN 或空值。
 */
function formatDate(value: string): string {
  if (!isNonEmpty(value)) {
    return '';
  }
  const trimmed = value.trim();
  const matched = /^(\d{4})-(\d{1,2})$/.exec(trimmed);
  return matched ? `${matched[1]}.${matched[2].padStart(2, '0')}` : trimmed;
}

/** 拼接起止时间，任一端为空则只显示另一端，两端都为空则返回空串。 */
function formatDateRange(startDate: string, endDate: string): string {
  const start = formatDate(startDate);
  const end = formatDate(endDate);

  if (start && end) {
    return `${start} - ${end}`;
  }
  return start || end;
}
