import type { EducationItem } from '../types/resume';
import type { EducationItemTextField } from '../pages/educationEdits';
import styles from './EducationExperienceForm.module.css';

/**
 * 教育经历编辑表单。
 *
 * 职责（严格限定）：
 * - 展示当前教育经历列表
 * - 新增 / 编辑 / 删除整条教育经历
 * - 编辑每条教育经历下的 description bullets（新增 / 修改 / 删除）
 *
 * 边界：
 * - 不持有 Resume state，状态属于 EditorPage。这里只接收 items 并上抛回调。
 * - 不自己取数（不读路由 / 不 import sampleResume / 不读存储）。
 * - 不做字段校验、不做日期格式化。时间是普通文本输入，用户可以填 `2018-09` 或 `至今`。
 * - 不是通用 Section 编辑器，也不是通用列表编辑器：只服务「教育经历」这一种 Section。
 *   本次刻意不与 WorkExperienceForm 合并成通用 ExperienceForm——
 *   现在只有一个稳定样本，还看不出哪些是真正的共性。重复代码是后续判断抽象的证据。
 *
 * 唯一属于本组件的 UI 关注点是删除确认：删除整条教育经历需要用户确认，
 * 确认通过后才调用 onRemove。删除单条 bullet 不需要确认（依据 05 第 11 节）。
 *
 * 依据：docs/ai-context/05_EDITOR_UX_SPEC.md 第 4、5、10、11 节
 */

interface EducationExperienceFormProps {
  items: EducationItem[];
  onAddItem: () => void;
  onChangeField: (
    itemId: string,
    field: EducationItemTextField,
    value: string,
  ) => void;
  onRemoveItem: (itemId: string) => void;
  onAddBullet: (itemId: string) => void;
  onChangeBullet: (itemId: string, bulletIndex: number, value: string) => void;
  onRemoveBullet: (itemId: string, bulletIndex: number) => void;
}

/** 每条教育经历的文本字段。顺序即界面顺序。 */
const TEXT_FIELDS: { field: EducationItemTextField; label: string }[] = [
  { field: 'school', label: '学校' },
  { field: 'major', label: '专业' },
  { field: 'degree', label: '学历' },
  { field: 'startDate', label: '开始时间' },
  { field: 'endDate', label: '结束时间' },
  { field: 'city', label: '城市' },
];

export default function EducationExperienceForm({
  items,
  onAddItem,
  onChangeField,
  onRemoveItem,
  onAddBullet,
  onChangeBullet,
  onRemoveBullet,
}: EducationExperienceFormProps) {
  return (
    <section className={styles.wrapper}>
      <h2 className={styles.title}>教育经历</h2>

      {items.length === 0 ? (
        <p className={styles.empty}>暂无教育经历</p>
      ) : (
        items.map((item) => (
          // 列表可增删，必须用稳定的 item.id 作 key，不能用数组下标。
          <div key={item.id} className={styles.item}>
            {TEXT_FIELDS.map(({ field, label }) => {
              const inputId = `edu-${item.id}-${field}`;
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
              <p className={styles.bulletsTitle}>教育描述</p>

              {item.description.map((bullet, bulletIndex) => {
                const bulletId = `edu-${item.id}-bullet-${bulletIndex}`;
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
                // 删除整条教育经历属重要删除，需要确认；取消则完全不动数据。
                if (window.confirm(describeRemoval(item))) {
                  onRemoveItem(item.id);
                }
              }}
            >
              删除这条教育经历
            </button>
          </div>
        ))
      )}

      <button type="button" className={styles.addItem} onClick={onAddItem}>
        + 添加教育经历
      </button>
    </section>
  );
}

/**
 * 删除确认的提示文案。
 *
 * 带上学校 / 专业让用户知道自己正在删哪一条；两者都为空时退回通用文案，
 * 避免出现「确认删除「 / 」这条教育经历？」这种没信息量的句子。
 * 刻意不拼学历：学历（本科 / 硕士）单独出现的区分度弱，学校 + 专业已经足够定位。
 */
function describeRemoval(item: EducationItem): string {
  const summary = [item.school, item.major]
    .filter((part) => part.trim())
    .join(' / ');
  if (!summary) {
    return '确认删除这条教育经历？';
  }
  return `确认删除「${summary}」这条教育经历？`;
}
