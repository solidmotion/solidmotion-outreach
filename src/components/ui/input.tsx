"use client";

import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-sm font-medium text-text">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`w-full px-3 py-2 text-sm rounded-lg border bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 ${
            error
              ? "border-danger focus:border-danger"
              : "border-border focus:border-primary"
          } ${className}`}
          {...props}
        />
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
