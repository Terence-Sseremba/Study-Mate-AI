import { handleTutorChatRequest } from '../src/server/apiPlugin.ts';

export default async function handler(req: any, res: any) {
  return handleTutorChatRequest(req, res);
}
