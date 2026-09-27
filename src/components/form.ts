/**
 * Form Validation Helpers using Zod
 */

import { z } from 'zod';

// Common validation schemas
export const schemas = {
    transaction: z.object({
        amount: z.number().positive('Amount must be positive'),
        type: z.enum(['income', 'expense']),
        categoryId: z.string().min(1, 'Category is required'),
        date: z.string().min(1, 'Date is required'),
        payee: z.string().optional(),
        notes: z.string().optional(),
    }),

    category: z.object({
        name: z.string().min(1, 'Name is required').max(50, 'Name too long'),
        type: z.enum(['income', 'expense', 'both']),
        icon: z.string().optional(),
        budget: z.number().nonnegative().optional(),
        color: z.string().optional(),
    }),

    budget: z.object({
        categoryId: z.string().min(1, 'Category is required'),
        amount: z.number().positive('Amount must be positive'),
        period: z.enum(['weekly', 'monthly', 'yearly']),
        startDate: z.string().min(1, 'Start date is required'),
    }),

    reminder: z.object({
        name: z.string().min(1, 'Name is required'),
        amount: z.number().nonnegative('Amount must be positive'),
        dueDate: z.string().min(1, 'Due date is required'),
        frequency: z.enum(['weekly', 'monthly', 'yearly']),
        categoryId: z.string().optional(),
        notes: z.string().optional(),
    }),

    profile: z.object({
        fullName: z.string().optional(),
        preferredName: z.string().optional(),
        primaryCurrency: z.string().default('INR'),
        country: z.string().default('India'),
        city: z.string().optional(),
        approximateMonthlyIncome: z.number().nonnegative().optional(),
    }),
};

/**
 * Validate form data against schema
 */
export function validateForm<T>(schema: z.ZodSchema<T>, data: any): {
    success: boolean;
    data?: T;
    errors?: Record<string, string>;
} {
    try {
        const validated = schema.parse(data);
        return { success: true, data: validated };
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errors: Record<string, string> = {};
            error.errors.forEach((err) => {
                const path = err.path.join('.');
                errors[path] = err.message;
            });
            return { success: false, errors };
        }
        return { success: false, errors: { _general: 'Validation failed' } };
    }
}

/**
 * Display validation errors on form
 */
export function displayFormErrors(form: HTMLFormElement, errors: Record<string, string>): void {
    // Clear existing errors
    form.querySelectorAll('.error-message').forEach(el => el.remove());
    form.querySelectorAll('.border-red-500').forEach(el => {
        el.classList.remove('border-red-500');
    });

    // Display new errors
    Object.entries(errors).forEach(([field, message]) => {
        const input = form.querySelector(`[name="${field}"]`);

        if (input) {
            input.classList.add('border-red-500');

            const errorEl = document.createElement('p');
            errorEl.className = 'error-message text-red-400 text-sm mt-1';
            errorEl.textContent = message;

            input.parentElement?.appendChild(errorEl);
        }
    });
}

/**
 * Extract form data as object
 */
export function getFormData(form: HTMLFormElement): Record<string, any> {
    const formData = new FormData(form);
    const data: Record<string, any> = {};

    formData.forEach((_value, key) => {
        // Handle checkboxes
        if (form.querySelector(`[name="${key}"][type="checkbox"]`)) {
            data[key] = (form.querySelector(`[name="${key}"]`) as HTMLInputElement)?.checked || false;
            return;
        }

        // Handle numbers
        const input = form.querySelector(`[name="${key}"]`) as HTMLInputElement;
        if (input?.type === 'number') {
            data[key] = input.value ? parseFloat(input.value) : undefined;
            return;
        }

        data[key] = input?.value || '';
    });

    return data;
}
