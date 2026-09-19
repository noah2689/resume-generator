import type { ResumeSection } from '../types/resume';
import styles from './SectionVisibilityControls.module.css';

/**
 * 模块显示 / 隐藏控件。
 *
 * 职责（严格限定）：
 * - 按传入的 sections 顺序，为每一个 Section 渲染一个 checkbox
 * - 勾选状态由 `section.visible` 控制
 * - 切换时上抛 `(section.id, 新的 visible)`
 *
 * 这是一个**合理的通用组件**，因为它只依赖 SectionBase 上真实共有的三个字段：
 * `id`（定位）、`title`（显示文本）、`visible`（勾选状态）。
 * 它不需要知道 Section 是哪一类，所以没有 `section.type` 的 switch、
 * 没有 type → 中文标题的映射表、没有 registry、也没有写死四个固定 checkbox。
 *
 * 标题直接取自 `section.title`：数据是唯一真相来源，标题改了这里自动跟着改。
 *
 * 边界：
 * - 不持有 Resume state，状态属于 EditorPage。
 * - 不自己取数（不读路由 / 不 import sampleResume / 不读存储）。
 * - 不给 Section 排序，也不按 order 重排：按传入顺序展示，顺序由调用方决定。
 * - 只渲染真实存在的 Section：不存在的类型自然没有 checkbox，也不自动补一个。
 * - 切换显隐**不需要确认**：显隐不是删除，用户随时可以重新打开。
 * - 只控制 Section 外壳的显隐，不碰 items；隐藏某个 Section 不会影响
 *   左栏对应的内容编辑表单（visible 只控制输出，不控制编辑入口）。
 *
 * 根节点是 <details>/<summary>，与左侧其余五个模块共用 name 做模块级折叠
 * （05 第 3 节 Accordion）；折叠是纯 UI 状态，不碰 Resume、不持久化。
 *
 * 依据：docs/ai-context/03_RESUME_DATA_SCHEMA.md 第 4 节、05_EDITOR_UX_SPEC.md 第 10 节
 */

interface SectionVisibilityControlsProps {
  sections: ResumeSection[];
  onChange: (sectionId: string, visible: boolean) => void;
}

export default function SectionVisibilityControls({
  sections,
  onChange,
}: SectionVisibilityControlsProps) {
  return (
    <details className={styles.wrapper} name="resume-editor-section">
      <summary className={styles.title}>模块显示</summary>

      {sections.length === 0 ? (
        <p className={styles.empty}>当前简历没有可显示的内容模块。</p>
      ) : (
        sections.map((section) => {
          const checkboxId = `section-visible-${section.id}`;
          return (
            // key 用 section.id，与 Section 的稳定标识一致。
            <div key={section.id} className={styles.row}>
              <input
                id={checkboxId}
                className={styles.checkbox}
                type="checkbox"
                checked={section.visible}
                onChange={(event) =>
                  onChange(section.id, event.target.checked)
                }
              />
              <label className={styles.label} htmlFor={checkboxId}>
                {section.title}
              </label>
            </div>
          );
        })
      )}
    </details>
  );
}
