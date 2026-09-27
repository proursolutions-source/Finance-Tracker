var me=Object.defineProperty;var he=(t,e,n)=>e in t?me(t,e,{enumerable:!0,configurable:!0,writable:!0,value:n}):t[e]=n;var D=(t,e,n)=>he(t,typeof e!="symbol"?e+"":e,n);(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))a(s);new MutationObserver(s=>{for(const r of s)if(r.type==="childList")for(const i of r.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&a(i)}).observe(document,{childList:!0,subtree:!0});function n(s){const r={};return s.integrity&&(r.integrity=s.integrity),s.referrerPolicy&&(r.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?r.credentials="include":s.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function a(s){if(s.ep)return;s.ep=!0;const r=n(s);fetch(s.href,r)}})();function fe(t){return new Worker("/assets/db-worker-DmuQD_qK.js",{type:"module",name:t==null?void 0:t.name})}class pe{constructor(){D(this,"worker",null);D(this,"requestId",0);D(this,"pendingRequests",new Map);D(this,"initPromise",null)}async init(){return this.initPromise?this.initPromise:(this.initPromise=new Promise((e,n)=>{try{this.worker=new fe,this.worker.onmessage=a=>{const{requestId:s,success:r,result:i,rows:c,error:o}=a.data;if(s&&this.pendingRequests.has(s)){const{resolve:u,reject:d}=this.pendingRequests.get(s);this.pendingRequests.delete(s),r?u(c||i):d(new Error(o||"Database operation failed"))}},this.worker.onerror=a=>{console.error("[DB API] Worker error:",a),n(a)},this.sendMessage({type:"init"}).then(()=>{console.log("[DB API] Database initialized"),e()}).catch(n)}catch(a){n(a)}}),this.initPromise)}sendMessage(e){return this.worker?new Promise((n,a)=>{const s=`req-${++this.requestId}`;this.pendingRequests.set(s,{resolve:n,reject:a}),this.worker.postMessage({...e,requestId:s}),setTimeout(()=>{this.pendingRequests.has(s)&&(this.pendingRequests.delete(s),a(new Error("Request timeout")))},3e4)}):Promise.reject(new Error("Worker not initialized"))}async exec(e,n=[]){return this.sendMessage({type:"exec",sql:e,params:n})}async query(e,n=[]){return this.sendMessage({type:"query",sql:e,params:n})}async transaction(e){return this.sendMessage({type:"transaction",ops:e})}async writeBlob(e,n){return this.sendMessage({type:"blobWrite",path:e,data:n})}async readBlob(e){return this.sendMessage({type:"blobRead",path:e})}async close(){this.worker&&(await this.sendMessage({type:"close"}),this.worker.terminate(),this.worker=null)}async createTransaction(e){const n=crypto.randomUUID(),a=new Date().toISOString();return await this.exec(`INSERT INTO transactions (id, amount, type, categoryId, date, payee, notes, receiptPath, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[n,e.amount,e.type,e.categoryId,e.date,e.payee||null,e.notes||null,e.receiptPath||null,a,a]),n}async getTransactions(e){let n="SELECT * FROM transactions WHERE 1=1";const a=[];if(e!=null&&e.startDate&&(n+=" AND date >= ?",a.push(e.startDate)),e!=null&&e.endDate&&(n+=" AND date <= ?",a.push(e.endDate)),e!=null&&e.categoryIds&&e.categoryIds.length>0&&(n+=` AND categoryId IN (${e.categoryIds.map(()=>"?").join(",")})`,a.push(...e.categoryIds)),e!=null&&e.type&&(n+=" AND type = ?",a.push(e.type)),e!=null&&e.searchQuery){n+=" AND (payee LIKE ? OR notes LIKE ?)";const s=`%${e.searchQuery}%`;a.push(s,s)}return n+=" ORDER BY date DESC",e!=null&&e.limit&&(n+=" LIMIT ?",a.push(e.limit),e.offset&&(n+=" OFFSET ?",a.push(e.offset))),this.query(n,a)}async getTransactionById(e){return(await this.query("SELECT * FROM transactions WHERE id = ?",[e]))[0]||null}async updateTransaction(e,n){const a=[],s=[];Object.entries(n).forEach(([r,i])=>{a.push(`${r} = ?`),s.push(i)}),a.length!==0&&(s.push(e),await this.exec(`UPDATE transactions SET ${a.join(", ")}, updatedAt = datetime('now') WHERE id = ?`,s))}async deleteTransaction(e){await this.exec("DELETE FROM transactions WHERE id = ?",[e])}async getCategories(e=!1){const n=e?"SELECT * FROM categories ORDER BY type, name":"SELECT * FROM categories WHERE hidden = 0 ORDER BY type, name";return this.query(n)}async getCategoryById(e){return(await this.query("SELECT * FROM categories WHERE id = ?",[e]))[0]||null}async createCategory(e){const n=crypto.randomUUID();return await this.exec(`INSERT INTO categories (id, name, type, icon, budget, hidden, color)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,[n,e.name,e.type,e.icon||null,e.budget||null,e.hidden?1:0,e.color||null]),n}async updateCategory(e,n){const a=[],s=[];Object.entries(n).forEach(([r,i])=>{r==="hidden"?(a.push(`${r} = ?`),s.push(i?1:0)):(a.push(`${r} = ?`),s.push(i))}),a.length!==0&&(s.push(e),await this.exec(`UPDATE categories SET ${a.join(", ")} WHERE id = ?`,s))}async deleteCategory(e){await this.exec("DELETE FROM categories WHERE id = ?",[e])}async getBudgets(){return this.query("SELECT * FROM budgets ORDER BY startDate DESC")}async createBudget(e){const n=crypto.randomUUID();return await this.exec(`INSERT INTO budgets (id, categoryId, amount, period, startDate, endDate)
       VALUES (?, ?, ?, ?, ?, ?)`,[n,e.categoryId,e.amount,e.period,e.startDate,e.endDate||null]),n}async updateBudget(e,n){const a=[],s=[];Object.entries(n).forEach(([r,i])=>{a.push(`${r} = ?`),s.push(i)}),a.length!==0&&(s.push(e),await this.exec(`UPDATE budgets SET ${a.join(", ")} WHERE id = ?`,s))}async deleteBudget(e){await this.exec("DELETE FROM budgets WHERE id = ?",[e])}async getReminders(e=!1){const n=e?"SELECT * FROM reminders ORDER BY dueDate ASC":"SELECT * FROM reminders WHERE completed = 0 ORDER BY dueDate ASC";return this.query(n)}async createReminder(e){const n=crypto.randomUUID();return await this.exec(`INSERT INTO reminders (id, name, amount, dueDate, categoryId, frequency, notes, completed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,[n,e.name,e.amount,e.dueDate,e.categoryId||null,e.frequency,e.notes||null,e.completed?1:0]),n}async updateReminder(e,n){const a=[],s=[];Object.entries(n).forEach(([r,i])=>{r==="completed"?(a.push(`${r} = ?`),s.push(i?1:0)):(a.push(`${r} = ?`),s.push(i))}),a.length!==0&&(s.push(e),await this.exec(`UPDATE reminders SET ${a.join(", ")} WHERE id = ?`,s))}async deleteReminder(e){await this.exec("DELETE FROM reminders WHERE id = ?",[e])}async getProfile(){const e=await this.query("SELECT * FROM user_profiles WHERE id = 'current'");if(e.length===0)return null;try{return JSON.parse(e[0].profileData)}catch{return null}}async saveProfile(e){const n=JSON.stringify(e);await this.exec(`INSERT OR REPLACE INTO user_profiles (id, profileData, createdAt, updatedAt)
       VALUES ('current', ?, COALESCE((SELECT createdAt FROM user_profiles WHERE id='current'), datetime('now')), datetime('now'))`,[n])}async getDashboardSummary(){const e=new Date,n=new Date(e.getFullYear(),e.getMonth(),1).toISOString(),a=new Date(e.getFullYear(),e.getMonth()+1,0,23,59,59).toISOString(),[s]=await this.query("SELECT SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as balance FROM transactions"),[r]=await this.query(`SELECT 
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
       FROM transactions
       WHERE date >= ? AND date <= ?`,[n,a]);return{balance:(s==null?void 0:s.balance)||0,monthlyIncome:(r==null?void 0:r.income)||0,monthlyExpense:(r==null?void 0:r.expense)||0}}}const b=new pe;class ge{constructor(){D(this,"routes",new Map);D(this,"currentPath","");D(this,"onboardingRequired",!0)}register(e,n,a=!0){this.routes.set(e,{path:e,handler:n,requiresAuth:a})}navigate(e){window.location.hash=e}getPath(){return window.location.hash.slice(1)||"/"}setOnboardingRequired(e){this.onboardingRequired=e}async handleRoute(){const e=this.getPath();if(e===this.currentPath)return;if(this.currentPath=e,this.onboardingRequired&&e!=="/onboarding"){this.navigate("/onboarding");return}let n=this.routes.get(e);if(n||(n=this.routes.get("/")),n)try{await n.handler()}catch(a){console.error("[Router] Error handling route:",a)}else console.warn("[Router] No handler for path:",e)}start(){window.addEventListener("hashchange",()=>this.handleRoute()),this.handleRoute()}getQueryParams(){const e=window.location.hash,n=e.indexOf("?");return n===-1?new URLSearchParams:new URLSearchParams(e.slice(n))}}const x=new ge;class ye{constructor(){D(this,"state");D(this,"listeners",new Set);this.state={userProfile:null,categories:[],recentTransactions:[],budgets:[],currentView:"dashboard",isLoading:!0,theme:localStorage.getItem("theme")||"dark"},document.documentElement.classList.add(this.state.theme)}getState(){return{...this.state}}setState(e){this.state={...this.state,...e},this.notify()}subscribe(e){return this.listeners.add(e),()=>{this.listeners.delete(e)}}notify(){this.listeners.forEach(e=>e(this.getState()))}setProfile(e){this.setState({userProfile:e})}setCategories(e){this.setState({categories:e})}setRecentTransactions(e){this.setState({recentTransactions:e})}setBudgets(e){this.setState({budgets:e})}setCurrentView(e){this.setState({currentView:e})}setLoading(e){this.setState({isLoading:e})}setTheme(e){localStorage.setItem("theme",e),document.documentElement.classList.remove("light","dark"),document.documentElement.classList.add(e),this.setState({theme:e})}toggleTheme(){const e=this.state.theme==="light"?"dark":"light";this.setTheme(e)}}const E=new ye;function k(t){const e=Object.prototype.toString.call(t);return t instanceof Date||typeof t=="object"&&e==="[object Date]"?new t.constructor(+t):typeof t=="number"||e==="[object Number]"||typeof t=="string"||e==="[object String]"?new Date(t):new Date(NaN)}function P(t,e){return t instanceof Date?new t.constructor(e):new Date(e)}const ee=6048e5,be=864e5,te=6e4,ne=36e5;let we={};function W(){return we}function R(t,e){var c,o,u,d;const n=W(),a=(e==null?void 0:e.weekStartsOn)??((o=(c=e==null?void 0:e.locale)==null?void 0:c.options)==null?void 0:o.weekStartsOn)??n.weekStartsOn??((d=(u=n.locale)==null?void 0:u.options)==null?void 0:d.weekStartsOn)??0,s=k(t),r=s.getDay(),i=(r<a?7:0)+r-a;return s.setDate(s.getDate()-i),s.setHours(0,0,0,0),s}function F(t){return R(t,{weekStartsOn:1})}function ae(t){const e=k(t),n=e.getFullYear(),a=P(t,0);a.setFullYear(n+1,0,4),a.setHours(0,0,0,0);const s=F(a),r=P(t,0);r.setFullYear(n,0,4),r.setHours(0,0,0,0);const i=F(r);return e.getTime()>=s.getTime()?n+1:e.getTime()>=i.getTime()?n:n-1}function U(t){const e=k(t);return e.setHours(0,0,0,0),e}function _(t){const e=k(t),n=new Date(Date.UTC(e.getFullYear(),e.getMonth(),e.getDate(),e.getHours(),e.getMinutes(),e.getSeconds(),e.getMilliseconds()));return n.setUTCFullYear(e.getFullYear()),+t-+n}function ve(t,e){const n=U(t),a=U(e),s=+n-_(n),r=+a-_(a);return Math.round((s-r)/be)}function xe(t){const e=ae(t),n=P(t,0);return n.setFullYear(e,0,4),n.setHours(0,0,0,0),F(n)}function Ee(t){return t instanceof Date||typeof t=="object"&&Object.prototype.toString.call(t)==="[object Date]"}function ke(t){if(!Ee(t)&&typeof t!="number")return!1;const e=k(t);return!isNaN(Number(e))}function Se(t){const e=k(t),n=P(t,0);return n.setFullYear(e.getFullYear(),0,1),n.setHours(0,0,0,0),n}const De={lessThanXSeconds:{one:"less than a second",other:"less than {{count}} seconds"},xSeconds:{one:"1 second",other:"{{count}} seconds"},halfAMinute:"half a minute",lessThanXMinutes:{one:"less than a minute",other:"less than {{count}} minutes"},xMinutes:{one:"1 minute",other:"{{count}} minutes"},aboutXHours:{one:"about 1 hour",other:"about {{count}} hours"},xHours:{one:"1 hour",other:"{{count}} hours"},xDays:{one:"1 day",other:"{{count}} days"},aboutXWeeks:{one:"about 1 week",other:"about {{count}} weeks"},xWeeks:{one:"1 week",other:"{{count}} weeks"},aboutXMonths:{one:"about 1 month",other:"about {{count}} months"},xMonths:{one:"1 month",other:"{{count}} months"},aboutXYears:{one:"about 1 year",other:"about {{count}} years"},xYears:{one:"1 year",other:"{{count}} years"},overXYears:{one:"over 1 year",other:"over {{count}} years"},almostXYears:{one:"almost 1 year",other:"almost {{count}} years"}},Te=(t,e,n)=>{let a;const s=De[t];return typeof s=="string"?a=s:e===1?a=s.one:a=s.other.replace("{{count}}",e.toString()),n!=null&&n.addSuffix?n.comparison&&n.comparison>0?"in "+a:a+" ago":a};function A(t){return(e={})=>{const n=e.width?String(e.width):t.defaultWidth;return t.formats[n]||t.formats[t.defaultWidth]}}const Me={full:"EEEE, MMMM do, y",long:"MMMM do, y",medium:"MMM d, y",short:"MM/dd/yyyy"},Oe={full:"h:mm:ss a zzzz",long:"h:mm:ss a z",medium:"h:mm:ss a",short:"h:mm a"},Pe={full:"{{date}} 'at' {{time}}",long:"{{date}} 'at' {{time}}",medium:"{{date}}, {{time}}",short:"{{date}}, {{time}}"},Ie={date:A({formats:Me,defaultWidth:"full"}),time:A({formats:Oe,defaultWidth:"full"}),dateTime:A({formats:Pe,defaultWidth:"full"})},Ce={lastWeek:"'last' eeee 'at' p",yesterday:"'yesterday at' p",today:"'today at' p",tomorrow:"'tomorrow at' p",nextWeek:"eeee 'at' p",other:"P"},Ne=(t,e,n,a)=>Ce[t];function C(t){return(e,n)=>{const a=n!=null&&n.context?String(n.context):"standalone";let s;if(a==="formatting"&&t.formattingValues){const i=t.defaultFormattingWidth||t.defaultWidth,c=n!=null&&n.width?String(n.width):i;s=t.formattingValues[c]||t.formattingValues[i]}else{const i=t.defaultWidth,c=n!=null&&n.width?String(n.width):t.defaultWidth;s=t.values[c]||t.values[i]}const r=t.argumentCallback?t.argumentCallback(e):e;return s[r]}}const $e={narrow:["B","A"],abbreviated:["BC","AD"],wide:["Before Christ","Anno Domini"]},Re={narrow:["1","2","3","4"],abbreviated:["Q1","Q2","Q3","Q4"],wide:["1st quarter","2nd quarter","3rd quarter","4th quarter"]},Le={narrow:["J","F","M","A","M","J","J","A","S","O","N","D"],abbreviated:["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],wide:["January","February","March","April","May","June","July","August","September","October","November","December"]},Fe={narrow:["S","M","T","W","T","F","S"],short:["Su","Mo","Tu","We","Th","Fr","Sa"],abbreviated:["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],wide:["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]},We={narrow:{am:"a",pm:"p",midnight:"mi",noon:"n",morning:"morning",afternoon:"afternoon",evening:"evening",night:"night"},abbreviated:{am:"AM",pm:"PM",midnight:"midnight",noon:"noon",morning:"morning",afternoon:"afternoon",evening:"evening",night:"night"},wide:{am:"a.m.",pm:"p.m.",midnight:"midnight",noon:"noon",morning:"morning",afternoon:"afternoon",evening:"evening",night:"night"}},qe={narrow:{am:"a",pm:"p",midnight:"mi",noon:"n",morning:"in the morning",afternoon:"in the afternoon",evening:"in the evening",night:"at night"},abbreviated:{am:"AM",pm:"PM",midnight:"midnight",noon:"noon",morning:"in the morning",afternoon:"in the afternoon",evening:"in the evening",night:"at night"},wide:{am:"a.m.",pm:"p.m.",midnight:"midnight",noon:"noon",morning:"in the morning",afternoon:"in the afternoon",evening:"in the evening",night:"at night"}},Be=(t,e)=>{const n=Number(t),a=n%100;if(a>20||a<10)switch(a%10){case 1:return n+"st";case 2:return n+"nd";case 3:return n+"rd"}return n+"th"},Ae={ordinalNumber:Be,era:C({values:$e,defaultWidth:"wide"}),quarter:C({values:Re,defaultWidth:"wide",argumentCallback:t=>t-1}),month:C({values:Le,defaultWidth:"wide"}),day:C({values:Fe,defaultWidth:"wide"}),dayPeriod:C({values:We,defaultWidth:"wide",formattingValues:qe,defaultFormattingWidth:"wide"})};function N(t){return(e,n={})=>{const a=n.width,s=a&&t.matchPatterns[a]||t.matchPatterns[t.defaultMatchWidth],r=e.match(s);if(!r)return null;const i=r[0],c=a&&t.parsePatterns[a]||t.parsePatterns[t.defaultParseWidth],o=Array.isArray(c)?Ye(c,h=>h.test(i)):He(c,h=>h.test(i));let u;u=t.valueCallback?t.valueCallback(o):o,u=n.valueCallback?n.valueCallback(u):u;const d=e.slice(i.length);return{value:u,rest:d}}}function He(t,e){for(const n in t)if(Object.prototype.hasOwnProperty.call(t,n)&&e(t[n]))return n}function Ye(t,e){for(let n=0;n<t.length;n++)if(e(t[n]))return n}function je(t){return(e,n={})=>{const a=e.match(t.matchPattern);if(!a)return null;const s=a[0],r=e.match(t.parsePattern);if(!r)return null;let i=t.valueCallback?t.valueCallback(r[0]):r[0];i=n.valueCallback?n.valueCallback(i):i;const c=e.slice(s.length);return{value:i,rest:c}}}const Ue=/^(\d+)(th|st|nd|rd)?/i,_e=/\d+/i,ze={narrow:/^(b|a)/i,abbreviated:/^(b\.?\s?c\.?|b\.?\s?c\.?\s?e\.?|a\.?\s?d\.?|c\.?\s?e\.?)/i,wide:/^(before christ|before common era|anno domini|common era)/i},Qe={any:[/^b/i,/^(a|c)/i]},Ge={narrow:/^[1234]/i,abbreviated:/^q[1234]/i,wide:/^[1234](th|st|nd|rd)? quarter/i},Ve={any:[/1/i,/2/i,/3/i,/4/i]},Xe={narrow:/^[jfmasond]/i,abbreviated:/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,wide:/^(january|february|march|april|may|june|july|august|september|october|november|december)/i},Je={narrow:[/^j/i,/^f/i,/^m/i,/^a/i,/^m/i,/^j/i,/^j/i,/^a/i,/^s/i,/^o/i,/^n/i,/^d/i],any:[/^ja/i,/^f/i,/^mar/i,/^ap/i,/^may/i,/^jun/i,/^jul/i,/^au/i,/^s/i,/^o/i,/^n/i,/^d/i]},Ze={narrow:/^[smtwf]/i,short:/^(su|mo|tu|we|th|fr|sa)/i,abbreviated:/^(sun|mon|tue|wed|thu|fri|sat)/i,wide:/^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i},Ke={narrow:[/^s/i,/^m/i,/^t/i,/^w/i,/^t/i,/^f/i,/^s/i],any:[/^su/i,/^m/i,/^tu/i,/^w/i,/^th/i,/^f/i,/^sa/i]},et={narrow:/^(a|p|mi|n|(in the|at) (morning|afternoon|evening|night))/i,any:/^([ap]\.?\s?m\.?|midnight|noon|(in the|at) (morning|afternoon|evening|night))/i},tt={any:{am:/^a/i,pm:/^p/i,midnight:/^mi/i,noon:/^no/i,morning:/morning/i,afternoon:/afternoon/i,evening:/evening/i,night:/night/i}},nt={ordinalNumber:je({matchPattern:Ue,parsePattern:_e,valueCallback:t=>parseInt(t,10)}),era:N({matchPatterns:ze,defaultMatchWidth:"wide",parsePatterns:Qe,defaultParseWidth:"any"}),quarter:N({matchPatterns:Ge,defaultMatchWidth:"wide",parsePatterns:Ve,defaultParseWidth:"any",valueCallback:t=>t+1}),month:N({matchPatterns:Xe,defaultMatchWidth:"wide",parsePatterns:Je,defaultParseWidth:"any"}),day:N({matchPatterns:Ze,defaultMatchWidth:"wide",parsePatterns:Ke,defaultParseWidth:"any"}),dayPeriod:N({matchPatterns:et,defaultMatchWidth:"any",parsePatterns:tt,defaultParseWidth:"any"})},at={code:"en-US",formatDistance:Te,formatLong:Ie,formatRelative:Ne,localize:Ae,match:nt,options:{weekStartsOn:0,firstWeekContainsDate:1}};function st(t){const e=k(t);return ve(e,Se(e))+1}function rt(t){const e=k(t),n=+F(e)-+xe(e);return Math.round(n/ee)+1}function se(t,e){var d,h,g,v;const n=k(t),a=n.getFullYear(),s=W(),r=(e==null?void 0:e.firstWeekContainsDate)??((h=(d=e==null?void 0:e.locale)==null?void 0:d.options)==null?void 0:h.firstWeekContainsDate)??s.firstWeekContainsDate??((v=(g=s.locale)==null?void 0:g.options)==null?void 0:v.firstWeekContainsDate)??1,i=P(t,0);i.setFullYear(a+1,0,r),i.setHours(0,0,0,0);const c=R(i,e),o=P(t,0);o.setFullYear(a,0,r),o.setHours(0,0,0,0);const u=R(o,e);return n.getTime()>=c.getTime()?a+1:n.getTime()>=u.getTime()?a:a-1}function it(t,e){var c,o,u,d;const n=W(),a=(e==null?void 0:e.firstWeekContainsDate)??((o=(c=e==null?void 0:e.locale)==null?void 0:c.options)==null?void 0:o.firstWeekContainsDate)??n.firstWeekContainsDate??((d=(u=n.locale)==null?void 0:u.options)==null?void 0:d.firstWeekContainsDate)??1,s=se(t,e),r=P(t,0);return r.setFullYear(s,0,a),r.setHours(0,0,0,0),R(r,e)}function ot(t,e){const n=k(t),a=+R(n,e)-+it(n,e);return Math.round(a/ee)+1}function m(t,e){const n=t<0?"-":"",a=Math.abs(t).toString().padStart(e,"0");return n+a}const T={y(t,e){const n=t.getFullYear(),a=n>0?n:1-n;return m(e==="yy"?a%100:a,e.length)},M(t,e){const n=t.getMonth();return e==="M"?String(n+1):m(n+1,2)},d(t,e){return m(t.getDate(),e.length)},a(t,e){const n=t.getHours()/12>=1?"pm":"am";switch(e){case"a":case"aa":return n.toUpperCase();case"aaa":return n;case"aaaaa":return n[0];case"aaaa":default:return n==="am"?"a.m.":"p.m."}},h(t,e){return m(t.getHours()%12||12,e.length)},H(t,e){return m(t.getHours(),e.length)},m(t,e){return m(t.getMinutes(),e.length)},s(t,e){return m(t.getSeconds(),e.length)},S(t,e){const n=e.length,a=t.getMilliseconds(),s=Math.trunc(a*Math.pow(10,n-3));return m(s,e.length)}},I={midnight:"midnight",noon:"noon",morning:"morning",afternoon:"afternoon",evening:"evening",night:"night"},z={G:function(t,e,n){const a=t.getFullYear()>0?1:0;switch(e){case"G":case"GG":case"GGG":return n.era(a,{width:"abbreviated"});case"GGGGG":return n.era(a,{width:"narrow"});case"GGGG":default:return n.era(a,{width:"wide"})}},y:function(t,e,n){if(e==="yo"){const a=t.getFullYear(),s=a>0?a:1-a;return n.ordinalNumber(s,{unit:"year"})}return T.y(t,e)},Y:function(t,e,n,a){const s=se(t,a),r=s>0?s:1-s;if(e==="YY"){const i=r%100;return m(i,2)}return e==="Yo"?n.ordinalNumber(r,{unit:"year"}):m(r,e.length)},R:function(t,e){const n=ae(t);return m(n,e.length)},u:function(t,e){const n=t.getFullYear();return m(n,e.length)},Q:function(t,e,n){const a=Math.ceil((t.getMonth()+1)/3);switch(e){case"Q":return String(a);case"QQ":return m(a,2);case"Qo":return n.ordinalNumber(a,{unit:"quarter"});case"QQQ":return n.quarter(a,{width:"abbreviated",context:"formatting"});case"QQQQQ":return n.quarter(a,{width:"narrow",context:"formatting"});case"QQQQ":default:return n.quarter(a,{width:"wide",context:"formatting"})}},q:function(t,e,n){const a=Math.ceil((t.getMonth()+1)/3);switch(e){case"q":return String(a);case"qq":return m(a,2);case"qo":return n.ordinalNumber(a,{unit:"quarter"});case"qqq":return n.quarter(a,{width:"abbreviated",context:"standalone"});case"qqqqq":return n.quarter(a,{width:"narrow",context:"standalone"});case"qqqq":default:return n.quarter(a,{width:"wide",context:"standalone"})}},M:function(t,e,n){const a=t.getMonth();switch(e){case"M":case"MM":return T.M(t,e);case"Mo":return n.ordinalNumber(a+1,{unit:"month"});case"MMM":return n.month(a,{width:"abbreviated",context:"formatting"});case"MMMMM":return n.month(a,{width:"narrow",context:"formatting"});case"MMMM":default:return n.month(a,{width:"wide",context:"formatting"})}},L:function(t,e,n){const a=t.getMonth();switch(e){case"L":return String(a+1);case"LL":return m(a+1,2);case"Lo":return n.ordinalNumber(a+1,{unit:"month"});case"LLL":return n.month(a,{width:"abbreviated",context:"standalone"});case"LLLLL":return n.month(a,{width:"narrow",context:"standalone"});case"LLLL":default:return n.month(a,{width:"wide",context:"standalone"})}},w:function(t,e,n,a){const s=ot(t,a);return e==="wo"?n.ordinalNumber(s,{unit:"week"}):m(s,e.length)},I:function(t,e,n){const a=rt(t);return e==="Io"?n.ordinalNumber(a,{unit:"week"}):m(a,e.length)},d:function(t,e,n){return e==="do"?n.ordinalNumber(t.getDate(),{unit:"date"}):T.d(t,e)},D:function(t,e,n){const a=st(t);return e==="Do"?n.ordinalNumber(a,{unit:"dayOfYear"}):m(a,e.length)},E:function(t,e,n){const a=t.getDay();switch(e){case"E":case"EE":case"EEE":return n.day(a,{width:"abbreviated",context:"formatting"});case"EEEEE":return n.day(a,{width:"narrow",context:"formatting"});case"EEEEEE":return n.day(a,{width:"short",context:"formatting"});case"EEEE":default:return n.day(a,{width:"wide",context:"formatting"})}},e:function(t,e,n,a){const s=t.getDay(),r=(s-a.weekStartsOn+8)%7||7;switch(e){case"e":return String(r);case"ee":return m(r,2);case"eo":return n.ordinalNumber(r,{unit:"day"});case"eee":return n.day(s,{width:"abbreviated",context:"formatting"});case"eeeee":return n.day(s,{width:"narrow",context:"formatting"});case"eeeeee":return n.day(s,{width:"short",context:"formatting"});case"eeee":default:return n.day(s,{width:"wide",context:"formatting"})}},c:function(t,e,n,a){const s=t.getDay(),r=(s-a.weekStartsOn+8)%7||7;switch(e){case"c":return String(r);case"cc":return m(r,e.length);case"co":return n.ordinalNumber(r,{unit:"day"});case"ccc":return n.day(s,{width:"abbreviated",context:"standalone"});case"ccccc":return n.day(s,{width:"narrow",context:"standalone"});case"cccccc":return n.day(s,{width:"short",context:"standalone"});case"cccc":default:return n.day(s,{width:"wide",context:"standalone"})}},i:function(t,e,n){const a=t.getDay(),s=a===0?7:a;switch(e){case"i":return String(s);case"ii":return m(s,e.length);case"io":return n.ordinalNumber(s,{unit:"day"});case"iii":return n.day(a,{width:"abbreviated",context:"formatting"});case"iiiii":return n.day(a,{width:"narrow",context:"formatting"});case"iiiiii":return n.day(a,{width:"short",context:"formatting"});case"iiii":default:return n.day(a,{width:"wide",context:"formatting"})}},a:function(t,e,n){const s=t.getHours()/12>=1?"pm":"am";switch(e){case"a":case"aa":return n.dayPeriod(s,{width:"abbreviated",context:"formatting"});case"aaa":return n.dayPeriod(s,{width:"abbreviated",context:"formatting"}).toLowerCase();case"aaaaa":return n.dayPeriod(s,{width:"narrow",context:"formatting"});case"aaaa":default:return n.dayPeriod(s,{width:"wide",context:"formatting"})}},b:function(t,e,n){const a=t.getHours();let s;switch(a===12?s=I.noon:a===0?s=I.midnight:s=a/12>=1?"pm":"am",e){case"b":case"bb":return n.dayPeriod(s,{width:"abbreviated",context:"formatting"});case"bbb":return n.dayPeriod(s,{width:"abbreviated",context:"formatting"}).toLowerCase();case"bbbbb":return n.dayPeriod(s,{width:"narrow",context:"formatting"});case"bbbb":default:return n.dayPeriod(s,{width:"wide",context:"formatting"})}},B:function(t,e,n){const a=t.getHours();let s;switch(a>=17?s=I.evening:a>=12?s=I.afternoon:a>=4?s=I.morning:s=I.night,e){case"B":case"BB":case"BBB":return n.dayPeriod(s,{width:"abbreviated",context:"formatting"});case"BBBBB":return n.dayPeriod(s,{width:"narrow",context:"formatting"});case"BBBB":default:return n.dayPeriod(s,{width:"wide",context:"formatting"})}},h:function(t,e,n){if(e==="ho"){let a=t.getHours()%12;return a===0&&(a=12),n.ordinalNumber(a,{unit:"hour"})}return T.h(t,e)},H:function(t,e,n){return e==="Ho"?n.ordinalNumber(t.getHours(),{unit:"hour"}):T.H(t,e)},K:function(t,e,n){const a=t.getHours()%12;return e==="Ko"?n.ordinalNumber(a,{unit:"hour"}):m(a,e.length)},k:function(t,e,n){let a=t.getHours();return a===0&&(a=24),e==="ko"?n.ordinalNumber(a,{unit:"hour"}):m(a,e.length)},m:function(t,e,n){return e==="mo"?n.ordinalNumber(t.getMinutes(),{unit:"minute"}):T.m(t,e)},s:function(t,e,n){return e==="so"?n.ordinalNumber(t.getSeconds(),{unit:"second"}):T.s(t,e)},S:function(t,e){return T.S(t,e)},X:function(t,e,n){const a=t.getTimezoneOffset();if(a===0)return"Z";switch(e){case"X":return G(a);case"XXXX":case"XX":return O(a);case"XXXXX":case"XXX":default:return O(a,":")}},x:function(t,e,n){const a=t.getTimezoneOffset();switch(e){case"x":return G(a);case"xxxx":case"xx":return O(a);case"xxxxx":case"xxx":default:return O(a,":")}},O:function(t,e,n){const a=t.getTimezoneOffset();switch(e){case"O":case"OO":case"OOO":return"GMT"+Q(a,":");case"OOOO":default:return"GMT"+O(a,":")}},z:function(t,e,n){const a=t.getTimezoneOffset();switch(e){case"z":case"zz":case"zzz":return"GMT"+Q(a,":");case"zzzz":default:return"GMT"+O(a,":")}},t:function(t,e,n){const a=Math.trunc(t.getTime()/1e3);return m(a,e.length)},T:function(t,e,n){const a=t.getTime();return m(a,e.length)}};function Q(t,e=""){const n=t>0?"-":"+",a=Math.abs(t),s=Math.trunc(a/60),r=a%60;return r===0?n+String(s):n+String(s)+e+m(r,2)}function G(t,e){return t%60===0?(t>0?"-":"+")+m(Math.abs(t)/60,2):O(t,e)}function O(t,e=""){const n=t>0?"-":"+",a=Math.abs(t),s=m(Math.trunc(a/60),2),r=m(a%60,2);return n+s+e+r}const V=(t,e)=>{switch(t){case"P":return e.date({width:"short"});case"PP":return e.date({width:"medium"});case"PPP":return e.date({width:"long"});case"PPPP":default:return e.date({width:"full"})}},re=(t,e)=>{switch(t){case"p":return e.time({width:"short"});case"pp":return e.time({width:"medium"});case"ppp":return e.time({width:"long"});case"pppp":default:return e.time({width:"full"})}},ct=(t,e)=>{const n=t.match(/(P+)(p+)?/)||[],a=n[1],s=n[2];if(!s)return V(t,e);let r;switch(a){case"P":r=e.dateTime({width:"short"});break;case"PP":r=e.dateTime({width:"medium"});break;case"PPP":r=e.dateTime({width:"long"});break;case"PPPP":default:r=e.dateTime({width:"full"});break}return r.replace("{{date}}",V(a,e)).replace("{{time}}",re(s,e))},lt={p:re,P:ct},dt=/^D+$/,ut=/^Y+$/,mt=["D","DD","YY","YYYY"];function ht(t){return dt.test(t)}function ft(t){return ut.test(t)}function pt(t,e,n){const a=gt(t,e,n);if(console.warn(a),mt.includes(t))throw new RangeError(a)}function gt(t,e,n){const a=t[0]==="Y"?"years":"days of the month";return`Use \`${t.toLowerCase()}\` instead of \`${t}\` (in \`${e}\`) for formatting ${a} to the input \`${n}\`; see: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md`}const yt=/[yYQqMLwIdDecihHKkms]o|(\w)\1*|''|'(''|[^'])+('|$)|./g,bt=/P+p+|P+|p+|''|'(''|[^'])+('|$)|./g,wt=/^'([^]*?)'?$/,vt=/''/g,xt=/[a-zA-Z]/;function Et(t,e,n){var d,h,g,v;const a=W(),s=a.locale??at,r=a.firstWeekContainsDate??((h=(d=a.locale)==null?void 0:d.options)==null?void 0:h.firstWeekContainsDate)??1,i=a.weekStartsOn??((v=(g=a.locale)==null?void 0:g.options)==null?void 0:v.weekStartsOn)??0,c=k(t);if(!ke(c))throw new RangeError("Invalid time value");let o=e.match(bt).map(f=>{const p=f[0];if(p==="p"||p==="P"){const S=lt[p];return S(f,s.formatLong)}return f}).join("").match(yt).map(f=>{if(f==="''")return{isToken:!1,value:"'"};const p=f[0];if(p==="'")return{isToken:!1,value:kt(f)};if(z[p])return{isToken:!0,value:f};if(p.match(xt))throw new RangeError("Format string contains an unescaped latin alphabet character `"+p+"`");return{isToken:!1,value:f}});s.localize.preprocessor&&(o=s.localize.preprocessor(c,o));const u={firstWeekContainsDate:r,weekStartsOn:i,locale:s};return o.map(f=>{if(!f.isToken)return f.value;const p=f.value;(ft(p)||ht(p))&&pt(p,e,String(t));const S=z[p[0]];return S(c,p,s.localize,u)}).join("")}function kt(t){const e=t.match(wt);return e?e[1].replace(vt,"'"):t}function ie(t,e){const a=Mt(t);let s;if(a.date){const o=Ot(a.date,2);s=Pt(o.restDateString,o.year)}if(!s||isNaN(s.getTime()))return new Date(NaN);const r=s.getTime();let i=0,c;if(a.time&&(i=It(a.time),isNaN(i)))return new Date(NaN);if(a.timezone){if(c=Ct(a.timezone),isNaN(c))return new Date(NaN)}else{const o=new Date(r+i),u=new Date(0);return u.setFullYear(o.getUTCFullYear(),o.getUTCMonth(),o.getUTCDate()),u.setHours(o.getUTCHours(),o.getUTCMinutes(),o.getUTCSeconds(),o.getUTCMilliseconds()),u}return new Date(r+i+c)}const L={dateTimeDelimiter:/[T ]/,timeZoneDelimiter:/[Z ]/i,timezone:/([Z+-].*)$/},St=/^-?(?:(\d{3})|(\d{2})(?:-?(\d{2}))?|W(\d{2})(?:-?(\d{1}))?|)$/,Dt=/^(\d{2}(?:[.,]\d*)?)(?::?(\d{2}(?:[.,]\d*)?))?(?::?(\d{2}(?:[.,]\d*)?))?$/,Tt=/^([+-])(\d{2})(?::?(\d{2}))?$/;function Mt(t){const e={},n=t.split(L.dateTimeDelimiter);let a;if(n.length>2)return e;if(/:/.test(n[0])?a=n[0]:(e.date=n[0],a=n[1],L.timeZoneDelimiter.test(e.date)&&(e.date=t.split(L.timeZoneDelimiter)[0],a=t.substr(e.date.length,t.length))),a){const s=L.timezone.exec(a);s?(e.time=a.replace(s[1],""),e.timezone=s[1]):e.time=a}return e}function Ot(t,e){const n=new RegExp("^(?:(\\d{4}|[+-]\\d{"+(4+e)+"})|(\\d{2}|[+-]\\d{"+(2+e)+"})$)"),a=t.match(n);if(!a)return{year:NaN,restDateString:""};const s=a[1]?parseInt(a[1]):null,r=a[2]?parseInt(a[2]):null;return{year:r===null?s:r*100,restDateString:t.slice((a[1]||a[2]).length)}}function Pt(t,e){if(e===null)return new Date(NaN);const n=t.match(St);if(!n)return new Date(NaN);const a=!!n[4],s=$(n[1]),r=$(n[2])-1,i=$(n[3]),c=$(n[4]),o=$(n[5])-1;if(a)return Ft(e,c,o)?Nt(e,c,o):new Date(NaN);{const u=new Date(0);return!Rt(e,r,i)||!Lt(e,s)?new Date(NaN):(u.setUTCFullYear(e,r,Math.max(s,i)),u)}}function $(t){return t?parseInt(t):1}function It(t){const e=t.match(Dt);if(!e)return NaN;const n=H(e[1]),a=H(e[2]),s=H(e[3]);return Wt(n,a,s)?n*ne+a*te+s*1e3:NaN}function H(t){return t&&parseFloat(t.replace(",","."))||0}function Ct(t){if(t==="Z")return 0;const e=t.match(Tt);if(!e)return 0;const n=e[1]==="+"?-1:1,a=parseInt(e[2]),s=e[3]&&parseInt(e[3])||0;return qt(a,s)?n*(a*ne+s*te):NaN}function Nt(t,e,n){const a=new Date(0);a.setUTCFullYear(t,0,4);const s=a.getUTCDay()||7,r=(e-1)*7+n+1-s;return a.setUTCDate(a.getUTCDate()+r),a}const $t=[31,null,31,30,31,30,31,31,30,31,30,31];function oe(t){return t%400===0||t%4===0&&t%100!==0}function Rt(t,e,n){return e>=0&&e<=11&&n>=1&&n<=($t[e]||(oe(t)?29:28))}function Lt(t,e){return e>=1&&e<=(oe(t)?366:365)}function Ft(t,e,n){return e>=1&&e<=53&&n>=0&&n<=6}function Wt(t,e,n){return t===24?e===0&&n===0:n>=0&&n<60&&e>=0&&e<60&&t>=0&&t<25}function qt(t,e){return e>=0&&e<=59}function M(t,e="INR",n="en-IN"){return new Intl.NumberFormat(n,{style:"currency",currency:e,minimumFractionDigits:0,maximumFractionDigits:2}).format(t)}function j(t,e="dd/MM/yyyy"){const n=typeof t=="string"?ie(t):t;return Et(n,e)}function Bt(t){const e=typeof t=="string"?ie(t):t,a=new Date().getTime()-e.getTime(),s=Math.floor(a/(1e3*60*60*24));if(s===0){const r=Math.floor(a/36e5);if(r===0){const i=Math.floor(a/6e4);return i<1?"Just now":`${i} min${i>1?"s":""} ago`}return`${r} hour${r>1?"s":""} ago`}else return s===1?"Yesterday":s<7?`${s} days ago`:j(e,"dd MMM yyyy")}function X(){return new Date().toISOString()}function Y(t,e=24,n=""){return`<i data-lucide="${t}" class="${n}" style="width:${e}px;height:${e}px"></i>`}function At(t,e){return e===0?0:Math.round(t/e*100)}function Ht(t){return t<70?"text-green-500":t<90?"text-yellow-500":t<100?"text-orange-500":"text-red-500"}function Yt(){return window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches}function jt(){const t=localStorage.getItem("theme");return t==="light"||t==="dark"?t:(Yt(),"dark")}function Ut(t){localStorage.setItem("theme",t),document.documentElement.classList.remove("light","dark"),document.documentElement.classList.add(t)}async function _t(){if("storage"in navigator&&"estimate"in navigator.storage){const t=await navigator.storage.estimate(),e=t.usage||0,n=t.quota||0,a=n>0?Math.round(e/n*100):0;return{usage:e,quota:n,percentage:a}}return{usage:0,quota:0,percentage:0}}function J(t,e=2){if(t===0)return"0 Bytes";const n=1024,a=e<0?0:e,s=["Bytes","KB","MB","GB","TB"],r=Math.floor(Math.log(t)/Math.log(n));return parseFloat((t/Math.pow(n,r)).toFixed(a))+" "+s[r]}const zt={success:"check-circle",error:"x-circle",warning:"alert-triangle",info:"info"},Qt={success:"bg-green-500/90",error:"bg-red-500/90",warning:"bg-yellow-500/90",info:"bg-blue-500/90"};function w(t,e={}){const{type:n="info",duration:a=3e3,icon:s=zt[n]}=e,r=document.getElementById("toast-container");if(!r)return;const i=document.createElement("div");i.className=`${Qt[n]} backdrop-blur-md text-white px-4 py-3 rounded-lg shadow-2xl flex items-center gap-3 animate-slide-down max-w-sm`,i.innerHTML=`
    ${Y(s,20,"flex-shrink-0")}
    <p class="flex-1 text-sm font-medium">${t}</p>
    <button class="toast-close flex-shrink-0 hover:opacity-70 transition-opacity">
      ${Y("x",16)}
    </button>
  `,r.appendChild(i),window.lucide&&window.lucide.createIcons();const c=i.querySelector(".toast-close");c==null||c.addEventListener("click",()=>{Z(i)}),a>0&&setTimeout(()=>{Z(i)},a)}function Z(t){t.style.opacity="0",t.style.transform="translateX(100%)",t.style.transition="all 0.3s ease-out",setTimeout(()=>{t.remove()},300)}const Gt={sm:"max-w-sm",md:"max-w-md",lg:"max-w-lg",xl:"max-w-2xl"};function Vt(t){const{title:e,content:n,footer:a,onClose:s,closeOnBackdrop:r=!0,size:i="md"}=t,c=document.getElementById("modal-container");if(!c)return console.error("Modal container not found"),()=>{};const o=document.createElement("div");o.className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in";const u=document.createElement("div");u.className=`glass-card ${Gt[i]} w-full max-h-[90vh] flex flex-col animate-slide-up`;const d=document.createElement("div");d.className="flex items-center justify-between p-6 border-b border-white/10",d.innerHTML=`
    <h2 class="text-xl font-bold">${e}</h2>
    <button class="modal-close hover:opacity-70 transition-opacity">
      ${Y("x",24)}
    </button>
  `;const h=document.createElement("div");h.className="flex-1 overflow-y-auto p-6 custom-scrollbar",typeof n=="string"?h.innerHTML=n:h.appendChild(n);let g=null;a&&(g=document.createElement("div"),g.className="flex items-center justify-end gap-3 p-6 border-t border-white/10",typeof a=="string"?g.innerHTML=a:g.appendChild(a)),u.appendChild(d),u.appendChild(h),g&&u.appendChild(g),o.appendChild(u),c.appendChild(o),window.lucide&&window.lucide.createIcons();const v=()=>{o.style.opacity="0",setTimeout(()=>{o.remove(),s&&s()},200)},f=d.querySelector(".modal-close");f==null||f.addEventListener("click",v),r&&o.addEventListener("click",S=>{S.target===o&&v()});const p=S=>{S.key==="Escape"&&(v(),document.removeEventListener("keydown",p))};return document.addEventListener("keydown",p),v}async function ce(){const t=document.getElementById("main-content");if(t)try{const e=await b.getDashboardSummary(),n=await b.getTransactions({limit:10}),a=await b.getBudgets(),s=E.getState().categories,i=(await Promise.all(a.slice(0,3).map(async d=>{const h=s.find(B=>B.id===d.categoryId);if(!h)return null;const g=new Date;let v=d.startDate,f=new Date().toISOString();const S=(await b.getTransactions({startDate:v,endDate:f,categoryIds:[d.categoryId],type:"expense"})).reduce((B,ue)=>B+ue.amount,0),de=At(S,d.amount);return{categoryName:h.name,icon:h.icon||"circle",spent:S,budget:d.amount,percentage:de}}))).filter(d=>d!==null),c=E.getState().userProfile,o=(c==null?void 0:c.primaryCurrency)||"INR";t.innerHTML=`
      <div class="max-w-7xl mx-auto">
        <!-- Header -->
        <div class="mb-8">
          <h1 class="text-3xl font-bold mb-2">Welcome back${c!=null&&c.preferredName?", "+c.preferredName:""}! 👋</h1>
          <p class="text-slate-400">Here's your financial overview</p>
        </div>
        
        <!-- Summary Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <!-- Balance Card -->
          <div class="glass-card p-6">
            <div class="flex items-center justify-between mb-4">
              <span class="text-slate-400">Total Balance</span>
              <i data-lucide="wallet" class="w-5 h-5 text-primary-400"></i>
            </div>
            <h2 class="text-3xl font-bold mb-1">${M(e.balance,o)}</h2>
            <p class="text-sm text-slate-500">All accounts</p>
          </div>
          
          <!-- Monthly Income Card -->
          <div class="glass-card p-6">
            <div class="flex items-center justify-between mb-4">
              <span class="text-slate-400">Monthly Income</span>
              <i data-lucide="trending-up" class="w-5 h-5 text-green-400"></i>
            </div>
            <h2 class="text-3xl font-bold text-green-400 mb-1">${M(e.monthlyIncome,o)}</h2>
            <p class="text-sm text-slate-500">This month</p>
          </div>
          
          <!-- Monthly Expense Card -->
          <div class="glass-card p-6">
            <div class="flex items-center justify-between mb-4">
              <span class="text-slate-400">Monthly Expense</span>
              <i data-lucide="trending-down" class="w-5 h-5 text-red-400"></i>
            </div>
            <h2 class="text-3xl font-bold text-red-400 mb-1">${M(e.monthlyExpense,o)}</h2>
            <p class="text-sm text-slate-500">This month</p>
          </div>
        </div>
        
        <!-- Budget Progress (if any budgets exist) -->
        ${i.length>0?`
          <div class="glass-card p-6 mb-8">
            <h3 class="text-xl font-bold mb-4">Budget Progress</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              ${i.map(d=>`
                <div class="flex flex-col items-center">
                  <div class="relative w-24 h-24 mb-3">
                    <svg class="transform -rotate-90 w-24 h-24">
                      <circle cx="48" cy="48" r="40" stroke="currentColor" stroke-width="8" fill="none" class="text-slate-700" />
                      <circle cx="48" cy="48" r="40" stroke="currentColor" stroke-width="8" fill="none" 
                        class="${Ht(d.percentage)}"
                        stroke-dasharray="${2*Math.PI*40}"
                        stroke-dashoffset="${2*Math.PI*40*(1-d.percentage/100)}"
                        stroke-linecap="round" />
                    </svg>
                    <div class="absolute inset-0 flex items-center justify-center">
                      <span class="text-lg font-bold">${d.percentage}%</span>
                    </div>
                  </div>
                  <h4 class="font-semibold mb-1">${d.categoryName}</h4>
                  <p class="text-sm text-slate-400">${M(d.spent,o)} / ${M(d.budget,o)}</p>
                </div>
              `).join("")}
            </div>
          </div>
        `:""}
        
        <!-- Recent Transactions -->
        <div class="glass-card p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-xl font-bold">Recent Transactions</h3>
            <a href="#/transactions" class="text-primary-400 hover:text-primary-300 text-sm flex items-center gap-1">
              View all
              <i data-lucide="arrow-right" class="w-4 h-4"></i>
            </a>
          </div>
          
          ${n.length>0?`
            <div class="space-y-3">
              ${n.map(d=>{const h=s.find(g=>g.id===d.categoryId);return`
                  <div class="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
                        <i data-lucide="${(h==null?void 0:h.icon)||"circle"}" class="w-5 h-5 text-primary-400"></i>
                      </div>
                      <div>
                        <h4 class="font-medium">${(h==null?void 0:h.name)||"Unknown"}</h4>
                        <p class="text-sm text-slate-400">${Bt(d.date)}${d.payee?" • "+d.payee:""}</p>
                      </div>
                    </div>
                    <div class="text-right">
                      <p class="font-semibold ${d.type==="income"?"text-green-400":"text-red-400"}">
                        ${d.type==="income"?"+":"-"}${M(d.amount,o)}
                      </p>
                    </div>
                  </div>
                `}).join("")}
            </div>
          `:`
            <div class="text-center py-12 text-slate-400">
              <i data-lucide="inbox" class="w-16 h-16 mx-auto mb-4 opacity-50"></i>
              <p>No transactions yet</p>
              <p class="text-sm mt-2">Tap the + button to add your first transaction</p>
            </div>
          `}
        </div>
        
        <!-- FAB for adding transaction -->
        <button id="add-transaction-fab" class="fab" aria-label="Add transaction">
          <i data-lucide="plus" class="w-6 h-6"></i>
        </button>
      </div>
    `,window.lucide&&window.lucide.createIcons();const u=document.getElementById("add-transaction-fab");u==null||u.addEventListener("click",Xt)}catch(e){console.error("[Dashboard] Error rendering:",e),w("Failed to load dashboard",{type:"error"})}}function Xt(){var i;const t=E.getState().categories,e=E.getState().userProfile,n=(e==null?void 0:e.primaryCurrency)||"INR",a=document.createElement("form");a.id="transaction-form",a.className="space-y-4",a.innerHTML=`
    <div>
      <label class="block text-sm font-medium mb-2">Amount (${n})</label>
      <input type="number" name="amount" step="0.01" min="0" required 
        class="glass-input w-full" placeholder="0.00">
    </div>
    
    <div>
      <label class="block text-sm font-medium mb-2">Type</label>
      <div class="flex gap-2">
        <label class="flex-1 cursor-pointer">
          <input type="radio" name="type" value="expense" checked class="sr-only peer">
          <div class="glass-input text-center peer-checked:bg-red-500/20 peer-checked:border-red-500">
            Expense
          </div>
        </label>
        <label class="flex-1 cursor-pointer">
          <input type="radio" name="type" value="income" class="sr-only peer">
          <div class="glass-input text-center peer-checked:bg-green-500/20 peer-checked:border-green-500">
            Income
          </div>
        </label>
      </div>
    </div>
    
    <div>
      <label class="block text-sm font-medium mb-2">Category</label>
      <select name="categoryId" required class="glass-input w-full">
        <option value="">Select category...</option>
        ${t.map(c=>`
          <option value="${c.id}">${c.icon?c.icon+" ":""}${c.name}</option>
        `).join("")}
      </select>
    </div>
    
    <div>
      <label class="block text-sm font-medium mb-2">Date</label>
      <input type="date" name="date" required value="${new Date().toISOString().split("T")[0]}" 
        class="glass-input w-full">
    </div>
    
    <div>
      <label class="block text-sm font-medium mb-2">Payee (optional)</label>
      <input type="text" name="payee" class="glass-input w-full" placeholder="e.g., Grocery Store">
    </div>
    
    <div>
      <label class="block text-sm font-medium mb-2">Notes (optional)</label>
      <textarea name="notes" rows="2" class="glass-input w-full" placeholder="Add details..."></textarea>
    </div>
  `;const s=document.createElement("div");s.className="flex gap-3",s.innerHTML=`
    <button type="button" class="glass-button-secondary flex-1" data-action="cancel">Cancel</button>
    <button type="submit" class="glass-button flex-1">Add Transaction</button>
  `;const r=Vt({title:"Add Transaction",content:a,footer:s,size:"lg"});(i=s.querySelector('[data-action="cancel"]'))==null||i.addEventListener("click",r),a.addEventListener("submit",async c=>{c.preventDefault();try{const o=new FormData(a),u={amount:parseFloat(o.get("amount")),type:o.get("type"),categoryId:o.get("categoryId"),date:new Date(o.get("date")).toISOString(),payee:o.get("payee")||void 0,notes:o.get("notes")||void 0};await b.createTransaction(u),r(),w("Transaction added successfully",{type:"success"}),ce()}catch(o){w("Failed to add transaction",{type:"error"}),console.error(o)}})}let y=1,l={id:"current",country:"India",city:"Chennai",stateProvince:"Tamil Nadu",primaryCurrency:"INR",preferredLanguage:"en",dataSharingOptOut:!0};async function q(){var e,n,a;const t=document.getElementById("main-content");t&&(t.innerHTML=`
    <div class="max-w-2xl mx-auto py-8">
      <!-- Progress Bar -->
      <div class="mb-8">
        <div class="flex justify-between text-xs text-slate-400 mb-2">
          <span>Step ${y} of 7</span>
          <span>${Math.round(y/7*100)}% complete</span>
        </div>
        <div class="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
          <div class="h-full bg-primary-500 transition-all duration-300" style="width: ${y/7*100}%"></div>
        </div>
      </div>
      
      <!-- Step Content -->
      <div class="glass-card p-8 mb-6">
        <div id="step-content"></div>
      </div>
      
      <!-- Navigation Buttons -->
      <div class="flex gap-4">
        ${y>1?'<button id="prev-btn" class="glass-button-secondary flex-1">Previous</button>':""}
        <button id="next-btn" class="glass-button flex-1">${y===7?"Complete":"Next"}</button>
        ${y<7?'<button id="skip-btn" class="glass-button-secondary">Skip</button>':""}
      </div>
    </div>
  `,Jt(),(e=document.getElementById("next-btn"))==null||e.addEventListener("click",Zt),(n=document.getElementById("prev-btn"))==null||n.addEventListener("click",Kt),(a=document.getElementById("skip-btn"))==null||a.addEventListener("click",en))}function Jt(){var e;const t=document.getElementById("step-content");if(t)switch(y){case 1:t.innerHTML=`
        <h2 class="text-2xl font-bold mb-2">Welcome to MoneyFlow! 👋</h2>
        <p class="text-slate-400 mb-6">Let's set up your profile to personalize your experience</p>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">Full Name</label>
            <input type="text" id="fullName" value="${l.fullName||""}" 
              class="glass-input w-full" placeholder="Enter your name">
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">Preferred Name (optional)</label>
            <input type="text" id="preferredName" value="${l.preferredName||""}" 
              class="glass-input w-full" placeholder="What should we call you?">
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">Country</label>
            <input type="text" id="country" value="${l.country||"India"}" 
              class="glass-input w-full">
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">Currency</label>
            <select id="primaryCurrency" class="glass-input w-full">
              <option value="INR" ${l.primaryCurrency==="INR"?"selected":""}>₹ Indian Rupee (INR)</option>
              <option value="USD" ${l.primaryCurrency==="USD"?"selected":""}>$ US Dollar (USD)</option>
              <option value="EUR" ${l.primaryCurrency==="EUR"?"selected":""}>€ Euro (EUR)</option>
              <option value="GBP" ${l.primaryCurrency==="GBP"?"selected":""}>£ British Pound (GBP)</option>
              <option value="AED" ${l.primaryCurrency==="AED"?"selected":""}>د.إ UAE Dirham (AED)</option>
            </select>
          </div>
        </div>
      `;break;case 2:t.innerHTML=`
        <h2 class="text-2xl font-bold mb-2">Personal Information</h2>
        <p class="text-slate-400 mb-6">This helps us tailor budget recommendations</p>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">Date of Birth (optional)</label>
            <input type="date" id="dateOfBirth" value="${((e=l.dateOfBirth)==null?void 0:e.split("T")[0])||""}" 
              class="glass-input w-full">
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">Household Size</label>
            <input type="number" id="householdSize" value="${l.householdSize||1}" min="1" 
              class="glass-input w-full">
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">City</label>
            <input type="text" id="city" value="${l.city||"Chennai"}" 
              class="glass-input w-full">
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">State/Province</label>
            <input type="text" id="stateProvince" value="${l.stateProvince||"Tamil Nadu"}" 
              class="glass-input w-full">
          </div>
        </div>
      `;break;case 3:t.innerHTML=`
        <h2 class="text-2xl font-bold mb-2">Financial Profile</h2>
        <p class="text-slate-400 mb-6">Help us understand your income pattern</p>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">Income Frequency</label>
            <select id="incomeFrequency" class="glass-input w-full">
              <option value="monthly" ${l.incomeFrequency==="monthly"?"selected":""}>Monthly</option>
              <option value="bi-weekly" ${l.incomeFrequency==="bi-weekly"?"selected":""}>Bi-weekly</option>
              <option value="weekly" ${l.incomeFrequency==="weekly"?"selected":""}>Weekly</option>
              <option value="irregular" ${l.incomeFrequency==="irregular"?"selected":""}>Irregular</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">Approximate Monthly Income (optional)</label>
            <input type="number" id="approximateMonthlyIncome" value="${l.approximateMonthlyIncome||""}" 
              step="1000" min="0" class="glass-input w-full" placeholder="₹">
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">Main Income Source</label>
            <select id="mainIncomeSource" class="glass-input w-full">
              <option value="salary" ${l.mainIncomeSource==="salary"?"selected":""}>Salary</option>
              <option value="business" ${l.mainIncomeSource==="business"?"selected":""}>Business</option>
              <option value="freelance" ${l.mainIncomeSource==="freelance"?"selected":""}>Freelance</option>
              <option value="investments" ${l.mainIncomeSource==="investments"?"selected":""}>Investments</option>
              <option value="pension" ${l.mainIncomeSource==="pension"?"selected":""}>Pension</option>
              <option value="other" ${l.mainIncomeSource==="other"?"selected":""}>Other</option>
            </select>
          </div>
        </div>
      `;break;case 4:t.innerHTML=`
        <h2 class="text-2xl font-bold mb-2">Debt & Safety Net</h2>
        <p class="text-slate-400 mb-6">Understanding your financial obligations</p>
        <div class="space-y-4">
          <div>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" id="hasDebt" ${l.hasDebt?"checked":""} class="w-5 h-5">
              <span>I have existing debt</span>
            </label>
          </div>
          <div>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" id="hasEmergencyFund" ${l.hasEmergencyFund?"checked":""} class="w-5 h-5">
              <span>I have an emergency fund</span>
            </label>
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">Emergency Fund (months of expenses)</label>
            <input type="number" id="emergencyFundMonths" value="${l.emergencyFundMonths||0}" 
              min="0" max="24" class="glass-input w-full">
          </div>
        </div>
      `;break;case 5:t.innerHTML=`
        <h2 class="text-2xl font-bold mb-2">Financial Goals</h2>
        <p class="text-slate-400 mb-6">What are you working towards?</p>
        <div class="space-y-3">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" value="emergency-fund" class="goal-checkbox w-5 h-5">
            <span>Build emergency fund</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" value="debt-payoff" class="goal-checkbox w-5 h-5">
            <span>Pay off debt</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" value="retirement" class="goal-checkbox w-5 h-5">
            <span>Save for retirement</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" value="home-purchase" class="goal-checkbox w-5 h-5">
            <span>Buy a home</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" value="education" class="goal-checkbox w-5 h-5">
            <span>Education expenses</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" value="vacation" class="goal-checkbox w-5 h-5">
            <span>Save for vacation</span>
          </label>
        </div>
      `;break;case 6:t.innerHTML=`
        <h2 class="text-2xl font-bold mb-2">Preferences</h2>
        <p class="text-slate-400 mb-6">Customize your experience</p>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">Language</label>
            <select id="preferredLanguage" class="glass-input w-full">
              <option value="en" ${l.preferredLanguage==="en"?"selected":""}>English</option>
              <option value="ta" ${l.preferredLanguage==="ta"?"selected":""}>தமிழ் (Tamil)</option>
              <option value="hi" ${l.preferredLanguage==="hi"?"selected":""}>हिन्दी (Hindi)</option>
            </select>
          </div>
          <div>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" id="notifReminders" checked class="w-5 h-5">
              <span>Send bill reminders</span>
            </label>
          </div>
          <div>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" id="notifOverspending" checked class="w-5 h-5">
              <span>Alert me when I overspend</span>
            </label>
          </div>
        </div>
      `;break;case 7:t.innerHTML=`
        <h2 class="text-2xl font-bold mb-2">All Set! 🎉</h2>
        <p class="text-slate-400 mb-6">Review your profile before we get started</p>
        <div class="space-y-3 text-sm">
          <div class="flex justify-between py-2 border-b border-white/5">
            <span class="text-slate-400">Name:</span>
            <span class="font-medium">${l.fullName||"Not set"}</span>
          </div>
          <div class="flex justify-between py-2 border-b border-white/5">
            <span class="text-slate-400">Location:</span>
            <span class="font-medium">${l.city}, ${l.country}</span>
          </div>
          <div class="flex justify-between py-2 border-b border-white/5">
            <span class="text-slate-400">Currency:</span>
            <span class="font-medium">${l.primaryCurrency}</span>
          </div>
          <div class="flex justify-between py-2 border-b border-white/5">
            <span class="text-slate-400">Income:</span>
            <span class="font-medium">${l.incomeFrequency||"Not set"}</span>
          </div>
        </div>
        <div class="mt-6 p-4 bg-primary-500/10 border border-primary-500/20 rounded-lg animate-pulse-soft">
          <p class="text-sm text-center">Click Complete to start tracking your finances!</p>
        </div>
      `;break}}function le(){const t=n=>{var a;return(a=document.getElementById(n))==null?void 0:a.value},e=n=>{var a;return(a=document.getElementById(n))==null?void 0:a.checked};switch(y){case 1:l.fullName=t("fullName"),l.preferredName=t("preferredName"),l.country=t("country"),l.primaryCurrency=t("primaryCurrency");break;case 2:const n=t("dateOfBirth");l.dateOfBirth=n?new Date(n).toISOString():void 0,l.householdSize=parseInt(t("householdSize"))||1,l.city=t("city"),l.stateProvince=t("stateProvince");break;case 3:l.incomeFrequency=t("incomeFrequency");const a=t("approximateMonthlyIncome");l.approximateMonthlyIncome=a?parseFloat(a):void 0,l.mainIncomeSource=t("mainIncomeSource");break;case 4:l.hasDebt=e("hasDebt"),l.hasEmergencyFund=e("hasEmergencyFund"),l.emergencyFundMonths=parseInt(t("emergencyFundMonths"))||0;break;case 5:const s=[];document.querySelectorAll(".goal-checkbox:checked").forEach(r=>{const i=r.value;s.push({type:i,priority:"medium"})}),l.financialGoals=s;break;case 6:l.preferredLanguage=t("preferredLanguage"),l.notificationPreferences={reminders:e("notifReminders"),overspendingAlerts:e("notifOverspending")};break}}async function Zt(){le(),y===7?await tn():(y++,q())}function Kt(){le(),y>1&&(y--,q())}function en(){y++,q()}async function tn(){try{const t={...l,id:"current",createdAt:X(),lastUpdated:X(),onboardingComplete:!0,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone};await b.saveProfile(t),E.setProfile(t),x.setOnboardingRequired(!1),w("Profile created successfully! Welcome to MoneyFlow 🎉",{type:"success",duration:3e3}),y=1,l={},x.navigate("/")}catch(t){console.error("[Onboarding] Error saving profile:",t),w("Failed to save profile. Please try again.",{type:"error"})}}async function nn(){const t=document.getElementById("main-content");if(t)try{const e=await b.getTransactions({limit:50}),n=E.getState().categories,a=E.getState().userProfile,s=(a==null?void 0:a.primaryCurrency)||"INR";t.innerHTML=`
      <div class="max-w-4xl mx-auto">
        <h1 class="text-3xl font-bold mb-6">Transactions</h1>
        
        <div class="glass-card p-6">
          ${e.length>0?`
            <div class="space-y-3">
              ${e.map(r=>{const i=n.find(c=>c.id===r.categoryId);return`
                  <div class="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
                        <i data-lucide="${(i==null?void 0:i.icon)||"circle"}" class="w-5 h-5 text-primary-400"></i>
                      </div>
                      <div>
                        <h4 class="font-medium">${(i==null?void 0:i.name)||"Unknown"}</h4>
                        <p class="text-sm text-slate-400">${j(r.date)}${r.payee?" • "+r.payee:""}</p>
                      </div>
                    </div>
                    <div class="text-right">
                      <p class="font-semibold ${r.type==="income"?"text-green-400":"text-red-400"}">
                        ${r.type==="income"?"+":"-"}${M(r.amount,s)}
                      </p>
                    </div>
                  </div>
                `}).join("")}
            </div>
          `:`
            <div class="text-center py-12 text-slate-400">
              <i data-lucide="inbox" class="w-16 h-16 mx-auto mb-4 opacity-50"></i>
              <p>No transactions yet</p>
            </div>
          `}
        </div>
      </div>
    `,window.lucide&&window.lucide.createIcons()}catch(e){console.error("[Transactions] Error rendering:",e),w("Failed to load transactions",{type:"error"})}}async function an(){const t=document.getElementById("main-content");if(t)try{const e=await b.getCategories();t.innerHTML=`
      <div class="max-w-4xl mx-auto">
        <h1 class="text-3xl font-bold mb-6">Categories</h1>
        
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          ${e.map(n=>`
            <div class="glass-card p-4 text-center">
              <i data-lucide="${n.icon||"circle"}" class="w-8 h-8 mx-auto mb-2 text-primary-400"></i>
              <h3 class="font-medium mb-1">${n.name}</h3>
              <span class="text-xs text-slate-400">${n.type}</span>
            </div>
          `).join("")}
        </div>
      </div>
    `,window.lucide&&window.lucide.createIcons()}catch(e){console.error("[Categories] Error rendering:",e),w("Failed to load categories",{type:"error"})}}async function sn(){const t=document.getElementById("main-content");if(t)try{const e=await b.getBudgets();t.innerHTML=`
      <div class="max-w-4xl mx-auto">
        <h1 class="text-3xl font-bold mb-6">Budgets</h1>
        
        <div class="glass-card p-6">
          ${e.length>0?`
            <div class="space-y-4">
              ${e.map(n=>`
                <div class="py-3 border-b border-white/5 last:border-0">
                  <div class="flex justify-between items-center">
                    <span class="font-medium">Budget</span>
                    <span class="text-slate-400">${n.period}</span>
                  </div>
                </div>
              `).join("")}
            </div>
          `:`
            <div class="text-center py-12 text-slate-400">
              <i data-lucide="pie-chart" class="w-16 h-16 mx-auto mb-4 opacity-50"></i>
              <p>No budgets set</p>
            </div>
          `}
        </div>
      </div>
    `,window.lucide&&window.lucide.createIcons()}catch(e){console.error("[Budgets] Error rendering:",e),w("Failed to load budgets",{type:"error"})}}async function rn(){const t=document.getElementById("main-content");t&&(t.innerHTML=`
    <div class="max-w-6xl mx-auto">
      <h1 class="text-3xl font-bold mb-6">Reports & Analytics</h1>
      
      <div class="glass-card p-6">
        <div class="text-center py-12 text-slate-400">
          <i data-lucide="bar-chart-3" class="w-16 h-16 mx-auto mb-4 opacity-50"></i>
          <p>Reports coming soon</p>
          <p class="text-sm mt-2">We're working on beautiful charts for your financial insights</p>
        </div>
      </div>
    </div>
  `,window.lucide&&window.lucide.createIcons())}async function on(){const t=document.getElementById("main-content");if(t)try{const e=await b.getReminders();t.innerHTML=`
      <div class="max-w-4xl mx-auto">
        <h1 class="text-3xl font-bold mb-6">Reminders</h1>
        
        <div class="glass-card p-6">
          ${e.length>0?`
            <div class="space-y-3">
              ${e.map(n=>`
                <div class="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                  <div>
                    <h4 class="font-medium">${n.name}</h4>
                    <p class="text-sm text-slate-400">Due: ${j(n.dueDate)}</p>
                  </div>
                  <span class="text-yellow-400">${M(n.amount)}</span>
                </div>
              `).join("")}
            </div>
          `:`
            <div class="text-center py-12 text-slate-400">
              <i data-lucide="bell" class="w-16 h-16 mx-auto mb-4 opacity-50"></i>
              <p>No reminders set</p>
            </div>
          `}
        </div>
      </div>
    `,window.lucide&&window.lucide.createIcons()}catch(e){console.error("[Reminders] Error rendering:",e),w("Failed to load reminders",{type:"error"})}}async function cn(){var e;const t=document.getElementById("main-content");if(t)try{const n=E.getState().userProfile,a=await _t();t.innerHTML=`
      <div class="max-w-4xl mx-auto">
        <h1 class="text-3xl font-bold mb-6">Settings</h1>
        
        <!-- Profile Section -->
        <div class="glass-card p-6 mb-6">
          <h2 class="text-xl font-bold mb-4">Profile</h2>
          <div class="space-y-3">
            <div class="flex justify-between py-2 border-b border-white/5">
              <span class="text-slate-400">Name</span>
              <span class="font-medium">${(n==null?void 0:n.fullName)||"Not set"}</span>
            </div>
            <div class="flex justify-between py-2 border-b border-white/5">
              <span class="text-slate-400">Location</span>
              <span class="font-medium">${n==null?void 0:n.city}, ${n==null?void 0:n.country}</span>
            </div>
            <div class="flex justify-between py-2 border-b border-white/5">
              <span class="text-slate-400">Currency</span>
              <span class="font-medium">${n==null?void 0:n.primaryCurrency}</span>
            </div>
          </div>
          <button class="glass-button w-full mt-4">Edit Profile</button>
        </div>
        
        <!-- Appearance -->
        <div class="glass-card p-6 mb-6">
          <h2 class="text-xl font-bold mb-4">Appearance</h2>
          <button id="theme-toggle-settings" class="glass-button-secondary w-full">
            Toggle Theme
          </button>
        </div>
        
        <!-- Storage -->
        <div class="glass-card p-6 mb-6">
          <h2 class="text-xl font-bold mb-4">Storage</h2>
          <div class="space-y-3">
            <div class="flex justify-between">
              <span class="text-slate-400">Used</span>
              <span class="font-medium">${J(a.usage)}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">Available</span>
              <span class="font-medium">${J(a.quota)}</span>
            </div>
            <div class="w-full h-2 bg-slate-700 rounded-full overflow-hidden mt-2">
              <div class="h-full bg-primary-500" style="width: ${a.percentage}%"></div>
            </div>
          </div>
        </div>
        
        <!-- Data Management -->
        <div class="glass-card p-6">
          <h2 class="text-xl font-bold mb-4">Data Management</h2>
          <div class="space-y-3">
            <button class="glass-button-secondary w-full">Export Data (CSV)</button>
            <button class="glass-button-secondary w-full">Export Data (JSON)</button>
            <button class="glass-button-secondary w-full text-red-400">Reset All Data</button>
          </div>
        </div>
        
        <!-- About -->
        <div class="text-center mt-8 text-sm text-slate-400">
          <p>MoneyFlow v1.0.0</p>
          <p class="mt-1">Privacy-first offline finance tracker</p>
        </div>
      </div>
    `,(e=document.getElementById("theme-toggle-settings"))==null||e.addEventListener("click",()=>{E.toggleTheme(),w("Theme updated",{type:"success",duration:2e3})})}catch(n){console.error("[Settings] Error rendering:",n),w("Failed to load settings",{type:"error"})}}async function K(){try{console.log("[App] Initializing MoneyFlow...");const t=jt();Ut(t),await b.init(),console.log("[App] Database initialized");const e=await b.getProfile();E.setProfile(e);const n=(e==null?void 0:e.onboardingComplete)||!1;x.setOnboardingRequired(!n);const a=await b.getCategories();E.setCategories(a),x.register("/",ce),x.register("/onboarding",q,!1),x.register("/transactions",nn),x.register("/categories",an),x.register("/budgets",sn),x.register("/reports",rn),x.register("/reminders",on),x.register("/settings",cn),ln();const s=document.getElementById("loading-screen"),r=document.getElementById("app");s&&r&&(s.style.display="none",r.classList.remove("hidden")),x.start(),console.log("[App] Initialization complete")}catch(t){console.error("[App] Initialization error:",t),w("Failed to initialize app. Please refresh.",{type:"error",duration:0})}}function ln(){const t=document.getElementById("nav-container");t&&(t.innerHTML=`
      <div class="hidden md:flex fixed top-0 left-0 h-screen w-64 glass-card flex-col p-6 border-r border-white/10">
        <div class="mb-8">
          <h1 class="text-2xl font-bold text-white mb-1">MoneyFlow</h1>
          <p class="text-sm text-slate-400">Personal Finance Tracker</p>
        </div>
        
        <nav class="flex-1 space-y-2">
          <a href="#/" class="nav-link flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors">
            <i data-lucide="layout-dashboard" class="w-5 h-5"></i>
            <span>Dashboard</span>
          </a>
          <a href="#/transactions" class="nav-link flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors">
            <i data-lucide="receipt" class="w-5 h-5"></i>
            <span>Transactions</span>
          </a>
          <a href="#/categories" class="nav-link flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors">
            <i data-lucide="tag" class="w-5 h-5"></i>
            <span>Categories</span>
          </a>
          <a href="#/budgets" class="nav-link flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors">
            <i data-lucide="pie-chart" class="w-5 h-5"></i>
            <span>Budgets</span>
          </a>
          <a href="#/reports" class="nav-link flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors">
            <i data-lucide="bar-chart-3" class="w-5 h-5"></i>
            <span>Reports</span>
          </a>
          <a href="#/reminders" class="nav-link flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors">
            <i data-lucide="bell" class="w-5 h-5"></i>
            <span>Reminders</span>
          </a>
          <a href="#/settings" class="nav-link flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors">
            <i data-lucide="settings" class="w-5 h-5"></i>
            <span>Settings</span>
          </a>
        </nav>
        
        <div class="mt-auto pt-6 border-t border-white/10">
          <button id="theme-toggle" class="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
            <i data-lucide="moon" class="w-5 h-5"></i>
            <span>Toggle Theme</span>
          </button>
        </div>
      </div>
      
      <!-- Spacer for desktop -->
      <div class="hidden md:block w-64"></div>
    `);const e=document.getElementById("bottom-nav");e&&(e.innerHTML=`
      <div class="flex items-center justify-around py-2">
        <a href="#/" class="nav-link flex flex-col items-center gap-1 px-4 py-2 text-slate-400 hover:text-white transition-colors">
          <i data-lucide="layout-dashboard" class="w-6 h-6"></i>
          <span class="text-xs">Home</span>
        </a>
        <a href="#/transactions" class="nav-link flex flex-col items-center gap-1 px-4 py-2 text-slate-400 hover:text-white transition-colors">
          <i data-lucide="receipt" class="w-6 h-6"></i>
          <span class="text-xs">Transactions</span>
        </a>
        <a href="#/budgets" class="nav-link flex flex-col items-center gap-1 px-4 py-2 text-slate-400 hover:text-white transition-colors">
          <i data-lucide="pie-chart" class="w-6 h-6"></i>
          <span class="text-xs">Budgets</span>
        </a>
        <a href="#/reports" class="nav-link flex flex-col items-center gap-1 px-4 py-2 text-slate-400 hover:text-white transition-colors">
          <i data-lucide="bar-chart-3" class="w-6 h-6"></i>
          <span class="text-xs">Reports</span>
        </a>
        <a href="#/settings" class="nav-link flex flex-col items-center gap-1 px-4 py-2 text-slate-400 hover:text-white transition-colors">
          <i data-lucide="settings" class="w-6 h-6"></i>
          <span class="text-xs">More</span>
        </a>
      </div>
    `),window.lucide&&window.lucide.createIcons();const n=()=>{const s=window.location.hash;document.querySelectorAll(".nav-link").forEach(r=>{const i=r.getAttribute("href");i===s||s===""&&i==="#/"?r.classList.add("bg-primary-500/20","text-primary-400"):r.classList.remove("bg-primary-500/20","text-primary-400")})};window.addEventListener("hashchange",n),n();const a=document.getElementById("theme-toggle");a&&a.addEventListener("click",()=>{E.toggleTheme(),w("Theme updated",{type:"success",duration:2e3})})}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",K):K();
