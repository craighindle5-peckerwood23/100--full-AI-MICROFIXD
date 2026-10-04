/** Real Chromium actions only. No simulated successes or host-side evaluation. */
import { chromium, Browser, BrowserContext, Page } from 'playwright';
class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private starting: Promise<void> | null = null;
  async start(headless=true): Promise<void> {
    if(this.page)return;
    if(this.starting)return this.starting;
    this.starting=(async()=>{
      const browser=await chromium.launch({headless,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
        chromiumSandbox: process.env.PLAYWRIGHT_CHROMIUM_SANDBOX !== 'false', args:['--disable-dev-shm-usage']});
      try {
        const context=await browser.newContext({viewport:{width:1280,height:800}});
        this.context=context;this.page=await context.newPage();this.browser=browser;
        browser.on('disconnected',()=>{this.browser=null;this.context=null;this.page=null;});
      } catch(err){await browser.close();throw err;}
    })();
    try {await this.starting;} finally {this.starting=null;}
  }
  async stop(): Promise<void> {
    if(this.starting)await this.starting.catch(()=>{});
    const browser=this.browser;this.browser=null;this.context=null;this.page=null;
    if(browser)await browser.close();
  }
  async getPage(): Promise<Page> {await this.start();return this.page!;}
  isStarted():boolean{return !!this.page;}
  isPlaywrightNative():boolean{return !!this.page;}
  async navigate(url:string):Promise<{title:string;url:string;status:number}> {
    const parsed=new URL(url);
    if(!['http:','https:'].includes(parsed.protocol))throw new Error('Browser navigation requires HTTP or HTTPS');
    const page=await this.getPage();
    const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:25000});
    if(response && response.status()>=400)throw new Error(`Navigation failed: HTTP ${response.status()}`);
    return {title:await page.title(),url:page.url(),status:response?.status()??200};
  }
  async getText(selector='body'):Promise<string>{return (await this.getPage()).locator(selector).innerText({timeout:5000});}
  async getHtml(selector='body'):Promise<string>{return (await this.getPage()).locator(selector).innerHTML({timeout:5000});}
  async click(selector:string):Promise<{success:boolean}>{await (await this.getPage()).click(selector,{timeout:5000});return {success:true};}
  async fill(selector:string,value:string):Promise<{success:boolean}>{await (await this.getPage()).fill(selector,value,{timeout:5000});return {success:true};}
  async screenshot(fullPage=false):Promise<string>{const buffer=await (await this.getPage()).screenshot({type:'jpeg',quality:80,fullPage});return `data:image/jpeg;base64,${buffer.toString('base64')}`;}
  async evaluate(js:string):Promise<unknown>{return (await this.getPage()).evaluate(js);}
  async scrape(url:string,selector='body'):Promise<{text:string;url:string;title:string}>{const nav=await this.navigate(url);return {text:await this.getText(selector),url:nav.url,title:nav.title};}
  async findLinks(url?:string):Promise<string[]>{if(url)await this.navigate(url);return (await this.getPage()).evaluate(()=>Array.from(document.querySelectorAll('a[href]')).map(a=>(a as HTMLAnchorElement).href).filter(h=>/^https?:/.test(h)).slice(0,50));}
  async fillAndSubmit(selector:string,value:string,submitSelector:string):Promise<{success:boolean}>{await this.fill(selector,value);return this.click(submitSelector);}
  async getCurrentState():Promise<{url:string;title:string;status:string;engine:string}>{
    if(!this.page)return {url:'',title:'',status:'idle',engine:'playwright_chromium_native'};
    return {url:this.page.url(),title:await this.page.title(),status:'active',engine:'playwright_chromium_native'};
  }
}
export const browserManager=new BrowserManager();
