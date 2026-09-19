import type { SkillItem } from '../types/resume';
import type { SkillItemTextField } from '../pages/skillsEdits';
import styles from './SkillsForm.module.css';

/**
 * 技能编辑表单。
 *
 * 职责（严格限定）：
 * - 展示当前技能列表
 * - 新增技能
 * - 编辑每条技能的 name / level
 * - 删除技能
 *
 * 边界：
 * - 不持有 Resume state，状态属于 EditorPage。这里只接收 items 并上抛回调。
 * - 不自己取数（不读路由 / 不 import sampleResume / 不读存储）。
 * - 不做字段校验、不做等级枚举。`level` 在当前 Schema 里就是普通 string，
 *   用户可以填「熟练」「精通」或任何自己的说法，因此用普通文本输入，
 *   不做 Select 下拉、不做固定枚举、不做星级 / 进度条 / Slider / 雷达图。
 * - 只覆盖 Schema 里 SkillItem 实际拥有的字段，不因为别的 Section 字段更多就顺手加。
 * - 不是通用 Section 编辑器，也不是通用列表编辑器：只服务「技能」这一种 Section。
 *
 * 与前三个 Experience Form 的关键差别：
 * - 没有 description / bullet 区块（SkillItem 没有 description 字段）。
 * - **删除不需要确认**，因此本文件没有 window.confirm，也没有 describeRemoval。
 *   依据 05_EDITOR_UX_SPEC.md 第 11 节：删除保护针对工作经历、项目经历等重要内容；
 *   单条技能信息量小、容易重新添加，高频增删时确认框只会制造摩擦。
 *
 * 根节点是 <details>/<summary>，与左侧其余五个模块共用 name 做模块级折叠
 * （05 第 3 节 Accordion）；折叠是纯 UI 状态，不碰 Resume、不持久化。
 *
 * 依据：docs/ai-context/03_RESUME_DATA_SCHEMA.md 第 8 节、05_EDITOR_UX_SPEC.md 第 10、11 节
 */

interface SkillsFormProps {
  items: SkillItem[];
  onAddItem: () => void;
  onChangeField: (itemId: string, field: SkillItemTextField, value: string) => void;
  onRemoveItem: (itemId: string) => void;
}

/** 每条技能的两个字段。顺序即界面顺序。 */
const TEXT_FIELDS: {
  field: SkillItemTextField;
  label: string;
  className: string;
}[] = [
  { field: 'name', label: '技能名称', className: styles.fieldName },
  { field: 'level', label: '熟练度', className: styles.fieldLevel },
];

export default function SkillsForm({
  items,
  onAddItem,
  onChangeField,
  onRemoveItem,
}: SkillsFormProps) {
  return (
    <details className={styles.wrapper} name="resume-editor-section">
      <summary className={styles.title}>技能</summary>

      {items.length === 0 ? (
        <p className={styles.empty}>暂无技能</p>
      ) : (
        items.map((item) => (
          // 列表可增删，必须用稳定的 item.id 作 key，不能用数组下标。
          <div key={item.id} className={styles.item}>
            <div className={styles.fields}>
              {TEXT_FIELDS.map(({ field, label, className }) => {
                const inputId = `skill-${item.id}-${field}`;
                return (
                  <div key={field} className={`${styles.field} ${className}`}>
                    <label className={styles.label} htmlFor={inputId}>
                      {label}
                    </label>
                    <input
                      id={inputId}
                      className={styles.input}
                      type="text"
                      value={item[field]}
                      onChange={(event) =>
                        onChangeField(item.id, field, event.target.value)
                      }
                    />
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              className={styles.removeItem}
              onClick={() => onRemoveItem(item.id)}
            >
              删除
            </button>
          </div>
        ))
      )}

      <button type="button" className={styles.addItem} onClick={onAddItem}>
        + 添加技能
      </button>
    </details>
  );
}
