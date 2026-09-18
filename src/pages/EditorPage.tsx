import { Link, useParams } from 'react-router-dom';
import { sampleResume } from '../data/sampleResume';
import type { Resume, ResumeSection } from '../types/resume';
import styles from './EditorPage.module.css';

/**
 * 页面 C：简历编辑器。
 *
 * M0 阶段这一页**不是**真正的简历编辑器，而是一个开发态验证页，
 * 用途是证明「Resume 类型定义 → 示例数据 → 页面读取」这条链路成立。
 *
 * 本页刻意不做：A4 预览、模板渲染、编辑表单、保存。
 * 正式编辑器（三栏布局）在 M1 / M2 实现。
 *
 * 页面上的所有业务字段都直接来自 sampleResume，
 * 修改 src/data/sampleResume.ts 后本页内容应随之变化。
 */
export default function EditorPage() {
  const { resumeId } = useParams<{ resumeId: string }>();

  // M0 只有一份固定示例数据，因此这里直接比较 ID。
  // 简历列表与持久化属于后续 Milestone，暂不引入任何存储层。
  const resume: Resume | null = sampleResume.id === resumeId ? sampleResume : null;

  if (!resume) {
    return (
      <section className="panel">
        <h1 className="panel__title">未找到简历</h1>
        <p className="panel__text">
          当前 M0 只内置一份示例简历，ID 为 <code>{sampleResume.id}</code>。
        </p>
        <p className="panel__text">
          <Link to={`/editor/${sampleResume.id}`}>打开示例简历</Link>
        </p>
      </section>
    );
  }

  const sections = [...resume.sections].sort((a, b) => a.order - b.order);
  const visibleSectionCount = sections.filter((section) => section.visible).length;
  const totalItemCount = sections.reduce((sum, section) => sum + section.items.length, 0);

  return (
    <div className={styles.wrapper}>
      <div className={styles.notice}>
        <strong>M0 开发态验证页</strong>
        <span>
          本页只验证示例简历数据已被读取，不是最终编辑器界面。所有字段均来自{' '}
          <code>src/data/sampleResume.ts</code>。
        </span>
      </div>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>简历顶层字段</h2>
        <dl className={styles.fieldList}>
          <Field label="id" value={resume.id} />
          <Field label="title" value={resume.title} />
          <Field label="locale" value={resume.locale} />
          <Field label="targetRole" value={resume.targetRole} />
          <Field label="templateId" value={resume.templateId} />
          <Field label="schemaVersion" value={String(resume.schemaVersion)} />
        </dl>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>基本信息 profile</h2>
        <dl className={styles.fieldList}>
          <Field label="姓名" value={resume.profile.name} highlight />
          <Field label="手机" value={resume.profile.phone} />
          <Field label="邮箱" value={resume.profile.email} />
          <Field label="城市" value={resume.profile.city} />
          <Field label="头像" value={resume.profile.avatar || '（空）'} />
        </dl>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>样式设置 style</h2>
        <dl className={styles.fieldList}>
          <Field label="themeColor" value={resume.style.themeColor} />
          <Field label="fontFamily" value={resume.style.fontFamily} />
          <Field label="density" value={resume.style.density} />
          <Field label="showAvatar" value={String(resume.style.showAvatar)} />
        </dl>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Sections 统计</h2>
        <dl className={styles.fieldList}>
          <Field label="section 总数" value={String(sections.length)} highlight />
          <Field label="可见 section 数" value={String(visibleSectionCount)} />
          <Field label="条目总数" value={String(totalItemCount)} highlight />
        </dl>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Section 列表（按 order 排序）</h2>
        <ul className={styles.sectionList}>
          {sections.map((section) => (
            <li key={section.id} className={styles.sectionItem}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>{section.title}</span>
                <span className={styles.badge}>{section.type}</span>
                <span className={styles.badge}>
                  {section.visible ? '显示' : '隐藏'}
                </span>
                <span className={styles.meta}>
                  order {section.order} · {section.items.length} 条
                </span>
              </div>
              <ul className={styles.itemList}>
                {section.items.map((_, index) => (
                  <li key={`${section.id}_${index}`} className={styles.item}>
                    {describeItem(section, index)}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <>
      <dt className={styles.fieldLabel}>{label}</dt>
      <dd className={highlight ? styles.fieldValueStrong : styles.fieldValue}>{value}</dd>
    </>
  );
}

/**
 * 按 section.type 取一条条目的摘要文本。
 *
 * 这里用 switch 而不是通用取字段的方式，是为了让 TypeScript 在每个分支里
 * 把 section 收窄到具体类型（discriminated union），字段名写错会直接编译报错。
 */
function describeItem(section: ResumeSection, index: number): string {
  switch (section.type) {
    case 'education': {
      const item = section.items[index];
      return item ? `${item.school} · ${item.major} · ${item.degree}` : '';
    }
    case 'work': {
      const item = section.items[index];
      return item ? `${item.company} · ${item.role}` : '';
    }
    case 'project': {
      const item = section.items[index];
      return item ? `${item.name} · ${item.role}` : '';
    }
    case 'skills': {
      const item = section.items[index];
      return item ? `${item.name} · ${item.level}` : '';
    }
  }
}
