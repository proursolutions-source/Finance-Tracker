/**
 * Shown when the user arrives back at the app via a password-reset email
 * link (Supabase fires a PASSWORD_RECOVERY auth event at that point). Blocks
 * the rest of the app until they've set a new password.
 */
import { updatePassword } from '../cloud/cloud-auth';
import { showToast } from './toast';

export function showResetPasswordScreen(onDone: () => void): void {
    const overlay = document.createElement('div');
    overlay.id = 'reset-password-overlay';
    overlay.className = 'fixed inset-0 z-[110] bg-slate-950 flex items-center justify-center p-6 overflow-y-auto';
    overlay.innerHTML = `
    <div class="w-full max-w-sm">
      <div class="text-center mb-6">
        <h1 class="text-2xl font-bold" style="font-family:'Poppins',sans-serif"><span class="text-white">Money</span><span class="text-primary-400">Flow</span></h1>
      </div>
      <div class="glass-card p-6 space-y-4">
        <h2 class="text-lg font-semibold text-white">Set a new password</h2>
        <p class="text-sm text-slate-400">Choose a new password for your MoneyFlow Cloud account.</p>
        <form id="reset-password-form" class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">New Password</label>
            <input type="password" name="password" required minlength="6" class="glass-input w-full" placeholder="At least 6 characters" autofocus>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Confirm Password</label>
            <input type="password" name="confirmPassword" required minlength="6" class="glass-input w-full">
          </div>
          <p id="reset-password-error" class="text-sm text-red-400 h-5"></p>
          <button type="submit" class="glass-button w-full">Set New Password</button>
        </form>
      </div>
    </div>
  `;
    document.body.appendChild(overlay);

    const form = overlay.querySelector('#reset-password-form') as HTMLFormElement;
    const errorEl = overlay.querySelector('#reset-password-error') as HTMLElement;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const password = formData.get('password') as string;
        const confirmPassword = formData.get('confirmPassword') as string;

        if (password !== confirmPassword) {
            errorEl.textContent = 'Passwords do not match';
            return;
        }

        try {
            await updatePassword(password);
            showToast('Password updated — you are signed in', { type: 'success' });
            overlay.remove();
            onDone();
        } catch (error: any) {
            errorEl.textContent = error?.message || 'Failed to update password';
        }
    });
}
