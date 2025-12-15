// import-to-kv.js
const fs = require('fs-extra');
const path = require('path');
// 确保使用 require 导入 node-fetch 以兼容 CommonJS
const fetch = require('node-fetch');

// 不需要 dotenv，因为环境变量 CLOUDFLARE_API_TOKEN 等由 GitHub Actions 直接注入

// 从index.js读取配置（这是一个有风险的操作，但先保留）
const indexContent = fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8');
const cacheTokenMatch = indexContent.match(/"cacheToken":"(.*?)"/);
const cacheZoneIdMatch = indexContent.match(/"cacheZoneId":"(.*?)"/);
const cacheToken = cacheTokenMatch ? cacheTokenMatch[1] : '';
const cacheZoneId = cacheZoneIdMatch ? cacheZoneIdMatch[1] : '';

// 从环境变量获取配置
const CONFIG = {
  // 从环境变量中获取
  CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
  CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
  // CLOUDFLARE_ZONE_ID 在 KV 导入中不是必须的，但如果被用作缓存清除则保留
  CLOUDFLARE_ZONE_ID: process.env.CLOUDFLARE_ZONE_ID,

  // 从 index.js 解析获取
  CACHE_TOKEN: cacheToken,
  CACHE_ZONE_ID: cacheZoneId,

  KV_NAMESPACE_ID: '70b1ff9d867a46f2a5bf77f93c51169e',
  WORKER_NAME: 'cloudflare-workers-blog',
  IMPORT_FILE: path.join(__dirname, '../content/output/import-data.json')
};

// 验证配置
function validateConfig() {
  // 仅验证 KV 导入必需的环境变量
  const required = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'];
  const missing = required.filter(key => !CONFIG[key]);

  if (missing.length > 0) {
    console.error(`缺少必要的环境变量，无法执行 KV 导入: ${missing.join(', ')}`);
    // 强制退出以失败 CI 流程
    process.exit(1);
  }
}

// 上传数据到KV
async function uploadToKV(key, value) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CONFIG.CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CONFIG.KV_NAMESPACE_ID}/values/${key}`;

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${CONFIG.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      // 避免 JSON.stringify 两次
      body: typeof value === 'string' ? value : JSON.stringify(value)
    });

    // 务必检查 HTTP 状态码，如果不是 2xx，则响应 JSON 可能是错误信息
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`上传 ${key} 失败: HTTP Status ${response.status}`, errorText);
      return false;
    }

    // Cloudflare API 响应体可能是空的，检查 success 字段更安全
    const data = await response.json().catch(() => ({ success: true }));

    if (!data.success) {
      console.error(`上传 ${key} 失败:`, data.errors || "未知API错误");
      return false;
    }

    console.log(`✅ 成功上传: ${key}`);
    return true;
  } catch (error) {
    console.error(`上传 ${key} 出错:`, error.message);
    return false;
  }
}

// 清除缓存 (注意: 这个步骤需要 Zone ID 和一个专门的 API Token)
async function purgeCache() {
  const cacheToken = CONFIG.CACHE_TOKEN;
  const cacheZoneId = CONFIG.CACHE_ZONE_ID;

  if (!cacheToken || !cacheZoneId) {
    console.log('跳过缓存清除: 未找到有效的缓存Token或区域ID');
    return;
  }

  // 注意：这个 Token (CACHE_TOKEN) 必须拥有 Zone 级的清除缓存权限
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
    // 在 CI/CD 流程中，如果文件不存在，可能是前面的 convert 步骤失败了
    process.exit(1);
  }

  const importData = await fs.readJSON(CONFIG.IMPORT_FILE);
  const keys = Object.keys(importData);

  console.log(`共导入 ${keys.length} 个键值对`);

  // 上传数据
  let successCount = 0;
  for (const key of keys) {
    // 增加日志显示正在导入哪个键
    console.log(`正在导入键: ${key}`);
    const value = importData[key];
    const success = await uploadToKV(key, value);
    if (success) successCount++;

    // 避免API限流 (保留)
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