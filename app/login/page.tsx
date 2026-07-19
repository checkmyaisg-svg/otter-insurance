import { login, signup } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ProspektMark } from '@/components/ui/ProspektMark';

/**
 * Login — DS V2. Centered 360px column on the canvas; wordmark, two wells, one
 * primary action. The first four seconds finally match the rest of the product.
 * Functionality identical: one form, two server actions (sign in / sign up).
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-[360px]">
        <div className="mb-8 flex items-center gap-2.5">
          <ProspektMark size={28} className="text-foreground" />
          <div>
            <p className="text-[15px] font-semibold tracking-tight">Prospekt</p>
            <p className="text-xs text-faint">Mission control for insurance advisors</p>
          </div>
        </div>

        <h1 className="text-[22px] font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">
          Sign in to your advisor workspace.
        </p>

        {error ? (
          <p role="alert" className="mt-4 rounded border !border-destructive/30 bg-destructive/10 px-3 py-2 text-[13.5px] text-destructive">
            {error}
          </p>
        ) : null}

        <form className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="full_name" className="text-[11px] font-medium uppercase tracking-wide text-faint">
              Full name <span className="normal-case tracking-normal">(sign up only)</span>
            </label>
            <Input id="full_name" name="full_name" type="text" autoComplete="name" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-[11px] font-medium uppercase tracking-wide text-faint">
              Email
            </label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-[11px] font-medium uppercase tracking-wide text-faint">
              Password
            </label>
            <Input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>

          <div className="space-y-2 pt-2">
            <Button formAction={login} className="w-full">
              Sign in
            </Button>
            <Button formAction={signup} variant="ghost" className="w-full">
              Create an account
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
