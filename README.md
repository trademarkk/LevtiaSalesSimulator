# LEVITA Sales Simulator

Локальный тренажер для администраторов студии LEVITA:

- администратор входит в чат и отрабатывает продажу абонемента после пробного занятия;
- руководитель управляет библиотекой возражений и базовым промптом тренажера;
- сценарий чата строится на основе возражений из локальной SQLite-базы.

## Что внутри

- `Next.js 16` для интерфейса и API;
- `SQLite` через встроенный модуль `node:sqlite` для локального хранения;
- единый AI-движок в `lib/trainer-engine.ts` для сценариев, поточного диалога и итоговой оценки;
- `OpenAI Responses API` для ролевого клиента в чате;
- `OpenRouter` для бесплатного старта через `openrouter/free`;
- `DeepSeek` как альтернативный живой провайдер с потоковыми ответами;
- резервный демо-режим, если AI-ключи не заданы.

## Текущая архитектура AI

Сейчас основной и актуальный модуль тренажера — `lib/trainer-engine.ts`.

Он отвечает за:
- сбор сценария тренировки;
- потоковый ответ клиентки;
- итоговую оценку после завершения диалога;
- выбор AI-провайдера (`openai`, `openrouter`, `deepseek`, `demo`).

Маршруты используют именно его:
- `app/api/scenario/route.ts`
- `app/api/chat-stream/route.ts`

Файлы `lib/trainer.ts` и `lib/trainer-service.ts` — устаревшие ветки логики, оставшиеся после эволюции проекта. Их можно безопасно удалить после финальной зачистки импорта и функциональной сверки.

## Быстрый старт

1. Установите зависимости:

```bash
npm install
```

2. Создайте `.env` на основе `.env.example`.

3. Запустите проект:

```bash
npm run dev
```

4. Откройте [http://localhost:3000](http://localhost:3000).

## Демо-доступы

- Руководитель: `manager@levita.local` / `levita-manager`
- Администратор: `admin@levita.local` / `levita-admin`

## Переменные окружения

- `AI_PROVIDER` - `openrouter`, `deepseek` или `openai`.
- `OPENROUTER_API_KEY` - ключ OpenRouter.
- `OPENROUTER_BASE_URL` - базовый URL OpenRouter API, по умолчанию `https://openrouter.ai/api/v1`.
- `OPENROUTER_MODEL` - модель OpenRouter, для бесплатного старта `openrouter/free`.
- `DEEPSEEK_API_KEY` - ключ DeepSeek для живого потокового диалога.
- `DEEPSEEK_BASE_URL` - базовый URL DeepSeek API, по умолчанию `https://api.deepseek.com`.
- `DEEPSEEK_MODEL` - модель DeepSeek, по умолчанию `deepseek-chat`.
- `OPENAI_API_KEY` - ключ OpenAI для живого ИИ-диалога.
- `OPENAI_MODEL` - модель для чата, по умолчанию `gpt-5-mini`.
- `SESSION_SECRET` - секрет для подписи сессий. В production обязателен. В локальной разработке есть dev-fallback.

## Что важно перед хостингом

- заменить демо-логины и пароли;
- вынести SQLite в управляемую БД или хотя бы в стабильное хранилище;
- задать боевой `SESSION_SECRET`;
- подключить HTTPS и ограничение попыток входа.
