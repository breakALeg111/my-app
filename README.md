# 日常助手 · 日志 / 倒数日 / 保养

零依赖的移动端 Web App（PWA），三个功能：每日工作日志、倒数日/正数日、车辆保养提醒。
数据全部保存在手机本地浏览器（localStorage），不上传服务器。

## 本地运行

- **最简单**：双击 `index.html`（除离线安装外所有功能可用）。
- **手机真机预览**：在项目目录执行 `python -m http.server 8000`，手机连同一 WiFi 访问 `http://电脑IP:8000`。

## 功能说明

### 1. 工作日志
- 顶部为日历式日期控件：左侧圆形 `‹ ›` 逐日翻页，中间显示 `周五 · 今天` 与 `10月9日 2026 年`（点击唤起系统日期选择器，支持 `showPicker`），右侧「今天」快捷回到当天。
- 切换到某一天时，输入框会**自动带入当天已保存的日志**，可在此基础上修改。
- 输入后自动保存（约 0.9 秒），也可点「保存」立即落盘；「删除本日」移除当天记录。
- 历史日志默认**按月份看当月**，可切换**按季度**或**全部**；用 `‹ ›` 翻到上个月/上个季度，列表按月份分组显示每月条数，同时支持关键词搜索，点击任意一条跳到该日期继续编辑。
- 导入导出都用**纯文本**，不落文件：选好年份 + 季度点「导出本季度」，或点「导出全部」，会弹出只读文本框与「复制全部文本」按钮，复制后可直接发到微信/备忘录；点「文本导入」粘贴同样格式的文本即可导入（可选「合并」或「仅补充缺失日期」）。
- 文本格式：

  ```
  工作日志导出 - 全部记录
  导出时间: 2026/9/16 08:54:32
  共 2 条记录
  ==================================================

  【2026-09-03】
  上线交割智慧监管平台仿真环境
  ------------------------------

  【2026-09-02】
  配置交割智慧监管平台仿真环境的程序监控与自监控
  ------------------------------
  ```

  解析时按 `【日期】` 分块，日期支持 `2026-09-03`、`2026/9/3`、`2026年9月3日` 等写法，内容到分隔线为止（支持多行）。

### 2. 倒数日 / 正数日
- 添加任意日期的事项：日期在未来显示「还有 N 天」（倒数），在过去显示「已过 N 天」（正数），当天显示「就是今天」。
- 顶部可筛选 **全部 / 未来 / 已过**；未来事项用**绿色**（含当天），已过事项用**红色**，卡片左边框同色，筛选状态会记住。
- 排序完全自定义：按住右侧 `⠿` 上下拖动，或用 `↑` `↓` 微调，顺序会保存下来。

### 3. 保养提醒
- 录入**当前里程**，随时可更新。
- 每个保养项目录入：名称、保养周期（公里 + 时间，时间可选「个月 / 天」）、上次保养里程与日期。
- 下次保养点 = 上次里程 + 周期公里，或 上次日期 + 周期时间，**两者先到为准**。
- 颜色分级：
  - 绿色 **安全**：剩余里程 > 1000 km 且剩余天数 > 30 天
  - 黄色 **临近**：剩余里程 ≤ 1000 km 或 剩余天数 ≤ 30 天
  - 红色 **超期**：剩余里程 ≤ 0 或 剩余天数 ≤ 0
- 保养完成后点「已保养」，基准自动重置为当前里程和今天，周期重新开始计算。
- 进度条取「公里消耗比例」与「时间消耗比例」中较大的一个。

## 部署到 GitHub Pages

1. 在 GitHub 新建仓库（例如 `daily-hub`），把本目录所有文件推上去：

   ```bash
   git init
   git add .
   git commit -m "init"
   git branch -M main
   git remote add origin https://github.com/<你的用户名>/daily-hub.git
   git push -u origin main
   ```

2. 打开仓库 **Settings → Pages**，Source 选择 `Deploy from a branch`，Branch 选 `main`、目录选 `/ (root)`，点 Save。

3. 等待 1～2 分钟，访问 `https://<你的用户名>.github.io/daily-hub/`。

4. 手机浏览器打开该地址 → 「添加到主屏幕」，即可作为 App 全屏、离线使用。

> 仓库里的 `.nojekyll` 必须保留，否则 GitHub Pages 会用 Jekyll 处理静态文件。
> 所有资源都使用相对路径，因此部署到子路径（如 `/daily-hub/`）也能正常工作。

### 更新版本
改动后重新 push，GitHub Pages 会自动更新。若手机上看不到变化，下拉刷新一次（Service Worker 缓存名为 `dailyhub-v1`，大版本改动可手动调大该版本号）。

## 打包成 APK（安装到手机）

前提：先按上一节部署到 GitHub Pages，**必须是 HTTPS**，否则打包工具无法通过校验。

### 方式一：PWABuilder（几乎不需要本地环境）
1. 打开 <https://www.pwabuilder.com>，填入你的 Pages 地址，点 Start
2. 检查评分：`manifest`、`Service Worker`、`图标` 三项应全部通过
3. 右上角 **Package for stores** → **Android**
4. 按向导填写：
   - Package ID：`com.你的名字.dailyhub`（全小写，之后不能改）
   - 应用名 / 版本：随意
   - 签名：没有 keystore 就选让 PWABuilder 新建，**务必保存生成的 keystore 文件**，以后更新必须用同一签名，否则手机上无法覆盖安装
5. 生成并下载 APK（若它给的是 Gradle 工程，用 Android Studio 打开 → Build → Build Bundle(s)/APK → Build APK）
6. 手机开启「允许来自未知来源的应用」后安装

### 方式二：Bubblewrap 命令行（可控性最好）
需要本机 Node 18+ 与 JDK 17，首次运行会引导下载 Android SDK：
```bash
npx @bubblewrap/cli init --manifest https://<用户名>.github.io/<仓库>/manifest.json
npx @bubblewrap/cli build
```
按提示填包名与签名，产出 `app-release-signed.apk`。

### 注意事项
- **数据不互通**：APK 内的数据仍存在手机本地，与网页版各自独立；换机请用「完整备份」或网盘同步
- **不会自动更新**：改了代码要重新打包安装；想随时生效就用 PWA（添加到主屏幕）更省事
- **应用内安装入口**：设置页顶部有「安装到手机桌面」按钮（Chrome/Edge 支持一键安装；iOS 需 Safari 分享 → 添加到主屏幕）
- **状态栏颜色**：由 `index.html` 里的 `theme-color`（浅色/深色各一份）控制，打包后同样生效
- **返回键**：弹层打开时按返回键会先关闭弹层，不会直接退出应用

## 数据存储与备份

### 存储方式
- 数据默认保存在 **IndexedDB**（容量可达数百 MB，比 localStorage 的 ~5MB 稳得多）
- IndexedDB 不可用时（隐私模式、被禁用、打开超时 1.5 秒）**自动回退 localStorage**，应用照常运行，设置页会显示当前实际使用的存储方式
- 首次启动会自动把旧版本 localStorage 里的数据迁移到 IndexedDB，迁移成功后清除旧副本
- 内存状态即时生效，落盘异步进行；页面隐藏或关闭前会强制写入一次

### 三种备份通道
1. **日志文本导出**（日志页）：纯文本 + 复制按钮，随手发到微信/备忘录
2. **完整备份**（设置页）：下载 `backup-日期.json`，含日志 + 倒数日 + 保养；在新设备「恢复备份」时可选**合并**或**覆盖**
3. **云端同步**（设置页）：对象存储（腾讯云 COS / 阿里云 OSS）直连，可开启「每天首次打开自动备份」

### 对象存储同步（腾讯云 COS / 阿里云 OSS）——推荐

不需要代理、不需要服务端，浏览器直连，只需在存储桶上放行跨域(CORS)。官方 SDK 已内置在 `vendor/`，按需加载。

**腾讯云 COS**
1. 控制台新建存储桶（私有读写），记下 **Bucket 名称**（如 `mybackup-1250000000`）和 **地域**（如 `ap-guangzhou`）
2. 存储桶 → **安全管理 → 跨域访问 CORS** → 新增规则：
   - 来源 Origin：`https://<用户名>.github.io`（本地调试再加 `http://localhost:8000`）
   - 操作 Methods：勾选 `GET`、`PUT`、`HEAD`
   - Allow-Headers：`*`；Expose-Headers：`ETag`、`Content-Length`、`x-cos-request-id`
3. 访问管理 CAM → 新建**子用户**，只给这条策略（把 bucket 名换成你的）：

```json
{
  "version": "2.0",
  "statement": [{
    "effect": "allow",
    "action": ["cos:PutObject", "cos:GetObject", "cos:HeadObject"],
    "resource": ["qcs::cos:ap-guangzhou:uid/1250000000:mybackup-1250000000/daily-hub/backup.json"]
  }]
}
```

4. 生成该子用户的密钥，在 App「设置 → 对象存储同步」里填 SecretId / SecretKey / Bucket / Region

**阿里云 OSS**
1. 新建 Bucket，记下名称与 Endpoint（如 `oss-cn-hangzhou`）
2. Bucket → **权限管理 → 跨域设置** → 创建规则：来源填你的站点，允许 Methods `GET/PUT/HEAD`，允许 Headers `*`，暴露 Headers `ETag`、`x-oss-request-id`
3. RAM 访问控制新建**子用户**，授权策略只覆盖 `acs:oss:*:*:<bucket>/daily-hub/backup.json`，动作 `oss:PutObject`、`oss:GetObject`
4. 填入 AccessKeyId / AccessKeySecret / Bucket / Endpoint

> 备份内容为**明文 JSON**。密钥保存在本机浏览器里，请务必使用**子账号 + 单文件授权**，不要填主账号密钥。

> 备份内容目前是**明文 JSON**。
> 无论用哪种方式，都建议定期保留一份离线副本。

### 关于跨域

浏览器只放行返回了 CORS 响应头的服务。对象存储可以在控制台直接开启跨域规则，所以能直连；而多数网盘（坚果云、夸克等）不返回该头部，浏览器会拦截，**前端无法绕过**。这也是本项目只接对象存储的原因。

## 目录结构

```
index.html            页面骨架（三个视图 + 底部导航）
css/style.css         样式（浅色/深色自适应）
js/utils.js           日期、CSV、文件下载等工具
js/storage.js         IndexedDB 存储层（带 localStorage 回退与迁移）
js/store.js           数据层与保养状态计算（异步持久化）
js/ui.js              Toast、底部弹层表单、确认框
js/diary.js           工作日志模块
js/events.js          倒数日模块（含拖拽排序）
js/care.js            保养提醒模块
js/dataio.js          日志文本导入导出
js/settings.js        设置页：数据概览、备份恢复、云端同步
js/cosync.js          腾讯云 COS / 阿里云 OSS 对象存储同步
vendor/               云存储官方浏览器 SDK（按需加载，见 tools/fetch_sdks.py）
js/app.js             入口与 Tab 切换
sw.js                 Service Worker（离线缓存）
manifest.json         PWA 配置
icons/                应用图标
tools/gen_icons.py    图标生成脚本（python tools/gen_icons.py）
```
