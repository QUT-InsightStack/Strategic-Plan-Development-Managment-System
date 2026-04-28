# Strategic-Plan-Development-Management-System

# Environment Setup Guide

---

## 1. Prerequisites

Before setting up the project, ensure the following tools are installed:

* PHP (>= 8.3)
* Composer
* Node.js and npm
* Git

This project requires PHP and Composer to be installed and properly configured before proceeding.

---

## 1.1 Install PHP

### Windows

1. Download PHP from the official website: https://www.php.net/downloads

2. Extract the downloaded archive to a directory, e.g.:

   C:\php

3. Add PHP to system PATH:

   * Open "Environment Variables"
   * Edit **Path**
   * Add:

     C:\php

4. Verify installation:

   php -v

Expected output:

PHP 8.x.x (cli)

---

### macOS (using Homebrew)

brew install php

---

### Linux (Ubuntu)

sudo apt update
sudo apt install php php-cli php-mbstring php-xml php-curl php-zip unzip

---

## 1.2 Required PHP Extensions

Ensure the following extensions are enabled:

* mbstring
* openssl
* pdo
* tokenizer
* xml
* ctype
* json
* curl
* zip

To check installed extensions:

php -m

---

## 1.3 Install Composer

Composer is a dependency manager for PHP.

### Windows

1. Download Composer from: https://getcomposer.org/download/
2. Run the installer and ensure it detects your PHP installation
3. Follow the installation wizard

---

### macOS / Linux

curl -sS https://getcomposer.org/installer | php
mv composer.phar /usr/local/bin/composer

---

### Verify installation

composer --version

Expected output:

Composer version x.x.x

---

## 1.4 Configure Composer (Global)

(Optional but recommended)

Set Composer global bin directory to PATH:

Windows:

C:\Users<username>\AppData\Roaming\Composer\vendor\bin

Verify:

composer global config bin-dir --absolute

---

## 1.5 Notes

* Ensure PHP version is compatible with Laravel (>= 8.3 recommended)
* Composer requires PHP to be correctly installed and accessible via PATH
* If Composer fails to detect PHP, manually specify the PHP executable path during installation

---

## 2. Install Laravel Installer (Optional)

Run the following command to install Laravel globally:

composer global require laravel/installer

Verify installation:

laravel --version

---

## 3. Configure GitHub Access Token (for Private Repositories)

If the project depends on private GitHub repositories, a Personal Access Token is required.

### Step 1: Create Token

* Go to GitHub → Settings → Developer settings → Personal access tokens
* Choose **Fine-grained token**
* Configure:

  * Resource owner: Select your GitHub account or organisation
  * Repository access: Only selected repositories
  * Permissions:

    * Contents → Read-only

⚠️ Copy your token immediately after creation. It will not be shown again.

---

### Step 2: Configure Token in Composer

Set the token globally:

composer config --global --auth github-oauth.github.com <your_token>

To remove existing token (if needed):

composer config --global --unset github-oauth.github.com

---

### Step 3: Verify Configuration

Check whether the token is configured:

composer config --global --list

Or inspect the auth.json file:

C:\Users<username>\AppData\Roaming\Composer\auth.json

---

## 4. Clone Repository

Clone the project from GitHub:

git clone https://github.com/Yufei0122/Strategic-Plan-Development-Management-System

Navigate into the project directory:

cd Strategic-Plan-Development-Management-System

⚠️ Do NOT use `composer create-project`, as this project already exists.

---

## 5. Install Project Dependencies

Install backend dependencies:

composer install

Install frontend dependencies:

npm install

---

## 6. Configure Environment File

Copy the example environment file:

### Windows

copy .env.example .env

### macOS / Linux

cp .env.example .env

---

## 7. Generate Application Key

php artisan key:generate

---

## 8. Configure Database

### Step 1: Create Database

Execute the provided SQL script using MySQL:

```sql
SOURCE init_db.sql;
```

### Step 2: Update database configuration in `.env`:

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=db_spdms
DB_USERNAME=your_username
DB_PASSWORD=your_password

⚠️ Note:
- The database must exist before running migrations
- Use lowercase `mysql` as the connection name (not `MySQL`)
---

## 9. Run Database Migrations

php artisan migrate

# Local development only: seed manual test data.
php artisan db:seed

---

## 10. Run the Application

After completing the environment and database configuration, the application can be started as follows.

---

### Step 1: Start Laravel Development Server

Run the following command:

```bash
php artisan serve
```

The application will be available at:

http://127.0.0.1:8000

---

### Step 2: Start Frontend Development Server

In a separate terminal, run:

```bash
npm run dev
```

This compiles frontend assets using Vite.

---

### Step 3: Access the Application

Open your browser and visit:

http://127.0.0.1:8000

If the Laravel welcome page is displayed, the application is running successfully.

---

## 11. Verification

To verify that the setup is successful:

* The Laravel welcome page is accessible in the browser
* No errors are shown in the terminal
* Database migrations run successfully

---

## 12. Notes

* Ensure both backend and frontend servers are running during development
* The frontend server (`npm run dev`) is required for asset compilation

* The GitHub token is only used by Composer to download dependencies
* It does NOT affect Git operations such as commit or push
* Do NOT commit `.env` or `auth.json` files to the repository
* Each developer must configure their own local environment

* If changes are made to `.env`, clear cache:

```bash
php artisan config:clear
```

---

## 13. Common Issues

### Xdebug Timeout Message

The following message can be ignored:

Xdebug: Time-out connecting to debugging client

---

### Invalid Token Error

If you see:

Invalid token provided

Solution:

* Recreate the token with correct permissions
* Reconfigure using Composer

---

### Missing Dependencies

If dependencies are missing:

composer install
npm install

---

### Port Already in Use

If port 8000 is occupied, run:

```bash
php artisan serve --port=8001
```

---

### Frontend Not Loading (CSS/JS Missing)

Run:

```bash
npm run dev
```

---

### Environment Changes Not Applied

Run:

```bash
php artisan config:clear
php artisan cache:clear
```
---

## 14. Security Considerations

* Each team member must use their own GitHub token
* Follow the principle of least privilege (read-only access where possible)
* Do not share tokens or credentials
* Sensitive files such as `.env` and `auth.json` must be excluded via `.gitignore`
* Authentication credentials should only be stored locally

---

## 15. About Laravel

Laravel is a web application framework with expressive, elegant syntax. We believe development must be an enjoyable and creative experience to be truly fulfilling. Laravel takes the pain out of development by easing common tasks used in many web projects, such as:

- [Simple, fast routing engine](https://laravel.com/docs/routing).
- [Powerful dependency injection container](https://laravel.com/docs/container).
- Multiple back-ends for [session](https://laravel.com/docs/session) and [cache](https://laravel.com/docs/cache) storage.
- Expressive, intuitive [database ORM](https://laravel.com/docs/eloquent).
- Database agnostic [schema migrations](https://laravel.com/docs/migrations).
- [Robust background job processing](https://laravel.com/docs/queues).
- [Real-time event broadcasting](https://laravel.com/docs/broadcasting).

Laravel is accessible, powerful, and provides tools required for large, robust applications.

## 16. Version Control

This project uses a Laravel-standard `.gitignore` configuration to exclude:

- Environment files (`.env`)
- Dependency directories (`vendor/`, `node_modules/`)
- Sensitive authentication files (`auth.json`)

This ensures security and consistency across development environments.

## 17. Summary

To set up the project locally:

1. Install required tools
2. Configure GitHub token (if required)
3. Clone repository
4. Install dependencies
5. Configure environment
6. Run migrations
7. Start the application

This ensures consistency across all development environments.
