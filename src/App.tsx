import { Link, Route, Routes } from 'react-router-dom';
import EditorPage from './pages/EditorPage';
import MyResumesPage from './pages/MyResumesPage';
import NewResumePage from './pages/NewResumePage';
import { sampleResume } from './data/sampleResume';

/**
 * 应用路由表。
 *
 * M0 只有三个路由，对应 02_MVP_PRODUCT_SPEC.md 的页面 A / B / C。
 * 页面 D（模板选择）属于后续 Milestone，此处不建。
 */
export default function App() {
  return (
    <div className="app">
      <header className="app-bar">
        <span className="app-bar__brand">简历生成器</span>
        <nav className="app-bar__nav">
          <Link to="/">我的简历</Link>
          <Link to="/new">新建简历</Link>
          <Link to={`/editor/${sampleResume.id}`}>编辑器（示例数据）</Link>
        </nav>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<MyResumesPage />} />
          <Route path="/new" element={<NewResumePage />} />
          <Route path="/editor/:resumeId" element={<EditorPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </div>
  );
}

function NotFoundPage() {
  return (
    <section className="panel">
      <h1 className="panel__title">页面不存在</h1>
      <p className="panel__text">请检查地址是否正确。</p>
      <p className="panel__text">
        <Link to="/">返回我的简历</Link>
      </p>
    </section>
  );
}
