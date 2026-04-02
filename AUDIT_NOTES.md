# AUDIT_NOTES

## 2026-03-29 — старт технической стабилизации

### Подтверждено по коду
- Основной AI-движок проекта: `lib/trainer-engine.ts`.
- Активные маршруты используют:
  - `app/api/scenario/route.ts` -> `buildScenario` из `trainer-engine.ts`
  - `app/api/chat-stream/route.ts` -> `streamTrainerReply` из `trainer-engine.ts`
- `app/api/chat/route.ts` использует `lib/trainer.ts` и выглядит как legacy fallback / старая ветка.
- `lib/trainer-service.ts` не подключен активными маршрутами и выглядит как устаревшая дублирующая реализация.

### Первый вывод
- `trainer-engine.ts` оставляем как canonical source of truth.
- `trainer.ts` и `trainer-service.ts` кандидаты на удаление или архивирование после финальной зачистки.
- Следующие шаги:
  1. проверить, нужен ли вообще `app/api/chat/route.ts`;
  2. удалить/заменить legacy imports;
  3. затем перейти к чистке кодировки и валидации payload.

### Что уже сделано
- `app/api/chat/route.ts` переписан как совместимый legacy-wrapper над `trainer-engine.ts`.
- Теперь старый маршрут больше не зависит от `lib/trainer.ts` и не тянет отдельную устаревшую ветку логики.
- `lib/trainer.ts` и `lib/trainer-service.ts` очищены до временных stub-файлов, чтобы исключить случайное использование старой логики и не ломать путь импорта при возможных внешних ссылках.
- Следующая безопасная цель: удалить stub-файлы полностью после ещё одного круга проверки и перейти к чистке кодировки/текстов.
- Начата чистка битой кириллицы. В первую очередь правятся активные пользовательские экраны и API-сообщения, потом seed-данные и второстепенные legacy-компоненты.
- Добавлен единый слой валидации `lib/validation.ts` на `zod`.
- На `zod` переведены маршруты: `scenario`, `manager/settings`, `manager/objections`, `manager/objections/[id]`, `training-sessions`, `login`, `chat`, `chat-stream`.
- Добавлен `lib/env.ts` и вынесен контроль `SESSION_SECRET`: в production секрет обязателен, в dev допускается fallback.
