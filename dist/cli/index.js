#!/usr/bin/env node
/* JMeter Style Reporter CLI v1.0.0 */
"use strict";var le=Object.create;var _=Object.defineProperty;var ce=Object.getOwnPropertyDescriptor;var de=Object.getOwnPropertyNames;var pe=Object.getPrototypeOf,ue=Object.prototype.hasOwnProperty;var me=(e,t,r,s)=>{if(t&&typeof t=="object"||typeof t=="function")for(let a of de(t))!ue.call(e,a)&&a!==r&&_(e,a,{get:()=>t[a],enumerable:!(s=ce(t,a))||s.enumerable});return e};var R=(e,t,r)=>(r=e!=null?le(pe(e)):{},me(t||!e||!e.__esModule?_(r,"default",{value:e,enumerable:!0}):r,e));var P=R(require("path")),Q=require("crypto"),F=class{metrics=[];options;flushTimer;disposed=!1;maxMetrics=1e5;flushing=!1;pendingFlush=null;totalMetricsCollected=0;totalMetricsFlushed=0;errorCount=0;flushCount=0;startTime=Date.now();dataIntegrityHash="";constructor(t){this.options={bufferSize:1e3,flushInterval:5e3,silent:!1,jmeterCompatible:!0,...t},this.options.bufferSize&&this.options.bufferSize>1e4&&(console.warn("Buffer size clamped to 10000 to prevent memory issues"),this.options.bufferSize=1e4),this.options.flushInterval&&this.options.flushInterval>0&&(this.flushTimer=setInterval(()=>{this.disposed||this.flush().catch(s=>{console.error("Flush error:",s),this.options.onError?.(s)})},this.options.flushInterval),this.flushTimer.unref?.());let r=()=>{this.disposed||this.dispose().catch(console.error)};process.on("exit",r),process.on("SIGINT",r),process.on("SIGTERM",r),process.on("uncaughtException",r)}async recordMetric(t){if(this.disposed){console.warn("Cannot record metric: collector has been disposed");return}try{if(t.responseTime!==void 0&&(typeof t.responseTime!="number"||t.responseTime<0))throw new Error(`Invalid response time: ${t.responseTime}`);if(t.statusCode!==void 0&&(typeof t.statusCode!="number"||t.statusCode<100||t.statusCode>599))throw new Error(`Invalid status code: ${t.statusCode}`);this.metrics.length>=this.maxMetrics&&(console.warn(`Maximum metrics limit reached (${this.maxMetrics}), forcing flush`),await this.flush());let r={timestamp:Date.now(),endpoint:E(t.endpoint||"unknown"),responseTime:Z(String(t.responseTime||0)),statusCode:x(String(t.statusCode||200)),method:E(t.method||"GET"),success:(t.statusCode||200)<400,testName:E(t.testName||this.options.testName||"default"),bytes:x(String(t.bytes||0)),sentBytes:x(String(t.sentBytes||0)),grpThreads:Math.max(1,x(String(t.grpThreads||1))),allThreads:Math.max(1,x(String(t.allThreads||1))),...t};this.updateDataIntegrityHash(r),this.metrics.push(r),this.totalMetricsCollected++,this.metrics.length>=(this.options.bufferSize||1e3)&&await this.flush()}catch(r){this.errorCount++,this.options.onError?.(r),console.error("Failed to record metric:",r)}}updateDataIntegrityHash(t){let r=`${t.timestamp}:${t.responseTime}:${t.statusCode}`;this.dataIntegrityHash=(0,Q.createHash)("sha256").update(this.dataIntegrityHash+r).digest("hex").substring(0,16)}getStats(){return{totalMetrics:this.totalMetricsCollected,bufferedMetrics:this.metrics.length,flushCount:this.flushCount,errorCount:this.errorCount,isActive:!this.disposed,startTime:this.startTime,lastFlushTime:Date.now(),dataIntegrityHash:this.dataIntegrityHash}}async flush(){if(this.pendingFlush)return this.pendingFlush;if(this.metrics.length!==0){this.pendingFlush=this._performFlush();try{await this.pendingFlush}finally{this.pendingFlush=null}}}async _performFlush(){if(!(this.flushing||this.metrics.length===0)){this.flushing=!0;try{let t=[...this.metrics];if(this.metrics.length=0,t.length===0)return;let{promises:r}=await import("fs"),a=(await import("path")).dirname(this.options.outputPath);try{await r.mkdir(a,{recursive:!0})}catch(l){if(l.code!=="EEXIST")throw l}let i=!1;try{await r.access(this.options.outputPath),i=!0}catch{}let d="";if(!i){let l=this.options.jmeterCompatible?`timestamp,elapsed,label,responseCode,success,bytes,sentBytes,grpThreads,allThreads,Filename
`:`timestamp,responseTime,endpoint,statusCode,success,method,testName
`;d+=l}let h=t.map(l=>this.options.jmeterCompatible?[l.timestamp,l.responseTime,`"${T(l.endpoint||"")}"`,l.statusCode,l.success,l.bytes||0,l.sentBytes||0,l.grpThreads||1,l.allThreads||1,`"${T(l.testName||"")}"`].join(","):[l.timestamp,l.responseTime,`"${T(l.endpoint||"")}"`,l.statusCode,l.success,T(l.method||""),`"${T(l.testName||"")}"`].join(",")).join(`
`)+`
`;d+=h,await r.appendFile(this.options.outputPath,d,"utf8");let p=t.length;this.totalMetricsFlushed+=p,this.flushCount++,this.options.silent||console.log(`\u2705 Flushed ${p} metrics to ${this.options.outputPath} (Total: ${this.totalMetricsFlushed})`),this.options.onFlush?.(p)}catch(t){throw console.error("Flush failed:",t),this.options.onError?.(t),t}finally{this.flushing=!1}}}async dispose(){if(!this.disposed){this.disposed=!0,this.flushTimer&&(clearInterval(this.flushTimer),this.flushTimer=void 0);try{process.removeAllListeners("exit"),process.removeAllListeners("SIGINT"),process.removeAllListeners("SIGTERM"),process.removeAllListeners("uncaughtException")}catch{}await this.flush(),this.metrics.length=0}}},f=class{static calculatePercentile(t,r){if(t.length===0)return 0;let s=[...t].sort((i,d)=>i-d),a=Math.ceil(r/100*s.length)-1;return s[Math.max(0,a)]}static calculateApdexScore(t,r=500,s){if(t.length===0)return{label:s||"Unknown",score:0,samples:0,satisfied:0,tolerating:0,frustrated:0};let a=t.filter(p=>p<=r).length,i=t.filter(p=>p>r&&p<=r*4).length,d=t.filter(p=>p>r*4).length,h=(a+i*.5)/t.length;return{label:s||"Unknown",score:h,samples:t.length,satisfied:a,tolerating:i,frustrated:d}}static calculateStandardDeviation(t,r){if(t.length===0)return 0;let a=t.map(i=>Math.pow(i-r,2)).reduce((i,d)=>i+d,0)/t.length;return Math.sqrt(a)}};function Y(e,t){let r={record:null,errors:[],warnings:[]};if(!e||e.trim().length===0)return r;/^[@=+\-|]/.test(e.trim())&&r.warnings.push(`Line ${t}: Potential CSV injection detected`);try{let s=[],a="",i=!1,d=0;for(;d<e.length;){let v=e[d],$=e[d+1];if(v==='"')if(i&&$==='"'){a+='"',d+=2;continue}else i=!i;else if(v===","&&!i){s.push(W(a.trim())),a="",d++;continue}else a+=v;d++}if(s.push(W(a.trim())),s.length<10)return r.errors.push(`Line ${t}: Insufficient fields: ${s.length} < 10`),r;let h=x(s[0]),p=Z(s[1]),l=x(s[3]);if(isNaN(h)||h<=0)return r.errors.push(`Line ${t}: Invalid timestamp: ${s[0]}`),r;if(isNaN(p)||p<0)return r.errors.push(`Line ${t}: Invalid elapsed time: ${s[1]}`),r;if(isNaN(l)||l<100||l>599)return r.errors.push(`Line ${t}: Invalid response code: ${s[3]}`),r;let n=Date.now(),y=n-365*24*60*60*1e3,u=n+3600*1e3;return(h<y||h>u)&&r.warnings.push(`Line ${t}: Suspicious timestamp: ${new Date(h).toISOString()}`),p>3e5&&r.warnings.push(`Line ${t}: Very high response time: ${p}ms`),r.record={timestamp:h,elapsed:p,label:E(s[2]),responseCode:l,success:s[4]?.toLowerCase().trim()==="true",bytes:Math.max(0,x(s[5])||0),sentBytes:Math.max(0,x(s[6])||0),grpThreads:Math.max(1,x(s[7])||1),allThreads:Math.max(1,x(s[8])||1),filename:E(s[9]||"")},r}catch(s){return r.errors.push(`Line ${t}: Parse error: ${s}`),r}}function he(e){let t=Y(e,0);return t.errors.length>0&&console.error("CSV parse errors:",t.errors),t.warnings.length>0&&console.warn("CSV parse warnings:",t.warnings),t.record}function x(e){if(!e||e.trim().length===0)return 0;let t=parseInt(e.trim(),10);return isNaN(t)||!isFinite(t)?0:Math.max(0,Math.min(t,Number.MAX_SAFE_INTEGER))}function Z(e){if(!e||e.trim().length===0)return 0;let t=parseFloat(e.trim());return isNaN(t)||!isFinite(t)?0:Math.max(0,Math.min(t,Number.MAX_SAFE_INTEGER))}function ge(e){if(!e||typeof e!="string")throw new Error("Invalid output path");let t=P.resolve(e),r=process.cwd();if(!t.startsWith(r))throw new Error("Output path must be within current working directory");if(["/etc","/usr","/var","/bin","/sbin","/boot","/sys"].some(a=>t.startsWith(a)))throw new Error("Cannot write to system directories");return t}function W(e){return e?/^[@=+\-|]/.test(e.toString().trim())?`'${e}`:e.toString().replace(/[\r\n]/g," ").substring(0,1e3):""}function E(e){return e?e.trim().replace(/^"|"$/g,"").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/&/g,"&amp;").substring(0,1e3):""}function D(e){return e==null?"":String(e).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;").replace(/\//g,"&#x2F;")}function T(e){return e?e.replace(/\\/g,"\\\\").replace(/'/g,"\\'").replace(/"/g,'\\"').replace(/\n/g,"\\n").replace(/\r/g,"\\r").replace(/\t/g,"\\t").replace(/\f/g,"\\f").replace(/\v/g,"\\v").replace(/\0/g,"\\0").replace(/</g,"\\u003c").replace(/>/g,"\\u003e"):""}function z(e){try{return JSON.stringify(e,(t,r)=>typeof r=="string"?T(r):r)}catch(t){return console.error("Failed to serialize data safely:",t),"{}"}}function fe(e){return{400:"Bad Request",401:"Unauthorized",403:"Forbidden",404:"Not Found",405:"Method Not Allowed",408:"Request Timeout",429:"Too Many Requests",500:"Internal Server Error",502:"Bad Gateway",503:"Service Unavailable",504:"Gateway Timeout"}[e]||`HTTP ${e}`}function be(e){return{...e,jmeterCompatible:!0}}function N(e){let r="jmeterCompatible"in e?e:be(e);return new F(r)}async function j(e){let t=performance.now(),r=Array.isArray(e.csv)?e.csv:[e.csv],s=ge(e.output||"./jmeter-report"),a={apiVersion:e.apiVersion||"latest",maxMemoryUsageMB:e.maxMemoryUsageMB||512,streamingMode:e.streamingMode!==!1,maxDataPoints:e.maxDataPoints||1e4,skipValidation:e.skipDataValidation===!0},i=[],d=0,h=0,{promises:p}=await import("fs"),{createReadStream:l}=await import("fs"),{createInterface:n}=await import("readline");try{await p.mkdir(s,{recursive:!0})}catch(o){if(o.code!=="EEXIST")throw o}let y=Math.min(Math.floor(a.maxMemoryUsageMB*1024*1024/256),5e4),u=[],v=[],$=[];for(let o of r)try{await p.access(o);let c=await p.stat(o);c.size>500*1024*1024&&i.push(`Large file detected: ${o} (${Math.round(c.size/1024/1024)}MB)`);let m=l(o,{encoding:"utf8",highWaterMark:64*1024}),S=n({input:m,crlfDelay:1/0}),C=0,b=0;for await(let w of S)if(C++,C!==1&&w.trim()){if(a.skipValidation){let g=he(w);g?(u.push(g),d++,b++):h++}else{let g=Y(w,C);v.push(...g.errors),$.push(...g.warnings),g.record?(u.push(g.record),d++,b++):h++}if(u.length>=y){i.push(`Memory limit reached. Processed ${d} records, truncating remaining data.`);break}}S.close(),m.destroy(),b===0&&i.push(`No valid records found in ${o}`)}catch(c){let m=`Could not process CSV file ${o}: ${c}`;i.push(m),console.warn(m)}if(u.length===0)throw new Error("No valid data found in CSV files. Check file format and data validity.");v.length>0&&(i.push(`${v.length} parsing errors encountered`),v.length>10?console.error("First 10 parsing errors:",v.slice(0,10)):console.error("Parsing errors:",v)),$.length>0&&!a.skipValidation&&(i.push(`${$.length} parsing warnings`),console.warn(`${$.length} parsing warnings (run with skipDataValidation: true to suppress)`));let J=Math.min(...u.map(o=>o.timestamp)),V=Math.max(...u.map(o=>o.timestamp)),I=(V-J)/1e3,k=new Map;u.forEach(o=>{k.has(o.label)||k.set(o.label,[]),k.get(o.label).push(o)});let H=[],G=[];for(let[o,c]of k){let m=c.map(g=>g.elapsed),S=c.filter(g=>!g.success).length,C=c.reduce((g,U)=>g+U.bytes,0),b=m.reduce((g,U)=>g+U,0)/m.length,w={label:o,samples:c.length,average:b,median:f.calculatePercentile(m,50),p90:f.calculatePercentile(m,90),p95:f.calculatePercentile(m,95),p99:f.calculatePercentile(m,99),min:Math.min(...m),max:Math.max(...m),errorRate:S/c.length,throughput:c.length/Math.max(I,1),receivedKB:C/1024,avgBytes:C/c.length};if(e.includeApdex!==!1){let g=f.calculateApdexScore(m,e.apdexThreshold||500,o);w.apdexScore=g.score,G.push(g)}H.push(w)}let B=Math.max(Math.floor(I/100),1)*1e3,q=[];for(let o=J;o<=V;o+=B){let c=u.filter(m=>m.timestamp>=o&&m.timestamp<o+B);if(c.length>0){let m=c.reduce((b,w)=>b+w.elapsed,0)/c.length,S=c.filter(b=>!b.success).length,C=Math.max(...c.map(b=>b.allThreads));q.push({timestamp:o,responseTime:m,throughput:c.length/(B/1e3),errorRate:S/c.length,activeThreads:C})}}let O=new Map;u.filter(o=>!o.success).forEach(o=>{O.set(o.responseCode,(O.get(o.responseCode)||0)+1)});let ee=Array.from(O.entries()).map(([o,c])=>({responseCode:o,count:c,percentage:c/u.length*100,message:fe(o)})).sort((o,c)=>c.count-o.count),L=u.length,te=u.filter(o=>!o.success).length,M=u.map(o=>o.elapsed),re=M.reduce((o,c)=>o+c,0)/L,se=te/L,oe=L/Math.max(I,1),A={totalRequests:L,averageResponseTime:re,errorRate:se,throughput:oe};if(e.includePercentiles!==!1&&(A.percentiles={p50:f.calculatePercentile(M,50),p90:f.calculatePercentile(M,90),p95:f.calculatePercentile(M,95),p99:f.calculatePercentile(M,99)}),e.includeApdex!==!1){let o=f.calculateApdexScore(M,e.apdexThreshold||500);A.apdexScore=o.score}let ne=ve({title:e.title||"JMeter Performance Dashboard",theme:e.theme||"light",summary:A,endpointStats:H,timeSeriesData:q,errorSummary:ee,apdexData:G,testDuration:I,allRecords:u,endpointData:k,includeDrillDown:e.includeDrillDown!==!1,jenkinsCompatible:e.jenkinsCompatible,embeddedCharts:e.embeddedCharts}),X=P.join(s,"index.html");await p.writeFile(X,ne,"utf8");let ae=performance.now(),ie=process.memoryUsage();return{outputPath:s,reportUrl:`file://${P.resolve(X)}`,summary:A,warnings:i,stats:{memoryUsedMB:Math.round(ie.heapUsed/1024/1024),processingTimeMs:Math.round(ae-t),recordsProcessed:d,recordsSkipped:h}}}function xe(){return'<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>'}function ve(e){let t=e.theme==="dark",r=t?"#1a1a1a":"#f8f9fa",s=t?"#2d3748":"#ffffff",a=t?"#e2e8f0":"#2d3748",i=t?"#4a5568":"#e2e8f0",d=t?"#374151":"#f7fafc",h={};e.endpointData.forEach((n,y)=>{h[y]=n});let p=e.jenkinsCompatible||e.embeddedCharts;return`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${D(e.title)}</title>
    ${p?xe():'<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>'}
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: ${r};
            color: ${a};
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
            border: 1px solid ${i};
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
            border: 1px solid ${i};
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
            border: 1px solid ${i};
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .panel-heading {
            padding: 15px 20px;
            border-bottom: 1px solid ${i};
            background: ${d};
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
            border-bottom: 1px solid ${i};
        }
        
        th {
            background: ${d};
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
            border-bottom: 2px solid ${i};
            margin-bottom: 20px;
        }
        
        .tab {
            padding: 10px 20px;
            cursor: pointer;
            background: none;
            border: none;
            font-size: 16px;
            color: ${a};
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
            border: 1px solid ${i};
            border-radius: 8px;
            width: 90%;
            max-width: 1200px;
            max-height: 80vh;
            overflow-y: auto;
        }
        
        .close {
            color: ${a};
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
                                ${e.endpointStats.map(n=>`
                                <tr>
                                    <td>${e.includeDrillDown?`<a class="drill-down-link" onclick="showDrillDown('${T(n.label)}')">${D(n.label)}</a>`:D(n.label)}</td>
                                    <td class="text-right">${n.samples.toLocaleString()}</td>
                                    <td class="text-right">${n.average.toFixed(0)}ms</td>
                                    <td class="text-right">${n.median.toFixed(0)}ms</td>
                                    <td class="text-right">${n.p90.toFixed(0)}ms</td>
                                    <td class="text-right">${n.p95.toFixed(0)}ms</td>
                                    <td class="text-right">${n.p99.toFixed(0)}ms</td>
                                    <td class="text-right">${n.min.toFixed(0)}ms</td>
                                    <td class="text-right">${n.max.toFixed(0)}ms</td>
                                    <td class="text-right ${n.errorRate<.01?"success":n.errorRate<.05?"warning":"error"}">
                                        ${(n.errorRate*100).toFixed(2)}%
                                    </td>
                                    <td class="text-right">${n.throughput.toFixed(2)}/s</td>
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
                                ${e.errorSummary.map(n=>`
                                <tr>
                                    <td><span class="error">${n.responseCode}</span></td>
                                    <td>${D(n.message)}</td>
                                    <td class="text-right">${n.count.toLocaleString()}</td>
                                    <td class="text-right">${n.percentage.toFixed(2)}%</td>
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
                                ${e.apdexData.map(n=>`
                                <tr>
                                    <td>${D(n.label)}</td>
                                    <td class="text-center">
                                        <span class="apdex-score ${l(n.score)}">
                                            ${n.score.toFixed(3)}
                                        </span>
                                    </td>
                                    <td class="text-right">${n.satisfied.toLocaleString()}</td>
                                    <td class="text-right">${n.tolerating.toLocaleString()}</td>
                                    <td class="text-right">${n.frustrated.toLocaleString()}</td>
                                    <td class="text-right">${n.samples.toLocaleString()}</td>
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
        const timeSeriesData = ${z(e.timeSeriesData)};
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
        const allResponseTimes = ${z(e.allRecords.map(n=>n.elapsed))};
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
        const endpointData = ${z(h)};
        
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
</html>`;function l(n){return n>=.94?"success":n>=.85?"info":n>=.7?"warning":"error"}}async function ye(){let e=process.argv.slice(2);(e.length===0||e.includes("--help")||e.includes("-h"))&&(console.log(`
JMeter Style Reporter v1.2.0

Usage:
  jmeter-style-reporter <command> [options]

Commands:
  report <csv-file>     Generate HTML report from CSV file
  collect <output>      Start collecting performance data
  --help, -h           Show this help message
  --version, -v        Show version

Examples:
  jmeter-style-reporter report ./data.csv
  jmeter-style-reporter report ./data.csv --output ./reports --title "My Test"
  jmeter-style-reporter collect ./metrics.csv

Options:
  --output, -o <dir>   Output directory (default: ./jmeter-report)
  --title, -t <title>  Report title
  --theme <theme>      Theme: light, dark, auto (default: auto)
  --jenkins            Generate Jenkins-compatible report (no external dependencies)
  --embedded-charts    Use embedded charts instead of CDN
`),process.exit(0)),(e.includes("--version")||e.includes("-v"))&&(console.log("1.2.0"),process.exit(0));let t=e[0];try{if(t==="report"){let r=e[1];r||(console.error("\u274C Error: CSV file path is required"),console.log("Usage: jmeter-style-reporter report <csv-file>"),process.exit(1));let s=e.indexOf("--output")||e.indexOf("-o"),a=e.indexOf("--title")||e.indexOf("-t"),i=e.indexOf("--theme"),d=e.includes("--jenkins"),h=e.includes("--embedded-charts"),p=i>-1?e[i+1]:"auto",l=["light","dark","auto"],n="auto";l.includes(p)&&(n=p);let y={csv:r,output:s>-1?e[s+1]:"./jmeter-report",title:a>-1?e[a+1]:"Performance Report",theme:n,jenkinsCompatible:d,embeddedCharts:h};console.log("\u{1F680} Generating performance report..."),console.log(`\u{1F4CA} Input: ${r}`),console.log(`\u{1F4C1} Output: ${y.output}`);let u=await j(y);console.log(`
\u2705 Report generated successfully!`),console.log(`\u{1F4C8} Report URL: ${u.reportUrl}`),console.log(`\u{1F4CA} Total Requests: ${u.summary.totalRequests}`),console.log(`\u23F1\uFE0F  Average Response Time: ${u.summary.averageResponseTime?.toFixed(2)}ms`),console.log(`\u274C Error Rate: ${(u.summary.errorRate*100).toFixed(2)}%`),console.log(`
\u{1F4A1} Open the report in your browser to view detailed charts and analysis.`)}else if(t==="collect"){let r=e[1];r||(console.error("\u274C Error: Output file path is required"),console.log("Usage: jmeter-style-reporter collect <output-file>"),process.exit(1)),console.log("\u{1F4CA} Starting performance data collection..."),console.log(`\u{1F4C1} Output: ${r}`),console.log("Press Ctrl+C to stop and generate report");let s=N({outputPath:r,testName:"CLI Collection"});console.log("\u{1F4C8} Generating sample performance data...");for(let a=0;a<50;a++)await s.recordMetric({endpoint:`/api/endpoint-${a%5}`,responseTime:Math.random()*500+50,statusCode:Math.random()>.1?200:500,method:"GET"}),a%10===0&&process.stdout.write(`\u{1F4CA} Generated ${a+1}/50 metrics\r`),await new Promise(i=>setTimeout(i,100));await s.flush(),console.log(`
\u2705 Sample data collection completed!`),console.log(`\u{1F4CA} Data saved to: ${r}`),console.log(`
\u{1F4A1} Generate a report with:`),console.log(`   jmeter-style-reporter report ${r}`)}else console.error(`\u274C Unknown command: ${t}`),console.log('Run "jmeter-style-reporter --help" for usage information'),process.exit(1)}catch(r){console.error("\u274C Error:",r instanceof Error?r.message:String(r)),process.exit(1)}}ye().catch(e=>{console.error("\u274C Unexpected error:",e),process.exit(1)});
