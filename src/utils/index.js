const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

const rewirteImport = (content) => {
  return content.replace(/ from ['"](.*)['"]/g, (s1, s2) => {
    if (s2.startsWith("./") || s2.startsWith("/") || s2.startsWith("../")) {
      return s1;
    } else {
      return ` from "/@modules/${s2}"`
    }
  });
}

/** 获取文件的最后修改时间 */
const getFileUpdatedDate = (path) => {
  const stats = fs.statSync(path);
  return stats.mtime;
};


/** 协商缓存判断返回304还是200 */
const ifUseCache = (ctx, url, ifNoneMatch, ifModifiedSince) => {
  let flag = false
  // 使用协商缓存
  ctx.set('Cache-Control', 'no-cache')
  const expiresDate = new Date();
  expiresDate.setTime(expiresDate.getTime() + 30000);
  ctx.set('Expires', expiresDate.toUTCString());
  let filePath = url.includes(".vue") ? url : path.join(__dirname, url);
  if (url === "/") {
    filePath = path.join(__dirname, "./index.html");
  }
  // 获取文件的最后修改时间
  const buffer = fs.readFileSync(filePath, "utf-8");
  // 计算请求文件的md5值
  const hash = crypto.createHash("md5");
  hash.update(buffer, "utf-8");
  // 得到etag
  const etag = `${hash.digest("hex")}`;
  if (ifNoneMatch === etag) {
    ctx.status = 304;
    ctx.body = "";
    flag = true
  } else {
    // etag不一致 更新tag值，返回新的资源
    ctx.set("etag", etag);
    flag = false
  }

  let fileLastModifiedTime = getFileUpdatedDate(filePath);
  if (!ifNoneMatch && ifModifiedSince === fileLastModifiedTime) {
    ctx.status = 304;
    ctx.body = "";
    flag = true
  } else {
    // 最后修改时间不一致，更新最后修改时间，返回新的资源
    ctx.set("Last-Modified", fileLastModifiedTime.toUTCString());
    flag = false
  }
  return flag
};

module.exports = {
  rewirteImport,
  ifUseCache,
};