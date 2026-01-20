# Environment Variables Setup Guide

## Quick Setup

1. **Copy the example file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` file** with your configuration

3. **Required changes before running:**
   - `MONGODB_URI` - Your MongoDB connection string
   - `JWT_SECRET` - A strong random secret (min 32 characters)

## Environment Variables Reference

### Server Configuration

| Variable | Default | Description |
|---------|---------|-------------|
| `PORT` | `3000` | Server port number |
| `NODE_ENV` | `development` | Environment: `development`, `production`, `test` |

### MongoDB Configuration

| Variable | Default | Description |
|---------|---------|-------------|
| `MONGODB_URI` | `mongodb://localhost:27017/bookacut` | MongoDB connection string |
| `MONGODB_OPTIONS` | (empty) | Additional MongoDB connection options |

**MongoDB URI Examples:**
- Local: `mongodb://localhost:27017/bookacut`
- Atlas: `mongodb+srv://user:pass@cluster.mongodb.net/bookacut`

**Important:** The system uses a single MongoDB cluster with multiple databases:
- `platform_db` - Platform super admin and client admin metadata
- `client_*_db` - Individual client databases (created automatically)

### JWT Configuration

| Variable | Default | Description |
|---------|---------|-------------|
| `JWT_SECRET` | (required) | Secret key for JWT tokens (min 32 chars) |
| `JWT_EXPIRE` | `7d` | Token expiration (e.g., `7d`, `24h`, `1h`) |

**Generate secure JWT_SECRET:**
```bash
# Linux/Mac
openssl rand -base64 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Platform Admin

| Variable | Default | Description |
|---------|---------|-------------|
| `PLATFORM_ADMIN_EMAIL` | `admin@bookacut.com` | Super admin email |
| `PLATFORM_ADMIN_PASSWORD` | `ChangeThisPassword123!` | Super admin password |

**⚠️ Change these before running seed script!**

### Rate Limiting

| Variable | Default | Description |
|---------|---------|-------------|
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window (15 minutes) |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Max requests per window |

### Booking Configuration

| Variable | Default | Description |
|---------|---------|-------------|
| `BOOKING_ADVANCE_DAYS` | `7` | Max days customers can book ahead |
| `NO_SHOW_TIMEOUT_MINUTES` | `5` | Minutes before marking as no-show |

### Shop Defaults

| Variable | Default | Description |
|---------|---------|-------------|
| `DEFAULT_SLOT_DURATION_MINUTES` | `30` | Default slot duration |
| `DEFAULT_WORKING_HOURS_START` | `09:00` | Default opening time |
| `DEFAULT_WORKING_HOURS_END` | `18:00` | Default closing time |

### CORS Configuration

| Variable | Default | Description |
|---------|---------|-------------|
| `CORS_ORIGIN` | `*` | Allowed CORS origins (use specific domain in production) |

**Production example:**
```
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com
```

### Other Configuration

| Variable | Default | Description |
|---------|---------|-------------|
| `CREATE_SAMPLE_CLIENT` | `false` | Create sample client admin and database in seed script |
| `LOG_LEVEL` | `info` | Logging level: `error`, `warn`, `info`, `debug` |

**Note:** `CREATE_SAMPLE_CLIENT` creates a sample client admin in the seed script, which automatically creates a new client database.

## Production Checklist

Before deploying to production:

- [ ] Set `NODE_ENV=production`
- [ ] Generate strong `JWT_SECRET` (32+ characters)
- [ ] Use secure MongoDB instance (Atlas recommended)
- [ ] Set specific `CORS_ORIGIN` (not `*`)
- [ ] Change `PLATFORM_ADMIN_EMAIL` and `PLATFORM_ADMIN_PASSWORD`
- [ ] Review rate limiting settings
- [ ] Set appropriate `LOG_LEVEL`
- [ ] Use environment-specific MongoDB URI
- [ ] Never commit `.env` file to version control

## Example Production .env

```env
# Production Environment
NODE_ENV=production
PORT=3000

# MongoDB Atlas
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/bookacut?retryWrites=true&w=majority

# Strong JWT Secret (generated)
JWT_SECRET=your-generated-secret-key-min-32-characters-long-random-string
JWT_EXPIRE=7d

# Platform Admin
PLATFORM_ADMIN_EMAIL=admin@yourdomain.com
PLATFORM_ADMIN_PASSWORD=StrongPassword123!

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Booking Settings
BOOKING_ADVANCE_DAYS=7
NO_SHOW_TIMEOUT_MINUTES=5

# CORS (Specific domains)
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com

# Logging
LOG_LEVEL=warn
```

## Security Notes

1. **Never commit `.env` file** - It's already in `.gitignore`
2. **Use different secrets** for development and production
3. **Rotate JWT_SECRET** periodically in production
4. **Use environment variables** in deployment platforms (Heroku, AWS, etc.)
5. **Restrict CORS** to specific domains in production
6. **Use MongoDB authentication** in production
7. **Enable MongoDB SSL/TLS** for cloud databases

## Troubleshooting

### MongoDB Connection Failed
- Check `MONGODB_URI` format
- Verify MongoDB is running
- Check network connectivity
- Verify credentials (for Atlas)

### JWT Token Invalid
- Verify `JWT_SECRET` is set
- Check token expiration (`JWT_EXPIRE`)
- Ensure secret hasn't changed between restarts

### CORS Errors
- Check `CORS_ORIGIN` setting
- Verify frontend domain matches
- Use `*` only in development

### Rate Limiting Too Strict
- Increase `RATE_LIMIT_MAX_REQUESTS`
- Increase `RATE_LIMIT_WINDOW_MS`

