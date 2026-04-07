import { Card } from "@/components/ui/card";

interface StatCard {
  label: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: React.ReactNode;
}

interface StatsCardsProps {
  stats: StatCard[];
}

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label} padding="md">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-text-muted">{stat.label}</p>
              <p className="text-2xl font-bold text-text mt-1">{stat.value}</p>
              {stat.change && (
                <p
                  className={`text-xs mt-1 font-medium ${
                    stat.changeType === "positive"
                      ? "text-success"
                      : stat.changeType === "negative"
                        ? "text-danger"
                        : "text-text-muted"
                  }`}
                >
                  {stat.change}
                </p>
              )}
            </div>
            <div className="p-2 rounded-lg bg-primary-light text-primary">
              {stat.icon}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
