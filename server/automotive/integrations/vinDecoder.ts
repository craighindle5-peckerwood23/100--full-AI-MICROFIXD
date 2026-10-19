export async function decodeVIN(vin:string,request:typeof fetch=fetch){
  if(!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin))throw new Error('INVALID_VIN');
  const source=`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vin}?format=json`;
  const response=await request(source,{signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error('VIN_PROVIDER_UNAVAILABLE');
  const result=await response.json(),row=result.Results?.[0];
  if(!row||String(row.ErrorCode)!=='0')throw new Error('VIN_DECODE_INCOMPLETE');
  return {vin,year:Number(row.ModelYear),make:row.Make,model:row.Model,engine:[row.DisplacementL,row.EngineModel].filter(Boolean).join(' '),source,requiresEngineConfirmation:true};
}
