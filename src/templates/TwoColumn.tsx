import type { CSSProperties } from 'react';
import type { Resume, ResumeSection } from '../types/resume';
import styles from './TwoColumn.module.css';

/**
 * 模板：左右双栏（two-column）
 *
 * 依据：docs/ai-context/04_TEMPLATE_SYSTEM_SPEC.md 第 3 节 Template C
 *
 * 布局：
 *   顶部全宽：姓名 + 目标岗位
 *   下方：约 30% 左栏 ｜ 约 70% 右栏
 *     左栏：联系方式 + 技能
 *     右栏：教育经历 / 工作经历 / 项目经历
 *
 * 列分配是**本模板自己的展示规则**，不是数据的一部分：
 * - 不新增 layout 字段，不给 Section 增加 column 字段，
 *   不把「左栏 / 右栏」写进 Schema，不重排 resume.sections 的顺序。
 * - 归属只看 `section.type`：skills → 左栏，其余三类 → 右栏。
 *
 * 顺序语义（与 Simple / Business 完全一致）：
 *   visible 过滤 → 复制数组 → 按 order 升序 → 再按归属分栏渲染。
 * 即：分栏不是第二种排序。右栏内部仍按 order 排；如果将来数据里
 * project.order < education.order，右栏就跟着数据变化。
 * 左栏当前只有 skills 一种 Section，因此不存在栏内顺序竞争。
 *
 * 左栏退回单栏：
 *   当左栏**确实没有任何可渲染内容**时（既无可显示的联系方式值，
 *   也没有 visible 且非空的 skills），下方正文退回单栏，
 *   教育 / 工作 / 项目使用完整可用宽度——不保留一条空的 30% 窄栏。
 *   这只是本模板内部的展示分支，不修改 Resume 的任何字段。
 *
 * 职责边界（与另外两个模板一致）：
 * - 只通过 props 接收 Resume，不 import sampleResume、不读路由、不读存储、不写状态。
 * - 不修改 Resume Schema，不新增模板专属字段。
 * - helper 与另外两个模板刻意各留一份（不抽公共 util），理由见 README 决策第 7 条。
 *
 * 不实现分页：固定宽度 + min-height，内容超长自然向下增长（属 M6）。
 */

/**
 * 主题色映射。
 *
 * 沿用与另外两个模板相同的最小映射：只覆盖示例数据用到的 navy + 兜底色。
 * 完整色板 / 主题切换属于 M5。
 */
const THEME_COLORS: Record<string, string> = {
  navy: '#1f3a5f',
};

/** 未知 themeColor 时的兜底色。 */
const FALLBACK_ACCENT = '#333333';

/**
 * 归属判断：哪些 Section 放左栏。
 *
 * 当前只有 skills 一类短内容进左栏，因此这里是一个按类型判断的谓词，
 * 不是一份可配置的布局表（那属于模板元数据系统，本轮不做）。
 */
function isSidebarSection(section: ResumeSection): boolean {
  return section.type === 'skills';
}

export default function TwoColumn({ resume }: { resume: Resume }) {
  const accent = THEME_COLORS[resume.style.themeColor] ?? FALLBACK_ACCENT;

  // 统一先做 visible 过滤 + 按 order 排序（复制后排序，不动原数组）。
  // 分栏在排序之后进行，因此每一栏内部都保持 order 顺序。
  const visibleSections = resume.sections
    .filter((section) => section.visible)
    .slice()
    .sort((a, b) => a.order - b.order);

  const sidebarSections = visibleSections
    .filter(isSidebarSection)
    .filter(hasRenderableContent);
  const mainSections = visibleSections.filter(
    (section) => !isSidebarSection(section),
  );

  const { profile } = resume;

  // 联系方式不是 Section，不参与 order；这里只做「有值才显示」。
  const contactItems = [profile.city, profile.phone, profile.email].filter(
    isNonEmpty,
  );

  // 左栏是否有真实内容：有联系方式，或有一个非空的 skills。
  const hasSidebarContent =
    contactItems.length > 0 || sidebarSections.length > 0;

  return (
    <article
      className={styles.paper}
      style={{ '--accent': accent } as CSSProperties}
    >
      <header className={styles.header}>
        {isNonEmpty(profile.name) && (
          <h1 className={styles.name}>{profile.name.trim()}</h1>
        )}
        {isNonEmpty(resume.targetRole) && (
          <p className={styles.targetRole}>{resume.targetRole.trim()}</p>
        )}
      </header>

      {hasSidebarContent ? (
        <div className={styles.columns}>
          <aside className={styles.sidebar}>
            {contactItems.length > 0 && (
              <ul className={styles.contactList}>
                {contactItems.map((text, index) => (
                  <li key={index} className={styles.contactItem}>
                    {text.trim()}
                  </li>
                ))}
              </ul>
            )}

            {sidebarSections.map((section) => (
              <SectionBlock key={section.id} section={section} />
            ))}
          </aside>

          <div className={styles.main}>
            {mainSections.map((section) => (
              <SectionBlock key={section.id} section={section} />
            ))}
          </div>
        </div>
      ) : (
        <div className={styles.singleColumnBody}>
          {mainSections.map((section) => (
            <SectionBlock key={section.id} section={section} />
          ))}
        </div>
      )}
    </article>
  );
}

/**
 * 条目所需的展示数据，已全部处理为空值无关的纯字符串。
 *
 * `id` 保留数据里的条目 id：列表可增删，React key 必须用稳定 id。
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
 *
 * skills 在这个模板里只出现在左栏，因此固定使用竖排列表（窄栏更合适）。
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
            {entry.title && (
              <h3 className={styles.entryTitle}>{entry.title}</h3>
            )}
            {entry.subtitleParts.some(isNonEmpty) && (
              <p className={styles.entrySubtitle}>
                {joinNonEmpty(entry.subtitleParts, ' · ')}
              </p>
            )}
            {entry.dateRange && (
              <p className={styles.entryDate}>{entry.dateRange}</p>
            )}
            <Bullets items={entry.bullets} />
          </div>
        ))
      )}
    </section>
  );
}

/** 该 Section 是否有可渲染内容（用于判断左栏是否真的需要存在）。 */
function hasRenderableContent(section: ResumeSection): boolean {
  return buildEntries(section).filter(hasVisibleEntry).length > 0;
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
 * 不符合 YYYY-MM 格式的值（例如「至今」）原样放行。
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
