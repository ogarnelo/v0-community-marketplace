/**
 * Verified federation -> subfederation hierarchy.
 * A confederation sees descendant federation metrics only for ACTIVE,
 * verified, unexpired links. Graph records are server-trusted.
 * No client-provided region/name grants access.
 */
import {
  resolveFederationSchoolScope,
  type ReportingMembership,
  type Representation,
} from "./federation-reporting-scope";

export type FederationLink = {
  parentId: string;
  childId: string;
  status: "verified" | "pending" | "revoked";
  startsAt: string;
  endsAt: string | null;
};
export type FederationHierarchyInput = {
  userId: string;
  rootFederationId: string;
  memberships: readonly ReportingMembership[];
  links: readonly FederationLink[];
  representations: readonly Representation[];
  now: Date;
};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function activeTime(startsAt:string, endsAt:string|null,now:number):boolean {
  const iso=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/;
  if (!iso.test(startsAt) || (endsAt!==null && !iso.test(endsAt))) return false;
  const start=Date.parse(startsAt),end=endsAt===null?Infinity:Date.parse(endsAt);
  return Number.isFinite(start) && start<=now && end>now;
}
/**
 * Cycles, multiple parents and self-links in relevant verified topology are
 * treated as invalid configurations: deny ALL rather than provide a partial
 * misleading scope.
 */
export function resolveHierarchySchoolScope(input:FederationHierarchyInput):readonly string[] {
  const {userId,rootFederationId,memberships,links,representations,now}=input;
  if(!UUID.test(userId) || !UUID.test(rootFederationId) ||
     !Array.isArray(memberships) || !Array.isArray(links) ||
     !Array.isArray(representations) || !(now instanceof Date) ||
     !Number.isFinite(now.getTime())) return [];
  const member=memberships.some(m=>m.userId===userId && m.federationId===rootFederationId &&
    m.state==="active" && m.role==="report_viewer");
  if(!member) return [];
  const children=new Map<string,string[]>();
  const parents=new Map<string,string>();
  for (const link of links) {
    if (link.status!=="verified" ||
        !activeTime(link.startsAt,link.endsAt,now.getTime())) continue;
    if(!UUID.test(link.parentId)||!UUID.test(link.childId) ||
        link.parentId===link.childId) return [];
    const existing=parents.get(link.childId);
    if(existing && existing!==link.parentId) return [];
    parents.set(link.childId,link.parentId);
    const next=children.get(link.parentId)??[];
    if(!next.includes(link.childId))next.push(link.childId);
    children.set(link.parentId,next);
  }
  const expanded=new Set<string>();
  const visiting=new Set<string>();
  const visit=(id:string):boolean=>{
    if(visiting.has(id))return false;
    if(expanded.has(id))return true;
    visiting.add(id);
    for(const child of children.get(id)??[]){
      if(!visit(child))return false;
    }
    visiting.delete(id);
    expanded.add(id);
    return true;
  };
  if(!visit(rootFederationId))return [];
  const schools=new Set<string>();
  for(const federationId of expanded){
    // Scope core requires a valid reporting membership. Use an internal
    // synthetic membership ONLY after verifying root membership and
    // explicitly traversing verified representation links.
    const subset=resolveFederationSchoolScope({
      subjectUserId:userId,federationId,
      memberships:[{userId,federationId,role:"report_viewer",state:"active"}],
      representations,now,
    });
    for(const id of subset)schools.add(id);
  }
  return [...schools].sort();
}
