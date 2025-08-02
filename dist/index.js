'use strict';Object.defineProperty(exports,'__esModule',{value:true});var P=require('path'),crypto=require('crypto');function _interopNamespace(e){if(e&&e.__esModule)return e;var n=Object.create(null);if(e){Object.keys(e).forEach(function(k){if(k!=='default'){var d=Object.getOwnPropertyDescriptor(e,k);Object.defineProperty(n,k,d.get?d:{enumerable:true,get:function(){return e[k]}});}})}n.default=e;return Object.freeze(n)}var P__namespace=/*#__PURE__*/_interopNamespace(P);/* JMeter Style Reporter v1.0.0 - MIT License */
var $=class{metrics=[];options;flushTimer;disposed=false;maxMetrics=1e5;flushing=false;pendingFlush=null;totalMetricsCollected=0;totalMetricsFlushed=0;errorCount=0;flushCount=0;startTime=Date.now();dataIntegrityHash="";constructor(t){this.options={bufferSize:1e3,flushInterval:5e3,silent:false,jmeterCompatible:true,...t},this.options.bufferSize&&this.options.bufferSize>1e4&&(console.warn("Buffer size clamped to 10000 to prevent memory issues"),this.options.bufferSize=1e4),this.options.flushInterval&&this.options.flushInterval>0&&(this.flushTimer=setInterval(()=>{this.disposed||this.flush().catch(s=>{console.error("Flush error:",s),this.options.onError?.(s);});},this.options.flushInterval),this.flushTimer.unref?.());let r=()=>{this.disposed||this.dispose().catch(console.error);};process.on("exit",r),process.on("SIGINT",r),process.on("SIGTERM",r),process.on("uncaughtException",r);}async recordMetric(t){if(this.disposed){console.warn("Cannot record metric: collector has been disposed");return}try{if(t.responseTime!==void 0&&(typeof t.responseTime!="number"||t.responseTime<0))throw new Error(`Invalid response time: ${t.responseTime}`);if(t.statusCode!==void 0&&(typeof t.statusCode!="number"||t.statusCode<100||t.statusCode>599))throw new Error(`Invalid status code: ${t.statusCode}`);this.metrics.length>=this.maxMetrics&&(console.warn(`Maximum metrics limit reached (${this.maxMetrics}), forcing flush`),await this.flush());let r={timestamp:Date.now(),endpoint:E(t.endpoint||"unknown"),responseTime:_(String(t.responseTime||0)),statusCode:v(String(t.statusCode||200)),method:E(t.method||"GET"),success:(t.statusCode||200)<400,testName:E(t.testName||this.options.testName||"default"),bytes:v(String(t.bytes||0)),sentBytes:v(String(t.sentBytes||0)),grpThreads:Math.max(1,v(String(t.grpThreads||1))),allThreads:Math.max(1,v(String(t.allThreads||1))),...t};this.updateDataIntegrityHash(r),this.metrics.push(r),this.totalMetricsCollected++,this.metrics.length>=(this.options.bufferSize||1e3)&&await this.flush();}catch(r){this.errorCount++,this.options.onError?.(r),console.error("Failed to record metric:",r);}}updateDataIntegrityHash(t){let r=`${t.timestamp}:${t.responseTime}:${t.statusCode}`;this.dataIntegrityHash=crypto.createHash("sha256").update(this.dataIntegrityHash+r).digest("hex").substring(0,16);}getStats(){return {totalMetrics:this.totalMetricsCollected,bufferedMetrics:this.metrics.length,flushCount:this.flushCount,errorCount:this.errorCount,isActive:!this.disposed,startTime:this.startTime,lastFlushTime:Date.now(),dataIntegrityHash:this.dataIntegrityHash}}async flush(){if(this.pendingFlush)return this.pendingFlush;if(this.metrics.length!==0){this.pendingFlush=this._performFlush();try{await this.pendingFlush;}finally{this.pendingFlush=null;}}}async _performFlush(){if(!(this.flushing||this.metrics.length===0)){this.flushing=true;try{let t=[...this.metrics];if(this.metrics.length=0,t.length===0)return;let{promises:r}=await import('fs'),i=(await import('path')).dirname(this.options.outputPath);try{await r.mkdir(i,{recursive:!0});}catch(l){if(l.code!=="EEXIST")throw l}let n=!1;try{await r.access(this.options.outputPath),n=!0;}catch{}let c="";if(!n){let l=this.options.jmeterCompatible?`timestamp,elapsed,label,responseCode,success,bytes,sentBytes,grpThreads,allThreads,Filename
`:`timestamp,responseTime,endpoint,statusCode,success,method,testName
`;c+=l;}let m=t.map(l=>this.options.jmeterCompatible?[l.timestamp,l.responseTime,`"${M(l.endpoint||"")}"`,l.statusCode,l.success,l.bytes||0,l.sentBytes||0,l.grpThreads||1,l.allThreads||1,`"${M(l.testName||"")}"`].join(","):[l.timestamp,l.responseTime,`"${M(l.endpoint||"")}"`,l.statusCode,l.success,M(l.method||""),`"${M(l.testName||"")}"`].join(",")).join(`
`)+`
`;c+=m,await r.appendFile(this.options.outputPath,c,"utf8");let p=t.length;this.totalMetricsFlushed+=p,this.flushCount++,this.options.silent||console.log(`\u2705 Flushed ${p} metrics to ${this.options.outputPath} (Total: ${this.totalMetricsFlushed})`),this.options.onFlush?.(p);}catch(t){throw console.error("Flush failed:",t),this.options.onError?.(t),t}finally{this.flushing=false;}}}async dispose(){if(!this.disposed){this.disposed=true,this.flushTimer&&(clearInterval(this.flushTimer),this.flushTimer=void 0);try{process.removeAllListeners("exit"),process.removeAllListeners("SIGINT"),process.removeAllListeners("SIGTERM"),process.removeAllListeners("uncaughtException");}catch{}await this.flush(),this.metrics.length=0;}}},b=class{static calculatePercentile(t,r){if(t.length===0)return 0;let s=[...t].sort((n,c)=>n-c),i=Math.ceil(r/100*s.length)-1;return s[Math.max(0,i)]}static calculateApdexScore(t,r=500,s){if(t.length===0)return {label:s||"Unknown",score:0,samples:0,satisfied:0,tolerating:0,frustrated:0};let i=t.filter(p=>p<=r).length,n=t.filter(p=>p>r&&p<=r*4).length,c=t.filter(p=>p>r*4).length,m=(i+n*.5)/t.length;return {label:s||"Unknown",score:m,samples:t.length,satisfied:i,tolerating:n,frustrated:c}}static calculateStandardDeviation(t,r){if(t.length===0)return 0;let i=t.map(n=>Math.pow(n-r,2)).reduce((n,c)=>n+c,0)/t.length;return Math.sqrt(i)}};function X(e,t){let r={record:null,errors:[],warnings:[]};if(!e||e.trim().length===0)return r;/^[@=+\-|]/.test(e.trim())&&r.warnings.push(`Line ${t}: Potential CSV injection detected`);try{let s=[],i="",n=!1,c=0;for(;c<e.length;){let f=e[c],C=e[c+1];if(f==='"')if(n&&C==='"'){i+='"',c+=2;continue}else n=!n;else if(f===","&&!n){s.push(G(i.trim())),i="",c++;continue}else i+=f;c++;}if(s.push(G(i.trim())),s.length<10)return r.errors.push(`Line ${t}: Insufficient fields: ${s.length} < 10`),r;let m=v(s[0]),p=_(s[1]),l=v(s[3]);if(isNaN(m)||m<=0)return r.errors.push(`Line ${t}: Invalid timestamp: ${s[0]}`),r;if(isNaN(p)||p<0)return r.errors.push(`Line ${t}: Invalid elapsed time: ${s[1]}`),r;if(isNaN(l)||l<100||l>599)return r.errors.push(`Line ${t}: Invalid response code: ${s[3]}`),r;let a=Date.now(),y=a-365*24*60*60*1e3,h=a+3600*1e3;return (m<y||m>h)&&r.warnings.push(`Line ${t}: Suspicious timestamp: ${new Date(m).toISOString()}`),p>3e5&&r.warnings.push(`Line ${t}: Very high response time: ${p}ms`),r.record={timestamp:m,elapsed:p,label:E(s[2]),responseCode:l,success:s[4]?.toLowerCase().trim()==="true",bytes:Math.max(0,v(s[5])||0),sentBytes:Math.max(0,v(s[6])||0),grpThreads:Math.max(1,v(s[7])||1),allThreads:Math.max(1,v(s[8])||1),filename:E(s[9]||"")},r}catch(s){return r.errors.push(`Line ${t}: Parse error: ${s}`),r}}function ne(e){let t=X(e,0);return t.errors.length>0&&console.error("CSV parse errors:",t.errors),t.warnings.length>0&&console.warn("CSV parse warnings:",t.warnings),t.record}function v(e){if(!e||e.trim().length===0)return 0;let t=parseInt(e.trim(),10);return isNaN(t)||!isFinite(t)?0:Math.max(0,Math.min(t,Number.MAX_SAFE_INTEGER))}function _(e){if(!e||e.trim().length===0)return 0;let t=parseFloat(e.trim());return isNaN(t)||!isFinite(t)?0:Math.max(0,Math.min(t,Number.MAX_SAFE_INTEGER))}function ie(e){if(typeof e!="string")throw new Error("Invalid output path");let t=P__namespace.resolve(e),r=process.cwd();if(!t.startsWith(r))throw new Error("Output path must be within current working directory");if(["/etc","/usr","/var","/bin","/sbin","/boot","/sys"].some(i=>t.startsWith(i)))throw new Error("Cannot write to system directories");return t}function G(e){return e?/^[@=+\-|]/.test(e.toString().trim())?`'${e}`:e.toString().replace(/[\r\n]/g," ").substring(0,1e3):""}function E(e){return e?e.trim().replace(/^"|"$/g,"").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/&/g,"&amp;").substring(0,1e3):""}function D(e){return e==null?"":String(e).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;").replace(/\//g,"&#x2F;")}function M(e){return e?e.replace(/\\/g,"\\\\").replace(/'/g,"\\'").replace(/"/g,'\\"').replace(/\n/g,"\\n").replace(/\r/g,"\\r").replace(/\t/g,"\\t").replace(/\f/g,"\\f").replace(/\v/g,"\\v").replace(/\0/g,"\\0").replace(/</g,"\\u003c").replace(/>/g,"\\u003e"):""}function N(e){try{return JSON.stringify(e,(t,r)=>typeof r=="string"?M(r):r)}catch(t){return console.error("Failed to serialize data safely:",t),"{}"}}function le(e){return {400:"Bad Request",401:"Unauthorized",403:"Forbidden",404:"Not Found",405:"Method Not Allowed",408:"Request Timeout",429:"Too Many Requests",500:"Internal Server Error",502:"Bad Gateway",503:"Service Unavailable",504:"Gateway Timeout"}[e]||`HTTP ${e}`}function ce(e){return {...e,jmeterCompatible:true}}function W(e){let r="jmeterCompatible"in e?e:ce(e);return new $(r)}async function O(e){let t=performance.now(),r=Array.isArray(e.csv)?e.csv:[e.csv],s=ie(e.output||"./jmeter-report"),i={apiVersion:e.apiVersion||"latest",maxMemoryUsageMB:e.maxMemoryUsageMB||512,streamingMode:e.streamingMode!==false,maxDataPoints:e.maxDataPoints||1e4,skipValidation:e.skipDataValidation===true},n=[],c=0,m=0,{promises:p}=await import('fs'),{createReadStream:l}=await import('fs'),{createInterface:a}=await import('readline');try{await p.mkdir(s,{recursive:!0});}catch(o){if(o.code!=="EEXIST")throw o}let y=Math.min(Math.floor(i.maxMemoryUsageMB*1024*1024/256),5e4),h=[],f=[],C=[];for(let o of r)try{await p.access(o);let d=await p.stat(o);d.size>500*1024*1024&&n.push(`Large file detected: ${o} (${Math.round(d.size/1024/1024)}MB)`);let u=l(o,{encoding:"utf8",highWaterMark:64*1024}),R=a({input:u,crlfDelay:1/0}),w=0,x=0;for await(let T of R)if(w++,w!==1&&T.trim()){if(i.skipValidation){let g=ne(T);g?(h.push(g),c++,x++):m++;}else {let g=X(T,w);f.push(...g.errors),C.push(...g.warnings),g.record?(h.push(g.record),c++,x++):m++;}if(h.length>=y){n.push(`Memory limit reached. Processed ${c} records, truncating remaining data.`);break}}R.close(),u.destroy(),x===0&&n.push(`No valid records found in ${o}`);}catch(d){let u=`Could not process CSV file ${o}: ${d}`;n.push(u),console.warn(u);}if(h.length===0)throw new Error("No valid data found in CSV files. Check file format and data validity.");f.length>0&&(n.push(`${f.length} parsing errors encountered`),f.length>10?console.error("First 10 parsing errors:",f.slice(0,10)):console.error("Parsing errors:",f)),C.length>0&&!i.skipValidation&&(n.push(`${C.length} parsing warnings`),console.warn(`${C.length} parsing warnings (run with skipDataValidation: true to suppress)`));let F=Math.min(...h.map(o=>o.timestamp)),U=Math.max(...h.map(o=>o.timestamp)),I=(U-F)/1e3,k=new Map;h.forEach(o=>{k.has(o.label)||k.set(o.label,[]),k.get(o.label).push(o);});let J=[],H=[];for(let[o,d]of k){let u=d.map(g=>g.elapsed),R=d.filter(g=>!g.success).length,w=d.reduce((g,j)=>g+j.bytes,0),x=u.reduce((g,j)=>g+j,0)/u.length,T={label:o,samples:d.length,average:x,median:b.calculatePercentile(u,50),p90:b.calculatePercentile(u,90),p95:b.calculatePercentile(u,95),p99:b.calculatePercentile(u,99),min:Math.min(...u),max:Math.max(...u),errorRate:R/d.length,throughput:d.length/Math.max(I,1),receivedKB:w/1024,avgBytes:w/d.length};if(e.includeApdex!==false){let g=b.calculateApdexScore(u,e.apdexThreshold||500,o);T.apdexScore=g.score,H.push(g);}J.push(T);}let B=Math.max(Math.floor(I/100),1)*1e3,V=[];for(let o=F;o<=U;o+=B){let d=h.filter(u=>u.timestamp>=o&&u.timestamp<o+B);if(d.length>0){let u=d.reduce((x,T)=>x+T.elapsed,0)/d.length,R=d.filter(x=>!x.success).length,w=Math.max(...d.map(x=>x.allThreads));V.push({timestamp:o,responseTime:u,throughput:d.length/(B/1e3),errorRate:R/d.length,activeThreads:w});}}let z=new Map;h.filter(o=>!o.success).forEach(o=>{z.set(o.responseCode,(z.get(o.responseCode)||0)+1);});let Q=Array.from(z.entries()).map(([o,d])=>({responseCode:o,count:d,percentage:d/h.length*100,message:le(o)})).sort((o,d)=>d.count-o.count),L=h.length,Y=h.filter(o=>!o.success).length,S=h.map(o=>o.elapsed),Z=S.reduce((o,d)=>o+d,0)/L,ee=Y/L,te=L/Math.max(I,1),A={totalRequests:L,averageResponseTime:Z,errorRate:ee,throughput:te};if(e.includePercentiles!==false&&(A.percentiles={p50:b.calculatePercentile(S,50),p90:b.calculatePercentile(S,90),p95:b.calculatePercentile(S,95),p99:b.calculatePercentile(S,99)}),e.includeApdex!==false){let o=b.calculateApdexScore(S,e.apdexThreshold||500);A.apdexScore=o.score;}let re=pe({title:e.title||"JMeter Performance Dashboard",theme:e.theme||"light",summary:A,endpointStats:J,timeSeriesData:V,errorSummary:Q,apdexData:H,testDuration:I,allRecords:h,endpointData:k,includeDrillDown:e.includeDrillDown!==false,jenkinsCompatible:e.jenkinsCompatible,embeddedCharts:e.embeddedCharts}),q=P__namespace.join(s,"index.html");await p.writeFile(q,re,"utf8");let se=performance.now(),oe=process.memoryUsage();return {outputPath:s,reportUrl:`file://${P__namespace.resolve(q)}`,summary:A,warnings:n,stats:{memoryUsedMB:Math.round(oe.heapUsed/1024/1024),processingTimeMs:Math.round(se-t),recordsProcessed:c,recordsSkipped:m}}}function de(){return '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>'}function pe(e){let t=e.theme==="dark",r=t?"#1a1a1a":"#f8f9fa",s=t?"#2d3748":"#ffffff",i=t?"#e2e8f0":"#2d3748",n=t?"#4a5568":"#e2e8f0",c=t?"#374151":"#f7fafc",m={};e.endpointData.forEach((a,y)=>{m[y]=a;});let p=e.jenkinsCompatible||e.embeddedCharts;return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${D(e.title)}</title>
    ${p?de():'<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>'}
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: ${r};
            color: ${i};
            line-height: 1.6;
            font-size: 14px;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            background: ${s};
            border: 1px solid ${n};
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            font-weight: 600;
            color: ${t?"#fff":"#1a202c"};
        }
        
        .header p {
            font-size: 1.1rem;
            opacity: 0.8;
        }
        
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .summary-card {
            background: ${s};
            padding: 20px;
            border: 1px solid ${n};
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            transition: transform 0.2s;
        }
        
        .summary-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }
        
        .summary-value {
            font-size: 2.5rem;
            font-weight: bold;
            margin-bottom: 8px;
        }
        
        .summary-label {
            font-size: 0.95rem;
            opacity: 0.8;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .success { color: #10b981; }
        .warning { color: #f59e0b; }
        .error { color: #ef4444; }
        .info { color: #3b82f6; }
        
        .panel {
            background: ${s};
            border: 1px solid ${n};
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .panel-heading {
            padding: 15px 20px;
            border-bottom: 1px solid ${n};
            background: ${c};
            border-radius: 8px 8px 0 0;
        }
        
        .panel-title {
            font-size: 18px;
            font-weight: 600;
            margin: 0;
            color: ${t?"#fff":"#1a202c"};
        }
        
        .panel-body {
            padding: 20px;
        }
        
        .chart-container {
            position: relative;
            height: 400px;
            margin-bottom: 20px;
        }
        
        .table-responsive {
            overflow-x: auto;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }
        
        th, td {
            text-align: left;
            padding: 12px;
            border-bottom: 1px solid ${n};
        }
        
        th {
            background: ${c};
            font-weight: 600;
            position: sticky;
            top: 0;
            z-index: 10;
        }
        
        tbody tr:hover {
            background: ${t?"#374151":"#f9fafb"};
        }
        
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        
        .apdex-score {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-weight: 600;
            font-size: 12px;
        }
        
        .apdex-excellent { background: #10b981; color: white; }
        .apdex-good { background: #3b82f6; color: white; }
        .apdex-fair { background: #f59e0b; color: white; }
        .apdex-poor { background: #ef4444; color: white; }
        
        .tabs {
            display: flex;
            border-bottom: 2px solid ${n};
            margin-bottom: 20px;
        }
        
        .tab {
            padding: 10px 20px;
            cursor: pointer;
            background: none;
            border: none;
            font-size: 16px;
            color: ${i};
            opacity: 0.7;
            transition: all 0.2s;
        }
        
        .tab:hover {
            opacity: 1;
        }
        
        .tab.active {
            opacity: 1;
            border-bottom: 3px solid #3b82f6;
            margin-bottom: -2px;
        }
        
        .tab-content {
            display: none;
        }
        
        .tab-content.active {
            display: block;
        }
        
        .drill-down-link {
            color: #3b82f6;
            cursor: pointer;
            text-decoration: none;
        }
        
        .drill-down-link:hover {
            text-decoration: underline;
        }
        
        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
        }
        
        .modal-content {
            background-color: ${s};
            margin: 5% auto;
            padding: 20px;
            border: 1px solid ${n};
            border-radius: 8px;
            width: 90%;
            max-width: 1200px;
            max-height: 80vh;
            overflow-y: auto;
        }
        
        .close {
            color: ${i};
            float: right;
            font-size: 28px;
            font-weight: bold;
            cursor: pointer;
        }
        
        .close:hover {
            opacity: 0.7;
        }
        
        @media (max-width: 768px) {
            .summary-grid {
                grid-template-columns: 1fr;
            }
            
            .header h1 {
                font-size: 1.8rem;
            }
            
            .tab {
                font-size: 14px;
                padding: 8px 12px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${D(e.title)}</h1>
            <p>Test Duration: ${(e.testDuration/60).toFixed(2)} minutes | Generated: ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="summary-grid">
            <div class="summary-card">
                <div class="summary-value">${e.summary.totalRequests.toLocaleString()}</div>
                <div class="summary-label">Total Requests</div>
            </div>
            <div class="summary-card">
                <div class="summary-value ${e.summary.errorRate<.01?"success":e.summary.errorRate<.05?"warning":"error"}">
                    ${(e.summary.errorRate*100).toFixed(2)}%
                </div>
                <div class="summary-label">Error Rate</div>
            </div>
            <div class="summary-card">
                <div class="summary-value info">${e.summary.averageResponseTime?.toFixed(0)}ms</div>
                <div class="summary-label">Average Response Time</div>
            </div>
            <div class="summary-card">
                <div class="summary-value">${e.summary.throughput.toFixed(2)}/s</div>
                <div class="summary-label">Throughput</div>
            </div>
            ${e.summary.apdexScore!==void 0?`
            <div class="summary-card">
                <div class="summary-value ${l(e.summary.apdexScore)}">${e.summary.apdexScore.toFixed(3)}</div>
                <div class="summary-label">APDEX Score</div>
            </div>
            `:""}
            ${e.summary.percentiles?`
            <div class="summary-card">
                <div class="summary-value">${e.summary.percentiles.p95.toFixed(0)}ms</div>
                <div class="summary-label">95th Percentile</div>
            </div>
            `:""}
        </div>
        
        <div class="tabs">
            <button class="tab active" onclick="showTab('charts')">Charts</button>
            <button class="tab" onclick="showTab('statistics')">Statistics</button>
            <button class="tab" onclick="showTab('errors')">Errors</button>
            ${e.apdexData.length>0?`<button class="tab" onclick="showTab('apdex')">APDEX</button>`:""}
        </div>
        
        <div id="charts" class="tab-content active">
            <div class="panel">
                <div class="panel-heading">
                    <h3 class="panel-title">Response Times Over Time</h3>
                </div>
                <div class="panel-body">
                    <div class="chart-container">
                        <canvas id="responseTimeChart"></canvas>
                    </div>
                </div>
            </div>
            
            <div class="panel">
                <div class="panel-heading">
                    <h3 class="panel-title">Throughput & Error Rate</h3>
                </div>
                <div class="panel-body">
                    <div class="chart-container">
                        <canvas id="throughputChart"></canvas>
                    </div>
                </div>
            </div>
            
            <div class="panel">
                <div class="panel-heading">
                    <h3 class="panel-title">Response Time Distribution</h3>
                </div>
                <div class="panel-body">
                    <div class="chart-container">
                        <canvas id="distributionChart"></canvas>
                    </div>
                </div>
            </div>
        </div>
        
        <div id="statistics" class="tab-content">
            <div class="panel">
                <div class="panel-heading">
                    <h3 class="panel-title">Endpoint Statistics</h3>
                </div>
                <div class="panel-body">
                    <div class="table-responsive">
                        <table>
                            <thead>
                                <tr>
                                    <th>Endpoint</th>
                                    <th class="text-right">Samples</th>
                                    <th class="text-right">Average</th>
                                    <th class="text-right">Median</th>
                                    <th class="text-right">90%</th>
                                    <th class="text-right">95%</th>
                                    <th class="text-right">99%</th>
                                    <th class="text-right">Min</th>
                                    <th class="text-right">Max</th>
                                    <th class="text-right">Error %</th>
                                    <th class="text-right">Throughput</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${e.endpointStats.map(a=>`
                                <tr>
                                    <td>${e.includeDrillDown?`<a class="drill-down-link" onclick="showDrillDown('${M(a.label)}')">${D(a.label)}</a>`:D(a.label)}</td>
                                    <td class="text-right">${a.samples.toLocaleString()}</td>
                                    <td class="text-right">${a.average.toFixed(0)}ms</td>
                                    <td class="text-right">${a.median.toFixed(0)}ms</td>
                                    <td class="text-right">${a.p90.toFixed(0)}ms</td>
                                    <td class="text-right">${a.p95.toFixed(0)}ms</td>
                                    <td class="text-right">${a.p99.toFixed(0)}ms</td>
                                    <td class="text-right">${a.min.toFixed(0)}ms</td>
                                    <td class="text-right">${a.max.toFixed(0)}ms</td>
                                    <td class="text-right ${a.errorRate<.01?"success":a.errorRate<.05?"warning":"error"}">
                                        ${(a.errorRate*100).toFixed(2)}%
                                    </td>
                                    <td class="text-right">${a.throughput.toFixed(2)}/s</td>
                                </tr>
                                `).join("")}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
        
        <div id="errors" class="tab-content">
            <div class="panel">
                <div class="panel-heading">
                    <h3 class="panel-title">Error Summary</h3>
                </div>
                <div class="panel-body">
                    ${e.errorSummary.length>0?`
                    <div class="table-responsive">
                        <table>
                            <thead>
                                <tr>
                                    <th>Response Code</th>
                                    <th>Error Message</th>
                                    <th class="text-right">Count</th>
                                    <th class="text-right">Percentage</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${e.errorSummary.map(a=>`
                                <tr>
                                    <td><span class="error">${a.responseCode}</span></td>
                                    <td>${D(a.message)}</td>
                                    <td class="text-right">${a.count.toLocaleString()}</td>
                                    <td class="text-right">${a.percentage.toFixed(2)}%</td>
                                </tr>
                                `).join("")}
                            </tbody>
                        </table>
                    </div>
                    `:"<p>No errors recorded during the test.</p>"}
                </div>
            </div>
        </div>
        
        ${e.apdexData.length>0?`
        <div id="apdex" class="tab-content">
            <div class="panel">
                <div class="panel-heading">
                    <h3 class="panel-title">APDEX Scores by Endpoint</h3>
                </div>
                <div class="panel-body">
                    <div class="table-responsive">
                        <table>
                            <thead>
                                <tr>
                                    <th>Endpoint</th>
                                    <th class="text-center">APDEX Score</th>
                                    <th class="text-right">Satisfied</th>
                                    <th class="text-right">Tolerating</th>
                                    <th class="text-right">Frustrated</th>
                                    <th class="text-right">Total Samples</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${e.apdexData.map(a=>`
                                <tr>
                                    <td>${D(a.label)}</td>
                                    <td class="text-center">
                                        <span class="apdex-score ${l(a.score)}">
                                            ${a.score.toFixed(3)}
                                        </span>
                                    </td>
                                    <td class="text-right">${a.satisfied.toLocaleString()}</td>
                                    <td class="text-right">${a.tolerating.toLocaleString()}</td>
                                    <td class="text-right">${a.frustrated.toLocaleString()}</td>
                                    <td class="text-right">${a.samples.toLocaleString()}</td>
                                </tr>
                                `).join("")}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
        `:""}
    </div>
    
    ${e.includeDrillDown?`
    <div id="drillDownModal" class="modal">
        <div class="modal-content">
            <span class="close" onclick="closeDrillDown()">&times;</span>
            <h2 id="drillDownTitle"></h2>
            <div id="drillDownContent"></div>
        </div>
    </div>
    `:""}
    
    <script>
        const isDark = ${t};
        const chartColors = {
            primary: '#3b82f6',
            success: '#10b981',
            warning: '#f59e0b',
            error: '#ef4444',
            info: '#6366f1',
            gray: isDark ? '#6b7280' : '#9ca3af'
        };
        
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        const textColor = isDark ? '#e5e7eb' : '#374151';
        
        // Time series data
        const timeSeriesData = ${N(e.timeSeriesData)};
        const labels = timeSeriesData.map(d => new Date(d.timestamp).toLocaleTimeString());
        
        // Response Time Chart
        const responseTimeCtx = document.getElementById('responseTimeChart').getContext('2d');
        new Chart(responseTimeCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Average Response Time',
                    data: timeSeriesData.map(d => d.responseTime),
                    borderColor: chartColors.primary,
                    backgroundColor: chartColors.primary + '20',
                    tension: 0.1,
                    pointRadius: 0,
                    pointHoverRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        labels: { color: textColor }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => context.parsed.y.toFixed(0) + 'ms'
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: gridColor },
                        ticks: { color: textColor }
                    },
                    y: {
                        grid: { color: gridColor },
                        ticks: { 
                            color: textColor,
                            callback: (value) => value + 'ms'
                        }
                    }
                }
            }
        });
        
        // Throughput & Error Rate Chart
        const throughputCtx = document.getElementById('throughputChart').getContext('2d');
        new Chart(throughputCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Throughput',
                    data: timeSeriesData.map(d => d.throughput),
                    borderColor: chartColors.success,
                    backgroundColor: chartColors.success + '20',
                    tension: 0.1,
                    pointRadius: 0,
                    yAxisID: 'y'
                }, {
                    label: 'Error Rate',
                    data: timeSeriesData.map(d => d.errorRate * 100),
                    borderColor: chartColors.error,
                    backgroundColor: chartColors.error + '20',
                    tension: 0.1,
                    pointRadius: 0,
                    yAxisID: 'y1'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        labels: { color: textColor }
                    }
                },
                scales: {
                    x: {
                        grid: { color: gridColor },
                        ticks: { color: textColor }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        grid: { color: gridColor },
                        ticks: { 
                            color: textColor,
                            callback: (value) => value + '/s'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: { drawOnChartArea: false },
                        ticks: { 
                            color: textColor,
                            callback: (value) => value + '%'
                        }
                    }
                }
            }
        });
        
        // Response Time Distribution
        const allResponseTimes = ${N(e.allRecords.map(a=>a.elapsed))};
        const distributionCtx = document.getElementById('distributionChart').getContext('2d');
        
        // Create histogram data
        const bins = 50;
        const minTime = Math.min(...allResponseTimes);
        const maxTime = Math.max(...allResponseTimes);
        const binSize = (maxTime - minTime) / bins;
        const histogram = new Array(bins).fill(0);
        
        allResponseTimes.forEach(time => {
            const binIndex = Math.min(Math.floor((time - minTime) / binSize), bins - 1);
            histogram[binIndex]++;
        });
        
        const binLabels = histogram.map((_, i) => Math.round(minTime + i * binSize) + 'ms');
        
        new Chart(distributionCtx, {
            type: 'bar',
            data: {
                labels: binLabels,
                datasets: [{
                    label: 'Request Count',
                    data: histogram,
                    backgroundColor: chartColors.info + '80',
                    borderColor: chartColors.info,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { 
                            color: textColor,
                            maxRotation: 45,
                            minRotation: 45
                        }
                    },
                    y: {
                        grid: { color: gridColor },
                        ticks: { color: textColor }
                    }
                }
            }
        });
        
        // Tab functionality
        function showTab(tabName) {
            document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            
            event.target.classList.add('active');
            document.getElementById(tabName).classList.add('active');
        }
        
        // APDEX class helper
        function getApdexClass(score) {
            if (score >= 0.94) return 'apdex-excellent';
            if (score >= 0.85) return 'apdex-good';
            if (score >= 0.70) return 'apdex-fair';
            return 'apdex-poor';
        }
        
        ${e.includeDrillDown?`
        // Drill-down functionality
        const endpointData = ${N(m)};
        
        function showDrillDown(endpoint) {
            const modal = document.getElementById('drillDownModal');
            const title = document.getElementById('drillDownTitle');
            const content = document.getElementById('drillDownContent');
            
            title.textContent = 'Details: ' + endpoint;
            
            const records = endpointData[endpoint] || [];
            const responseTimes = records.map(r => r.elapsed);
            
            // Create drill-down chart
            content.innerHTML = \`
                <div class="panel">
                    <div class="panel-heading">
                        <h3 class="panel-title">Response Time Timeline</h3>
                    </div>
                    <div class="panel-body">
                        <div class="chart-container">
                            <canvas id="drillDownChart"></canvas>
                        </div>
                    </div>
                </div>
                <div class="panel">
                    <div class="panel-heading">
                        <h3 class="panel-title">Sample Details (Last 100)</h3>
                    </div>
                    <div class="panel-body">
                        <div class="table-responsive">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Timestamp</th>
                                        <th>Response Time</th>
                                        <th>Status</th>
                                        <th>Bytes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    \${records.slice(-100).reverse().map(r => \`
                                    <tr>
                                        <td>\${new Date(r.timestamp).toLocaleString()}</td>
                                        <td class="text-right">\${r.elapsed}ms</td>
                                        <td class="text-center">
                                            <span class="\${r.success ? 'success' : 'error'}">\${r.responseCode}</span>
                                        </td>
                                        <td class="text-right">\${(r.bytes / 1024).toFixed(2)} KB</td>
                                    </tr>
                                    \`).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            \`;
            
            modal.style.display = 'block';
            
            // Create drill-down chart
            setTimeout(() => {
                const drillCtx = document.getElementById('drillDownChart').getContext('2d');
                new Chart(drillCtx, {
                    type: 'line',
                    data: {
                        labels: records.map(r => new Date(r.timestamp).toLocaleTimeString()),
                        datasets: [{
                            label: 'Response Time',
                            data: responseTimes,
                            borderColor: chartColors.primary,
                            backgroundColor: chartColors.primary + '20',
                            tension: 0.1,
                            pointRadius: 1,
                            pointHoverRadius: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            x: {
                                grid: { color: gridColor },
                                ticks: { 
                                    color: textColor,
                                    maxTicksLimit: 10
                                }
                            },
                            y: {
                                grid: { color: gridColor },
                                ticks: { 
                                    color: textColor,
                                    callback: (value) => value + 'ms'
                                }
                            }
                        }
                    }
                });
            }, 100);
        }
        
        function closeDrillDown() {
            document.getElementById('drillDownModal').style.display = 'none';
        }
        
        window.onclick = function(event) {
            const modal = document.getElementById('drillDownModal');
            if (event.target == modal) {
                modal.style.display = 'none';
            }
        }
        `:""}
    </script>
</body>
</html>`;function l(a){return a>=.94?"success":a>=.85?"info":a>=.7?"warning":"error"}}function K(e,t){let r,s;return e instanceof $?(r=e,s=t||{}):(s=e,r=s.collector),(i,n,c)=>{if(s.skipPaths&&s.skipPaths.some(y=>y.test(i.path)))return c();let m=Date.now(),p=process.cpuUsage(),l=n.end;n.end=function(...a){n.end=l,n.end(...a);let y=Date.now()-m,h=process.cpuUsage(p),f=`${i.method} ${i.route?.path||i.path}`;s.includeQuery&&i.query&&Object.keys(i.query).length>0&&(f+="?"+new URLSearchParams(i.query).toString());let C=s.customLabels?s.customLabels(i):{};r.recordMetric({endpoint:f,responseTime:y,statusCode:n.statusCode,method:i.method,success:n.statusCode<400,bytes:n.get("content-length")?parseInt(n.get("content-length")):0,sentBytes:i.get("content-length")?parseInt(i.get("content-length")):0,customFields:{...C,cpuUser:h.user,cpuSystem:h.system,memoryUsage:process.memoryUsage().heapUsed}}).catch(F=>console.error("Failed to record metric:",F));},c();}}var ue={createCollector:W,generateJMeterReport:O,performanceMiddleware:K,JMeterPerformanceCollector:$,StatisticsCalculator:b};exports.JMeterPerformanceCollector=$;exports.PerformanceCollector=$;exports.StatisticsCalculator=b;exports.createCollector=W;exports.default=ue;exports.generateJMeterReport=O;exports.generateReport=O;exports.performanceMiddleware=K;//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map