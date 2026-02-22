/**
 * LLM Client
 * 统一调用 OpenAI 兼容接口，支持流式输出
 * 零依赖，使用原生 fetch + ReadableStream
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMConfig {
  baseURL: string;
  apiKey: string;
  model: string;
}

/**
 * 流式调用 OpenAI 兼容接口
 * @param config LLM 配置
 * @param messages 消息列表
 * @param onChunk 增量 token 回调
 * @param signal 中断信号
 * @returns 完整文本
 */
export async function chatStream(
  config: LLMConfig,
  messages: ChatMessage[],
  onChunk: (delta: string) => void,
  signal?: AbortSignal,
  onThinking?: (delta: string) => void,
): Promise<string> {
  const url = `${config.baseURL.replace(/\/$/, '')}/chat/completions`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 2048,
    }),
    signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`LLM 请求失败 (${res.status}): ${errText || res.statusText}`);
  }

  if (!res.body) {
    throw new Error('响应无 body');
  }

  // 解析 SSE 流
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);
      if (data === '[DONE]') continue;

      try {
        const json = JSON.parse(data);
        const delta = json.choices?.[0]?.delta;
        if (!delta) continue;

        // 主回答 content
        const content: string = delta.content || '';
        if (content) {
          full += content;
          onChunk(content);
        }

        // Thinking 模型的推理过程（Qwen-QwQ / DeepSeek-R1 等）
        const reasoning: string =
          delta.reasoning_content || delta.thinking_content || '';
        if (reasoning && onThinking) {
          onThinking(reasoning);
        }
      } catch {
        // skip malformed JSON lines
      }
    }
  }

  return full;
}

/**
 * 非流式调用，直接返回完整文本
 * 用于时间提取等需要完整响应的轻量调用
 */
export async function chatOnce(
  config: LLMConfig,
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<string> {
  const url = `${config.baseURL.replace(/\/$/, '')}/chat/completions`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      stream: false,
      temperature: 0,
      max_tokens: 1024,
    }),
    signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`LLM 请求失败 (${res.status}): ${errText || res.statusText}`);
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content || '';
}
