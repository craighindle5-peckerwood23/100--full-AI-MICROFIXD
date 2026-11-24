export default async function* report(events){
 for await(const {type,data} of events){
   if(!['test:pass','test:fail'].includes(type))continue;
   const error=data.details?.error;
   const cause=error?.cause??error;
   yield JSON.stringify({id:data.name,status:data.skip||data.todo?'skipped':type==='test:pass'?'pass':'fail',error:cause?.stack??cause?.message??''})+'\n';
 }
}
