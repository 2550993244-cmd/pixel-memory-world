# Pixel Memory World V12 · 部署说明

这份文件只讲“怎么把它放到网上”。

如果你只是想了解项目是什么、怎么玩，请先看根目录 README.md。

---

## 你实际需要部署两部分

~~~text
1. 前端网页
   index.html / CSS / JS
   ↓
   GitHub Pages

2. 实时服务器
   server/
   ↓
   Render / Railway / 云服务器
~~~

GitHub Pages 只能放静态网页，不能运行 Node WebSocket，所以多人公网联机必须另外有一个后端。

---

## 方案 A：GitHub Pages + Render

这是目前最容易维护的方案。

### 第一步：部署前端

仓库开启 GitHub Pages 后，网页通常是：

~~~text
https://2550993244-cmd.github.io/pixel-memory-world/
~~~

每次 main 分支更新，Pages 会重新构建。

### 第二步：部署 Render 后端

在 Render 创建 Web Service。

建议配置：

~~~text
Root Directory: server
Runtime: Node
Build Command: npm install
Start Command: npm start
~~~

Node 版本要求：20 或更高。

部署成功后，你会得到类似：

~~~text
https://pixel-memory-world.onrender.com
~~~

### 第三步：检查服务器

打开：

~~~text
https://你的-render-域名/api/health
~~~

V12 正常应返回类似：

~~~json
{
  "ok": true,
  "version": "v12"
}
~~~

### 第四步：让 GitHub Pages 使用这个服务器

第一次访问网页时加：

~~~text
https://2550993244-cmd.github.io/pixel-memory-world/?server=https://你的-render-域名
~~~

网页会把服务器地址写进浏览器 localStorage。

之后再正常打开 Pages 地址，也会继续连接这个后端。

如果以后换服务器，可以重新用新的 ?server= 地址打开一次。

---

## 方案 B：服务器直接托管整个网页

server/server.js 也可以直接托管仓库根目录。

这样前端、REST、WebSocket 和上传接口都在同一个域名，配置最简单。

从仓库根目录启动：

~~~bash
cd server
npm install
npm start
~~~

然后打开：

~~~text
http://localhost:8787
~~~

如果把整个项目部署到一台可以运行 Node 的服务器，也可以直接让这个服务对公网开放。

---

## Docker

Dockerfile 在 server/ 下。

从仓库根目录构建：

~~~bash
docker build -f server/Dockerfile -t pixel-memory-world .
docker run -p 8787:8787 pixel-memory-world
~~~

---

## 怎么测试“真的联机了”

不要只在一个浏览器开两个标签页。

最好：

- 电脑 + 手机；
- 或两台电脑；
- 或让一个朋友在另一张网络下加入。

测试顺序：

1. A 创建房间。
2. B 输入相同 6 位邀请码。
3. A 移动，B 看人物是否同步。
4. B 聊天，A 是否立即看到。
5. A 放纪念物，B 是否出现。
6. A 播放音乐，B 是否同步。
7. 两边一起进入 Memory Quest。
8. A 藏一个宝藏，B 是否能发现。
9. A 录一段声音，B 是否能播放。

网页顶部出现类似：

~~~text
2 人在线 · 公网联机 · 86ms
~~~

说明当前正在走公网实时连接。

---

## Render 免费实例需要知道的事

免费实例可能会休眠。

因此第一次打开时可能会出现：

~~~text
网页已经打开
但联机状态还没马上亮
~~~

这通常是服务器正在唤醒。

另外，当前 Demo 如果把房间数据和上传文件放在实例本地磁盘：

- 重新部署；
- 实例重建；
- 云平台清理；

都有可能导致文件不再永久保留。

所以真正长期保存纪念内容时，需要把：

~~~text
房间数据 → PostgreSQL / CloudBase
照片录音 → R2 / COS / OSS / CloudBase Storage
~~~

---

## 微信小程序部署

微信小程序目录：

~~~text
miniprogram/
~~~

上线前：

1. 微信开发者工具导入 miniprogram/。
2. project.config.json 中填自己的 AppID。
3. miniprogram/app.js 中把 serverUrl 改成公网 HTTPS 地址。
4. 微信公众平台配置：
   - request 合法域名；
   - socket 合法域名。
5. 生产环境必须使用 HTTPS / WSS。

小程序当前是轻量入口，完整世界仍以网页端为主。

---

## 当前服务器接口

主要接口：

~~~text
GET  /api/health
POST /api/rooms
GET  /api/rooms/:code
PUT  /api/rooms/:code
POST /api/rooms/:code/ops
POST /api/uploads
WS    /ws?room=...&channel=...&player=...
~~~

网页和微信小程序共用这一套后端。

---

## 正式上线前还要补什么

当前后端适合 Demo 和小规模测试。

正式产品至少建议继续做：

- 数据库持久化；
- 对象存储；
- 房主权限；
- 房间锁定 / 删除；
- 上传文件类型与大小校验；
- 内容删除机制；
- 用户身份；
- 限流；
- 多实例 WebSocket 广播；
- 隐私和数据保留策略。

这些属于产品上线阶段，不需要为了当前像素世界视觉迭代提前全部做完。
