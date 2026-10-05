# 微信小程序上线清单

## 当前代码状态

- 小程序目录：`miniprogram/`
- 当前 AppID：`touristappid`（仅开发占位）
- 当前后端：`http://localhost:8787`（仅本地开发）
- 正式上线必须替换为真实 AppID 和公网 HTTPS/WSS 服务。

## 需要产品负责人完成

1. 在微信公众平台创建/注册“小小世界”小程序。
2. 获取正式 AppID。
3. 确认主体信息、管理员、服务类目和小程序名称。
4. 把 AppID 提供给开发侧。
5. 准备一个可备案/可配置 HTTPS 的正式域名。
6. 在微信公众平台完成服务器域名配置：
   - request 合法域名
   - socket 合法域名
   - uploadFile 合法域名
   - downloadFile 合法域名
7. 按实际使用的照片、录音等能力完成隐私保护指引和相关声明。
8. 完成备案、体验版测试、提交审核和发布。

## 开发侧待完成

1. 将 `miniprogram/project.config.json` 中的 `touristappid` 替换为正式 AppID。
2. 将 `miniprogram/app.js` 中的 `serverUrl` 替换为公网 HTTPS 地址。
3. 确保 WebSocket 自动转为 WSS。
4. 真机测试：
   - 创建房间
   - 邀请码加入
   - 微信分享进入
   - 多人位置同步
   - 聊天
   - 庆祝
   - 麦克风授权
   - 录音上传与播放
   - 弱网重连
5. 再逐步迁移 DIY 人物、照片/纪念物、Outside、Memory Quest 和纪念卡。
