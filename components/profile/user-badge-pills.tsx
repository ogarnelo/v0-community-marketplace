import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getBadgeToneClassName, type UserBadge } from "@/lib/users/badges";

type UserBadgePillsProps = {
  badges: UserBadge[];
  className?: string;
};

export function UserBadgePills({ badges, className }: UserBadgePillsProps) {
  if (badges.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {badges.map((badge) => (
        <Badge
          key={badge.key}
          variant="outline"
          title={badge.description}
          className={cn("rounded-full border", getBadgeToneClassName(badge.tone))}
        >
          {badge.label}
        </Badge>
      ))}
    </div>
  );
}
