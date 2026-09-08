# Strategic-Plan-Development-Management-System

# Environment Setup Guide

---

## 1. Prerequisites

Before setting up the project, ensure the following tools are installed:

* PHP (>= 8.3)
* Composer
* Node.js(>=20.19.0) and npm
⚠️ It is strongly recommended to use the latest Node.js LTS version instead of the Current release version, as some frontend dependencies may not be fully compatible with non-LTS releases.
* Git

This project requires PHP and Composer to be installed and properly configured before proceeding.

This project is built with Laravel and Vite. Because Vite requires a relatively recent version of Node.js, using an outdated Node.js version may cause the frontend to fail at runtime due to missing dependencies. Please install the latest stable version of Node.js and complete the frontend environment setup before running the project.

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

git clone https://github.com/QUT-InsightStack/Strategic-Plan-Development-Managment-System

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
## 8. Configure JWT Authentication

This project uses `tymon/jwt-auth` for API authentication. JWT is configured in `config/jwt.php`, and the API guard is configured in `config/auth.php` with the `jwt` driver.

### Step 1: Generate JWT Secret

After creating the `.env` file and generating the Laravel application key, generate a JWT signing secret:

```bash
php artisan jwt:secret
```

This command adds a generated secret to `.env`:

```env
JWT_SECRET=your_generated_secret
```

Important:

* Do not commit your personal `.env` file to Git.
* Each developer must generate their own local JWT secret.
* Keep the `JWT_SECRET` placeholder in `.env.example`; never store a real secret in the repository.

### Step 2: Check JWT Environment Values

The default JWT values are already included in `.env.example`:

```env
JWT_SECRET=
JWT_TTL=30
JWT_REFRESH_TTL=10080
JWT_BLACKLIST_ENABLED=true
JWT_COOKIE_SECURE=false
```

Meaning:

* `JWT_TTL=30` keeps access tokens valid for 30 minutes.
* `JWT_REFRESH_TTL=10080` allows refresh for 7 days.
* `JWT_BLACKLIST_ENABLED=true` invalidates tokens on logout/refresh.
* `JWT_COOKIE_SECURE=false` supports local HTTP development. Set this to `true` in production when the app runs over HTTPS.

After generating the JWT secret or changing `.env`, clear Laravel's cached configuration:

```bash
php artisan config:clear
php artisan cache:clear
php artisan optimize:clear
```

### Step 3: How JWT Is Used In This Project

On successful login, the API returns the JWT token in the JSON response and also sets it as an HttpOnly cookie named `access_token`.

Browser requests should use cookies:

* The login frontend posts to `/api/login` with `credentials: 'include'`.
* The `access_token` cookie is HttpOnly, so JavaScript cannot read it directly.
* `JwtCookieMiddleware` copies the cookie into an `Authorization: Bearer <token>` header internally so `jwt-auth` can authenticate the request.

External API clients can send the token manually:

```http
Authorization: Bearer <token>
```

Requests without a valid JWT will receive a JSON `401 Unauthenticated` response.

### Step 4: Auth Endpoints

Login:

```http
POST /api/login
Content-Type: application/json
Accept: application/json

{
  "email": "user@example.com",
  "password": "password"
}
```

Response includes:

```json
{
  "success": true,
  "message": "Logged in successfully.",
  "token": "<jwt_token>"
}
```

Current auth routes:

* `POST /api/login` - login and issue JWT.
* `POST /api/logout` - blacklist the current JWT and clear the cookie.
* `POST /api/refresh` - rotate the JWT within the refresh window.
* `GET /api/me` - return the authenticated user.
* `PUT /api/profile` - update the authenticated user's profile.

The project also exposes `/api/auth/login`, `/api/auth/logout`, `/api/auth/refresh`, `/api/auth/me`, and `/api/auth/profile` variants.

## 9. Configure Database

### Step 1: Create Database

Execute the provided SQL script using MySQL:

```sql
SOURCE init_db.sql;
```

### Step 2: Update database configuration in `.env`:

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=dbspdms
DB_USERNAME=your_username
DB_PASSWORD=your_password

⚠️ Note:
- The database must exist before running migrations
- Use lowercase `mysql` as the connection name (not `MySQL`)
---

## 10. Run Database Migrations

php artisan migrate

# Local development only: seed manual test data.
php artisan db:seed

---

## 11. Run the Application

After completing the environment and database configuration, the application can be started as follows.

⚠️ During development, both the Laravel backend server and the Vite frontend development server must be running at the same time.

---

### Step 1: Start Laravel Development Server

Open the first terminal in the project root directory and run:

```bash
php artisan serve
```

The Laravel backend server will start at:

```txt
http://127.0.0.1:8000
```

Keep this terminal running during development.

---

### Step 2: Start Frontend Development Server

Open a second terminal in the same project directory and run:

```bash
npm run dev
```

If successful, the terminal should display output similar to:

```txt
VITE v8.x.x ready

➜ Local:   http://localhost:5173/
```

This starts the Vite development server for frontend asset compilation.

Keep this terminal running during development.

---

### Step 3: Access the Application

Open your browser and visit:

```txt
http://127.0.0.1:8000
```

If the Laravel welcome page is displayed, the application is running successfully.

---

## Important Notes

* Both terminals must remain running during development
* `php artisan serve` runs the Laravel backend server
* `npm run dev` runs the Vite frontend development server
* Do NOT close either terminal while developing

If the frontend server is not running, Laravel may report errors such as:

```txt
Vite manifest not found at:
public/build/manifest.json
```

This usually means the Vite development server has not been started.


## 12. Verification

To verify that the setup is successful:

* The Laravel welcome page is accessible in the browser
* No errors are shown in the terminal
* Database migrations run successfully

---

## 13. Notes

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

## 14. Common Issues

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

If frontend dependencies still fail to install or the frontend reports missing modules at runtime, verify that your local Node.js version meets the project requirement before reinstalling dependencies.

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

If the issue persists, check whether your Node.js version is up to date, then run `npm install` again.

If you encounter the following error:

```txt
Vite manifest not found at:
public/build/manifest.json
```

Ensure that the frontend development server is running:

```bash
npm run dev
```

This project uses Laravel + Vite, which requires the Vite development server during local development.


---

### Environment Changes Not Applied

Run:

```bash
php artisan config:clear
php artisan cache:clear
php artisan optimize:clear
```
---

## 15. Security Considerations

* Each team member must use their own GitHub token
* Follow the principle of least privilege (read-only access where possible)
* Do not share tokens or credentials
* Sensitive files such as `.env` and `auth.json` must be excluded via `.gitignore`
* Authentication credentials should only be stored locally

---

## 16. About Laravel

Laravel is a web application framework with expressive, elegant syntax. We believe development must be an enjoyable and creative experience to be truly fulfilling. Laravel takes the pain out of development by easing common tasks used in many web projects, such as:

- [Simple, fast routing engine](https://laravel.com/docs/routing).
- [Powerful dependency injection container](https://laravel.com/docs/container).
- Multiple back-ends for [session](https://laravel.com/docs/session) and [cache](https://laravel.com/docs/cache) storage.
- Expressive, intuitive [database ORM](https://laravel.com/docs/eloquent).
- Database agnostic [schema migrations](https://laravel.com/docs/migrations).
- [Robust background job processing](https://laravel.com/docs/queues).
- [Real-time event broadcasting](https://laravel.com/docs/broadcasting).

Laravel is accessible, powerful, and provides tools required for large, robust applications.

## 17. Version Control

This project uses a Laravel-standard `.gitignore` configuration to exclude:

- Environment files (`.env`)
- Dependency directories (`vendor/`, `node_modules/`)
- Sensitive authentication files (`auth.json`)

This ensures security and consistency across development environments.

## 18. Summary

To set up the project locally:

1. Install required tools
2. Configure GitHub token (if required)
3. Clone repository
4. Install dependencies
5. Configure environment
6. Initialize the empty database with `php artisan migrate --seed` (see [database initialization](docs/database-initialization.md) for existing databases)
7. Start the application

This ensures consistency across all development environments.
