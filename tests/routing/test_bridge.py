import importlib.util
from pathlib import Path
import unittest
from flask import Flask
spec=importlib.util.spec_from_file_location('routing_bridge',Path(__file__).resolve().parents[2]/'src/modules/routing_bridge.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class BridgeTests(unittest.TestCase):
 def setUp(self):
  self.calls=[];self.app=Flask(__name__);self.app.secret_key='test-only'
  def transport(method,path,body,headers):self.calls.append((method,path,body,headers));return 200,b'{"ok":true}',{'Content-Type':'application/json'}
  self.app.register_blueprint(module.create_routing_blueprint('/vpn',transport=transport))
  self.client=self.app.test_client()
 def login(self):
  with self.client.session_transaction() as session:session['username']='admin-token';session['role']='admin'
 def test_api_key_does_not_bypass_session(self):
  response=self.client.get('/vpn/routing/api/v1/status',headers={'wg-dashboard-apikey':'key'})
  self.assertEqual(response.status_code,401);self.assertFalse(self.calls)
 def test_csrf_required_and_session_authorizes_forwarding(self):
  self.login();response=self.client.get('/vpn/routing/api/v1/session');token=response.json['csrf_token']
  self.assertEqual(self.client.put('/vpn/routing/api/v1/policy',json={}).status_code,403)
  response=self.client.put('/vpn/routing/api/v1/policy',json={},headers={'X-CSRF-Token':token,'If-Match':'3','Idempotency-Key':'key'})
  self.assertEqual(response.status_code,200)
  self.assertEqual(self.calls[0][3]['If-Match'],'3')
  self.assertNotIn('admin-token',str(self.calls))
 def test_unknown_paths_and_cross_origin_rejected(self):
  self.login();token=self.client.get('/vpn/routing/api/v1/session').json['csrf_token']
  self.assertEqual(self.client.get('/vpn/routing/api/v1/../../shell').status_code,404)
  self.assertEqual(self.client.post('/vpn/routing/api/v1/previews',json={},headers={'X-CSRF-Token':token,'Origin':'https://evil.test'}).status_code,403)
if __name__=='__main__':unittest.main()
