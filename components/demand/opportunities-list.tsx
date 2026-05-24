import {
  type DemandActivationOpportunity,
  opportunityKey,
  opportunityLabel,
  opportunityPublishUrl,
  priorityClassName,
  priorityLabel,
} from "@/lib/demand/opportunities";
import OpportunityActionLink from "@/components/demand/opportunity-action-link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, BellPlus, PackagePlus, TrendingUp } from "lucide-react";

export default function OpportunitiesList({
  opportunities,
  roleContext = "business",
  emptyTitle = "Aún no hay oportunidades suficientes",
  emptyText = "Cuando haya búsquedas, demandas explícitas y señales de interés, aparecerán aquí.",
}: {
  opportunities: DemandActivationOpportunity[];
  roleContext?: string;
  emptyTitle?: string;
  emptyText?: string;
}) {
  if (opportunities.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed bg-card p-8 text-center">
        <BellPlus className="mx-auto h-8 w-8 text-primary" />
        <h2 className="mt-4 text-xl font-semibold">{emptyTitle}</h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {opportunities.map((opportunity) => {
        const key = opportunityKey(opportunity);
        const label = opportunityLabel(opportunity);
        const publishUrl = opportunityPublishUrl(opportunity);

        return (
          <div key={`${key}-${opportunity.grade_level}-${opportunity.region}`} className="rounded-3xl border bg-card p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={priorityClassName(opportunity.priority)}>
                    {priorityLabel(opportunity.priority)}
                  </Badge>
                  <Badge variant="secondary" className="gap-1">
                    <TrendingUp className="h-3 w-3" />
                    score {opportunity.opportunity_score}
                  </Badge>
                </div>

                <h3 className="mt-3 text-lg font-semibold">{label}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {opportunity.recommendation_reason || "Señal de demanda detectada."}
                </p>

                <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                  <Metric label="Búsquedas" value={opportunity.searches} />
                  <Metric label="Sin resultado" value={opportunity.zero_results} />
                  <Metric label="Guardadas" value={opportunity.saved_searches} />
                  <Metric label="Peticiones" value={opportunity.explicit_requests} />
                </div>
              </div>

              <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
                <Button asChild className="gap-2">
                  <OpportunityActionLink
                    href={publishUrl}
                    opportunityKey={key}
                    actionType="publish_clicked"
                    roleContext={roleContext}
                  >
                    <PackagePlus className="h-4 w-4" />
                    Publicar este producto
                  </OpportunityActionLink>
                </Button>
                <Button asChild variant="outline" className="gap-2">
                  <OpportunityActionLink
                    href="/negocios"
                    opportunityKey={key}
                    actionType="business_contact_clicked"
                    roleContext={roleContext}
                  >
                    Captar proveedor
                    <ArrowRight className="h-4 w-4" />
                  </OpportunityActionLink>
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-muted px-3 py-2">
      <p className="font-semibold text-foreground">{value}</p>
      <p>{label}</p>
    </div>
  );
}
