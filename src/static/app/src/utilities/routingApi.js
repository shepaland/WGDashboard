export function moveGateway(order, id, delta) {
 const result=[...order], index=result.indexOf(id), target=index+delta;
 if(index<0 || target<0 || target>=result.length) return result;
 [result[index],result[target]]=[result[target],result[index]];return result;
}
export function createRoutingClient(prefix='', fetcher=globalThis.fetch) {
 let csrf;
 const base=prefix.replace(/\/$/,'')+'/routing/api/v1';
 async function request(path, {method='GET',body,revision,key}={}) {
  if(method!=='GET' && !csrf) csrf=(await request('/session')).csrf_token;
  const headers={'Accept':'application/json'};
  if(method!=='GET') {headers['X-CSRF-Token']=csrf;headers['Idempotency-Key']=key||crypto.randomUUID();}
  if(body!==undefined) headers['Content-Type']='application/json';
  if(revision!==undefined) headers['If-Match']=String(revision);
  const response=await fetcher(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),credentials:'same-origin',cache:'no-store'});
  const data=await response.json();
  if(!response.ok) {const error=new Error(data.error||data.detail||'REQUEST_FAILED');error.status=response.status;throw error;}
  return data;
 }
 return {request};
}
export async function readRoutingSnapshot(api) {
 const [status,gateways,routes,policy]=await Promise.all(['/status','/gateways','/route-entries','/policy'].map(path=>api.request(path)));
 if(![status.desired_revision,gateways.revision,routes.revision].every(revision=>revision===policy.revision)) {
  const error=new Error('Конфигурация изменилась во время загрузки. Обновите данные.');error.status=409;throw error;
 }
 return {status,gateways:gateways.items,routes:routes.items,policy:policy.policy,revision:policy.revision};
}
export function canApplyPreview(preview) {
 return Boolean(preview && preview.preview_id && preview.hash && preview.diff && Array.isArray(preview.errors) && preview.errors.length===0 && Date.parse(preview.expires_at)>Date.now());
}
export function notificationJobMessage(job) {
 if(job.phase==='delivered') return 'Zabbix подтвердил отправку тестового сообщения. Прочтение получателем не проверяется.';
 if(job.phase==='succeeded' && job.kind==='check') return 'Подключение проверено. Доставка сообщения не проверялась.';
 if(job.phase==='succeeded' && job.kind==='disable') return 'Уведомления о переключении отключены. Уже созданные сообщения могут завершить доставку.';
 if(['failed','recovery_required'].includes(job.phase)) return 'Операция не подтверждена. Требуется проверка состояния Zabbix.';
 if(job.phase==='unknown') return 'Статус отправки пока неизвестен. Повторное сообщение автоматически не отправляется.';
 return 'Подтверждение отправки от Zabbix ожидается.';
}
