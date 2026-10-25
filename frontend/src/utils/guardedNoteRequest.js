// A new frontend can be deployed before its API. Don't send persistent drafts
// until the API confirms support for the account guard used by the outbox.
export function guardedNoteRequest(request) {
  let verifiedUser = null;
  return async (path, options) => {
    if (verifiedUser !== options.expectedUserId) {
      let capability;
      try { capability = await request('/sync-session', { expectedUserId: options.expectedUserId, signal: options.signal }); }
      catch (error) {
        if ([400, 404].includes(error.status)) throw Object.assign(new Error('O serviço de sincronização está sendo atualizado.'), { status: 503 });
        throw error;
      }
      if (capability.persistentQueue !== 1 || capability.userId !== options.expectedUserId) throw Object.assign(new Error('A conta da sincronização mudou. Entre novamente.'), { status: 409, code: 'SESSION_CHANGED' });
      verifiedUser = options.expectedUserId;
    }
    return request(path, options);
  };
}
