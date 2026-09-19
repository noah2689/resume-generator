/**
 * 「单条工作描述 AI 优化」的浏览器侧 HTTP 边界（M7.1）。
 *
 * 它的全部职责就是这一件事：把一个字符串 POST 给同源 endpoint，把 suggestion 拿回来。
 *
 * 边界（第 19 条，严格限定）：
 * - 只发相对路径。**provider 域名不允许出现在这里**——浏览器永远不知道
 *   api.deepseek.com 的存在，也永远拿不到 Authorization。
 * - 不做 `AIService` 类、不做 Provider interface、不做 retry、不做通用 API client、
 *   不做 prompt 组装。prompt 与模型参数全部固定在服务端。
 * - 不碰 Resume、不碰 LocalStorage、不碰 React。它是纯函数式的 IO 边界：
 *   要么返回 string，要么 throw。
 *
 * 关于错误：这里 throw 出去的 Error **不给用户看**。
 * 调用方（WorkExperienceForm）一律显示统一文案「优化失败，请重试。」——
 * HTTP 状态码、服务端错误码、provider 报错对用户都没有意义，
 * 说清楚「失败了，可以再试一次」就够了（第 6 条）。
 *
 * 依据：M7.1 最终口径 第 5、6、19 条
 */

/** 与 server/index.mjs 里的 OPTIMIZE_PATH 必须一致。 */
const OPTIMIZE_ENDPOINT = '/api/ai/optimize-work-bullet';

/**
 * 请求一条改写建议。
 *
 * @param text 当前 bullet 的原文。这是**唯一**发送的字段（第 5 条）：
 *             role / targetRole / company / 整份 Resume 本轮都不发送。
 * @returns 服务端清洗后的建议文本
 * @throws HTTP 非 2xx、响应不是预期形状、网络失败
 */
export async function requestBulletSuggestion(text: string): Promise<string> {
  const response = await fetch(OPTIMIZE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(`optimize-work-bullet failed with status ${response.status}`);
  }

  const payload: unknown = await response.json();

  const suggestion =
    payload !== null && typeof payload === 'object'
      ? (payload as { suggestion?: unknown }).suggestion
      : undefined;

  // 空串也按失败处理：服务端已经保证 suggestion 非空，
  // 这里再判一次是因为「拿到一个空建议」和「拿到建议」在 UI 上是两回事，
  // 不能让它渲染出一个空白面板。
  if (typeof suggestion !== 'string' || suggestion.trim() === '') {
    throw new Error('optimize-work-bullet response missing suggestion');
  }

  return suggestion;
}
