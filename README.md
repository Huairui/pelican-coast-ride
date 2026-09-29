# 鹈鹕海岸骑行 · Pelican Coast Ride

戴头盔墨镜、脖系红围巾的鹈鹕，在海岸公路上骑车抓鱼。

## 操作
- **W / S** 加减速
- **A / D** 变道抓鱼
- **Space** 跳跃
- **T** 展翅抬前轮
- **C** 切换镜头（追尾 / 侧拍 / 电影 / 鹈鹕视角 / 俯瞰）
- **E** 成就墙
- **M** 静音

## 特性
- 布料物理红围巾（Verlet）
- 黄昏 → 星夜昼夜循环
- Gerstner 海浪 + 岸边碎浪
- 14 个成就
- Web Audio 程序化音效/配乐（BPM 跟踏频）
- 触屏按钮 + 帧率自适应画质
- 空闲自动驾驶追鱼

## 本地运行
```bash
python3 -m http.server 8765
# 打开 http://localhost:8765
```

技术栈：three.js r170（本地 vendor，可离线）
