# Favicon Urban Luxe (10.09.2026)

Сейчас на сайте иконка — emoji 🏠 в inline-SVG (`data:` URI). Браузеры её показывают,
а Яндекс и Google — нет: им нужен реальный файл `/favicon.ico` (у нас 404) и/или PNG по ссылке.

## Что сделать (Арсен)

1. Скопировать все файлы из этой папки (кроме README) в корень `public/`:
   favicon.ico, favicon.svg, favicon-16x16.png, favicon-32x32.png, favicon-48x48.png, favicon-120x120.png,
   apple-touch-icon.png, android-chrome-192x192.png, android-chrome-512x512.png, site.webmanifest

2. В `public/index.html` заменить строку
   `<link rel="icon" href="data:image/svg+xml,...🏠...">`
   на блок:

```html
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png">
<link rel="icon" type="image/png" sizes="120x120" href="/favicon-120x120.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#0f0f0f">
```

3. Задеплоить. Проверка: https://urbanluxe.cc/favicon.ico должен открываться.

## После деплоя (сделаю я)
- Яндекс.Вебмастер → «Проверить фавикон» / переобход главной — Яндекс обновляет значок в выдаче
  обычно за 1–2 недели.
- Google Search Console → запрос индексации главной. Google подхватывает favicon за несколько дней.

Дизайн: эмблема из логотипа Urban Luxe (корона + здание), золото #C9A96E на тёмном #0F0F0F, скруглённый квадрат. Векторный исходник — favicon.svg.
