# Music to YouTube Link Converter 🎵

Веб-сервис для мгновенного поиска и конвертации музыкальных ссылок (Spotify, Apple Music, Deezer, Yandex Music и др.) в прямые ссылки на YouTube и YouTube Music.

---

## 🚀 Быстрая установка на VPS (Ubuntu / Debian)

### 1. Подготовка сервера и установка пакетов

Подключитесь к VPS по SSH под пользователем `root` и выполните установку Node.js 20, Nginx, Certbot и PM2:

```bash
# Обновление системы
apt update && apt upgrade -y

# Установка базовых утилит, Nginx и Certbot
apt install -y curl git nginx certbot python3-certbot-nginx

# Установка Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Установка PM2 для автозапуска в фоне
npm install -g pm2
```

---

### 2. Клонирование и сборка проекта

```bash
# Создаем директорию для проекта
mkdir -p /var/www/music-converter
cd /var/www/music-converter

# Клонируем репозиторий (замените URL на ваш репозиторий)
git clone <URL_ВАШЕГО_РЕПОЗИТОРИЯ> .

# Устанавливаем зависимости
npm install

# Собираем проект
npm run build
```

---

### 3. Фоновый запуск через PM2

```bash
# Запуск приложения
NODE_ENV=production pm2 start dist/server.cjs --name "music-converter"

# Сохранение процесса и настройка автозапуска при перезагрузке системы
pm2 save
pm2 startup
```
*(Если `pm2 startup` выведет команду в терминал — скопируйте и выполните её)*.

---

### 4. Настройка Nginx

Создайте файл конфигурации для вашего сайта (замените `yourdomain.com` на ваш домен):

```bash
nano /etc/nginx/sites-available/music-converter
```

Вставьте следующую конфигурацию:

```nginx
server {
    listen 80;
    server_name yourdomain.com; # Укажите ваш домен или поддомен

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Активируйте сайт и перезапустите Nginx:

```bash
# Создаем симлинк
ln -s /etc/nginx/sites-available/music-converter /etc/nginx/sites-enabled/

# Удаляем стандартный дефолтный сайт Nginx
rm -f /etc/nginx/sites-enabled/default

# Проверяем конфиг
nginx -t

# Перезагружаем Nginx
systemctl restart nginx
```

---

### 5. Получение бесплатного SSL-сертификата (HTTPS)

Убедитесь, что A-запись вашего домена указывает на IP вашего сервера, и выполните:

```bash
certbot --nginx -d yourdomain.com
```

Certbot автоматически настроит защищённое HTTPS-соединение и автопродление сертификата.

---

## 🛠 Полезные команды для обслуживания

* **Просмотр логов работы сервера:**
  ```bash
  pm2 logs music-converter
  ```
* **Статус приложения:**
  ```bash
  pm2 status
  ```
* **Перезапуск сервера:**
  ```bash
  pm2 restart music-converter
  ```
* **Обновление проекта до новой версии:**
  ```bash
  cd /var/www/music-converter
  git pull
  npm install
  npm run build
  pm2 restart music-converter
  ```
