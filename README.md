## 介绍

一个使用 Cloudflare Pages 创建的 URL 缩短器

*Demo* : [https://d.131213.xyz/](https://d.131213.xyz/)



### 利用Cloudflare pages部署


1. fork本项目
2. 登录到[Cloudflare](https://dash.cloudflare.com/)控制台.
3. 在帐户主页中，选择`pages`> ` Create a project` > `Connect to Git`
4. 选择你创建的项目存储库，在`Set up builds and deployments`部分中，全部默认即可。
5. 点击`Save and Deploy`，稍等片刻，你的网站就部署好了。
6. 创建D1数据库参考[这里](https://github.com/x-dr/telegraph-Image/blob/main/docs/manage.md)
7. **执行sql命令创建表**
   进入您创建的 D1 数据库的 **Console** (控制台)。
   **注意：** Cloudflare 的网页控制台一次只能执行一条 SQL 语句。请将以下命令**分两次**复制并执行。

   **第一步：创建 `links` 表**
   ```sql
   CREATE TABLE IF NOT EXISTS links (
     `id` integer PRIMARY KEY NOT NULL,
     `url` text,
     `slug` text,
     `ua` text,
     `ip` text,
     `status` int,
     `create_time` DATE
   );
   ```

   **第二步：创建 `logs` 表**
   ```sql
   CREATE TABLE IF NOT EXISTS logs (
     `id` integer PRIMARY KEY NOT NULL,
     `url` text ,
     `slug` text,
     `referer` text,
     `ua` text ,
     `ip` text ,
     `create_time` DATE
   );
   ```
8. 选择部署完成short项目，前往后台依次点击`设置`->`函数`->`D1 数据库绑定`->`编辑绑定`->变量名称填写：`DB` 命名空间 `选择你提前创建好的D1` 数据库绑定

9. 重新部署项目，完成。


### 本地开发

1. 安装依赖

```bash
npm install
```

2. 初始化数据库

```bash
npm run d1
```

3. 启动项目

```bash
npm run dev
```


### API

#### 短链生成

```bash
# POST /create
curl -X POST -H "Content-Type: application/json" -d '{"url":"https://131213.xyz"}' https://d.131213.xyz/create

# 指定slug
curl -X POST -H "Content-Type: application/json" -d '{"url":"https://131213.xyz","slug":"scxs"}' https://d.131213.xyz/create

```



> response:

```json
{
  "slug": "<slug>",
  "link": "http://d.131213.xyz/<slug>"
}
```
