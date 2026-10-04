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

#### V15 持久磁盘配置（推荐）

如果部署平台提供 Persistent Disk / Volume，把两个环境变量指向挂载目录：

~~~text
PIXEL_DATA_DIR=/var/data/pixel-memory/data
PIXEL_UPLOAD_DIR=/var/data/pixel-memory/uploads
~~~

服务器会把房间 JSON 和上传文件写到这两个目录；JSON 使用“临时文件 → rename”的原子替换方式，降低进程异常时写坏主数据文件的风险。若不配置这两个变量，仍回退到 `server/data` 与 `server/uploads`，适合本地开发但不建议作为长期线上保存方案。

V15.1 又增加了供应商适配层。当前有效值仍只有 `file`：

~~~text
PIXEL_ROOM_STORE=file
PIXEL_BLOB_STORE=file
~~~

未来切数据库或对象存储时，保持网页端 API 不变，只替换后端 adapter。不要在尚未确定供应商前把 Supabase / PostgreSQL / S3 / R2 的 SDK 直接写进房间业务逻辑。

部署成功后，你会得到类似：

~~~text
https://pixel-memory-world.onrender.com
~~~

### 第三步：检查服务器

打开：

~~~text
https://你的-render-域名/api/health
~~~

V15.12 正常应返回类似：

~~~json
{
  "ok": true,
  "version": "v15.12"
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
POST /api/rooms/:code/claim
PUT  /api/rooms/:code/layout    # 需要 X-Room-Owner
GET  /api/rooms/:code/revisions # 需要 X-Room-Owner
POST /api/rooms/:code/revisions/:id/restore # 需要 X-Room-Owner
POST /api/uploads
WS    /ws?room=...&channel=...&player=...
~~~

网页和微信小程序共用这一套后端。

---

## 正式上线前还要补什么

当前后端适合 Demo 和小规模测试。

正式产品至少建议继续做：

- 将 V15 的持久盘 JSON 适配层切换到正式数据库；
- 将 V15 的本地上传目录切换到对象存储；
- 将 V15 的房主令牌升级为完整用户身份 / 登录体系；
- 房间锁定 / 删除；
- 上传文件类型与大小校验；
- 内容删除机制；
- 用户身份；
- 限流；
- 多实例 WebSocket 广播；
- 隐私和数据保留策略。

这些属于产品上线阶段，不需要为了当前像素世界视觉迭代提前全部做完。


---

## 自定义域名

如果不希望网址显示默认的 GitHub 用户名前缀，例如：

~~~text
https://USERNAME.github.io/pixel-memory-world/
~~~

可以给 GitHub Pages 绑定自己拥有的域名，例如：

~~~text
https://memory.example.com
~~~

在仓库中打开：

~~~text
Settings → Pages → Custom domain
~~~

填入自己的域名并保存，然后在域名服务商处配置 DNS。

如果使用子域名（例如 `memory.example.com`），通常配置 CNAME 指向：

~~~text
USERNAME.github.io
~~~

如果使用根域名（例如 `example.com`），按 GitHub Pages 当前文档配置 A / AAAA 或 ALIAS / ANAME 记录。

域名生效后建议开启 **Enforce HTTPS**。

如果只是想让默认的 `USERNAME.github.io` 本身变得好看，也可以修改 GitHub 用户名，但这会同时影响 GitHub 账号地址和仓库 remote，通常不建议仅为了网站网址这么做。


### V15.5 房间归档与删除

- 默认归档恢复期：**30 天**
- 归档房间：普通 GET 返回 `410 room_archived`
- 归档期间写入：返回 `423 room_archived`
- 到期清理：服务端每小时执行一次，同时请求入口也会检查过期归档
- 永久删除：需要房主 token + 完整房间码确认 + `DELETE_FOREVER` acknowledge
- 永久删除会调用 blob adapter 清理与房间关联的上传资源

如果后续把 file blob adapter 换成 S3 / R2，新的 adapter 必须实现与当前 `removeMany(keys)` 等价的删除语义，否则永久删除不能算完整实现。


### V15.6 秘密邀请凭证

新创建房间默认启用高熵 invite token。浏览器端通过：

~~~text
X-Room-Invite: <invite-token>
~~~

访问受保护房间。WebSocket 使用同一个 token 作为 `invite` 查询参数。普通请求缺少或提供错误 token 时，不应通过 GET 响应确认短门牌号对应的房间是否存在。

邀请 token 在服务器只保存 SHA-256 hash；原始 token 只在创建 / 轮换响应中返回一次并保存在获得授权的浏览器。房主可通过 `POST /api/rooms/:code/invite/contributor/rotate` / `POST /api/rooms/:code/invite/viewer/rotate` 更换 token，旧 token 随即失效。

生产代理 / 日志配置应避免记录完整 WebSocket query string 或分享 URL 中的 `invite` 参数。


### V15.7 双邀请角色

房间现在可以同时验证两种 `X-Room-Invite`：

- contributor token：读 + 写；
- viewer token：只读 / 探索。

创建房间的响应会一次性返回 `inviteToken` 与 `viewInviteToken`。服务器只保存两者的 SHA-256 hash。

轮换接口：

~~~text
POST /api/rooms/:code/invite/contributor/rotate
POST /api/rooms/:code/invite/viewer/rotate
~~~

都要求 `X-Room-Owner`。两种 token 独立轮换，服务端只断开对应角色的 WebSocket 会话。

Viewer 对 `POST /ops`、`PUT /api/rooms/:code` 与房间作用域上传应收到：

~~~json
{"error":"view_only"}
~~~

Viewer WebSocket 只接受 presence / movement 类消息。生产多实例广播实现也必须保留这个角色过滤，不能只在单机 Node 进程里实现。


### V15.8 隐形 viewer presence

Viewer WebSocket 仍保持订阅，用来接收房间 / Outside 的实时变化，但除 ping 外的 viewer 上行实时消息全部由服务器丢弃。不要在反向代理或多实例广播层重新转发 viewer 的 presence / movement 消息。

服务器根据同一房间内 `role=viewer` 的连接，按 `player id` 去重计算匿名观看人数，并只向非 viewer WebSocket 发送：

~~~json
{"type":"viewer-count","sender":"server","count":3}
~~~

因此一个 viewer 同时打开 Room 与 Outside 不应计为两人。未来如果切换到多实例 WebSocket，需要把这个唯一 viewer 计数迁移到共享 presence store（例如 Redis），否则每个实例只能看到自己的局部观看人数。
