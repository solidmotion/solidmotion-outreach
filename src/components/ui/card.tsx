interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingStyles = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export function Card({
  children,
  className = "",
  padding = "md",
}: CardProps) {
  return (
    <div
      className={`bg-surface rounded-xl border border-border shadow-sm ${paddingStyles[padding]} ${className}`}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function CardHeader({ title, description, action }: CardHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h3 className="text-lg font-semibold text-text">{title}</h3>
        {description && (
          <p className="text-sm text-text-muted mt-0.5">{description}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
