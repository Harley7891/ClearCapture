# ClearCapture · 澄录

一个为创作者制作的开源本地录制工作台。首版面向 Windows 10/11 x64，GPL-3.0-only。所有媒体保存在你的电脑上，不需要账号。

**v0.1.0 预览版** · [下载 Windows 程序与对应源码](https://github.com/Harley7891/ClearCapture/releases/tag/v0.1.0) · [English](README.en.md) · [反馈问题](https://github.com/Harley7891/ClearCapture/issues)

## 使用

双击发行包中的 `ClearCapture.exe`（免安装目录版），或单文件便携版。选择右上角的屏幕/窗口来源，添加摄像头、文字或图片，调整布局后点击录制。点击暂停可暂时停止写入，继续后接着录；停止后会在本地库中显示已保存文件。

默认录制目录：系统“视频”文件夹下的 `ClearCapture`。默认快捷键：Ctrl+Shift+R 开始/停止，Ctrl+Shift+P 暂停/继续。快捷键冲突会提示，可在设置中修改或清空。

## 首版功能

- 屏幕或窗口选择、真实画面预览；Windows 系统声音与麦克风混合录制，分别调整音量并查看电平。
- 多场景切换、复制与重命名，屏幕、摄像头、PNG/JPEG/WebP/GIF 图片、文字图层；位置、尺寸、透明度、可见性、层级、适配与镜像。
- 开始、倒计时、暂停、继续、停止，时长/大小自动停止，开始后最小化，关闭时保存保护。
- 中文、English、日本語、Deutsch、Español；深色/浅色界面。
- 视频分辨率、15/24/30/60 FPS、VP8/VP9 编码、码率、背景与切换动画；音频采样率/码率、设备、降噪、回声消除和自动增益；文件夹、前缀、格式与快捷键。
- 场景 JSON 导入/导出、设置自动保存、本地文件打开与定位。
- WebM 原生输出；安装 FFmpeg 后支持 MP4 (H.264/AAC)，并为 WebM 补全时长/拖动索引。转换失败保留原始 WebM。

摄像头和麦克风只在明确启用或点击录制时打开。系统音频捕获的是 Windows 当前系统输出，不是所选窗口的独立音轨。建议用耳机避免扬声器声音再次被麦克风收录。图片的 GIF 当前作为静态图片绘入画布。

## FFmpeg 与 MP4

WebM 可以独立录制。MP4 需要单独安装 FFmpeg：如果 `ffmpeg.exe` 已在 PATH 中，程序自动检测；否则在“设置 → 输出”中选择它。程序不会自动下载 FFmpeg。更换 FFmpeg 后再次保存设置即可刷新检测。MP4 的 WebM 原始文件会一并保留，便于恢复。

## 开发

需要 Node.js 22+、npm 和 Windows x64。已验证环境为 Node 24.19.0 / Electron 44.7.0。

```powershell
npm install
npm run setup
npm start
npm test
npm run check
npm run test:e2e
npm run package
npm run release
```

`setup` 只安装项目依赖的 Electron 运行时。`package` 生成免安装目录版；`release` 生成单文件便携版。集成测试需要系统 FFmpeg/FFprobe，会创建本项目下的专用测试窗口与 artifacts 文件夹；不录制其他个人窗口。测试的屏幕采集与系统音频是真实路径，摄像头/麦克风采用测试中注入的合成设备，不能证明物理硬件品质。

## 当前边界

这是 0.1 首版，采用 Canvas + Chromium MediaRecorder。各场景共享一个屏幕/窗口来源和一个摄像头来源。没有直播推流、OBS 插件、专业采集卡、独立多音轨、硬件编码选择或 Linux/macOS 发行包。窗口/屏幕兼容性、物理设备质量、长时间录制和 4K/60 性能仍需扩大测试。帧率设置为目标值，实际表现取决于机器负载。鼠标指针开关取决于采集后端；窗口捕获的后端可能不支持隐藏指针。

发行包尚未代码签名，Windows 可能显示未知发布者。v0.1.0 作为预览版发布，欢迎试用和贡献。已完成的验证及未验证项见 [验证记录](docs/VERIFICATION.md)。

## 贡献与许可

见 [CONTRIBUTING.md](CONTRIBUTING.md)、[SECURITY.md](SECURITY.md)、[LICENSE](LICENSE) 和 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。英文说明见 [README.en.md](README.en.md)。
