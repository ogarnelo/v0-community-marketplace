import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDirectorySearch, SCHOOL_DIRECTORY_PAGE_SIZE } from "@/lib/schools/public-directory-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const PRIVATE = {"Cache-Control":"private, no-store"};
function respond(body: unknown,status=200) {
  return NextResponse.json(body,{status,headers:PRIVATE});
}
export async function GET(request: Request) {
  if(process.env.WETUDY_PUBLIC_SCHOOL_DIRECTORY_ENABLED!=="true")
    return respond({error:"feature_disabled"},404);
  const search=getDirectorySearch(new URL(request.url).searchParams);
  if(!search.ok) return respond({error:search.error},400);
  try {
    let query=createAdminClient().from("school_directory")
      .select("official_code,name,school_type,category,municipality,province,autonomous_community,postal_code",
        {count:"exact"})
      // Import is NOT publication: every result must be explicitly approved.
      .eq("is_listed",true);
    if(search.community)query=query.eq("autonomous_community",search.community);
    if(search.province)query=query.eq("province",search.province);
    if(search.pattern)query=query.ilike("search_text",search.pattern);
    const offset=(search.page-1)*SCHOOL_DIRECTORY_PAGE_SIZE;
    const {data,count,error}=await query.order("name",{ascending:true})
      .order("official_code",{ascending:true})
      .range(offset,offset+SCHOOL_DIRECTORY_PAGE_SIZE-1);
    if(error || !Array.isArray(data) || typeof count!=="number")
      return respond({error:"directory_unavailable"},503);
    return respond({centres:data,total:count,page:search.page,
      pageSize:SCHOOL_DIRECTORY_PAGE_SIZE});
  } catch {
    console.error("public_school_directory_read_unavailable");
    return respond({error:"directory_unavailable"},503);
  }
}
