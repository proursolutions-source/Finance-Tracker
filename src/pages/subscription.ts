/**
 * Subscription page — plans, current status, discount codes, cancel.
 * Requires a MoneyFlow Cloud account (separate from the local device login).
 * No live payment gateway is wired in yet: "Subscribe" honestly records
 * pending intent rather than pretending to charge a card — see cloud-db.ts.
 */
import { isCloudConfigured, getCloudUser } from '../cloud/cloud-auth';
import { renderCloudAuthGate } from '../components/cloud-auth-gate';
import { listPlans, getMySubscription, subscribeToPlan, cancelMySubscription, validateDiscountCode, getPaymentSettings, uploadPaymentScreenshot } from '../cloud/cloud-db';
import { refreshEntitlement } from '../cloud/entitlements';
import { formatCurrency, getIcon, escapeHtml, isGenuineReceiptFile, MAX_RECEIPT_FILE_SIZE, formatBytes } from '../utils';
import { showToast } from '../components/toast';
import { showConfirm } from '../components/modal';
import { renderAnimatedLoader } from '../components/animated-loader';
import type { SubscriptionPlan } from '../cloud/types';

export async function renderSubscription(): Promise<void> {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    mainContent.innerHTML = `<div id="subscription-root" class="max-w-4xl mx-auto pb-20"></div>`;
    const root = document.getElementById('subscription-root')!;
    renderAnimatedLoader(root);

    const onSignedIn = async () => {
        await refreshEntitlement();
        location.reload(); // simplest way to guarantee nav lock-icons and every gated page reflect the new tier
    };

    if (!isCloudConfigured()) {
        renderCloudAuthGate(root, { title: 'Subscription management', onSuccess: onSignedIn });
        return;
    }

    const user = await getCloudUser();
    if (!user) {
        renderCloudAuthGate(root, { title: 'Subscription management', onSuccess: onSignedIn });
        return;
    }

    try {
        const [plans, mySub] = await Promise.all([listPlans(), getMySubscription()]);
        renderPlans(root, plans, mySub);
    } catch (error) {
        console.error('[Subscription] Error loading:', error);
        root.innerHTML = `<div class="glass-card p-8 text-center text-red-400">Failed to load subscription data.</div>`;
    }
    if ((window as any).lucide) (window as any).lucide.createIcons();
}

function renderPlans(root: HTMLElement, plans: SubscriptionPlan[], mySub: Awaited<ReturnType<typeof getMySubscription>>): void {
    const currentPlanId = mySub?.status === 'active' || mySub?.status === 'pending_payment' ? mySub.planId : null;

    root.innerHTML = `
    <div class="mb-6">
      <h1 class="text-2xl sm:text-3xl font-bold flex items-center gap-2">${getIcon('sparkles', 26)} Subscription</h1>
      <p class="text-sm text-slate-400 mt-1">Manage your MoneyFlow plan.</p>
    </div>

    ${mySub ? `
      <div class="glass-card p-5 mb-6 border ${mySub.status === 'active' ? 'border-green-500/30' : 'border-yellow-500/30'}">
        <div class="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-400">Current plan</p>
            <p class="text-lg font-bold">${mySub.plan?.name || 'Unknown'}</p>
            <p class="text-sm mt-1 ${statusColor(mySub.status)}">${statusLabel(mySub.status)}${mySub.cancelAtPeriodEnd ? ' &middot; cancels at period end' : ''}</p>
            ${mySub.status === 'pending_payment' ? `<p class="text-xs text-slate-500 mt-1">No payment gateway is connected yet — this will activate automatically once billing goes live, or an admin can activate it manually.</p>` : ''}
          </div>
          ${mySub.status === 'active' && !mySub.cancelAtPeriodEnd ? `<button id="cancel-sub-btn" class="glass-button-secondary text-red-400">Cancel Subscription</button>` : ''}
        </div>
      </div>
    ` : ''}

    <div class="grid gap-4 md:grid-cols-3">
      ${plans.map(plan => `
        <div class="glass-card p-5 flex flex-col ${plan.id === currentPlanId ? 'border border-primary-500/40' : ''}">
          <h3 class="font-bold text-lg">${escapeHtml(plan.name)}</h3>
          <p class="text-sm text-slate-400 mb-3">${escapeHtml(plan.description)}</p>
          <p class="text-2xl font-bold mb-3">${plan.priceInr === 0 ? 'Free' : formatCurrency(plan.priceInr)}<span class="text-sm text-slate-400 font-normal">${plan.priceInr === 0 ? '' : ` / ${plan.billingInterval === 'yearly' ? 'year' : 'month'}`}</span></p>
          <ul class="text-sm text-slate-300 space-y-1 mb-4 flex-1">
            ${plan.features.map(f => `<li class="flex items-start gap-2">${getIcon('check', 14, 'text-green-400 mt-0.5 flex-shrink-0')}<span>${escapeHtml(f)}</span></li>`).join('')}
          </ul>
          ${plan.id === currentPlanId
            ? `<button disabled class="glass-button-secondary opacity-60 cursor-not-allowed">Current Plan</button>`
            : `<button class="subscribe-btn glass-button" data-plan-id="${plan.id}" data-plan-name="${escapeHtml(plan.name)}">Subscribe</button>`}
        </div>
      `).join('')}
    </div>
  `;

    root.querySelector('#cancel-sub-btn')?.addEventListener('click', () => {
        showConfirm('Cancel Subscription', 'Your plan will remain active until the end of the current billing period, then cancel.', async () => {
            try {
                await cancelMySubscription(mySub!.id);
                await refreshEntitlement();
                showToast('Subscription set to cancel at period end', { type: 'success' });
                renderSubscription();
            } catch (error) {
                console.error(error);
                showToast('Failed to cancel subscription', { type: 'error' });
            }
        });
    });

    root.querySelectorAll<HTMLButtonElement>('.subscribe-btn').forEach(btn => {
        btn.addEventListener('click', () => openSubscribeFlow(btn.dataset.planId!, btn.dataset.planName!));
    });
}

async function openSubscribeFlow(planId: string, planName: string): Promise<void> {
    const plans = await listPlans();
    const plan = plans.find(p => p.id === planId);
    const { showModal } = await import('../components/modal');
    const paymentSettings = await getPaymentSettings().catch(() => null);
    const upiConfigured = !!paymentSettings?.upiId;

    const form = document.createElement('form');
    form.className = 'space-y-4';
    form.innerHTML = `
    <p class="text-sm text-slate-400">Subscribing to <strong>${escapeHtml(planName)}</strong>.</p>
    <div>
      <label class="block text-sm font-medium mb-1">Discount code (optional)</label>
      <input type="text" name="discountCode" class="glass-input w-full" placeholder="e.g., LAUNCH20">
      <p id="discount-feedback" class="text-xs mt-1 h-4"></p>
    </div>
    <div id="upi-payment-block"></div>
  `;
    const footer = document.createElement('div');
    footer.className = 'flex gap-3 justify-end';
    footer.innerHTML = `
    <button type="button" class="glass-button-secondary" data-action="cancel">Cancel</button>
    <button type="submit" class="glass-button">${upiConfigured ? "I've Paid — Submit" : 'Subscribe'}</button>
  `;

    const close = showModal({ title: 'Subscribe', content: form, footer });
    footer.querySelector('[data-action="cancel"]')?.addEventListener('click', close);

    let validatedDiscount: { id: string; code: string; type: 'percent' | 'flat'; value: number } | null = null;
    let amountDue = plan?.priceInr ?? 0;
    const codeInput = form.querySelector('input[name="discountCode"]') as HTMLInputElement;
    const feedback = form.querySelector('#discount-feedback') as HTMLElement;
    const upiBlock = form.querySelector('#upi-payment-block') as HTMLElement;

    const renderUpiBlock = async () => {
        if (!upiConfigured || amountDue <= 0) {
            upiBlock.innerHTML = amountDue <= 0
                ? `<p class="text-xs text-slate-500">This plan is free — no payment needed.</p>`
                : `<p class="text-xs text-slate-500">No payment method is set up yet — this will record your intent, and an admin can activate it manually.</p>`;
            return;
        }
        const upiId = paymentSettings!.upiId!;
        const payeeName = paymentSettings!.payeeName || 'MoneyFlow';
        const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amountDue}&cu=INR&tn=${encodeURIComponent('MoneyFlow ' + planName)}`;
        const QRCode = await import('qrcode');
        const qrDataUrl = await QRCode.toDataURL(upiUrl, { width: 220, margin: 1 });
        upiBlock.innerHTML = `
      <div class="glass-card p-4 text-center">
        <p class="text-sm font-medium mb-2">Pay ${formatCurrency(amountDue)} via UPI</p>
        <img src="${qrDataUrl}" alt="UPI QR code" class="mx-auto rounded-lg" width="220" height="220">
        <p class="text-xs text-slate-400 mt-2">Scan with any UPI app, or pay directly to</p>
        <p class="text-sm font-mono">${upiId}</p>
        ${paymentSettings!.payeeName ? `<p class="text-xs text-slate-500">${paymentSettings!.payeeName}</p>` : ''}
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Payment reference / UTR number</label>
        <input type="text" name="paymentReference" required class="glass-input w-full" placeholder="12-digit UTR from your UPI app">
        <p class="text-xs text-slate-500 mt-1">After paying, enter the reference number so an admin can verify and activate your plan.</p>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Payment screenshot (optional but recommended)</label>
        <input type="file" name="paymentScreenshot" accept="image/*" class="glass-input w-full">
        <p class="text-xs text-slate-500 mt-1">A screenshot of the successful payment makes it faster for an admin to verify.</p>
      </div>
    `;
    };
    await renderUpiBlock();

    codeInput.addEventListener('blur', async () => {
        const code = codeInput.value.trim();
        if (!code) { feedback.textContent = ''; validatedDiscount = null; amountDue = plan?.priceInr ?? 0; await renderUpiBlock(); return; }
        try {
            const result = await validateDiscountCode(code, planId);
            if (result.valid) {
                validatedDiscount = { id: result.id!, code, type: result.type!, value: result.value! };
                feedback.textContent = `Valid — ${result.type === 'percent' ? `${result.value}% off` : `${formatCurrency(result.value!)} off`}`;
                feedback.className = 'text-xs mt-1 h-4 text-green-400';
                const base = plan?.priceInr ?? 0;
                amountDue = Math.max(0, Math.round(result.type === 'percent' ? base * (1 - result.value! / 100) : base - result.value!));
            } else {
                validatedDiscount = null;
                feedback.textContent = result.message || 'Invalid code';
                feedback.className = 'text-xs mt-1 h-4 text-red-400';
                amountDue = plan?.priceInr ?? 0;
            }
            await renderUpiBlock();
        } catch (error) {
            console.error(error);
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const paymentReference = (formData.get('paymentReference') as string || '').trim();
        const screenshotFile = formData.get('paymentScreenshot') as File | null;
        const submitBtn = footer.querySelector('button[type="submit"]') as HTMLButtonElement;

        try {
            let paymentScreenshotPath: string | undefined;
            if (screenshotFile && screenshotFile.size > 0) {
                if (screenshotFile.size > MAX_RECEIPT_FILE_SIZE) {
                    showToast(`Screenshot is too large (max ${formatBytes(MAX_RECEIPT_FILE_SIZE)})`, { type: 'error' });
                    return;
                }
                if (!(await isGenuineReceiptFile(screenshotFile))) {
                    showToast('That file doesn\'t look like a real image — please attach a genuine screenshot.', { type: 'error' });
                    return;
                }
                submitBtn.disabled = true;
                submitBtn.textContent = 'Uploading screenshot...';
                paymentScreenshotPath = await uploadPaymentScreenshot(screenshotFile);
            }

            await subscribeToPlan(planId, validatedDiscount ?? undefined, paymentReference || undefined, paymentScreenshotPath);
            await refreshEntitlement();
            showToast(upiConfigured && amountDue > 0 ? 'Payment submitted — an admin will verify and activate your plan shortly' : 'Subscription recorded', { type: 'success' });
            close();
            renderSubscription();
        } catch (error: any) {
            console.error(error);
            showToast(error?.message || 'Failed to subscribe', { type: 'error' });
            submitBtn.disabled = false;
            submitBtn.textContent = upiConfigured && amountDue > 0 ? "I've Paid — Submit" : 'Subscribe';
        }
    });
}

function statusLabel(status: string): string {
    switch (status) {
        case 'active': return 'Active';
        case 'pending_payment': return 'Pending activation';
        case 'canceled': return 'Canceled';
        case 'expired': return 'Expired';
        case 'past_due': return 'Payment past due';
        default: return status;
    }
}

function statusColor(status: string): string {
    switch (status) {
        case 'active': return 'text-green-400';
        case 'pending_payment': return 'text-yellow-400';
        case 'past_due': return 'text-red-400';
        default: return 'text-slate-400';
    }
}
