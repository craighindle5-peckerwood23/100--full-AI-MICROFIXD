import {Router} from 'express';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function marketingRouter(distDir:string){
 const router=Router();
 const base=()=>{const url=new URL(process.env.PUBLIC_SITE_URL||'https://microfixd.com');if(!['http:','https:'].includes(url.protocol))throw new Error('INVALID_PUBLIC_SITE_URL');return url.origin;};
 router.get('/robots.txt',(_req,res)=>res.type('text/plain').send(`User-agent: *\nAllow: /saas\nDisallow: /api/\nDisallow: /case-workspace\nSitemap: ${base()}/sitemap.xml\n`));
 router.get('/sitemap.xml',(_req,res)=>res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${escape(base())}/saas</loc></url></urlset>`));
 router.get(['/saas','/saas/'],async(_req,res,next)=>{try{
  const title=escape(`${process.env.VITE_BRAND_PRODUCT_NAME||'Microfixd OS'} — Governed AI workspace`);
  const html=await readFile(path.join(distDir,'index.html'),'utf8');
  res.type('html').send(html.replace(/<title>.*?<\/title>/s,`<title>${title}</title>`).replace('</head>',`<link rel="canonical" href="${escape(base())}/saas"/></head>`).replace('<body>','<body><noscript><h1>'+title+'</h1><p>AI reasoning, connected tools, and durable missions in a governed workspace. White-label branding supports one brand per deployment.</p><a href="/">Open workspace</a></noscript>'));
 }catch(error){next(error);}});
 return router;
}
