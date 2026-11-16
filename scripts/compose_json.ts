import {compose,NoActionError} from '../src/engine/composer';
let input='';for await(const c of process.stdin) input+=c;
const b=JSON.parse(input);
try {console.log(JSON.stringify(compose(b.category,b.merchant,b.trigger,b.customer,b.now)));}
catch(e){if(e instanceof NoActionError) console.log(JSON.stringify({body:'',cta:'none',send_as:b.customer?'merchant_on_behalf':'vera',suppression_key:b.trigger?.suppression_key || '',rationale:e.message}));else {console.error('Invalid composition request');process.exitCode=1;}}
