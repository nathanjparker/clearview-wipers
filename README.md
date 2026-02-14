This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

### Option B: Firebase on deployed app (e.g. phone)

So the app uses Firebase (no demo mode) when opened from the deployed URL:

1. **Deploy** the app to Vercel (e.g. connect this repo at [vercel.com/new](https://vercel.com/new) or run `npx vercel` in the project root).
2. In **Vercel** go to your project → **Settings** → **Environment Variables**.
3. Add these variables with the **same values** as in your local `.env.local` (from Firebase Console and your PIN):

   | Name | Notes |
   |------|--------|
   | `NEXT_PUBLIC_FIREBASE_API_KEY` | Required |
   | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Required |
   | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | For auth |
   | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Optional |
   | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Optional |
   | `NEXT_PUBLIC_FIREBASE_APP_ID` | For auth |
   | `NEXT_PUBLIC_ADMIN_PIN` | PIN for admin unlock (change in production) |

4. **Redeploy**: Deployments → open the latest → **Redeploy**, or push a new commit so a new build runs with the new env vars.

After redeploy, open the app on your phone from the Vercel URL; the "Demo mode" banner should be gone and data will persist in Firebase.
