import { handleStatusRequest } from '../src/server/apiPlugin.ts';

export default function handler(req: any, res: any) {
  return handleStatusRequest(req, res);
}
