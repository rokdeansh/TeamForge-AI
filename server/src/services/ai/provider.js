import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';

export async function generateJson({ system, input }) {
  if (!env.AI_API_URL || !env.AI_API_KEY || !env.AI_MODEL) throw new AppError('AI is not configured on this server yet', 503, 'AI_UNAVAILABLE');
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(env.AI_API_URL, { method: 'POST', signal: controller.signal, headers: { Authorization: `Bearer ${env.AI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: env.AI_MODEL, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: input }] }) });
      if (!response.ok) throw new Error(`Provider returned ${response.status}`);
      const data = await response.json(); const content = data.choices?.[0]?.message?.content;
      if (typeof content !== 'string') throw new Error('Provider response did not contain JSON text');
      return JSON.parse(content);
    } catch (error) {
      if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 300));
      else throw new AppError(error.name === 'AbortError' ? 'AI request timed out. Try again.' : 'AI could not complete this request. Try again later.', 503, 'AI_PROVIDER_ERROR');
    } finally { clearTimeout(timer); }
  }
}
