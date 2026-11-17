/**
 * Server-trusted, complete snapshot adapter for the REVIEW-ONLY schema #649.
 * No production federation tables exist yet: this NEVER queries a DB or
 * authorizes the caller. Use only with a trusted, complete server-side read.
 */
import type { FederationHierarchyInput } from "./federation-reporting-hierarchy";
type Organization = {id:string;status:string};
type Association = {id:string;status:string};
type School = {id:string;is_active:boolean|null};
type TimedLink = {valid_from:string;valid_until:string|null;status:string;verified_by:string|null};
type AssociationSchool = TimedLink & {association_id:string;school_id:string};
type OrganizationAssociation = TimedLink & {organization_id:string;association_id:string};
type Hierarchy = TimedLink & {parent_id:string;child_id:string};
type Member = {organization_id:string;user_id:string;role:string;status:string;verified_by:string|null};
export type TrustedFederationSnapshot = {
  complete: {organizations:boolean;associations:boolean;schools:boolean;
    associationSchools:boolean;organizationAssociations:boolean;hierarchy:boolean;memberships:boolean};
  organizations:readonly Organization[];
  associations:readonly Association[];
  schools:readonly School[];
  associationSchools:readonly AssociationSchool[];
  organizationAssociations:readonly OrganizationAssociation[];
  hierarchy:readonly Hierarchy[];
  memberships:readonly Member[];
};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
function dateTime(value:string):number {
 if(typeof value!=="string"||!ISO.test(value))throw Error("INVALID_FEDERATION_TIMESTAMP");
 const n=Date.parse(value);
 if(!Number.isFinite(n))throw Error("INVALID_FEDERATION_TIMESTAMP");
 return n;
}
function requireId(value:string):string{
 if(typeof value!=="string"||!UUID.test(value))throw Error("INVALID_FEDERATION_ID");
 return value.toLowerCase();
}
function interval(row:TimedLink,now:number):{from:number;until:number}|null{
 if(row.status!=="verified"||!row.verified_by)return null;
 requireId(row.verified_by);
 const from=dateTime(row.valid_from),until=row.valid_until===null?Infinity:dateTime(row.valid_until);
 if(from>=until)throw Error("INVALID_FEDERATION_INTERVAL");
 return from<=now&&now<until?{from,until}:null;
}
export function buildFederationAuthoritySnapshot(input:{
  userId:string;rootFederationId:string;now:Date;snapshot:TrustedFederationSnapshot;
}):FederationHierarchyInput{
 const {userId,rootFederationId,now,snapshot:s}=input;
 requireId(userId);requireId(rootFederationId);
 if(!(now instanceof Date)||!Number.isFinite(now.getTime())||!s ||
    !s.complete || Object.values(s.complete).length!==7 ||
    !Object.values(s.complete).every(v=>v===true) ||
    ![s.organizations,s.associations,s.schools,s.associationSchools,
      s.organizationAssociations,s.hierarchy,s.memberships].every(Array.isArray))
   throw Error("INCOMPLETE_FEDERATION_AUTHORITY_SNAPSHOT");
 const orgs=new Set(s.organizations.filter(x=>x.status==="verified").map(x=>requireId(x.id)));
 const associations=new Set(s.associations.filter(x=>x.status==="verified").map(x=>requireId(x.id)));
 const schools=new Set(s.schools.filter(x=>x.is_active===true).map(x=>requireId(x.id)));
 const memberships=s.memberships.filter(m=>m.user_id.toLowerCase()===userId.toLowerCase()
    && m.organization_id.toLowerCase()===rootFederationId.toLowerCase()).map(m=>({
      userId:requireId(m.user_id),federationId:requireId(m.organization_id),
      role:"report_viewer" as const,
      state:(m.role==="report_viewer"&&m.status==="active"&&m.verified_by
        &&orgs.has(requireId(m.organization_id))&&requireId(m.verified_by)?"active":"revoked") as "active"|"revoked",
    }));
 // Do not collapse duplicate/contradictory memberships. The hierarchy
 // resolver denies an ambiguous authority even if one row is active.
 const links: FederationHierarchyInput["links"][number][]=[];
 for(const row of s.hierarchy){
   const parentId=requireId(row.parent_id),childId=requireId(row.child_id);
   if(!orgs.has(parentId)||!orgs.has(childId))continue;
   const valid=interval(row,now.getTime());
   if(valid) links.push({parentId,childId,status:"verified",
     startsAt:new Date(valid.from).toISOString(),
     endsAt:Number.isFinite(valid.until)?new Date(valid.until).toISOString():null});
 }
 const associationSchoolLinks=new Map<string,{schoolId:string;from:number;until:number}[]>();
 for(const row of s.associationSchools){
   const associationId=requireId(row.association_id),schoolId=requireId(row.school_id);
   if(!associations.has(associationId)||!schools.has(schoolId))continue;
   const valid=interval(row,now.getTime());
   if(!valid)continue;
   const pairs=associationSchoolLinks.get(associationId)??[];
   pairs.push({schoolId,from:valid.from,until:valid.until});
   associationSchoolLinks.set(associationId,pairs);
 }
 const representations:FederationHierarchyInput["representations"][number][]=[];
 for(const row of s.organizationAssociations){
   const organizationId=requireId(row.organization_id),associationId=requireId(row.association_id);
   if(!orgs.has(organizationId)||!associations.has(associationId))continue;
   const valid=interval(row,now.getTime());
   if(!valid)continue;
   for(const school of associationSchoolLinks.get(associationId)??[]){
     const from=Math.max(valid.from,school.from),until=Math.min(valid.until,school.until);
     if(from>=until)continue;
     representations.push({federationId:organizationId,schoolId:school.schoolId,
       state:"active",startsAt:new Date(from).toISOString(),
       endsAt:Number.isFinite(until)?new Date(until).toISOString():null});
   }
 }
 return {userId:requireId(userId),rootFederationId:requireId(rootFederationId),
   memberships,links,representations,now};
}
