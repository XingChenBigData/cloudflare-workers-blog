> 这是一个运行在cloudflare workers 上的博客程序,使用 cloudflare KV作为数据库,无其他依赖.
兼容静态博客的速度,以及动态博客的灵活性,方便搭建不折腾.很稳定
演示地址: [https://blog.gezhong.vip](https://blog.gezhong.vip "cf-blog演示站点")

### TG 讨论群: [@CloudflareBlog](https://t.me/cloudflareblog "")
# 主要特点
* 使用workers提供的KV作为数据库
* 使用cloudflare缓存html来降低KV的读写
* 所有html页面均为缓存,可达到静态博客的速度
* 使用KV作为数据库,可达到wordpress的灵活性
* 后台使用markdown语法,方便快捷
* 一键发布(页面重构+缓存清理)
* 支持本地Markdown备份和管理
* 支持GitHub Push自动发布功能

# 承载能力
 * KV基本不存在瓶颈,因为使用了缓存,读写很少
 * 唯一瓶颈是 workers的日访问量10w,大约能承受2万IP /日
 * 文章数:1G存储空间,几万篇问题不大

# 部署步骤
  这里没有实时预览真难受,一系列坑会慢慢填到博客,敬请关注 [https://blog.gezhong.vip](https://blog.gezhong.vip "")

# 本地Markdown管理与自动发布

## 功能说明
本项目支持本地Markdown文件管理和通过GitHub Push自动发布到Cloudflare Workers博客的功能。

## 目录结构
```
cloudflare-workers-blog/
├── content/
│   └── articles/          # 存放Markdown文章文件
├── scripts/
│   ├── convert-md-to-json.js   # Markdown转JSON转换脚本
│   └── import-to-kv.js         # KV导入脚本
├── config/
│   └── config.example.json     # 配置文件示例
├── .github/
│   └── workflows/
│       ├── deploy.yml     # GitHub Action自动部署配置
│       └── .env.example   # 环境变量示例
└── package.json           # npm脚本配置
```

## 本地Markdown写作

### 1. Markdown文件格式
在 `content/articles/` 目录下创建Markdown文件，支持以下front-matter格式：

```markdown
---
title: "文章标题"
date: "2023-12-15"
category: "技术"
tags: "Cloudflare, Workers, Markdown"
img: "https://example.com/cover.jpg"
---

这里是文章内容，可以使用标准Markdown语法。
```

### 2. 本地转换测试

```bash
# 安装依赖
npm install

# 转换Markdown为JSON
npm run convert
```

转换后会在 `content/output/` 目录生成JSON文件，包含文章数据和索引。

## 自动发布配置

### 1. GitHub仓库设置

1. Fork或创建GitHub仓库
2. 将本地代码推送到GitHub仓库

### 2. Cloudflare API密钥设置

1. **进入仓库设置**：打开您的GitHub仓库页面，点击顶部的 `Settings` 标签
2. **选择Secrets and variables**：在左侧菜单栏中找到 `Secrets and variables` 选项并展开
3. **选择Actions**：点击 `Actions` 子选项
4. **添加环境变量**：点击 `New repository secret` 按钮，依次添加以下环境变量：



**注意**：这些设置是在**仓库的设置页面**中进行的，而不是GitHub的个人设置页面。

### 如何获取Cloudflare配置信息

#### 1. 获取Cloudflare API令牌 (CLOUDFLARE_API_TOKEN)

1. 登录Cloudflare控制台：https://dash.cloudflare.com/
2. 点击右上角的头像，选择 `My Profile`
3. 在左侧菜单中选择 `API Tokens`
4. 点击 `Create Token` 按钮
5. 选择 `Use template` 下的 `Edit Cloudflare Workers` 模板
6. 在权限设置中，确保已选择：
   - Account > Workers Scripts > Edit
   - Account > KV Storage > Edit
   - Zone > Cache Purge > Purge
   - Zone > Workers Routes > Edit
7. 点击 `Continue to summary`，然后点击 `Create Token`
8. 复制生成的API令牌，这就是 `CLOUDFLARE_API_TOKEN`

#### 2. 获取Cloudflare账户ID (CLOUDFLARE_ACCOUNT_ID)

1. 登录Cloudflare控制台
2. 点击右上角的头像，选择 `My Profile`
3. 在左侧菜单中选择 `Account`
4. 您将在页面顶部看到 `Account ID`，复制它作为 `CLOUDFLARE_ACCOUNT_ID`

#### 3. 获取Cloudflare区域ID (CLOUDFLARE_ZONE_ID)

1. 登录Cloudflare控制台
2. 选择您的网站域名
3. 点击右侧边栏中的 `Overview`
4. 滚动到页面底部，在 `API` 部分找到 `Zone ID`
5. 复制它作为 `CLOUDFLARE_ZONE_ID`

### 3. 自动发布流程

1. 在本地编辑Markdown文件
2. 提交并推送到GitHub仓库的 `main` 分支
3. GitHub Action自动触发：
   - 安装依赖
   - 转换Markdown为JSON
   - 部署Workers
   - 导入文章数据到Cloudflare KV
   - 清除Cloudflare缓存

## 手动发布（可选）

```bash
# 手动导入到KV
npm run import
```

需要确保环境变量已正确设置。

## 注意事项

1. 确保Cloudflare API令牌具有足够的权限（Workers、KV、缓存清除）
2. Markdown文件必须包含 `title` 和 `date` 必填字段
3. 图片链接建议使用外部CDN或Cloudflare Images
4. 避免在文章中使用过大的文件，影响加载速度
5. 定期备份 `content/articles/` 目录，确保文章安全

# 更新日志

> [持续更新地址https://blog.gezhong.vip/article/009000/update-log.html](https://blog.gezhong.vip/article/009000/update-log.html "更新日志")
  
## 最近更新(2020-12-31)
* 2020-12-31:加入sitemap.xml
* 2020-12-24:本次更新,主要针对seo和阅读次数,以及多项细节优化




### 前端演示:[https://blog.gezhong.vip](https://blog.gezhong.vip "演示站点")
![](https://s3.ax1x.com/2020/12/22/rrP81S.png)

### 后端演示:
![](https://s3.ax1x.com/2020/12/22/rrAWrD.png)
 
