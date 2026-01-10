# MT5 Monitor Frontend

React + Vite frontend for monitoring MT5 trading accounts.

## Development Setup

1. **Install Node.js 18+**

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   nano .env
   ```

   Update `VITE_API_BASE_URL` with your backend URL

4. **Run development server**:
   ```bash
   npm run dev
   ```

   Open http://localhost:5173

## Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Deployment to Vercel

### Option 1: Using Vercel CLI

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel
   ```

### Option 2: Using GitHub + Vercel

1. **Push to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/mt5-monitor.git
   git push -u origin main
   ```

2. **Import on Vercel**:
   - Go to https://vercel.com
   - Click "Import Project"
   - Select your GitHub repository
   - Add environment variable: `VITE_API_BASE_URL=http://YOUR_BACKEND_IP:8080`
   - Click "Deploy"

3. **Update Backend CORS**:
   - Add your Vercel URL to `ALLOWED_ORIGINS` in main-backend `.env`
   - Restart backend service

## Features

- Real-time MT5 account monitoring
- Manual refresh
- Editable phase values with inline editing
- Summary statistics
- Responsive design
- Error handling with retry

## Environment Variables

- `VITE_API_BASE_URL` - Backend API URL (required)
