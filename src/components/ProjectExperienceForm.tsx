import type { ProjectItem } from '../types/resume';
import type { ProjectItemTextField } from '../pages/projectEdits';
import styles from './ProjectExperienceForm.module.css';

/**
 * 项目经历编辑表单。
 *
 * 职责（严格限定）：
 * - 展示当前项目经历列表
 * - 新增 / 编辑 / 删除整条项目经历
 * - 编辑每条项目经历下的 description bullets（新增 / 修改 / 删除）
 *
 * 边界：
 * - 不持有 Resume state，状态属于 EditorPage。这里只接收 items 并上抛回调。
 * - 不自己取数（不读路由 / 不 import sampleResume / 不读存储）。
 * - 不做字段校验、不做日期格式化。时间是普通文本输入，用户可以填 `2024-01` 或 `至今`。
 * - 只覆盖 Schema 里 ProjectItem 实际拥有的字段：没有城市、没有公司、没有技术栈。
 *   不因为 work / education 有城市就顺手加一个输入框。
 * - 不是通用 Section 编辑器，也不是通用列表编辑器：只服务「项目经历」这一种 Section。
 *   这是第三个同类组件，但仍然不合并——详见 projectEdits.ts 顶部关于抽象的说明。
 *
 * 唯一属于本组件的 UI 关注点是删除确认：删除整条项目经历需要用户确认，
 * 确认通过后才调用 onRemove。删除单条 bullet 不需要确认（依据 05 第 11 节）。
 *
 * 根节点是 <details>/<summary>，与左侧其余五个模块共用 name 做模块级折叠
 * （05 第 3 节 Accordion）；折叠是纯 UI 状态，不碰 Resume、不持久化。
 *
 * 依据：docs/ai-context/05_EDITOR_UX_SPEC.md 第 4、5、10、11 节
 */

interface ProjectExperienceFormProps {
  items: ProjectItem[];
  onAddItem: () => void;
  onChangeField: (
    itemId: string,
    field: ProjectItemTextField,
    value: string,
  ) => void;
  onRemoveItem: (itemId: string) => void;
  onAddBullet: (itemId: string) => void;
  onChangeBullet: (itemId: string, bulletIndex: number, value: string) => void;
  onRemoveBullet: (itemId: string, bulletIndex: number) => void;
}

/** 每条项目经历的文本字段。顺序即界面顺序。 */
const TEXT_FIELDS: { field: ProjectItemTextField; label: string }[] = [
  { field: 'name', label: '项目名称' },
  { field: 'role', label: '角色' },
  { field: 'startDate', label: '开始时间' },
  { field: 'endDate', label: '结束时间' },
];

export default function ProjectExperienceForm({
  items,
  onAddItem,
  onChangeField,
  onRemoveItem,
  onAddBullet,
  onChangeBullet,
  onRemoveBullet,
}: ProjectExperienceFormProps) {
  return (
    <details className={styles.wrapper} name="resume-editor-section">
      <summary className={styles.title}>项目经历</summary>

      {items.length === 0 ? (
        <p className={styles.empty}>暂无项目经历</p>
      ) : (
        items.map((item) => (
          // 列表可增删，必须用稳定的 item.id 作 key，不能用数组下标。
          <div key={item.id} className={styles.item}>
            {TEXT_FIELDS.map(({ field, label }) => {
              const inputId = `project-${item.id}-${field}`;
              return (
                <div key={field} className={styles.field}>
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

            <div className={styles.bulletsBlock}>
              <p className={styles.bulletsTitle}>项目描述</p>

              {item.description.map((bullet, bulletIndex) => {
                const bulletId = `project-${item.id}-bullet-${bulletIndex}`;
                return (
                  // bullet 在 Schema 里是裸 string[]，没有 id，因此只能用下标作 key。
                  // 这是当前 Schema 的限制，不为了 key 去改数据结构。
                  <div key={bulletIndex} className={styles.bulletRow}>
                    <input
                      id={bulletId}
                      className={styles.bulletInput}
                      type="text"
                      value={bullet}
                      onChange={(event) =>
                        onChangeBullet(item.id, bulletIndex, event.target.value)
                      }
                    />
                    <button
                      type="button"
                      className={styles.bulletRemove}
                      onClick={() => onRemoveBullet(item.id, bulletIndex)}
                    >
                      删除
                    </button>
                  </div>
                );
              })}

              <button
                type="button"
                className={styles.addBullet}
                onClick={() => onAddBullet(item.id)}
              >
                + 添加一条描述
              </button>
            </div>

            <button
              type="button"
              className={styles.removeItem}
              onClick={() => {
                // 删除整条项目经历属重要删除，需要确认；取消则完全不动数据。
                if (window.confirm(describeRemoval(item))) {
                  onRemoveItem(item.id);
                }
              }}
            >
              删除这条项目经历
            </button>
          </div>
        ))
      )}

      <button type="button" className={styles.addItem} onClick={onAddItem}>
        + 添加项目经历
      </button>
    </details>
  );
}

/**
 * 删除确认的提示文案。
 *
 * 带上项目名称 / 角色让用户知道自己正在删哪一条；两者都为空时退回通用文案，
 * 避免出现「确认删除「 / 」这条项目经历？」这种没信息量的句子。
 */
function describeRemoval(item: ProjectItem): string {
  const summary = [item.name, item.role]
    .filter((part) => part.trim())
    .join(' / ');
  if (!summary) {
    return '确认删除这条项目经历？';
  }
  return `确认删除「${summary}」这条项目经历？`;
}
