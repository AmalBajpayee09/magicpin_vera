"""Live HTTP verification on local or public base URL. Adds synthetic smoke-* records.
Does NOT wipe unrelated state. Pass --url; BOT_TOKEN environment variable is optional.
"""
import argparse
from datetime import datetime, timezone, timedelta
import json
import os
import time
import urllib.request
import urllib.error
import uuid

def verify(url):
    timings = []
    def call(path, body=None):
        headers = {'Content-Type': 'application/json'}
        if os.environ.get('BOT_TOKEN'): headers['Authorization'] = 'Bearer ' + os.environ['BOT_TOKEN']
        r = urllib.request.Request(url.rstrip('/')+path, data=json.dumps(body).encode() if body is not None else None, headers=headers)
        started = time.perf_counter()
        try:
            with urllib.request.urlopen(r, timeout=25) as response:
                code, data = response.status, json.load(response)
        except urllib.error.HTTPError as e:
            code, data = e.code, json.load(e)
        timings.append((time.perf_counter()-started)*1000)
        return code, data
    now = datetime.now(timezone.utc)
    stamp = now.isoformat().replace('+00:00','Z')
    prefix = 'smoke-'+uuid.uuid4().hex[:12]
    category = {'slug':prefix,'voice':{'tone':'practical'}}
    merchant = {'merchant_id':prefix,'category_slug':prefix,'identity':{'name':'Smoke Cafe','languages':['en']},'offers':[]}
    trigger = {'id':prefix,'scope':'merchant','kind':'active_planning_intent','merchant_id':prefix,'payload':{'intent_topic':'corporate_lunch'},'urgency':4,'suppression_key':prefix,'expires_at':(now+timedelta(days=1)).isoformat().replace('+00:00','Z')}
    code, health = call('/v1/healthz');assert code==200 and health['status']=='ok'
    code, metadata = call('/v1/metadata');assert code==200 and isinstance(metadata['team_members'],list) and metadata['approach']
    for scope,payload in [('category',category),('merchant',merchant),('trigger',trigger)]:
        code,data=call('/v1/context',{'scope':scope,'context_id':prefix,'version':1,'payload':payload,'delivered_at':stamp})
        assert code==200 and data['accepted'] and data['stored_at']
    tick={'now':stamp,'available_triggers':[prefix]}
    code,data=call('/v1/tick',tick);assert code==200 and len(data['actions'])==1
    action=data['actions'][0];assert action['template_name'] and action['body'] and action['send_as']=='vera'
    reply={'conversation_id':action['conversation_id'],'merchant_id':prefix,'customer_id':None,'from_role':'merchant','message':"ok let's do it",'received_at':stamp,'turn_number':2}
    code,data=call('/v1/reply',reply)
    assert code==200 and data['action']=='send', 'Accepted proposal must produce a reply'
    body=data.get('body','')
    assert 'corporate lunch' in body.replace('_',' ').lower(), 'Reply must preserve the planning topic'
    assert all(field in body for field in ['Audience:', 'Details:', 'Availability:', 'Terms:']), 'Reply must deliver a concrete planning outline'
    assert '[approved services or content]' in body, 'Unknown services must remain unconfirmed'
    assert body.count('?')==1, 'Reply must contain one next question'
    assert call('/v1/reply',reply)[1]==data
    assert call('/v1/tick',tick)[1]['actions']==[]
    return {'status':'PASS','base_url':url,'https':url.startswith('https://'),'requests':len(timings),'mean_ms':round(sum(timings)/len(timings),3),'max_ms':round(max(timings),3),'synthetic_context_id':prefix,'conversation_id':action['conversation_id']}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--url',default='http://127.0.0.1:8080');a=p.parse_args()
    print(json.dumps(verify(a.url),indent=2))
