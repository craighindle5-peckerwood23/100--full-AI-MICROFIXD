import {z} from 'zod';
export const OBD_COMMANDS=['0100','0120','0140','0160','0101','0104','0105','0106','0107','010B','010C','010D','010F','0110','0111','0142','03','07','0A','0902'] as const;
export const obdSessionSchema=z.object({adapter:z.enum(['j2534','elm327_serial','elm327_tcp','elm327_bluetooth_serial']),label:z.string().trim().min(1).max(150)}).strict();
export const obdSampleSchema=z.object({
 sequence:z.number().int().min(1),observedAt:z.string().datetime(),
 status:z.enum(['connected','vehicle_not_responding','disconnected','error']),
 protocol:z.string().min(1).max(100),adapterVersion:z.string().max(200),
 responses:z.array(z.object({command:z.enum(OBD_COMMANDS),ecu:z.string().regex(/^[0-9A-F]{3,8}$/).optional(),payload:z.string().regex(/^(?:[0-9A-F]{2})*$/).max(8192)}).strict()).max(200),
 errors:z.array(z.string().max(200)).max(30),
}).strict();
export type OBDSample=z.infer<typeof obdSampleSchema>;
export type OBDSession={id:string;adapter:z.infer<typeof obdSessionSchema>['adapter'];label:string;owner:string;createdAt:string;receivedAt?:string;sequence:number;latest?:OBDSample;queries?:{command:string;receivedAt:string;responses:OBDSample['responses']}[];history:{at:string;sequence:number;status:string;dtcs:string[]}[]};
