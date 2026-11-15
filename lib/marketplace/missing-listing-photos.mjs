/**
 * Rebuild only missing photo metadata for an already owned listing.
 * URLs come from the persisted listings.photos array, never from a URL query.
 * Keep original order, but ignore non-HTTPS/untrusted values and duplicates.
 * @param {unknown} saved
 * @param {unknown} rows
 * @returns {{url:string,sort_order:number}[]}
 */
export function missingListingPhotoMetadata(saved,rows) {
  if (!Array.isArray(saved)) return [];
  const present=new Set(Array.isArray(rows)?rows.map(row=>row?.url).filter(url=>typeof url==="string"):[]);
  const unique=new Set();
  const missing=[];
  for(let index=0;index<Math.min(saved.length,8);index++){
    const url=saved[index];
    if(typeof url!=="string"||!url.startsWith("https://")||unique.has(url))continue;
    try {
      const parsed=new URL(url);
      if(parsed.protocol!=="https:"||!parsed.hostname)continue;
    } catch {continue;}
    unique.add(url);
    if(!present.has(url))missing.push({url,sort_order:index});
  }
  return missing;
}
