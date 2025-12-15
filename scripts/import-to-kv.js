const fs = require('fs-extra');
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config(); // 加载.env文件

// 从index.js读取配置
const indexContent = fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8');
const cacheTokenMatch = indexContent.match(/"cacheToken":"(.*?)"/);
const cacheZoneIdMatch = indexContent.match(/"cacheZoneId":"(.*?)"/);
const cacheToken = cacheTokenMatch ? cacheTokenMatch[1] : '';
const cacheZoneId = cacheZoneIdMatch ? cacheZoneIdMatch[1] : '';

// 从环境变量获取配置
const CONFIG = {
  CF_API_TOKEN: process.env.CF_API_TOKEN,
  CF_ACCOUNT_ID: process.env.CF_ACCOUNT_ID,
  CF_ZONE_ID: process.env.CF_ZONE_ID,
  CACHE_TOKEN: cacheToken,
  CACHE_ZONE_ID: cacheZoneId,
  KV_NAMESPACE_ID: 'da4233e8fee74d0caa1a3088d5afe20e',
  WORKER_NAME: 'cloudflare-workers-blog',
  IMPORT_FILE: path.join(__dirname, '../content/output/import-data.json')
};

// 验证配置
function validateConfig() {
  const required = ['CF_API_TOKEN', 'CF_ACCOUNT_ID', 'CF_ZONE_ID'];
  const missing = required.filter(key => !CONFIG[key]);
  
  if (missing.length > 0) {
    console.error(`缺少必要的环境变量: ${missing.join(', ')}`);
    process.exit(1);
  }
}

// 上传数据到KV
async function uploadToKV(key, value) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CONFIG.CF_ACCOUNT_ID}/storage/kv/namespaces/${CONFIG.KV_NAMESPACE_ID}/values/${key}`;
  
  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${CONFIG.CF_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: typeof value === 'string' ? value : JSON.stringify(value)
    });
    
    const data = await response.json();
    if (!data.success) {
      console.error(`上传 ${key} 失败:`, data.errors);
      return false;
    }
    
    console.log(`✅ 成功上传: ${key}`);
    return true;
  } catch (error) {
    console.error(`上传 ${key} 出错:`, error.message);
    return false;
  }
}

// 清除缓存
async function purgeCache() {
  // 使用index.js中的专用缓存Token
  const cacheToken = CONFIG.CACHE_TOKEN;
  const cacheZoneId = CONFIG.CACHE_ZONE_ID;
  
  if (!cacheToken || !cacheZoneId) {
    console.log('跳过缓存清除: 未找到有效的缓存Token或区域ID');
    return;
  }
  
  const url = `https://api.cloudflare.com/client/v4/zones/${cacheZoneId}/purge_cache`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cacheToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ purge_everything: true })
    });
    
    const data = await response.json();
    if (data.success) {
      console.log('✅ 缓存已清除');
    } else {
      console.error('清除缓存失败:', data.errors);
    }
  } catch (error) {
    console.error('清除缓存出错:', error.message);
  }
}

// 主函数
async function main() {
  console.log('开始导入数据到 Cloudflare KV...');
  
  // 验证配置
  validateConfig();
  
  // 读取导入文件
  if (!fs.existsSync(CONFIG.IMPORT_FILE)) {
    console.error(`导入文件不存在: ${CONFIG.IMPORT_FILE}`);
    process.exit(1);
  }
  
  const importData = await fs.readJSON(CONFIG.IMPORT_FILE);
  const keys = Object.keys(importData);
  
  console.log(`共导入 ${keys.length} 个键值对`);
  
  // 上传数据
  let successCount = 0;
  for (const key of keys) {
    const value = importData[key];
    const success = await uploadToKV(key, value);
    if (success) successCount++;
    
    // 避免API限流
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`\n导入完成: ${successCount}/${keys.length} 个键值对上传成功`);
  
  // 清除缓存
  await purgeCache();
}

// 执行
main().catch(error => {
  console.error('导入失败:', error.message);
  process.exit(1);
});
