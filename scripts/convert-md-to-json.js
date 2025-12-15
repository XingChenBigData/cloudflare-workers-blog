const fs = require('fs-extra');
const path = require('path');
const frontMatter = require('front-matter');
const marked = require('marked');
const slugify = require('slugify');

// 配置
const CONFIG = {
  articlesDir: path.join(__dirname, '../content/articles'),
  outputDir: path.join(__dirname, '../content/output'),
  pageSize: 5,
  readMoreLength: 150
};

// 创建输出目录
fs.ensureDirSync(CONFIG.outputDir);

// 解析所有Markdown文件
async function parseMarkdownFiles() {
  const files = await fs.readdir(CONFIG.articlesDir);
  const articles = [];
  const indexList = [];
  
  for (const file of files) {
    if (path.extname(file) === '.md') {
      const filePath = path.join(CONFIG.articlesDir, file);
      const content = await fs.readFile(filePath, 'utf8');
      
      try {
        // 解析front-matter和Markdown
        const { attributes, body } = frontMatter(content);
        
        // 验证必填字段
        if (!attributes.title || !attributes.date) {
          console.warn(`跳过文件 ${file}: 缺少必填字段 (title 或 date)`);
          continue;
        }
        
        // 生成文章ID（6位数字）
        const id = generateArticleId();
        
        // 生成link
        const link = slugify(attributes.title, { lower: true, strict: true });
        
        // 转换Markdown为HTML
        const contentHtml = marked(body);
        
        // 生成纯文本摘要
        const contentText = stripHtml(contentHtml).substring(0, CONFIG.readMoreLength).trim();
        
        // 准备文章数据
        const article = {
          id,
          title: attributes.title,
          img: attributes.img || '',
          link,
          createDate: attributes.date,
          category: attributes.category || '',
          tags: attributes.tags ? attributes.tags.split(',').map(tag => tag.trim()) : [],
          contentMD: body,
          contentHtml,
          contentText,
          priority: attributes.priority || '0.5',
          changefreq: attributes.changefreq || 'daily'
        };
        
        articles.push(article);
        
        // 准备索引数据
        indexList.push({
          id,
          title: attributes.title,
          img: attributes.img || '',
          link,
          createDate: attributes.date,
          category: attributes.category || '',
          tags: attributes.tags ? attributes.tags.split(',').map(tag => tag.trim()) : [],
          contentText
        });
        
        console.log(`处理完成: ${attributes.title}`);
        
      } catch (error) {
        console.error(`处理文件 ${file} 时出错:`, error.message);
      }
    }
  }
  
  // 按创建日期倒序排序
  articles.sort((a, b) => new Date(b.createDate) - new Date(a.createDate));
  indexList.sort((a, b) => new Date(b.createDate) - new Date(a.createDate));
  
  return { articles, indexList };
}

// 生成6位数字ID
function generateArticleId() {
  const id = Math.floor(100000 + Math.random() * 900000);
  return id.toString();
}

// 去除HTML标签
function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '');
}

// 保存转换结果
async function saveResults(articles, indexList) {
  // 保存文章数据
  for (const article of articles) {
    const outputPath = path.join(CONFIG.outputDir, `${article.id}.json`);
    await fs.writeJSON(outputPath, article, { spaces: 2 });
  }
  
  // 保存索引列表
  const indexPath = path.join(CONFIG.outputDir, 'SYSTEM_INDEX_LIST.json');
  await fs.writeJSON(indexPath, indexList, { spaces: 2 });
  
  // 保存系统索引数量
  const indexNumPath = path.join(CONFIG.outputDir, 'SYSTEM_INDEX_NUM.json');
  const maxId = articles.length > 0 ? Math.max(...articles.map(a => parseInt(a.id))) : 100000;
  await fs.writeJSON(indexNumPath, maxId + 1, { spaces: 2 });
  
  // 保存合并后的导入文件
  const importData = {
    SYSTEM_INDEX_LIST: indexList,
    SYSTEM_INDEX_NUM: maxId + 1
  };
  
  articles.forEach(article => {
    importData[article.id] = article;
  });
  
  const importPath = path.join(CONFIG.outputDir, 'import-data.json');
  await fs.writeJSON(importPath, importData, { spaces: 2 });
  
  console.log('\n转换完成！');
  console.log(`共处理 ${articles.length} 篇文章`);
  console.log(`输出目录: ${CONFIG.outputDir}`);
  console.log(`导入文件: ${importPath}`);
}

// 执行转换
async function main() {
  console.log('开始转换Markdown文件...');
  console.log(`文章目录: ${CONFIG.articlesDir}`);
  
  try {
    const { articles, indexList } = await parseMarkdownFiles();
    await saveResults(articles, indexList);
  } catch (error) {
    console.error('转换失败:', error.message);
    process.exit(1);
  }
}

// 运行脚本
main();
