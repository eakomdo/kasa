"""
Kasa API settings. Everything environment-specific comes from env vars (see
.env.example), so one settings module serves dev, CI and production.
"""

from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent
env = environ.Env()
environ.Env.read_env(BASE_DIR / '.env', overwrite=False)

DEBUG = env.bool('DJANGO_DEBUG', default=False)
SECRET_KEY = env('DJANGO_SECRET_KEY', default='dev-only-insecure-key-change-me' if DEBUG else environ.Env.NOTSET)
ALLOWED_HOSTS = env.list('DJANGO_ALLOWED_HOSTS', default=['localhost', '127.0.0.1', 'testserver'])

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third party
    'rest_framework',
    'rest_framework.authtoken',
    'corsheaders',
    'drf_spectacular',
    # Kasa
    'apps.core',
    'apps.accounts',
    'apps.curriculum',
    'apps.learning',
    'apps.translate',
    'apps.community',
    'apps.notifications',
    'apps.staff',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'apps.core.middleware.LastActiveMiddleware',
]

ROOT_URLCONF = 'config.urls'
WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# SQLite for local development; PostgreSQL in production via DATABASE_URL.
DATABASES = {'default': env.db('DATABASE_URL', default=f'sqlite:///{BASE_DIR / "db.sqlite3"}')}
DATABASES['default']['CONN_MAX_AGE'] = env.int('DB_CONN_MAX_AGE', default=60)

# Redis in production (shared across app servers); local memory otherwise.
CACHE_URL = env('CACHE_URL', default='')
CACHES = {
    'default': {'BACKEND': 'django.core.cache.backends.redis.RedisCache', 'LOCATION': CACHE_URL}
    if CACHE_URL.startswith('redis')
    else {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache', 'LOCATION': 'kasa'}
}

AUTH_USER_MODEL = 'accounts.User'
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 8}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
]

LANGUAGE_CODE = 'en-gb'
TIME_ZONE = 'Africa/Accra'  # UTC+0, no daylight saving
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = 'media/'
MEDIA_ROOT = Path(env('MEDIA_ROOT', default=str(BASE_DIR / 'media')))
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ---------------------------------------------------------------- API
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ['rest_framework.authentication.TokenAuthentication'],
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated'],
    # The frontend speaks camelCase JSON; Python stays snake_case.
    'DEFAULT_RENDERER_CLASSES': ['djangorestframework_camel_case.render.CamelCaseJSONRenderer'],
    'DEFAULT_PARSER_CLASSES': ['djangorestframework_camel_case.parser.CamelCaseJSONParser'],
    'JSON_UNDERSCOREIZE': {'no_underscore_before_number': True},
    'EXCEPTION_HANDLER': 'apps.core.exceptions.exception_handler',
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.UserRateThrottle',
        'rest_framework.throttling.AnonRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'user': env('THROTTLE_USER', default='600/min'),
        'anon': env('THROTTLE_ANON', default='60/min'),
        'auth': env('THROTTLE_AUTH', default='10/min'),
    },
    'UNAUTHENTICATED_USER': None,
}

SPECTACULAR_SETTINGS = {
    'TITLE': 'Kasa API',
    'DESCRIPTION': 'Ghanaian language learning on the GES curriculum. See docs/api-contract.md in the frontend repo.',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'POSTPROCESSING_HOOKS': [
        'drf_spectacular.hooks.postprocess_schema_enums',
        'drf_spectacular.contrib.djangorestframework_camel_case.camelize_serializer_fields',
    ],
}

CORS_ALLOWED_ORIGINS = env.list('CORS_ALLOWED_ORIGINS', default=['http://localhost:5173', 'http://127.0.0.1:5173'])
CSRF_TRUSTED_ORIGINS = env.list('CSRF_TRUSTED_ORIGINS', default=[])

# ---------------------------------------------------------------- Kasa
KHAYA_API_KEY = env('KHAYA_API_KEY', default='')
KHAYA_BASE_URL = env('KHAYA_BASE_URL', default='https://translation-api.ghananlp.org')
KHAYA_TIMEOUT = env.int('KHAYA_TIMEOUT', default=20)
TTS_CACHE_DIR = MEDIA_ROOT / 'tts-cache'

# ---------------------------------------------------------------- Production hardening
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = env.bool('DJANGO_SECURE_SSL_REDIRECT', default=True)
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = env.int('DJANGO_HSTS_SECONDS', default=60 * 60 * 24 * 365)
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    # Turn on only once the production domain is final: preload is hard to undo
    SECURE_HSTS_PRELOAD = env.bool('DJANGO_HSTS_PRELOAD', default=False)
    SECURE_CONTENT_TYPE_NOSNIFF = True

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {'plain': {'format': '%(asctime)s %(levelname)s %(name)s %(message)s'}},
    'handlers': {'console': {'class': 'logging.StreamHandler', 'formatter': 'plain'}},
    'root': {'handlers': ['console'], 'level': env('LOG_LEVEL', default='INFO')},
}
