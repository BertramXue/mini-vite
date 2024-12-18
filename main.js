const Koa = require('koa');
const path = require('path');
const fs = require('fs');
const { rewirteImport, ifUseCache } = require('./src/utils')
const compilerSfc = require('@vue/compiler-sfc')
const compilerDom = require('@vue/compiler-dom')

const app = new Koa();

app.use(ctx => {
  const { url, query } = ctx.request;
  const { "if-none-match": ifNoneMatch, "if-modified-since": ifModifiedSince } =
    ctx.request.headers;
  if (url === '/') {
    const content = fs.readFileSync('./index.html', 'utf-8')
    ctx.type = "text/html";
    ctx.body = content;
  } else if (url.endsWith('.js')) {
    const used = ifUseCache(ctx, url, ifNoneMatch, ifModifiedSince);
    if (used) {
      return;
    }
    const content = fs.readFileSync(path.join(__dirname, url), 'utf-8')
    ctx.type = "application/javascript"
    ctx.body = rewirteImport(content);
  } else if (url.startsWith('/@modules/')) {
    ctx.type = "application/javascript"
    const moduleUrl = path.resolve(__dirname, 'node_modules', url.replace("/@modules/", ""));
    const packageJsonContent = fs.readFileSync(path.join(moduleUrl, 'package.json'), 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);
    const content = fs.readFileSync(path.join(moduleUrl, packageJson.module), 'utf-8');
    ctx.set("cache-control", "max-age=31536000,immutable");
    ctx.body = rewirteImport(content);
  } else if (url.includes('.vue')) {
    const vueUrl = path.join(__dirname, 'src', url.split('?')[0]);
    const used = ifUseCache(ctx, vueUrl, ifNoneMatch, ifModifiedSince);
    if (used) {
      return;
    }
    const content = fs.readFileSync(vueUrl, 'utf-8')
    const { descriptor } = compilerSfc.parse(content);
    if (!query.type) {
      const scriptContent = descriptor.script.content;
      const script = scriptContent.replace('export default ', 'const __script = ')
      ctx.type = 'text/javascript'
      ctx.body = `
        ${rewirteImport(script)}
        ${descriptor.styles.length ? `import '${url}?type=style'` : ''}
        import { render as __render } from '${url}?type=template'
        __script.render = __render
        export default __script
      `;
    } else if (query.type === 'template') {
      ctx.type = "application/javascript";
      const templateContent = compilerDom.compile(descriptor.template.content, {
        mode: 'module'
      });
      ctx.body = rewirteImport(templateContent.code);
    } else if (query.type === 'style') {
      ctx.body = descriptor.styles;
      const styleBlock = descriptor.styles[0];
      ctx.type = "application/javascript";
      ctx.body = `
        const css = ${JSON.stringify(styleBlock.content)};
        updateStyle(css);
        export default css;
      `;
    }
  }
})

app.listen(3000, () => {
  console.log('started vited');
})