"use client";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
}

const sizeConfig = {
  sm: { track: "w-8 h-4", thumb: "h-3 w-3", translate: "translate-x-4" },
  md: { track: "w-11 h-6", thumb: "h-5 w-5", translate: "translate-x-5" },
  lg: { track: "w-14 h-7", thumb: "h-6 w-6", translate: "translate-x-7" },
};

export function Toggle({
  checked,
  onChange,
  label,
  description,
  size = "md",
  disabled = false,
}: ToggleProps) {
  const s = sizeConfig[size];

  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex shrink-0 ${s.track} items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed ${
          checked ? "bg-primary" : "bg-gray-300"
        }`}
      >
        <span
          className={`inline-block ${s.thumb} transform rounded-full bg-white shadow-sm transition-transform ${
            checked ? s.translate : "translate-x-0.5"
          }`}
        />
      </button>
      {(label || description) && (
        <div>
          {label && (
            <span className="text-sm font-medium text-text">{label}</span>
          )}
          {description && (
            <p className="text-xs text-text-muted">{description}</p>
          )}
        </div>
      )}
    </label>
  );
}
