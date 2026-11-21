"""Admin-session-only bridge to the local routing API over a protected Unix socket."""
import hashlib
import hmac
import http.client
import re
import secrets
import socket
from flask import Blueprint, Response, jsonify, request, session

SOCKET_PATH='/run/routing-control/api.sock'
MAX_FRAME=1024*1024
ROUTES={
 'GET':r'(?:status|policy|gateways|routes|route-entries|export|events|operations/[0-9a-f-]{36}|notifications/telegram|notifications/zabbix/options|notifications/jobs/[0-9a-f-]{36}|notifications/deliveries)',
 'POST':r'(?:gateways/import|gateways/[0-9a-f-]{36}/probe|route-entries|lookup|previews|operations|notifications/telegram/(?:check|test|disable)|reconcile/previews)',
 'PUT':r'(?:policy|notifications/telegram)',
 'PATCH':r'(?:gateways/[0-9a-f-]{36}|route-entries/[0-9a-f-]{36})',
 'DELETE':r'(?:gateways/[0-9a-f-]{36}|route-entries/[0-9a-f-]{36})',
}
class UnixHTTPConnection(http.client.HTTPConnection):
 def connect(self):
  self.sock=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM)
  self.sock.settimeout(self.timeout);self.sock.connect(SOCKET_PATH)

def unix_transport(method,path,body,headers):
 conn=UnixHTTPConnection('localhost',timeout=5)
 try:
  conn.request(method,path,body,headers)
  response=conn.getresponse();data=response.read(MAX_FRAME+1)
  if len(data)>MAX_FRAME:raise OSError('response too large')
  safe={name:value for name,value in response.getheaders() if name.lower() in ('content-type','etag','retry-after')}
  return response.status,data,safe
 finally:conn.close()

def create_routing_blueprint(prefix='',transport=unix_transport):
 blueprint=Blueprint('routing_control',__name__,url_prefix=prefix+'/routing/api/v1')
 @blueprint.before_request
 def protect():
  request.max_content_length=MAX_FRAME
  if not session.get('username') or session.get('role')!='admin':return jsonify(error='ADMIN_SESSION_REQUIRED'),401
  if request.method not in ('GET','HEAD'):
   token=session.get('routing_csrf','');provided=request.headers.get('X-CSRF-Token','')
   if not token or not hmac.compare_digest(token,provided):return jsonify(error='CSRF_REQUIRED'),403
   origin=request.headers.get('Origin')
   if origin and origin!=request.host_url.rstrip('/'):return jsonify(error='CROSS_ORIGIN_DENIED'),403
  if request.content_length and request.content_length>MAX_FRAME:return jsonify(error='PAYLOAD_TOO_LARGE'),413
 @blueprint.get('/session')
 def csrf_session():
  if 'routing_csrf' not in session:session['routing_csrf']=secrets.token_urlsafe(32)
  return jsonify(csrf_token=session['routing_csrf'])
 @blueprint.route('/<path:path>',methods=['GET','POST','PUT','PATCH','DELETE'])
 def proxy(path):
  if not re.fullmatch(ROUTES.get(request.method,r'(?!)'),path):return jsonify(error='NOT_FOUND'),404
  body=request.get_data(cache=False)
  if len(body)>MAX_FRAME:return jsonify(error='PAYLOAD_TOO_LARGE'),413
  headers={'Content-Type':'application/json','X-Routing-Actor':'admin:'+hashlib.sha256(session['username'].encode()).hexdigest()[:16]}
  for name in ('If-Match','Idempotency-Key'):
   if name in request.headers:headers[name]=request.headers[name]
  query=request.query_string.decode('ascii',errors='strict')
  endpoint='/v1/'+path+('?' + query if query else '')
  try:status,data,response_headers=transport(request.method,endpoint,body,headers)
  except (OSError,http.client.HTTPException):return jsonify(error='ROUTING_API_UNAVAILABLE'),503
  response=Response(data,status=status,headers=response_headers)
  response.headers['Cache-Control']='no-store'
  return response
 return blueprint
