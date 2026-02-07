import React from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * FormFieldError Component
 * 
 * Unified error display component for form validation feedback.
 * Provides consistent styling across all forms in the application.
 * 
 * @param {string} error - The error message to display
 * @param {string} className - Optional additional classes
 * 
 * @example
 * <FormFieldError error={errors.email} />
 * <FormFieldError error="This field is required" className="mt-1" />
 */
export const FormFieldError = ({ error, className }) => {
  if (!error) return null;

  return (
    <div 
      className={cn(
        "flex items-center gap-1.5 text-sm text-destructive bg-destructive/10 px-2 py-1 rounded-lg animate-in fade-in-50 slide-in-from-top-1 duration-200",
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <AlertCircle size={14} className="flex-shrink-0" />
      <span>{error}</span>
    </div>
  );
};

export default FormFieldError;

