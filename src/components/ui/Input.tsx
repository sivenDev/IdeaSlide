import { forwardRef, type InputHTMLAttributes } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = "", ...props }, ref) {
    return (
      <input
        ref={ref}
        className={`h-7 w-full rounded border border-blue-400 bg-white px-2 text-sm text-gray-900 outline-none ring-2 ring-blue-100 ${className}`}
        {...props}
      />
    );
  },
);
