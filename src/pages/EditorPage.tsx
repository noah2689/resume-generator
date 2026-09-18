import { Link, useParams } from 'react-router-dom';
import { sampleResume } from '../data/sampleResume';
import SimpleSingleColumn from '../templates/SimpleSingleColumn';
import type { Resume } from '../types/resume';
import styles from './EditorPage.module.css';

/**
 * 页面 C：简历编辑器。
 *
 * M1 阶段这一页只做一件事：取得 Resume，交给模板渲染。
 * M0 的开发态字段检查页已被真实简历预览取代。
 *
 * 职责边界：
 * - 本页负责「取数据」与「外层舞台」（浅灰背景、居中、可横向滚动）。
 * - 简历纸面与内容排版全部属于模板组件 SimpleSingleColumn。
 * - 三栏编辑器（左侧内容编辑 / 右侧样式设置）、模板切换、保存等属于后续 Milestone。
 *
 * 仍然只有一份固定示例数据，不建立真实存储层。
 */
export default function EditorPage() {
  const { resumeId } = useParams<{ resumeId: string }>();

  // M1 仍然只有一份示例数据，因此这里直接比较 ID。
  // 简历列表与持久化属于后续 Milestone，暂不引入任何存储层。
  const resume: Resume | null = sampleResume.id === resumeId ? sampleResume : null;

  if (!resume) {
    return (
      <section className="panel">
        <h1 className="panel__title">未找到简历</h1>
        <p className="panel__text">
          当前只内置一份示例简历，ID 为 <code>{sampleResume.id}</code>。
        </p>
        <p className="panel__text">
          <Link to={`/editor/${sampleResume.id}`}>打开示例简历</Link>
        </p>
      </section>
    );
  }

  return (
    <div className={styles.stage}>
      <div className={styles.paperSlot}>
        <SimpleSingleColumn resume={resume} />
      </div>
    </div>
  );
}
