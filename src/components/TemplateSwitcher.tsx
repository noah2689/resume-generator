import styles from './TemplateSwitcher.module.css';

/**
 * 模板选择控件（M4 最小实现）。
 *
 * 依据：docs/ai-context/04_TEMPLATE_SYSTEM_SPEC.md 第 2、3 节、
 *       02_MVP_PRODUCT_SPEC.md 第 1 节（页面 D）
 *
 * 为什么是最小实现：
 * - 本轮要验证的是「同一份 Resume 在 3 个模板间切换时内容不丢」这条架构承诺，
 *   不是模板浏览体验。完整的选择页（缩略图 / 布局标签 / 「使用」按钮 / 抽屉 / 弹窗）
 *   属于后续阶段，且依赖缩略图生成流程。
 * - 06 第 8 节明确禁止「模板卡片只是图片却说切换模板完成」，
 *   所以本轮不做一个只有外壳没有真实缩略图的卡片列表。
 *
 * 职责（严格限定）：
 * - 受控组件：当前值来自 props.templateId，变化时上抛 onChange。
 * - 不持有状态，不读路由，不读 / 写 LocalStorage，不 import sampleResume。
 * - **不修改 Resume，不自动修复未知 templateId**——「展示层回退」不等于「数据迁移」。
 *
 * 三个已知 option 与 renderer 的 switch 里各写一遍 id，这是当前刻意接受的重复：
 * 只有这两处，且抽一份 TEMPLATE_OPTIONS / 模板元数据表属于模板元数据系统，
 * 本轮明确不做（那要等模板数量真的增长、出现真实复用场景时再评估）。
 *
 * 未知 templateId：
 * - 额外渲染一个 disabled 的 option 显示当前值，让 select 有**明确的可见状态**，
 *   而不是原生空白（blank select 会被用户读成「界面坏了」）。
 * - 该 option 不可选：用户只能主动去选三个已知模板之一来恢复正常。
 *   不自动 setTemplateId、不 mount 时修复、不写 storage、不 Toast、不 ErrorBoundary。
 */

interface TemplateSwitcherProps {
  templateId: string;
  onChange: (templateId: string) => void;
}

export default function TemplateSwitcher({
  templateId,
  onChange,
}: TemplateSwitcherProps) {
  /**
   * 当前 id 是否属于三个已知模板。
   *
   * 故意写成显式比较而不是查一张 id 数组：数组常量就是「模板元数据」的雏形，
   * 而本轮明确不引入模板定义表（见文件顶部说明）。
   */
  const isKnownTemplate =
    templateId === 'simple-single-column' ||
    templateId === 'business-single-column' ||
    templateId === 'two-column';

  const selectId = 'template-switcher';

  return (
    <div className={styles.wrapper}>
      <label className={styles.label} htmlFor={selectId}>
        模板
      </label>
      <select
        id={selectId}
        className={styles.select}
        value={templateId}
        onChange={(event) => onChange(event.target.value)}
      >
        {/* 未知 id 时才出现：显示当前不受支持的值，并明确告知已回退。 */}
        {!isKnownTemplate && (
          <option value={templateId} disabled>
            未知模板（已回退为简约单栏）
          </option>
        )}
        <option value="simple-single-column">简约单栏</option>
        <option value="business-single-column">商务单栏</option>
        <option value="two-column">左右双栏</option>
      </select>
    </div>
  );
}
