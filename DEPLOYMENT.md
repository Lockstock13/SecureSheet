# Deployment Guide: SecureSheet

The project is now a standard Vite + Tailwind application and is fully optimized for static deployment.

## Preparation
1. Commit all your latest changes to a GitHub repository.

## Recommended: Deploying to Vercel (Easiest)
Vercel has first-class support for Vite applications.

1. Go to [Vercel](https://vercel.com/) and sign up or log in.
2. Click **Add New** -> **Project**.
3. Import your GitHub repository.
4. Vercel will automatically detect that you are using Vite. The settings should auto-populate to:
   * **Framework Preset:** Vite
   * **Build Command:** `npm run build`
   * **Output Directory:** `dist`
5. Click **Deploy**. Your app will be live on a `*.vercel.app` domain with SSL automatically configured.

## Alternative: Deploying to Netlify
Netlify is another excellent platform for static sites.

1. Go to [Netlify](https://www.netlify.com/) and log in.
2. Click **Add new site** -> **Import an existing project**.
3. Connect your GitHub account and select the repository.
4. Ensure the following build settings are entered:
   * **Build command:** `npm run build`
   * **Publish directory:** `dist`
5. Click **Deploy site**.

### 3. Vercel Configuration
1. Go to your Project Settings > Environment Variables.
2. Add `VITE_GOOGLE_CLIENT_ID` with your Google Client ID.

### 4. Google Cloud Console Setup
1. Go to [API & Services > Credentials](https://console.cloud.google.com/apis/credentials).
2. Edit your OAuth 2.0 Client ID.
3. Add your Vercel deployment URL (e.g., `https://securesheet.vercel.app`) to **Authorized JavaScript Origins**.
4. Save changes.

## Local Development
To run the project locally on your machine while making changes:
```bash
npm install
npm run dev
```

To create a local production build to check before deploying:
```bash
npm run build
npm run preview
```
