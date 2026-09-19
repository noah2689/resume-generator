import { useRef, useState } from 'react';
import type { WorkItem } from '../types/resume';
import type { WorkItemTextField } from '../pages/workEdits';
import styles from './WorkExperienceForm.module.css';

/**
 * 工作经历编辑表单。
 *
 * 职责（严格限定）：
 * - 展示当前工作经历列表
 * - 新增 / 编辑 / 删除整条工作经历
 * - 编辑每条工作经历下的 description bullets（新增 / 修改 / 删除）
 * - M7.1：对**已存在的** bullet 请求一次 AI 措辞优化建议（采用 / 取消）
 *
 * 边界：
 * - 不持有 Resume state，状态属于 EditorPage。这里只接收 items 并上抛回调。
 * - 不自己取数（不读路由 / 不 import sampleResume / 不读存储）。
 * - 不做字段校验、不做日期格式化。时间是普通文本输入，用户可以填 `2023-01` 或 `至今`。
 * - 不是通用 Section 编辑器，也不是通用列表编辑器：只服务「工作经历」这一种 Section。
 *   等教育 / 项目也出现真实需求后，再判断哪些部分值得复用。
 *
 * 关于 M7.1 的 AI 优化（第 12～18 条）：
 * - AI 的**瞬态 UI 状态**（idle / loading / success / error）留在本组件，
 *   因为它只描述「这一屏正在发生什么」，不属于简历数据，也不该进 EditorPage state。
 * - 但**网络请求本身不在这里**：本组件只调用 `onOptimizeBullet` 这个 prop，
 *   由页面（组合根）决定这条请求怎么发。这样组件既不认识 HTTP，也不认识 provider。
 * - 建议永远是瞬态的：在用户点「采用」之前，Resume 与 LocalStorage 都是 0 改动。
 *   采用时只调用已有的 `onChangeBullet`，走既有的 updateWorkBullet 写回路径，
 *   没有「AI 专用写入函数」，因此预览更新 / 自动保存 / 刷新恢复全部自然生效。
 *
 * 唯一属于本组件的 UI 关注点是删除确认：删除整条工作经历需要用户确认，
 * 确认通过后才调用 onRemove。删除单条 bullet 不需要确认（依据 05 第 11 节）。
 *
 * 根节点是 <details>/<summary>，与左侧其余五个模块共用 name 做模块级折叠
 * （05 第 3 节 Accordion）；折叠是纯 UI 状态，不碰 Resume、不持久化。
 *
 * 依据：docs/ai-context/05_EDITOR_UX_SPEC.md 第 4、5、10、11 节；M7.1 最终口径 第 12～18 条
 */

interface WorkExperienceFormProps {
  items: WorkItem[];
  onAddItem: () => void;
  onChangeField: (itemId: string, field: WorkItemTextField, value: string) => void;
  onRemoveItem: (itemId: string) => void;
  onAddBullet: (itemId: string) => void;
  onChangeBullet: (itemId: string, bulletIndex: number, value: string) => void;
  onRemoveBullet: (itemId: string, bulletIndex: number) => void;
  /** 请求一条 AI 改写建议。网络细节由页面提供，不在这里实现。 */
  onOptimizeBullet: (text: string) => Promise<string>;
}

/** 每条工作经历的文本字段。顺序即界面顺序。 */
const TEXT_FIELDS: { field: WorkItemTextField; label: string }[] = [
  { field: 'company', label: '公司' },
  { field: 'role', label: '职位' },
  { field: 'startDate', label: '开始时间' },
  { field: 'endDate', label: '结束时间' },
  { field: 'city', label: '城市' },
];

/**
 * AI 优化的瞬态状态（第 12 条）。
 *
 * 四种状态都**只描述 UI**，没有任何一个字段是简历数据。
 *
 * 为什么不需要 requestId / 请求序号 / Map / 全局请求管理器：
 * 下面用 `aiInFlightRef` 保证了**全组件同时最多 1 个请求在途**，
 * 于是在途请求与当前状态一一对应，乱序结果在结构上不可能出现——
 * 「用 requestId 丢弃过期响应」是解决并发的手段，而这里根本不产生并发。
 *
 * `sourceText` 是发请求那一刻的 bullet 快照，采用前用它做三道 stale 校验（第 15 条）。
 */
type AiState =
  | { status: 'idle' }
  | { status: 'loading'; itemId: string; bulletIndex: number; sourceText: string }
  | {
      status: 'success';
      itemId: string;
      bulletIndex: number;
      sourceText: string;
      suggestion: string;
    }
  | { status: 'error'; itemId: string; bulletIndex: number; message: string };

/**
 * 用户可见的两条 AI 文案。
 *
 * 刻意只区分这两种：一种是「这次没成」，一种是「这条内容已经不是你以为的那条了」。
 * provider 错误、HTTP 状态、错误码都不外露（第 6 条）——用户能做的动作只有重试。
 */
const AI_FAILURE_MESSAGE = '优化失败，请重试。';
const AI_STALE_MESSAGE = '原内容已发生变化，请重新优化。';

export default function WorkExperienceForm({
  items,
  onAddItem,
  onChangeField,
  onRemoveItem,
  onAddBullet,
  onChangeBullet,
  onRemoveBullet,
  onOptimizeBullet,
}: WorkExperienceFormProps) {
  const [aiState, setAiState] = useState<AiState>({ status: 'idle' });

  /**
   * 单请求不变量的硬保证（第 13、23 条）。
   *
   * state 里的 loading 已经会把所有 AI 按钮置为 disabled，正常情况下点不出第二个请求。
   * 用一个 ref 再兜一层，是为了不依赖「React 一定会在这个事件处理结束前
   * 完成重渲染」这个时序假设：连续两次触发（快速双击 / 键盘操作）时，
   * DOM 上的 disabled 需要一次 re-render 才生效，而这个 ref 是同步写入的。
   */
  const aiInFlightRef = useRef(false);

  /** 只要有请求在途，**所有** AI 按钮不可点，当前那条显示「优化中…」。 */
  const aiBusy = aiState.status === 'loading';

  /**
   * 请求 AI 建议。
   *
   * 请求期间只锁 AI 按钮：输入框、删除按钮、其他模块全部照常可用（第 13 条）。
   * 这不只是为了体验——用户可以在等待期间继续编辑甚至删掉这一条，
   * 所以结果回来之后必须再校验一次才敢用，见 handleAdopt。
   */
  const handleOptimize = async (itemId: string, bulletIndex: number, bullet: string) => {
    if (aiInFlightRef.current) {
      return;
    }

    // 空 bullet 不发请求（第 14 条）：没有任何内容可供改写。
    if (bullet.trim() === '') {
      return;
    }

    // 快照发送时这一条到底是什么内容，采用前用它比对。
    const sourceText = bullet;

    aiInFlightRef.current = true;
    setAiState({ status: 'loading', itemId, bulletIndex, sourceText });

    try {
      const suggestion = await onOptimizeBullet(sourceText);
      setAiState({ status: 'success', itemId, bulletIndex, sourceText, suggestion });
    } catch {
      // 失败的具体原因对用户没有价值，统一成一句可以照做的提示。
      setAiState({ status: 'error', itemId, bulletIndex, message: AI_FAILURE_MESSAGE });
    } finally {
      aiInFlightRef.current = false;
    }
  };

  /**
   * 采用建议（第 15、17 条）。
   *
   * 关键点：**采用前重新读取最新的 items**，把「发请求时的那一条」与
   * 「现在这一条」重新对齐。等待期间用户完全可能已经改过文字、删过 bullet、
   * 甚至删掉整条经历，所以下面三道校验缺一不可：
   *
   *   1. itemId 仍然存在
   *   2. bulletIndex 仍然合法
   *   3. 当前位置的内容仍然等于 sourceText
   *
   * 任何一条不过 → 不写入，提示用户重新优化。
   * **绝不猜新下标**：第 3 条已经保证了「写下去的位置内容正确」，
   * 而猜下标会把这个保证破坏掉。
   *
   * 校验通过后只调用既有的 onChangeBullet，不新增 AI 专用写入路径。
   */
  const handleAdopt = () => {
    if (aiState.status !== 'success') {
      return;
    }

    const { itemId, bulletIndex, sourceText, suggestion } = aiState;
    const item = items.find((candidate) => candidate.id === itemId);

    const stillValid =
      item !== undefined &&
      bulletIndex >= 0 &&
      bulletIndex < item.description.length &&
      item.description[bulletIndex] === sourceText;

    if (!stillValid) {
      setAiState({ status: 'error', itemId, bulletIndex, message: AI_STALE_MESSAGE });
      return;
    }

    onChangeBullet(itemId, bulletIndex, suggestion);
    setAiState({ status: 'idle' });
  };

  /** 取消：只清掉 AI 瞬态状态，Resume 与 LocalStorage 都是 0 改动（第 18 条）。 */
  const handleCancel = () => {
    setAiState({ status: 'idle' });
  };

  return (
    <details className={styles.wrapper} name="resume-editor-section">
      <summary className={styles.title}>工作经历</summary>

      {items.length === 0 ? (
        <p className={styles.empty}>暂无工作经历</p>
      ) : (
        items.map((item) => (
          // 列表可增删，必须用稳定的 item.id 作 key，不能用数组下标。
          <div key={item.id} className={styles.item}>
            {TEXT_FIELDS.map(({ field, label }) => {
              const inputId = `work-${item.id}-${field}`;
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
              <p className={styles.bulletsTitle}>工作描述</p>

              {item.description.map((bullet, bulletIndex) => {
                const bulletId = `work-${item.id}-bullet-${bulletIndex}`;

                /*
                 * 当前 AI 状态是不是落在这一行上。
                 *
                 * 用 (itemId, bulletIndex) 定位，而不是给 bullet 加 id——
                 * Schema 里 description 是裸 string[]，本轮不改 Schema（第 16 条）。
                 * 已知代价：前面的 bullet 被删掉导致下标前移时，
                 * 提示可能暂时挂在占据了旧下标的相邻行上。这是 UI 定位的限制，
                 * 不影响正确性——因为采用时的三道校验拦在写入之前。
                 */
                const aiOnThisRow =
                  aiState.status !== 'idle' &&
                  aiState.itemId === item.id &&
                  aiState.bulletIndex === bulletIndex;

                const isLoadingHere = aiOnThisRow && aiState.status === 'loading';

                return (
                  // bullet 在 Schema 里是裸 string[]，没有 id，因此只能用下标作 key。
                  // 这是当前 Schema 的限制，不为了 key 去改数据结构。
                  <div key={bulletIndex} className={styles.bulletBlock}>
                    <div className={styles.bulletRow}>
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
                        className={styles.bulletAi}
                        // 空 bullet 不可优化；有请求在途时全部 AI 按钮暂停。
                        disabled={bullet.trim() === '' || aiBusy}
                        onClick={() => handleOptimize(item.id, bulletIndex, bullet)}
                      >
                        {isLoadingHere ? '优化中…' : 'AI 优化'}
                      </button>
                      <button
                        type="button"
                        className={styles.bulletRemove}
                        onClick={() => onRemoveBullet(item.id, bulletIndex)}
                      >
                        删除
                      </button>
                    </div>

                    {/* 建议面板：只在这里展示，用户不点「采用」就不会进入 Resume。 */}
                    {aiOnThisRow && aiState.status === 'success' && (
                      <div className={styles.aiPanel}>
                        <p className={styles.aiPanelLabel}>AI 建议</p>
                        <p className={styles.aiPanelText}>{aiState.suggestion}</p>
                        <div className={styles.aiPanelActions}>
                          <button
                            type="button"
                            className={styles.aiAdopt}
                            onClick={handleAdopt}
                          >
                            采用
                          </button>
                          <button
                            type="button"
                            className={styles.aiDismiss}
                            onClick={handleCancel}
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    )}

                    {aiOnThisRow && aiState.status === 'error' && (
                      <p className={styles.aiPanelError}>{aiState.message}</p>
                    )}
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
                // 删除整条工作经历属重要删除，需要确认；取消则完全不动数据。
                if (window.confirm(describeRemoval(item))) {
                  onRemoveItem(item.id);
                }
              }}
            >
              删除这条工作经历
            </button>
          </div>
        ))
      )}

      <button type="button" className={styles.addItem} onClick={onAddItem}>
        + 添加工作经历
      </button>
    </details>
  );
}

/**
 * 删除确认的提示文案。
 *
 * 带上公司 / 职位让用户知道自己正在删哪一条；两者都为空时退回通用文案，
 * 避免出现「确认删除「 / 」这条工作经历？」这种没信息量的句子。
 */
function describeRemoval(item: WorkItem): string {
  const summary = [item.company, item.role].filter((part) => part.trim()).join(' / ');
  if (!summary) {
    return '确认删除这条工作经历？';
  }
  return `确认删除「${summary}」这条工作经历？`;
}
