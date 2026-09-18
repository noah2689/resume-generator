import { Link } from 'react-router-dom';

/**
 * 页面 A：我的简历。
 *
 * M0 只建立路由空壳，列表、新建、复制、删除等功能属于后续 Milestone。
 */
export default function MyResumesPage() {
  return (
    <section className="panel">
      <h1 className="panel__title">我的简历</h1>
      <p className="panel__text">M0 阶段仅建立页面骨架，简历列表功能尚未实现。</p>
      <p className="panel__text">
        <Link to="/new">新建简历</Link>
      </p>
    </section>
  );
}
