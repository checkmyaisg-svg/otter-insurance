import { login, signup } from './actions';
import { Button } from '@/components/ui/button';

/**
 * Minimal login/signup screen. Two submit buttons share one form and route to
 * the matching server action. Real visual identity is applied when the app
 * shell is built; this is functional auth only.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-primary">
          Insurance Client Automation
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Sign in to your agent account.
        </p>

        {error ? (
          <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <form className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="full_name" className="text-sm font-medium">
              Full name <span className="text-muted-foreground">(sign up only)</span>
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              autoComplete="name"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button formAction={login} className="flex-1">
              Sign in
            </Button>
            <Button formAction={signup} variant="outline" className="flex-1">
              Sign up
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
