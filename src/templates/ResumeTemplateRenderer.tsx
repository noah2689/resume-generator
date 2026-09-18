import type { Resume } from '../types/resume';
import BusinessSingleColumn from './BusinessSingleColumn';
import SimpleSingleColumn from './SimpleSingleColumn';
import TwoColumn from './TwoColumn';

/**
 * 模板渲染分发器（M4）。
 *
 * 依据：docs/ai-context/04_TEMPLATE_SYSTEM_SPEC.md 第 2、3、4 节
 *
 * 职责只有一个：读 `resume.templateId`，渲染对应的模板组件。
 *
 * 这是一个**显式 renderer dispatcher**，不是模板注册中心：
 * - 没有 registry / definitions / manifest / metadata / factory / dynamic import。
 * - 模板组件是静态 import 的常量，不按 id 从表里查。
 * - 只有 3 个已知模板，显式 `switch` 就足够了。
 *
 * 为什么现在不建注册表：注册表要先发明一份模板元数据（id / name / component /
 * 缩略图 / 标签 / 布局），那是为「模板数量会增长」这个假设先付的架构成本。
 * 按 06 第 5 节复杂度预算，抽象需要 2～3 个真实复用场景；模板浏览 / 缩略图
 * 属于后续阶段（07 把它划在 M8）。当前三个字符串的重复是可接受的。
 *
 * 边界：
 * - 只接收 resume，不持状态、不取数、不读路由、不读 LocalStorage、不写存储。
 * - 不修改 Resume，不做排序、不做过滤、不注入默认内容。
 * - visible 过滤与 order 排序是**各模板自己的职责**，不在这里统一处理。
 *
 * 未知 templateId 的处理（04 第 11 节 + 02 第 7 节）：
 * - 安全回退到 SimpleSingleColumn，页面不崩。
 * - **不自动修改 resume.templateId、不写回 storage、不做 migration**。
 *   展示层回退 ≠ 数据迁移。
 * - 用户主动选择任一已知模板后才正常更新数据（由 EditorPage 的 handler 完成）。
 */
export default function ResumeTemplateRenderer({ resume }: { resume: Resume }) {
  switch (resume.templateId) {
    case 'business-single-column':
      return <BusinessSingleColumn resume={resume} />;

    case 'two-column':
      return <TwoColumn resume={resume} />;

    // 显式写出已知 id，而不是依赖 default：
    // 这样「已知」与「未知」在代码里是两件不同的事，将来新增模板时
    // 也不会被 default 悄悄吞掉。
    case 'simple-single-column':
    default:
      return <SimpleSingleColumn resume={resume} />;
  }
}
