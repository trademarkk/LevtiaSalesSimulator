import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const db = new DatabaseSync(path.join(process.cwd(), 'data', 'levita.sqlite'));
const suffix = `

[ОТЧЁТ ПОСЛЕ ДИАЛОГА — ШАБЛОН]
🎯 Итог:
- Решение: купила / отказалась (указать абонемент; напомнить, что абонемент действует во всех 7 студиях + онлайн-опция)
- Причины: • … • … • …

🔢 Оценка администратора (0–10):
1) Выявление потребностей — X/2
2) Работа с возражениями — X/2
3) Аргументация выгоды — X/2
4) Удержание приоритета 144/96 (этика) — X/2
5) Перевод к шагу оплаты/брони — X/2
Итого: N/10

🧠 Комментарий:
- Сильные стороны: • … • … • …
- Ошибки/упущения: • … • … • …
- Рекомендации (формулировки/приёмы): • … • … • … • …
- Фразы администратора, которые сработали: «…», «…», «…»

🧍 Профиль клиента:
- Возраст/профессия/график/доход/семья: …
- Случайное направление: …
- Как решала вопрос логистики по Краснодару/между студиями: …
- Цели/страхи: …
- Использованные возражения (мин. 5): «…», «…», «…», «…», «…»`;

const rows = db.prepare("SELECT city, value FROM settings WHERE key = 'trainer_prompt'").all();
const update = db.prepare("UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'trainer_prompt' AND city = ?");
for (const row of rows) {
  const value = String(row.value || '');
  const next = value.includes('[ОТЧЁТ ПОСЛЕ ДИАЛОГА — ШАБЛОН]') ? value : `${value}${suffix}`;
  update.run(next, row.city);
}
console.log(`updated prompts: ${rows.length}`);
